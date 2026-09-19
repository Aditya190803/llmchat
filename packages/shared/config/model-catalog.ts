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
    modelId
        .replace(/_/g, ' ')
        .split('-')
        .map(titlePart)
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

export const getGatewayModelDisplayName = (modelId: string) => {
    const familyName = formatGatewayModelName(getModelFamilyId(modelId));
    const effort = effortLabel(getModelEffort(modelId));
    return effort ? `${familyName} · ${effort}` : familyName;
};

export const groupGatewayModels = (
    modelIds: string[],
    allowedModelIds: string[] = modelIds
): GatewayModelFamily[] => {
    const allowed = new Set(allowedModelIds);
    const families = new Map<string, GatewayModelFamily>();

    for (const id of modelIds) {
        if (!allowed.has(id)) continue;
        const familyId = getModelFamilyId(id);
        const family = families.get(familyId) || {
            id: familyId,
            label: formatGatewayModelName(familyId),
            isImage: isImageGenerationModel(id),
            variants: [],
        };
        family.isImage ||= isImageGenerationModel(id);
        family.variants.push({ id, effort: getModelEffort(id) });
        families.set(familyId, family);
    }

    return Array.from(families.values())
        .map(family => ({
            ...family,
            variants: family.variants.sort(
                (a, b) =>
                    (a.effort ? EFFORT_ORDER.indexOf(a.effort) : EFFORT_ORDER.length) -
                    (b.effort ? EFFORT_ORDER.indexOf(b.effort) : EFFORT_ORDER.length)
            ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
};
