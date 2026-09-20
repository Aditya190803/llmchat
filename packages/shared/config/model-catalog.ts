export const EFFORT_ORDER = ['instant', 'extra-low', 'low', 'medium', 'high'] as const;
export type ModelEffort = (typeof EFFORT_ORDER)[number];

export const IMAGE_GENERATION_CREDIT_COST = 10;

export type GatewayVariant = {
    id: string;
    effort?: ModelEffort;
};

export type GatewayModelFamily = {
    id: string;
    label: string;
    isImage: boolean;
    variants: GatewayVariant[];
};

const EFFORT_SUFFIXES = new Set<ModelEffort>(EFFORT_ORDER);

export const isImageGenerationModel = (modelId: string) =>
    /(?:^|-)(?:flash-)?image(?:-|$)/i.test(modelId);

const getEffortSuffix = (modelId: string) =>
    EFFORT_ORDER.slice()
        .sort((a, b) => b.length - a.length)
        .find(suffix => modelId.endsWith(`-${suffix}`)) ||
    (modelId.endsWith('-tiered') ? 'tiered' : undefined);

export const getModelEffort = (modelId: string): ModelEffort | undefined => {
    const suffix = getEffortSuffix(modelId);
    if (suffix === 'tiered') return 'instant';
    return suffix;
};

/**
 * "openai/gpt-oss-120b" and "gpt-oss-120b-medium" are the same model reaching
 * us by two routes. Users should see one entry, so the vendor prefix is dropped
 * when naming and grouping; the full id is still what gets sent to the gateway.
 */
export const stripProviderPrefix = (modelId: string) => modelId.replace(/^[^/]+\//, '');

export const getModelFamilyId = (modelId: string) => {
    const suffix = getEffortSuffix(modelId);
    return suffix ? modelId.slice(0, -(suffix.length + 1)) : modelId;
};

const titlePart = (part: string) => {
    if (part.toLowerCase() === 'gpt') return 'GPT';
    if (part.toLowerCase() === 'oss') return 'OSS';
    if (part.toLowerCase() === 'api') return 'API';
    return part.charAt(0).toUpperCase() + part.slice(1);
};

export const formatGatewayModelName = (modelId: string) =>
    stripProviderPrefix(modelId)
        .replace(/_/g, ' ')
        .split('-')
        .map(titlePart)
        // "4", "6" in claude-opus-4-6 are one version number, not two words.
        .reduce<string[]>((parts, part) => {
            const previous = parts[parts.length - 1];
            if (/^\d+$/.test(part) && previous && /^[\d.]+$/.test(previous)) {
                parts[parts.length - 1] = `${previous}.${part}`;
                return parts;
            }
            parts.push(part);
            return parts;
        }, [])
        .join(' ');

export const effortLabel = (effort?: ModelEffort) => {
    switch (effort) {
        case 'instant':
        case 'extra-low':
            return effort === 'instant' ? 'Instant' : 'Extra low';
        case 'low':
            return 'Low';
        case 'medium':
            return 'Medium';
        case 'high':
            return 'High';
        default:
            return undefined;
    }
};

/** Thinking longer costs more; a tiered/instant model costs its base price. */
export const EFFORT_COST_MULTIPLIER: Record<ModelEffort, number> = {
    instant: 1,
    'extra-low': 1,
    low: 1.25,
    medium: 1.5,
    high: 2,
};

// Matched per name segment: "gemini" must not count as "mini".
const CHEAP_SEGMENTS = new Set([
    'lite',
    'nano',
    'mini',
    'tiny',
    'small',
    'oss',
    'haiku',
    'tab',
    'chat',
]);
const PREMIUM_SEGMENTS = new Set([
    'pro',
    'opus',
    'sonnet',
    'thinking',
    'reasoning',
    'agent',
    'ultra',
    'max',
]);

/** Small models are cheap, frontier/reasoning models are not. */
export const getModelBaseCost = (modelId: string) => {
    const segments = modelId.toLowerCase().split(/[-_.\s]+/);
    if (segments.some(segment => PREMIUM_SEGMENTS.has(segment))) return 4;
    if (segments.some(segment => CHEAP_SEGMENTS.has(segment))) return 1;
    return 2;
};

/** Credits charged for one message with a live gateway model. */
export const getGatewayModelCreditCost = (modelId: string) => {
    if (isImageGenerationModel(modelId)) return IMAGE_GENERATION_CREDIT_COST;
    const effort = getModelEffort(modelId);
    const multiplier = effort ? EFFORT_COST_MULTIPLIER[effort] : 1;
    return Math.max(1, Math.ceil(getModelBaseCost(getModelFamilyId(modelId)) * multiplier));
};

export const getGatewayModelDisplayName = (modelId: string) => {
    const familyName = formatGatewayModelName(getModelFamilyId(modelId));
    const effort = effortLabel(getModelEffort(modelId));
    return effort ? `${familyName} · ${effort}` : familyName;
};

export const groupGatewayModels = (
    modelIds: string[],
    allowedModelIds: string[] = modelIds,
    // The admin screen manages every route, so it keeps duplicates visible.
    { collapseDuplicates = true }: { collapseDuplicates?: boolean } = {}
): GatewayModelFamily[] => {
    const allowed = new Set(allowedModelIds);
    const families = new Map<string, GatewayModelFamily>();

    for (const id of modelIds) {
        if (!allowed.has(id)) continue;
        const familyId = stripProviderPrefix(getModelFamilyId(id));
        const family = families.get(familyId) || {
            id: familyId,
            label: formatGatewayModelName(familyId),
            isImage: isImageGenerationModel(id),
            variants: [],
        };
        family.isImage ||= isImageGenerationModel(id);

        // Two routes to the same model and effort: keep the plainer id, which is
        // the gateway's own alias rather than a vendor-qualified duplicate.
        const effort = getModelEffort(id);
        const duplicate = collapseDuplicates
            ? family.variants.find(variant => variant.effort === effort)
            : undefined;
        if (duplicate) {
            if (id.length < duplicate.id.length) duplicate.id = id;
        } else {
            family.variants.push({ id, effort });
        }
        families.set(familyId, family);
    }

    return Array.from(families.values())
        .map(family => {
            const levelled = collapseDuplicates
                ? family.variants.filter(variant => variant.effort)
                : [];
            return {
                ...family,
                // A model offering effort levels does not also need an unlabelled
                // "default" entry beside them.
                variants: (levelled.length ? levelled : family.variants).sort(
                    (a, b) =>
                        (a.effort ? EFFORT_ORDER.indexOf(a.effort) : EFFORT_ORDER.length) -
                        (b.effort ? EFFORT_ORDER.indexOf(b.effort) : EFFORT_ORDER.length)
                ),
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
};
