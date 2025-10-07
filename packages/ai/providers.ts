import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { ModelEnum, models } from './models';

export const Providers = {
  GOOGLE: 'google',
  OPENROUTER: 'openrouter',
} as const;

export type ProviderEnumType = (typeof Providers)[keyof typeof Providers];

export class MissingProviderKeyError extends Error {
  constructor(provider: ProviderEnumType) {
    const providerName = provider === Providers.GOOGLE ? 'Google Gemini' : 'OpenRouter';
    const envHint =
      provider === Providers.GOOGLE
        ? 'Set the GEMINI_API_KEY environment variable or provide a personal key in Settings → API Keys.'
        : 'Set the OPENROUTER_API_KEY environment variable or provide a personal key in Settings → API Keys.';
    super(`Missing ${providerName} API credentials. ${envHint}`);
    this.name = 'MissingProviderKeyError';
  }
}

// Define a global type for API keys
declare global {
  interface Window {
    AI_API_KEYS?: {
      [key in ProviderEnumType]?: string;
    };
    LANGSEARCH_API_KEY?: string;
    SERPER_API_KEY?: string;
    JINA_API_KEY?: string;
    NEXT_PUBLIC_APP_URL?: string;
  }
}

// Helper function to get API key from env or global
export const getProviderApiKey = (provider: ProviderEnumType): string => {
  // For server environments
  if (typeof process !== 'undefined' && process.env) {
    switch (provider) {
      case Providers.GOOGLE:
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        break;
      case Providers.OPENROUTER:
        if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
        break;
    }
  }

  // For worker environments (use self)
  if (typeof self !== 'undefined') {
    // Check if AI_API_KEYS exists on self
    if ((self as any).AI_API_KEYS && (self as any).AI_API_KEYS[provider]) {
      return (self as any).AI_API_KEYS[provider];
    }
    
    // For browser environments (self is also defined in browser)
    if (typeof window !== 'undefined' && window.AI_API_KEYS) {
      return window.AI_API_KEYS[provider] || '';
    }
  }

  return '';
};

const resolveAppOrigin = () => {
  const envOrigin =
    (typeof process !== 'undefined' &&
      (process.env?.OPENROUTER_SITE_URL ||
        process.env?.NEXT_PUBLIC_APP_URL ||
        (process.env?.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined))) ||
    undefined;

  if (envOrigin) {
    return envOrigin;
  }

  if (typeof window !== 'undefined') {
    if ((window as any).NEXT_PUBLIC_APP_URL) {
      return (window as any).NEXT_PUBLIC_APP_URL;
    }

    if (window.location?.origin) {
      return window.location.origin;
    }
  }

  if (typeof self !== 'undefined' && (self as any).location?.origin) {
    return (self as any).location.origin;
  }

  return 'http://localhost:3000';
};

const getOpenRouterHeaders = () => {
  const headers: Record<string, string> = {};

  const referer = resolveAppOrigin();
  const title =
    (typeof process !== 'undefined' && process.env?.OPENROUTER_APP_TITLE) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_NAME) ||
    'Chatbot';

  if (referer) {
    headers['HTTP-Referer'] = referer;
  }

  if (title) {
    headers['X-Title'] = title;
  }

  return headers;
};

export const getProviderInstance = (provider: ProviderEnumType) => {
  switch (provider) {
    case Providers.GOOGLE: {
      const apiKey = getProviderApiKey(Providers.GOOGLE);
      if (!apiKey) {
        throw new MissingProviderKeyError(Providers.GOOGLE);
      }
      return createGoogleGenerativeAI({
        apiKey,
      });
    }
    case Providers.OPENROUTER: {
      const apiKey = getProviderApiKey(Providers.OPENROUTER);
      if (!apiKey) {
        throw new MissingProviderKeyError(Providers.OPENROUTER);
      }
      return createOpenRouter({
        apiKey,
        compatibility: 'strict',
        headers: getOpenRouterHeaders(),
      });
    }
    default: {
      const apiKey = getProviderApiKey(Providers.OPENROUTER);
      if (!apiKey) {
        throw new MissingProviderKeyError(Providers.OPENROUTER);
      }
      return createOpenRouter({
        apiKey,
        compatibility: 'strict',
        headers: getOpenRouterHeaders(),
      });
    }
  }
};

export const getLanguageModel = (m: ModelEnum, _middleware?: unknown): any => {
  const model = models.find(model => model.id === m);
  const instance = getProviderInstance(model?.provider as ProviderEnumType);
  const selectedModel = instance(model?.id || 'gpt-4o-mini');

  // Middleware support is temporarily disabled until the new AI SDK exposes a stable middleware API.
  return selectedModel;
};
