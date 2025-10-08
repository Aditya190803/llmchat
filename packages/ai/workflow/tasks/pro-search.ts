import { createTask } from '@repo/orchestrator';
import { z } from 'zod';
import { ModelEnum } from '../../models';
import { WorkflowContextSchema, WorkflowEventSchema } from '../flow';
import {
    ChunkBuffer,
    generateObject,
    generateText,
    getHumanizedDate,
    getSERPResults,
    handleError,
    processWebPages,
    sendEvents,
} from '../utils';
import { prepareWebPageContent } from '../utils/search-helpers';

type SearchResult = {
    title: string;
    link: string;
    snippet?: string;
    content?: string;
    index?: number;
};

const getAnalysisPrompt = (question: string, webPageContent: SearchResult[]): string => {
    return `
Today is ${getHumanizedDate()}.

You are a Web Research Assistant with expertise in Indian market context, helping users quickly understand search findings related to "${question}".

## Research Materials

<research_findings>
${webPageContent
    ?.map(
        (s, index) => `

## Finding ${index + 1}

<title>${s.title || 'No title available'}</title>
<content>${s.content || 'No content available'}</content>
<link>${s.link || 'No link available'}</link>

`
    )
    .join('\n\n\n')}
</research_findings>

## Output Requirements:

1. Content Organization:
   - Organize information in a highly scannable format with clear headings and subheadings
   - Use bullet points for key facts and findings
   - Bold important data points, statistics, and conclusions
   - Group related information from different sources together
   - **Prioritize Indian context when relevant**: Include Indian regulations, market conditions, INR currency values

2. Information Hierarchy:
   - Start with the most relevant and important findings first
   - Include specific details, numbers, and technical information when available
   - **For financial data**: Convert or mention values in INR when discussing Indian markets
   - **For business topics**: Highlight Indian market dynamics, regulatory environment, startup ecosystem
   - Highlight contradictory information or different perspectives on the same topic
   - Ensure each point adds unique value without unnecessary repetition

3. Context & Relevance:
   - Maintain focus on directly answering the user's question
   - Provide enough context for each point to be understood independently
   - Include temporal information (dates, timelines) when relevant
   - **Indian Context**: When applicable, include Indian laws, RBI regulations, Digital India initiatives, GST implications
   - Summarize complex concepts in accessible language

4. Indian Market Focus (when relevant):
   - **Technology**: Consider Digital India, UPI ecosystem, Indian tech startups
   - **Finance**: Include RBI policies, Indian banking systems, NSE/BSE data in INR
   - **Business**: Highlight Indian market size, demographics, cultural factors
   - **Legal**: Focus on Indian constitution, Supreme Court judgments, parliamentary acts
   - **Economic**: Use INR figures, Indian GDP context, government initiatives

5. Visual Structure:
   - Use clear visual separation between different sections
   - Keep paragraphs short (3-4 lines maximum)
   - Include a brief "Key Takeaways" section at the beginning for ultra-quick consumption
   - End with any important context or limitations of the findings

6. Citations:
   - Based on provided references in each findings, you must cite the sources in the report.
   - Use inline citations like [1] to reference the source
   - For example: According to recent findings [1][3], progress in this area has accelerated
   - When information appears in multiple findings, cite all relevant findings using multiple numbers
   - Integrate citations naturally without disrupting reading flow

Note: **Reference list at the end is not required.**

Your goal is to help the user quickly understand and extract value from these search results without missing any important details, with special attention to Indian context when relevant.
`;
};

