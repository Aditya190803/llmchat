/*
 * Which gateway models users may pick, and on which plan.
 *
 * The gateway lists everything it can route, including speech, safety
 * classifiers and superseded generations. This file is the product decision on
 * top of that list; ModelPolicy rows in the database override it per model.
 *
 * Reviewed 2026-09-20 against the live gateway (45 models).
 */

/** Not chat models at all: speech, classifiers, internal previews. */
const NON_CHAT_PATTERNS: RegExp[] = [
    /whisper/i, // transcription, used by voice input
    /orpheus/i, // text to speech
    /prompt-guard/i, // safety classifier
    /safeguard/i, // safety classifier
    /^(tab|chat)_/i, // internal gateway previews
    /-agent$/i, // agent harnesses, not plain chat
];

/**
 * Superseded or retiring generations. Gemini 2.5 shuts down 2026-10-16, and
 * 3.8 Flash at low effort beats 3.6 Flash at high effort for less, so the
 * intermediate Flash generations only add noise to the picker.
 */
const RETIRED_PATTERNS: RegExp[] = [
    /^gemini-2\.5-/i,
    /^gemini-3-flash/i,
    /^gemini-3\.5-/i,
    /^gemini-3\.6-/i,
    /^gemini-3\.7-/i,
    /^groq\/compound/i, // gateway cannot route these
    /^allam-/i, // 7B, single-language, long superseded
];

/** Models a user can be offered, before plan rules apply. */
export const isSelectableModel = (modelId: string) =>
    ![...NON_CHAT_PATTERNS, ...RETIRED_PATTERNS].some(pattern => pattern.test(modelId));

/** Free plan: fast and cheap, current generation only. */
export const FREE_MODEL_IDS = [
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash-tiered',
    'gemini-3.8-flash-low',
    'gpt-oss-120b-medium',
];

export const DEFAULT_MODEL_FREE = 'gemini-3.1-flash-lite';
export const DEFAULT_MODEL_PRO = 'gemini-3.8-flash-medium';

export const defaultModelFor = (isPro: boolean) => (isPro ? DEFAULT_MODEL_PRO : DEFAULT_MODEL_FREE);

/** Default plan access for a model with no explicit policy row. */
export const defaultPolicyFor = (modelId: string) => ({
    freeAllowed: FREE_MODEL_IDS.includes(modelId),
    proAllowed: isSelectableModel(modelId),
});
