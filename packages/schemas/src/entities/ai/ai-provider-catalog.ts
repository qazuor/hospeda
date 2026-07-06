/**
 * Curated AI provider catalog (HOS-94).
 *
 * This is the hardcoded, hand-maintained catalog of well-known AI providers
 * and their suggested chat models, base URLs, and API-key acquisition links.
 * It was originally inlined in the admin credentials page
 * (`apps/admin/src/routes/_authed/ai/credentials.tsx`) and is now shared so
 * that both the admin UI and the API's model-sync merge (HOS-94 §6.3) can
 * consume the exact same curated metadata.
 *
 * Per HOS-94's design, this catalog's role shifts from "source of truth for
 * which models exist" to "source of curated metadata" — the API merges a
 * live provider list-models call with this catalog (detected ∪ curated), but
 * the catalog itself keeps being maintained by hand here.
 *
 * @module schemas/entities/ai/ai-provider-catalog
 */

/**
 * Curated metadata for a single well-known AI provider.
 */
export interface KnownProvider {
    /** Stable provider identifier (matches `ai_provider_credentials.providerId`). */
    readonly id: string;
    /** Human-readable display label for the admin UI. */
    readonly label: string;
    /** Placeholder text shown in the API key input for this provider. */
    readonly apiKeyPlaceholder: string;
    /** Default base URL for the provider's OpenAI-compatible (or native) API. */
    readonly baseURL: string;
    /** URL where the operator can obtain/manage an API key for this provider. Empty string when not applicable (e.g. local providers). */
    readonly keyUrl: string;
    /** Suggested chat/text-generation model IDs for this provider. */
    readonly models: readonly string[];
    /** Whether this provider requires an API key to operate (false for local providers like Ollama). */
    readonly needsApiKey: boolean;
}

/**
 * The curated catalog of well-known AI providers.
 *
 * Immutable (`as const`): both the admin UI and the API's sync-models merge
 * treat this as read-only reference data. Adding a new provider or model here
 * requires a code change and redeploy — that is the exact gap HOS-94's
 * auto-detection feature complements, not replaces.
 *
 * @example
 * ```ts
 * import { KNOWN_PROVIDERS } from '@repo/schemas';
 *
 * const openai = KNOWN_PROVIDERS.find((p) => p.id === 'openai');
 * ```
 */
export const KNOWN_PROVIDERS: readonly KnownProvider[] = [
    {
        id: 'openai',
        label: 'OpenAI (GPT)',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.openai.com/v1',
        keyUrl: 'https://platform.openai.com/api-keys',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
        needsApiKey: true
    },
    {
        id: 'anthropic',
        label: 'Anthropic (Claude)',
        apiKeyPlaceholder: 'sk-ant-...',
        baseURL: 'https://api.anthropic.com/v1',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        needsApiKey: true
    },
    {
        id: 'google',
        label: 'Google (Gemini)',
        apiKeyPlaceholder: 'AIza...',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        keyUrl: 'https://aistudio.google.com/apikey',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        needsApiKey: true
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.deepseek.com/v1',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        needsApiKey: true
    },
    {
        id: 'groq',
        label: 'Groq',
        apiKeyPlaceholder: 'gsk_...',
        baseURL: 'https://api.groq.com/openai/v1',
        keyUrl: 'https://console.groq.com/keys',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        needsApiKey: true
    },
    {
        id: 'together',
        label: 'Together AI',
        apiKeyPlaceholder: '...',
        baseURL: 'https://api.together.xyz/v1',
        keyUrl: 'https://api.together.xyz/settings/api-keys',
        models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
        needsApiKey: true
    },
    {
        id: 'mistral',
        label: 'Mistral AI',
        apiKeyPlaceholder: '...',
        baseURL: 'https://api.mistral.ai/v1',
        keyUrl: 'https://console.mistral.ai/api-keys/',
        models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
        needsApiKey: true
    },
    {
        id: 'moonshot',
        label: 'Moonshot (Kimi)',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.moonshot.cn/v1',
        keyUrl: 'https://platform.moonshot.cn/console/api-keys',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
        needsApiKey: true
    },
    {
        id: 'zhipu',
        label: 'Zhipu AI (GLM)',
        apiKeyPlaceholder: '...',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
        models: ['glm-4-plus', 'glm-4-flash', 'glm-4-long'],
        needsApiKey: true
    },
    {
        id: 'baidu',
        label: 'Baidu (ERNIE)',
        apiKeyPlaceholder: '...',
        baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
        keyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
        models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-128k'],
        needsApiKey: true
    },
    {
        id: 'ollama',
        label: 'Ollama (local)',
        apiKeyPlaceholder: 'ollama (no key needed)',
        baseURL: 'http://localhost:11434/v1',
        keyUrl: '',
        models: ['llama3', 'mistral', 'codellama', 'qwen2.5'],
        needsApiKey: false
    }
] as const;

/** Union of the curated catalog's provider identifiers. */
export type KnownProviderId = (typeof KNOWN_PROVIDERS)[number]['id'];

/**
 * Looks up a curated provider's metadata by id.
 *
 * @param id - Provider identifier to look up (matches `KnownProvider.id`)
 * @returns The matching curated provider metadata, or `undefined` when `id`
 *   is not part of the curated catalog (e.g. a fully custom provider).
 *
 * @example
 * ```ts
 * getKnownProvider('openai')   // { id: 'openai', label: 'OpenAI (GPT)', ... }
 * getKnownProvider('my-proxy') // undefined
 * ```
 */
export function getKnownProvider(id: string): KnownProvider | undefined {
    return KNOWN_PROVIDERS.find((p) => p.id === id);
}