export const proSearchTask = createTask<WorkflowEventSchema, WorkflowContextSchema>({
    name: 'pro-search',
    execute: async ({ events, context, signal }) => {
        try {
            const question = context?.get('question');
            const { updateStatus, updateAnswer, updateStep, addSources } = sendEvents(events);
            if (!question) {
                throw new Error('No question provided for search');
            }

            // Check if web search was auto-enabled and show notification
            const autoWebSearchEnabled = context?.get('autoWebSearchEnabled');
            const autoWebSearchReason = context?.get('autoWebSearchReason');
            
            let stepOffset = 0;
            if (autoWebSearchEnabled && autoWebSearchReason) {
                // Add a notification step to inform the user
                updateStep({
                    stepId: 0,
                    stepStatus: 'COMPLETED',
                    subSteps: {
                        autoEnabled: { 
                            status: 'COMPLETED', 
                            data: {
                                message: `🔍 Web search automatically enabled: ${autoWebSearchReason}`,
                                type: 'info'
                            }
                        },
                    },
                });
                stepOffset = 1;
            }

            const messages =
                context
                    ?.get('messages')
                    ?.filter(
                        message =>
                            (message.role === 'user' || message.role === 'assistant') &&
                            !!message.content
                    ) || [];

            // Step 1: Generate search query
            let query;
            try {
                query = await generateObject({
                    prompt: `Today is ${getHumanizedDate()}.
                    ${context?.get('gl')?.country ? `You are in ${context?.get('gl')?.country}\n\n` : ''}
                    
                    Generate a query to search the web for information. Make sure query is not too broad and be specific for recent information.
                    
                    **Indian Context Guidelines**:
                    - For financial topics: Include "India" and consider INR currency, RBI regulations, GST
                    - For business topics: Focus on Indian market, startup ecosystem, regulatory environment
                    - For technology topics: Consider Digital India initiatives, UPI ecosystem, Indian tech landscape
                    - For legal topics: Include Indian laws, Supreme Court, parliamentary acts
                    - For economic topics: Focus on Indian economy, GDP in INR, market dynamics
                    
                    When the topic is relevant to India, include "India" or "Indian" in your search query to get localized results.`,
                    model: ModelEnum.GEMINI_2_5_FLASH,
                    messages,
                    schema: z.object({
                        query: z.string().min(1),
                    }),
                });
            } catch (error) {
                throw new Error(
                    `Failed to generate search query: ${error instanceof Error ? error.message : String(error)}`
                );
            }

            // Step 2: Get search results
            let searchResults: SearchResult[] = [];
            try {
                const gl = context?.get('gl');
                console.log('gl', gl);
                searchResults = await getSERPResults([query.query], gl);
                if (!searchResults || searchResults.length === 0) {
                    throw new Error('No search results found');
                }
            } catch (error) {
                throw new Error(
                    `Failed to get search results: ${error instanceof Error ? error.message : String(error)}`
                );
            }

            updateStep({
                stepId: 0 + stepOffset,
                stepStatus: 'PENDING',
                subSteps: {
                    search: { status: 'COMPLETED', data: [query.query] },
                },
            });

            const searchResultsData = searchResults.map(result => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
            }));

            updateStep({
                stepId: 0 + stepOffset,
                stepStatus: 'PENDING',
                subSteps: {
                    read: {
                        status: 'PENDING',
                        data: searchResultsData,
                    },
                },
            });

            // Step 3: Process web pages
            let webPageContent: SearchResult[] = [];
            try {
                webPageContent = await processWebPages(
                    searchResults?.reduce((acc: SearchResult[], result: SearchResult) => {
                        if (result.title && result.link) {
                            acc.push({ title: result.title, link: result.link });
                        }
                        return acc;
                    }, []),
                    signal,
                    { batchSize: 4, maxPages: 8, timeout: 30000 }
                );

                if (!webPageContent || webPageContent.length === 0) {
                    throw new Error('Failed to process web pages');
                }
            } catch (error) {
                throw new Error(
                    `Failed to process web pages: ${error instanceof Error ? error.message : String(error)}`
                );
            }

            // Update event with read status

            updateStep({
                stepId: 0 + stepOffset,
                stepStatus: 'COMPLETED',
                subSteps: {
                    read: { status: 'COMPLETED' },
                },
            });

            addSources(searchResultsData);

            let preparedWebContent = prepareWebPageContent(
                webPageContent as Array<{ title: string; link: string; content: string }>
            );

            if (!preparedWebContent.length) {
                preparedWebContent = searchResults.slice(0, 6).map(result => ({
                    title: result.title || 'Untitled Result',
                    link: result.link || '',
                    content: result.snippet || '',
                }));
            }

            const reasoningBuffer = new ChunkBuffer({
                threshold: 200,
                breakOn: ['\n\n'],
                onFlush: (chunk, fullText) => {
                    updateStep({
                        stepId: 1,
                        stepStatus: 'PENDING',
                        subSteps: {
                            reasoning: { status: 'COMPLETED', data: fullText },
                        },
                    });
                },
            });

            const chunkBuffer = new ChunkBuffer({
                threshold: 200,
                breakOn: ['\n\n'],
                onFlush: (chunk, fullText) => {
                    updateAnswer({
                        text: chunk,
                        status: 'PENDING',
                    });
                },
            });

            // Step 4: Generate analysis
            let reasoning = '';
            try {
                const { text: generatedReasoning } = await generateText({
                    prompt: getAnalysisPrompt(question, preparedWebContent),
                    model: ModelEnum.GEMINI_2_5_FLASH,
                    messages,
                    onReasoning: chunk => {
                        reasoningBuffer.add(chunk);
                    },
                    onChunk: (chunk, fullText) => {
                        chunkBuffer.add(chunk);
                    },
                });

                reasoning = generatedReasoning;

                if (!reasoning || reasoning.trim() === '') {
                    throw new Error('Failed to generate analysis');
                }
            } catch (error) {
                throw new Error(
                    `Failed to generate analysis: ${error instanceof Error ? error.message : String(error)}`
                );
            }

            reasoningBuffer.end();
            chunkBuffer.end();

            // Update flow with completed reasoning
            updateStep({
                stepId: 1,
                stepStatus: 'COMPLETED',
                subSteps: {
                    reasoning: { status: 'COMPLETED' },
                    wrapup: { status: 'COMPLETED' },
                },
            });

            // Update flow with completed answer
            updateAnswer({
                text: '',
                finalText: reasoning,
                status: 'COMPLETED',
            });

            updateStatus('COMPLETED');

            context?.update('answer', _ => reasoning);

            // Call onFinish callback if provided
            const onFinish = context?.get('onFinish');
            if (onFinish && typeof onFinish === 'function') {
                onFinish({
                    answer: reasoning,
                    threadId: context?.get('threadId'),
                    threadItemId: context?.get('threadItemId'),
                });
            }

            return {
                retry: false,
                result: 'success',
            };
        } catch (error) {
            console.error('Error in proSearchTask:', error);

            // Update flow with error status
            events?.update('error', prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                status: 'ERROR',
            }));

            return {
                retry: false,
                result: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    },
    onError: handleError,
    route: ({ context }) => {
        if (context?.get('showSuggestions') && context.get('answer')) {
            return 'suggestions';
        }
        return 'end';
    },
});
