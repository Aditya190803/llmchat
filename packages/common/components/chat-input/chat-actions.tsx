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
    isImageGenerationModel,
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
    IconBolt,
    IconAtom,
    IconCheck,
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

const FREE_MODEL_IDS = ['gemini-2.5-flash-lite', 'gpt-oss-120b-medium'];

// Starts empty so the picker shows "Loading models…" instead of flashing models
// the plan can't use. If the gateway is unreachable, fall back to free models.
const useGatewayModelFamilies = () => {
    const [families, setFamilies] = useState<GatewayModelFamily[]>([]);

    useEffect(() => {
        let cancelled = false;
        const fallback = () => groupGatewayModels(FREE_MODEL_IDS);
        fetch('/api/models', { cache: 'no-store' })
            .then(response => (response.ok ? response.json() : null))
            .catch(() => null)
            .then(data => {
                if (!cancelled) setFamilies(data?.families?.length ? data.families : fallback());
            });
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

/** Thinking effort, as its own composer control: only models with levels show it. */
export const EffortButton = () => {
    const chatMode = useChatStore(state => state.chatMode);
    const setChatMode = useChatStore(state => state.setChatMode);
    const families = useGatewayModelFamilies();
    const [open, setOpen] = useState(false);

    const family = selectedFamilyForMode(families, chatMode);
    if (!family || family.variants.length < 2) return null;

    const index = Math.max(
        0,
        family.variants.findIndex(variant => variant.id === chatMode)
    );
    const current = family.variants[index];

    return (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button variant="secondary" size="xs" className="gap-1.5">
                    <IconBolt size={13} strokeWidth={2} />
                    {effortLabel(current?.effort) || 'Effort'}
                    <IconChevronDown size={14} strokeWidth={2} />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                side="top"
                sideOffset={8}
                collisionPadding={12}
                className="z-[70] w-[260px] p-3"
            >
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Thinking effort</span>
                    <span className="text-muted-foreground text-xs">{family.label}</span>
                </div>
                <Slider
                    aria-label="Thinking effort"
                    min={0}
                    max={family.variants.length - 1}
                    step={1}
                    value={[index]}
                    onValueChange={value => {
                        const variant = family.variants[value[0] ?? index];
                        if (variant) setChatMode(variant.id as ChatMode);
                    }}
                    className="mt-3 h-6"
                />
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                    {family.variants.map(variant => (
                        <span
                            key={variant.id}
                            className={cn(variant.id === chatMode && 'text-foreground font-medium')}
                        >
                            {effortLabel(variant.effort) || 'Default'}
                        </span>
                    ))}
                </div>
                <p className="text-muted-foreground mt-2 text-[11px]">
                    Higher effort thinks longer before answering.
                </p>
            </PopoverContent>
        </Popover>
    );
};

const ModelFamilyList = ({
    families,
    chatMode,
    setChatMode,
    onSelect,
}: {
    families: GatewayModelFamily[];
    chatMode: ChatMode;
    setChatMode: (chatMode: ChatMode) => void;
    onSelect?: () => void;
}) => {
    return (
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
            {families.map(family => {
                const selected = family.variants.some(variant => variant.id === chatMode);
                const selectedVariant = family.variants.find(variant => variant.id === chatMode);
                const targetId = (selectedVariant || defaultVariant(family)).id as ChatMode;
                return (
                    <button
                        type="button"
                        key={family.id}
                        onClick={() => {
                            setChatMode(targetId);
                            onSelect?.();
                        }}
                        className={cn(
                            'hover:bg-muted flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            selected && 'bg-muted font-medium'
                        )}
                    >
                        <span
                            className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center',
                                selected ? 'text-foreground' : 'text-transparent'
                            )}
                        >
                            <IconCheck size={14} strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{family.label}</span>
                        {family.isImage && (
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                                Image
                            </span>
                        )}
                        {family.variants.length > 1 && (
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                                {family.variants.length} levels
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export const ChatModeButton = () => {
    const chatMode = useChatStore(state => state.chatMode);
    const setChatMode = useChatStore(state => state.setChatMode);
    const creditLimit = useChatStore(state => state.creditLimit);
    const [isChatModeOpen, setIsChatModeOpen] = useState(false);
    const isChatPage = usePathname().startsWith('/chat');
    const families = useGatewayModelFamilies();
    const canShowMode = (mode: ChatMode) =>
        !creditLimit.isFetched
            ? creditLimit.loggedOut
                ? (ChatModeConfig[mode]?.isAuthRequired ?? false) === false
                : true
            : creditLimit.allowedModes.length === 0 || creditLimit.allowedModes.includes(mode);
    const visibleAdvancedOptions = chatOptions.filter(option => canShowMode(option.value));
    const selectedFamily = selectedFamilyForMode(families, chatMode);
    const selectedOption = visibleAdvancedOptions.find(option => option.value === chatMode);
    const selectedLabel = selectedFamily?.label || selectedOption?.label || 'Model';

    // /api/models only lists models this plan can use. A saved selection that is
    // not among them (plan changed, model retired) falls back to the first one.
    const isStale =
        families.length > 0 && creditLimit.isFetched && !selectedFamily && !selectedOption;
    useEffect(() => {
        if (!isStale) return;
        const preferred =
            families.find(family => family.variants.some(v => FREE_MODEL_IDS.includes(v.id))) ??
            families[0];
        setChatMode(defaultVariant(preferred).id as ChatMode);
    }, [isStale, families, setChatMode]);

    return (
        <Popover open={isChatModeOpen} onOpenChange={setIsChatModeOpen} modal={false}>
            <PopoverTrigger asChild>
                <Button variant="secondary" size="xs">
                    {selectedLabel}
                    <IconChevronDown size={14} strokeWidth={2} />
                </Button>
            </PopoverTrigger>
            {/* Opens upward: the input usually sits at the bottom of the viewport.
                Radix flips it down only when there is no room above. */}
            <PopoverContent
                align="start"
                side="top"
                sideOffset={8}
                collisionPadding={12}
                className="z-[70] max-h-[min(34rem,var(--radix-popover-content-available-height))] w-[320px] overflow-y-auto p-3"
            >
                {isChatPage && visibleAdvancedOptions.length > 0 && (
                    <div className="border-border mb-3 border-b pb-3">
                        <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                            Modes
                        </p>
                        <div className="flex flex-col gap-0.5">
                            {visibleAdvancedOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setChatMode(option.value);
                                        setIsChatModeOpen(false);
                                    }}
                                    className={cn(
                                        'hover:bg-muted flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                                        chatMode === option.value && 'bg-muted'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex h-4 w-4 shrink-0 items-center justify-center pt-0.5',
                                            chatMode === option.value
                                                ? 'text-foreground'
                                                : 'text-transparent'
                                        )}
                                    >
                                        <IconCheck size={14} strokeWidth={2.5} />
                                    </span>
                                    <span className="text-muted-foreground mt-0.5 shrink-0">
                                        {option.icon}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5 text-sm font-medium">
                                            {option.label}
                                            {ChatModeConfig[option.value]?.isNew && <NewIcon />}
                                        </span>
                                        {option.description && (
                                            <span className="text-muted-foreground block truncate text-xs font-light">
                                                {option.description}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <p className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
                    Models
                </p>
                {families.length === 0 ? (
                    <p className="text-muted-foreground animate-pulse px-2 py-3 text-xs">
                        Loading models…
                    </p>
                ) : (
                    <ModelFamilyList
                        families={families}
                        chatMode={chatMode}
                        setChatMode={setChatMode}
                        onSelect={() => setIsChatModeOpen(false)}
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

    // Legacy modes declare support; live gateway text models all support it.
    const supportsWebSearch =
        ChatModeConfig[chatMode]?.webSearch ?? !isImageGenerationModel(chatMode);
    if (!supportsWebSearch) return null;

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
    // Hide anything the current plan cannot use. Before the quota loads, show
    // nothing plan-gated rather than everything (prevents picking deep/pro
    // while logged out, which 403s on send).
    const canShow = (mode: ChatMode) =>
        !creditLimit.isFetched
            ? creditLimit.loggedOut
                ? (ChatModeConfig[mode]?.isAuthRequired ?? false) === false
                : true
            : creditLimit.allowedModes.length === 0 || creditLimit.allowedModes.includes(mode);
    const visibleAdvancedOptions = chatOptions.filter(option => canShow(option.value));
    // Null until quota loads: hide the whole group instead of flashing all modes.
    // After load: only show modes the plan allows (server is source of truth).
    const showModesGroup =
        isChatPage && (creditLimit.isFetched ? visibleAdvancedOptions.length > 0 : false);
    return (
        <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={12}
            className="no-scrollbar max-h-[min(34rem,var(--radix-dropdown-menu-content-available-height))] w-[300px] overflow-y-auto"
        >
            {showModesGroup && (
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Modes</DropdownMenuLabel>
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
                {families.length === 0 && (
                    <p className="text-muted-foreground animate-pulse px-2 py-2 text-xs">
                        Loading models…
                    </p>
                )}
                {families.map(family => {
                    const selectedVariant = family.variants.find(
                        variant => variant.id === chatMode
                    );
                    const targetId = (selectedVariant || defaultVariant(family)).id as ChatMode;
                    const selected = family.variants.some(variant => variant.id === chatMode);
                    return (
                        <DropdownMenuItem
                            key={family.id}
                            onSelect={() => {
                                setChatMode(targetId);
                            }}
                            className="h-auto"
                        >
                            <div className="flex w-full flex-row items-center gap-2.5 px-1.5 py-1.5">
                                <span
                                    className={cn(
                                        'flex h-4 w-4 shrink-0 items-center justify-center',
                                        selected ? 'text-foreground' : 'text-transparent'
                                    )}
                                >
                                    <IconCheck size={14} strokeWidth={2.5} />
                                </span>
                                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {family.label}
                                </p>
                                {family.isImage && (
                                    <span className="text-muted-foreground shrink-0 text-[10px]">
                                        Image
                                    </span>
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
