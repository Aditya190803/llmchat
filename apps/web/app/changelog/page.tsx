import { Badge } from '@repo/ui';
import { IconBug, IconFileText, IconGitCommit, IconSparkles, IconTools, IconTrendingUp } from '@tabler/icons-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Changelog - llmchat',
};


const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');



type ChangeType = 'feature' | 'fix' | 'improvement' | 'docs' | 'chore' | 'other';

type IconComponent = typeof IconBug;

type ChangelogEntry = {
    id: string;
    title: string;
    type: ChangeType;
    description: string;
    items: string[];
};

const CHANGE_TYPE_META: Record<ChangeType, { label: string; icon: IconComponent; badge: string; marker: string }> = {
    feature: {
        label: 'Feature',
        icon: IconSparkles,
        badge: 'border-green-500/20 text-green-600 bg-green-500/10',
        marker: 'border-green-500/20 text-green-600 bg-green-500/10',
    },
    fix: {
        label: 'Fix',
        icon: IconBug,
        badge: 'border-orange-500/20 text-orange-600 bg-orange-500/10',
        marker: 'border-orange-500/20 text-orange-600 bg-orange-500/10',
    },
    improvement: {
        label: 'Improvement',
        icon: IconTrendingUp,
        badge: 'border-blue-500/20 text-blue-600 bg-blue-500/10',
        marker: 'border-blue-500/20 text-blue-600 bg-blue-500/10',
    },
    docs: {
        label: 'Docs',
        icon: IconFileText,
        badge: 'border-purple-500/20 text-purple-600 bg-purple-500/10',
        marker: 'border-purple-500/20 text-purple-600 bg-purple-500/10',
    },
    chore: {
        label: 'Chore',
        icon: IconTools,
        badge: 'border-slate-400/30 text-slate-600 bg-slate-400/10',
        marker: 'border-slate-400/30 text-slate-600 bg-slate-400/10',
    },
    other: {
        label: 'Update',
        icon: IconGitCommit,
        badge: 'border-muted text-muted-foreground bg-muted/20',
        marker: 'border-muted text-muted-foreground bg-muted/20',
    },
};



