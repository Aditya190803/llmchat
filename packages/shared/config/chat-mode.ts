export enum ChatMode {
    Auto = 'auto',
    Pro = 'pro',
    Deep = 'deep',
    GEMINI_2_5_PRO = 'gemini-pro-2.5',
    GEMINI_2_5_FLASH = 'gemini-flash-2.5',
    GLM_4_5_AIR = 'glm-4-5-air',
    DEEPSEEK_CHAT_V3_1 = 'deepseek-chat-v3-1',
    DEEPSEEK_R1 = 'deepseek-r1',
    LONGCAT_FLASH_CHAT = 'longcat-flash-chat',
    GPT_OSS_20B = 'gpt-oss-20b',
    DOLPHIN_MISTRAL_24B_VENICE = 'dolphin-mistral-24b-venice',
    DOCUMENT_QA = 'document-qa',
    IMAGE_GENERATION = 'image-generation',
}

export const ChatModeConfig: Record<
    ChatMode,
    {
        webSearch: boolean;
        imageUpload: boolean;
        retry: boolean;
        documentAnalysis?: boolean;
        nativeInternetAccess?: boolean; // Models can access internet independently of web search toggle
        isNew?: boolean;
        isAuthRequired?: boolean;
    }
> = {
    [ChatMode.Auto]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isAuthRequired: false,
    },
    [ChatMode.Deep]: {
        webSearch: false,
        imageUpload: false,
        retry: false,
        documentAnalysis: true,
        isAuthRequired: false,
    },
    [ChatMode.Pro]: {
        webSearch: false,
        imageUpload: false,
        retry: false,
        documentAnalysis: true,
        isAuthRequired: false,
    },
    [ChatMode.GEMINI_2_5_PRO]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isAuthRequired: false,
    },
    [ChatMode.GEMINI_2_5_FLASH]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isAuthRequired: false,
    },
    [ChatMode.GLM_4_5_AIR]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.DEEPSEEK_CHAT_V3_1]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.DEEPSEEK_R1]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.LONGCAT_FLASH_CHAT]: {
        webSearch: true,
        imageUpload: false,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.GPT_OSS_20B]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.DOLPHIN_MISTRAL_24B_VENICE]: {
        webSearch: true,
        imageUpload: true,
        retry: true,
        documentAnalysis: true,
        nativeInternetAccess: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.DOCUMENT_QA]: {
        webSearch: false,
        imageUpload: false,
        retry: true,
        isNew: true,
        isAuthRequired: false,
    },
    [ChatMode.IMAGE_GENERATION]: {
        webSearch: false,
        imageUpload: true,
        retry: true,
        documentAnalysis: false,
        nativeInternetAccess: false,
        isNew: true,
        isAuthRequired: false,
    },
};



export const getChatModeName = (mode: ChatMode) => {
    switch (mode) {
        case ChatMode.Auto:
            return 'Auto (Recommended)';
        case ChatMode.Deep:
            return 'Deep Research';
        case ChatMode.Pro:
            return 'Pro Search';
        case ChatMode.GEMINI_2_5_PRO:
            return 'Gemini 2.5 Pro';
        case ChatMode.GEMINI_2_5_FLASH:
            return 'Gemini 2.5 Flash';
        case ChatMode.GLM_4_5_AIR:
            return 'GLM 4.5 Air';
        case ChatMode.DEEPSEEK_CHAT_V3_1:
            return 'DeepSeek Chat v3.1';
        case ChatMode.DEEPSEEK_R1:
            return 'DeepSeek R1';
        case ChatMode.LONGCAT_FLASH_CHAT:
            return 'LongCat Flash Chat';
        case ChatMode.GPT_OSS_20B:
            return 'GPT-OSS 20B';
        case ChatMode.DOLPHIN_MISTRAL_24B_VENICE:
            return 'Dolphin Mistral 24B Venice';
        case ChatMode.DOCUMENT_QA:
            return 'Document Q&A';
        case ChatMode.IMAGE_GENERATION:
            return 'Image Generation';
    }
};

/**
 * Analyzes a query and selects the most appropriate model
 */
