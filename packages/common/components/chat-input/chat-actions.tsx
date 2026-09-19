'use client';
import { DotSpinner } from '@repo/common/components';
import { useChatStore } from '@repo/common/store';
import {
    CHAT_MODE_CREDIT_COSTS,
    ChatMode,
    ChatModeConfig,
    effortLabel,
    GatewayModelFamily,
    groupGatewayModels,
} from '@repo/shared/config';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    Kbd,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Slider,
} from '@repo/ui';
import {
    IconArrowUp,
    IconAtom,
    IconChevronDown,
    IconNorthStar,
    IconPaperclip,
    IconPlayerStopFilled,
    IconWorld,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NewIcon } from '../icons';

export const chatOptions = [
    {
        label: 'Deep Research',
        description: 'In depth research on complex topic',
        value: ChatMode.Deep,
        icon: <IconAtom size={16} className="text-muted-foreground" strokeWidth={2} />,
        creditCost: CHAT_MODE_CREDIT_COSTS[ChatMode.Deep],
    },
    {
        label: 'Pro Search',
        description: 'Pro search with web search',
        value: ChatMode.Pro,
        icon: <IconNorthStar size={16} className="text-muted-foreground" strokeWidth={2} />,
        creditCost: CHAT_MODE_CREDIT_COSTS[ChatMode.Pro],
    },
];

const fallbackGatewayFamilies = groupGatewayModels([
    'gemini-2.5-flash-lite',
    'claude-sonnet-4-6',
    'claude-opus-4-6-thinking',
    'gpt-oss-120b-medium',
]);