// Define the changelog features with organized structure
const CHANGELOG_ENTRIES: ChangelogEntry[] = [
    {
        id: 'image-generation-reliability',
        title: 'Image Generation Reliability',
        type: 'fix',
        description: 'Improved Gemini image generation stability and resilience.',
        items: [
            'Removed unsupported response MIME configuration for Gemini 2.5 Flash Image Preview',
            'Added exponential backoff retries for Gemini rate limit and transient errors',
            'Surfaced clearer messaging when prompts are blocked or no images are returned'
        ]
    },
    {
        id: 'development',
        title: 'Development & Build Improvements',
        type: 'chore',
        description: 'Enhanced development experience and build stability.',
        items: [
            'Configured successful production build process',
            'Updated dependencies and resolved conflicts',
            'Improved TypeScript configuration',
            'Added proper error handling for build compatibility',
            'Updated project structure and organization',
            'Enhanced analytics and tracking configuration'
        ]
    },
    {
        id: 'authentication',
        title: 'Authentication & Security',
        type: 'feature',
        description: 'Enhanced user authentication with custom sign-up and improved security.',
        items: [
            'Implemented CustomSignUp component for user registration',
            'Added email verification system',
            'Enhanced sign-in process with better UX',
            'Improved user profile management',
            'Updated authentication flow for mobile compatibility'
        ]
    },
    {
        id: 'mobile-support',
        title: 'Mobile Support Enhancement',
        type: 'feature',
        description: 'Full mobile support with responsive design and touch-friendly interface.',
        items: [
            'Removed "desktop only" restriction',
            'Added mobile hamburger menu navigation',
            'Implemented responsive padding and layouts',
            'Enhanced sidebar functionality for mobile devices',
            'Optimized message display for smaller screens',
            'Added mobile-first design principles'
        ]
    },
    {
        id: 'ui-simplification',
        title: 'UI Component Simplification',
        type: 'improvement',
        description: 'Replaced complex UI library components with native solutions for better stability.',
        items: [
            'Replaced Dialog and Popover components with custom modals',
            'Converted DropdownMenu components to native solutions',
            'Simplified Command components with basic alternatives',
            'Replaced HoverCard with custom hover state management',
            'Removed complex UI library dependencies for stable builds',
            'Enhanced mobile responsiveness and layout'
        ]
    },
    {
        id: 'cost-removal',
        title: 'Cost System Removal',
        type: 'improvement',
        description: 'Eliminated credit and cost systems for a completely free experience.',
        items: [
            'Removed all credit-related UI components and logic',
            'Eliminated API key requirements for model access',
            'Removed cost calculations and credit displays',
            'Simplified chat mode options without cost considerations',
            'Updated settings to remove API key and credits sections'
        ]
    },
    {
        id: 'ai-providers',
        title: 'AI Provider Overhaul',
        type: 'feature',
        description: 'Streamlined AI model support with focus on Google Gemini and OpenRouter integration.',
        items: [
            'Removed legacy providers (OpenAI, Anthropic, Together AI, Fireworks)',
            'Added comprehensive Google Gemini provider support',
            'Integrated OpenRouter for community models access',
            'Refreshed OpenRouter lineup: added LongCat Flash Chat, GLM 4.5 Air, DeepSeek Chat v3.1, GPT-OSS 20B, Dolphin Mistral 24B Venice',
            'Updated Gemini model identifiers for 2.5 Pro support',
            'Simplified model selection to Gemini 2.0 and 2.5 Flash',
            'Increased max tokens to 500,000 for all modes'
        ]
    },
    {
        id: 'fork-origin',
        title: 'Fork Origin',
        type: 'other',
        description: 'This project is a fork of the original llmchat.co, focused on simplification and enhanced AI provider support.',
        items: [
            'Forked from llmchat.co codebase',
            'Rebranded to focus on core chatbot functionality',
            'Maintained privacy-first approach with local data storage'
        ]
    }
];

export default async function ChangelogPage() {

    return (
        <div className="min-h-screen bg-secondary">
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 text-center">
                    <h1 className="mb-2 text-4xl font-bold text-foreground">Changelog</h1>
                    <p className="text-lg text-muted-foreground">
                        Major features and improvements in this fork of llmchat.co
                    </p>
                </div>

                <div className="space-y-8">
                    {CHANGELOG_ENTRIES.map((feature) => {
                        const meta = CHANGE_TYPE_META[feature.type] ?? CHANGE_TYPE_META.other;
                        const Icon = meta?.icon ?? IconGitCommit;
                        const markerClass = meta?.marker ?? CHANGE_TYPE_META.other.marker;
                        const badgeClass = meta?.badge ?? CHANGE_TYPE_META.other.badge;

                        return (
                            <div key={feature.id} className="rounded-xl border border-border bg-background p-6 shadow-subtle-sm">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                'grid h-10 w-10 place-items-center rounded-full border',
                                                markerClass || 'border-muted text-muted-foreground bg-muted/20'
                                            )}
                                        >
                                            <Icon size={20} strokeWidth={2} />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-foreground">
                                                {feature.title}
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {feature.description}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className={cn('border px-2 py-1 text-xs font-medium capitalize', badgeClass)}
                                    >
                                        {meta.label}
                                    </Badge>
                                </div>

                                <div className="mt-4">
                                    <ul className="space-y-2">
                                        {feature.items.map((item, itemIndex) => (
                                            <li key={itemIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand flex-shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 rounded-xl border border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
                    <p>
                        This is a fork of <a href="https://llmchat.co" target="_blank" rel="noreferrer" className="text-brand hover:text-brand/80">llmchat.co</a>, 
                        enhanced with simplified AI provider support, mobile compatibility, and cost-free access.
                        View the full commit history on{' '}
                        <a 
                            href="https://github.com/Aditya190803/chatbot"
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-brand hover:text-brand/80"
                        >
                            GitHub
                        </a>.
                    </p>
                </div>
            </div>
        </div>
    );
}