export const selectModelForQuery = (query: string, hasImage: boolean = false): ChatMode => {
    const lowerQuery = query.toLowerCase();
    const tokens = query.split(/\s+/);
    const length = tokens.length;

    // Image-related queries
    if (hasImage || /\b(image|photo|picture|screenshot|diagram|chart|graph|visual)\b/i.test(query)) {
        return ChatMode.GEMINI_2_5_FLASH; // Fast multimodal
    }

    // Code-heavy queries (prioritize DeepSeek for coding)
    const codeIndicators = [
        'code',
        'function',
        'class',
        'algorithm',
        'debug',
        'error',
        'bug',
        'implement',
        'refactor',
        'optimize',
        'python',
        'javascript',
        'typescript',
        'java',
        'c++',
        'rust',
        'go',
        'sql',
        'api',
        'regex',
        'git',
    ];
    const codeScore = codeIndicators.filter(word => lowerQuery.includes(word)).length;
    if (codeScore >= 2) {
        return ChatMode.DEEPSEEK_CHAT_V3_1; // Best for coding
    }

    // Math and reasoning (DeepSeek R1 for chain-of-thought)
    const mathIndicators = [
        'calculate',
        'solve',
        'equation',
        'math',
        'proof',
        'theorem',
        'reasoning',
        'logic',
        'derive',
        'compute',
        'algorithm complexity',
    ];
    const mathScore = mathIndicators.filter(word => lowerQuery.includes(word)).length;
    if (mathScore >= 2 || /\b(prove|theorem|∫|∑|∏|∂)\b/i.test(query)) {
        return ChatMode.DEEPSEEK_R1; // Chain-of-thought reasoning
    }

    // Current events / news (use models with internet access)
    const currentYear = new Date().getFullYear();
    const recentYearMentions = query.match(new RegExp(`\\b(${currentYear}|${currentYear - 1}|202[0-9])\\b`, 'g'));
    const newsIndicators = [
        'news',
        'latest',
        'recent',
        'today',
        'yesterday',
        'current',
        'breaking',
        'trending',
    ];
    const newsScore = newsIndicators.filter(word => lowerQuery.includes(word)).length;

    if (recentYearMentions || newsScore >= 2) {
    return ChatMode.LONGCAT_FLASH_CHAT; // Fast with internet access
    }

    // Research-intensive queries (long, complex questions)
    if (length > 50 || /\b(research|analyze|compare|comprehensive|detailed|explain)\b/i.test(query)) {
        return ChatMode.GEMINI_2_5_PRO; // Best for deep research
    }

    // Creative writing
    const creativeIndicators = [
        'write',
        'story',
        'poem',
        'creative',
        'fiction',
        'essay',
        'article',
        'blog',
        'script',
        'dialogue',
        'character',
    ];
    const creativeScore = creativeIndicators.filter(word => lowerQuery.includes(word)).length;
    if (creativeScore >= 2) {
        return ChatMode.GLM_4_5_AIR; // Good for creative tasks
    }

    // Translation queries
    if (/\b(translate|translation|language)\b/i.test(query) && length < 30) {
        return ChatMode.GEMINI_2_5_FLASH; // Fast multilingual
    }

    // Default: Fast, balanced model for general queries
    // Short queries (< 20 tokens) get Flash for speed
    if (length < 20) {
        return ChatMode.GEMINI_2_5_FLASH;
    }

    // Medium queries get balanced model
    return ChatMode.DEEPSEEK_CHAT_V3_1;
};

/**
 * Gets a human-readable explanation for why a model was selected
 */
export const getModelSelectionReason = (query: string, selectedModel: ChatMode): string => {
    const lowerQuery = query.toLowerCase();

    switch (selectedModel) {
        case ChatMode.GEMINI_2_5_FLASH:
            if (/\b(image|photo|picture)\b/i.test(query)) {
                return 'Multimodal capabilities for image analysis';
            }
            return 'Fast response for quick queries';

        case ChatMode.GEMINI_2_5_PRO:
            return 'Deep research and comprehensive analysis';

        case ChatMode.DEEPSEEK_CHAT_V3_1:
            if (lowerQuery.includes('code')) {
                return 'Optimized for coding tasks';
            }
            return 'Balanced performance for general queries';

        case ChatMode.DEEPSEEK_R1:
            return 'Advanced reasoning with chain-of-thought';

        case ChatMode.LONGCAT_FLASH_CHAT:
            return 'Real-time information with internet access';

        case ChatMode.GLM_4_5_AIR:
            return 'Creative content generation';

        default:
            return 'General-purpose model';
    }
};

export const selectOpenRouterFallback = (query: string): ChatMode => {
    const lowerQuery = query.toLowerCase();

    const codeIndicators = [
        'code',
        'function',
        'class',
        'algorithm',
        'debug',
        'error',
        'bug',
        'implement',
        'refactor',
        'optimize',
        'python',
        'javascript',
        'typescript',
        'java',
        'c++',
        'rust',
        'go',
        'sql',
        'api',
        'regex',
        'git',
    ];
    if (codeIndicators.filter(word => lowerQuery.includes(word)).length >= 2) {
        return ChatMode.DEEPSEEK_CHAT_V3_1;
    }

    const mathIndicators = [
        'calculate',
        'solve',
        'equation',
        'math',
        'proof',
        'theorem',
        'reasoning',
        'logic',
        'derive',
        'compute',
        'algorithm complexity',
    ];
    if (
        mathIndicators.filter(word => lowerQuery.includes(word)).length >= 2 ||
        /\b(prove|theorem|∫|∑|∏|∂)\b/i.test(query)
    ) {
        return ChatMode.DEEPSEEK_R1;
    }

    const currentYear = new Date().getFullYear();
    const newsIndicators = [
        'news',
        'latest',
        'recent',
        'today',
        'yesterday',
        'current',
        'breaking',
        'trending',
    ];
    const recentYearMentions = query.match(
        new RegExp(`\\b(${currentYear}|${currentYear - 1}|202[0-9])\\b`, 'g')
    );
    if (recentYearMentions || newsIndicators.filter(word => lowerQuery.includes(word)).length >= 2) {
        return ChatMode.LONGCAT_FLASH_CHAT;
    }

    const creativeIndicators = [
        'write',
        'story',
        'poem',
        'creative',
        'fiction',
        'essay',
        'article',
        'blog',
        'script',
        'dialogue',
        'character',
    ];
    if (creativeIndicators.filter(word => lowerQuery.includes(word)).length >= 2) {
        return ChatMode.GLM_4_5_AIR;
    }

    return ChatMode.DEEPSEEK_CHAT_V3_1;
};

export const selectGeminiFallback = (query: string, hasImage: boolean = false): ChatMode => {
    if (hasImage) {
        return ChatMode.GEMINI_2_5_FLASH;
    }

    const length = query.trim().split(/\s+/).filter(Boolean).length;
    return length > 50 ? ChatMode.GEMINI_2_5_PRO : ChatMode.GEMINI_2_5_FLASH;
};