const useGatewayModelFamilies = () => {
    const [families, setFamilies] = useState<GatewayModelFamily[]>(fallbackGatewayFamilies);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/models', { cache: 'no-store' })
            .then(response => (response.ok ? response.json() : null))
            .then(data => {
                if (!cancelled && data?.families?.length) setFamilies(data.families);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    return families;
};

const defaultVariant = (family: GatewayModelFamily) =>
    family.variants.find(variant => variant.effort === 'medium') || family.variants[0];

const selectedFamilyForMode = (families: GatewayModelFamily[], mode: ChatMode) =>
    families.find(family => family.variants.some(variant => variant.id === mode));

const effortIndexForMode = (family: GatewayModelFamily, mode: ChatMode) =>
    Math.max(0, family.variants.findIndex(variant => variant.id === mode));

export const AttachmentButton = () => {
    return (
        <Button
            size="icon"
            tooltip="Attachment (coming soon)"
            variant="ghost"
            className="gap-2"
            rounded="full"
            disabled
        >
            <IconPaperclip size={18} strokeWidth={2} className="text-muted-foreground" />
        </Button>
    );
};

const EffortControl = ({
    family,
    chatMode,
    setChatMode,
}: {
    family: GatewayModelFamily;
    chatMode: ChatMode;
    setChatMode: (chatMode: ChatMode) => void;
}) => {
    if (family.variants.length < 2) return null;

    const selectedIndex = effortIndexForMode(family, chatMode);
    const selectedVariant = family.variants[selectedIndex];

    return (
        <div className="border-border/70 mt-3 border-t pt-3">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Thinking effort</span>
                <span className="text-muted-foreground">
                    {effortLabel(selectedVariant?.effort) || 'Default'}
                </span>
            </div>
            <Slider
                aria-label="Thinking effort"
                min={0}
                max={family.variants.length - 1}
                step={1}
                value={[selectedIndex]}
                onValueChange={value => {
                    const variant = family.variants[value[0] ?? selectedIndex];
                    if (variant) setChatMode(variant.id as ChatMode);
                }}
                className="mt-2 h-6"
            />
            <div className="text-muted-foreground flex justify-between text-[10px]">
                {family.variants.map(variant => (
                    <span key={variant.id}>{effortLabel(variant.effort) || 'Default'}</span>
                ))}
            </div>
        </div>
    );
};

const ModelFamilyList = ({
    families,
    chatMode,
    setChatMode,
}: {
    families: GatewayModelFamily[];
    chatMode: ChatMode;
    setChatMode: (chatMode: ChatMode) => void;
}) => (
    <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
        {families.map(family => {
            const selected = family.variants.some(variant => variant.id === chatMode);
            const selectedVariant = family.variants.find(variant => variant.id === chatMode);
            return (
                <button
                    type="button"
                    key={family.id}
                    onClick={() => setChatMode((selectedVariant || defaultVariant(family)).id as ChatMode)}
                    className={cn(
                        'hover:bg-muted flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-left text-sm transition-colors',
                        selected && 'bg-muted font-medium'
                    )}
                >
                    <span>{family.label}</span>
                    {family.isImage && <span className="text-muted-foreground text-[10px]">Image</span>}
                </button>
            );
        })}
    </div>
);

export const ChatModeButton = () => {
    const chatMode = useChatStore(state => state.chatMode);
    const setChatMode = useChatStore(state => state.setChatMode);
    const [isChatModeOpen, setIsChatModeOpen] = useState(false);
    const isChatPage = usePathname().startsWith('/chat');
    const families = useGatewayModelFamilies();
    const selectedFamily = selectedFamilyForMode(families, chatMode);
    const selectedLabel = selectedFamily?.label || 'Default';

    return (
        <Popover open={isChatModeOpen} onOpenChange={setIsChatModeOpen}>
            <PopoverTrigger asChild>
                <Button variant="secondary" size="xs">
                    {selectedLabel}
                    <IconChevronDown size={14} strokeWidth={2} />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-[320px] p-3">
                {isChatPage && (
                    <div className="mb-3 border-b pb-3">
                        <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                            Modes
                        </p>
                        <div className="flex gap-1">
                            {chatOptions.map(option => (
                                <Button
                                    key={option.value}
                                    size="sm"
                                    variant={chatMode === option.value ? 'secondary' : 'ghost'}
                                    onClick={() => setChatMode(option.value)}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                    Models
                </p>
                <ModelFamilyList
                    families={families}
                    chatMode={chatMode}
                    setChatMode={setChatMode}
                />
                {selectedFamily && !selectedFamily.isImage && (
                    <EffortControl
                        family={selectedFamily}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                    />
                )}
                {selectedFamily?.isImage && (
                    <p className="text-muted-foreground border-border/70 mt-3 border-t pt-3 text-xs">
                        Image generation uses 10 Pro credits per image.
                    </p>
                )}
            </PopoverContent>
        </Popover>
    );
};

export const WebSearchButton = () => {
    const useWebSearch = useChatStore(state => state.useWebSearch);
    const setUseWebSearch = useChatStore(state => state.setUseWebSearch);
    const chatMode = useChatStore(state => state.chatMode);

    if (!ChatModeConfig[chatMode]?.webSearch) return null;

    return (
        <Button
            size={useWebSearch ? 'sm' : 'icon-sm'}
            tooltip="Web Search"
            variant={useWebSearch ? 'secondary' : 'ghost'}
            className={cn('gap-2', useWebSearch && 'bg-blue-500/10 text-blue-500')}
            onClick={() => setUseWebSearch(!useWebSearch)}
        >
            <IconWorld
                size={16}
                strokeWidth={2}
                className={cn(useWebSearch ? '!text-blue-500' : 'text-muted-foreground')}
            />
            {useWebSearch && <p className="text-xs">Web</p>}
        </Button>
    );
};

export const NewLineIndicator = () => {
    const editor = useChatStore(state => state.editor);
    const hasTextInput = !!editor?.getText();

    if (!hasTextInput) return null;

    return (
        <p className="flex flex-row items-center gap-1 text-xs text-gray-500">
            use <Kbd>Shift</Kbd> <Kbd>Enter</Kbd> for new line
        </p>
    );
};

export const GeneratingStatus = () => {
    return (
        <div className="text-muted-foreground flex flex-row items-center gap-1 px-2 text-xs">
            <DotSpinner /> Generating...
        </div>
    );
};

export const ChatModeOptions = ({
    chatMode,
    setChatMode,
    isRetry = false,
}: {
    chatMode: ChatMode;
    setChatMode: (chatMode: ChatMode) => void;
    isRetry?: boolean;
}) => {
    const isChatPage = usePathname().startsWith('/chat');
    const creditLimit = useChatStore(state => state.creditLimit);
    const families = useGatewayModelFamilies();
    const canShow = (mode: ChatMode) =>
        !creditLimit.isFetched ||
        creditLimit.allowedModes.length === 0 ||
        creditLimit.allowedModes.includes(mode);
    const visibleAdvancedOptions = chatOptions.filter(option => canShow(option.value));
    return (
        <DropdownMenuContent
            align="start"
            side="bottom"
            className="no-scrollbar max-h-[300px] w-[300px] overflow-y-auto"
        >
            {isChatPage && (
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Advanced Mode</DropdownMenuLabel>
                    {visibleAdvancedOptions.map(option => (
                        <DropdownMenuItem
                            key={option.label}
                            onSelect={() => {
                                setChatMode(option.value);
                            }}
                            className="h-auto"
                        >
                            <div className="flex w-full flex-row items-start gap-1.5 px-1.5 py-1.5">
                                <div className="flex flex-col gap-0 pt-1">{option.icon}</div>

                                <div className="flex flex-col gap-0">
                                    {<p className="m-0 text-sm font-medium">{option.label}</p>}
                                    {option.description && (
                                        <p className="text-muted-foreground text-xs font-light">
                                            {option.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex-1" />
                                {ChatModeConfig[option.value]?.isNew && <NewIcon />}
                            </div>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            )}
            <DropdownMenuGroup>
                <DropdownMenuLabel>Models</DropdownMenuLabel>
                {families.map(family => {
                    const selectedVariant = family.variants.find(variant => variant.id === chatMode);
                    return (
                        <DropdownMenuItem
                            key={family.id}
                            onSelect={() => {
                                setChatMode((selectedVariant || defaultVariant(family)).id as ChatMode);
                            }}
                            className="h-auto"
                        >
                            <div className="flex w-full flex-row items-center gap-2.5 px-1.5 py-1.5">
                                <p className="text-sm font-medium">{family.label}</p>
                                <div className="flex-1" />
                                {family.isImage && (
                                    <span className="text-muted-foreground text-[10px]">Image</span>
                                )}
                            </div>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuGroup>
        </DropdownMenuContent>
    );
};

export const SendStopButton = ({
    isGenerating,
    isChatPage,
    stopGeneration,
    hasTextInput,
    sendMessage,
}: {
    isGenerating: boolean;
    isChatPage: boolean;
    stopGeneration: () => void;
    hasTextInput: boolean;
    sendMessage: () => void;
}) => {
    return (
        <div className="flex flex-row items-center gap-2">
            <AnimatePresence mode="wait" initial={false}>
                {isGenerating && !isChatPage ? (
                    <motion.div
                        key="stop-button"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Button
                            size="icon-sm"
                            variant="default"
                            onClick={stopGeneration}
                            tooltip="Stop Generation"
                        >
                            <IconPlayerStopFilled size={14} strokeWidth={2} />
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="send-button"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Button
                            size="icon-sm"
                            tooltip="Send Message"
                            variant={hasTextInput ? 'default' : 'secondary'}
                            disabled={!hasTextInput || isGenerating}
                            onClick={() => {
                                sendMessage();
                            }}
                        >
                            <IconArrowUp size={16} strokeWidth={2} />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
