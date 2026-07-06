/**
 * Standalone list-models fetcher (HOS-94, T-003, OQ-4 — resolved option b).
 *
 * Given a provider id and a decrypted API key, returns the raw model IDs the
 * credential has access to. This is deliberately **decoupled from the
 * `AiProvider` interface**: it is a plain REST `fetch`, never routed through
 * the Vercel AI SDK, so it has zero overlap with HOS-88 (AI SDK v4 migration,
 * which edits `vercel-openai.adapter.ts`) and stays SDK-version-independent.
 *
 * **Scope (T-003)**: OpenAI + OpenAI-compatible providers only (`GET
 * {baseURL}/models` with `Authorization: Bearer <key>`). Anthropic (T-004)
 * and Google Gemini / Ollama (T-005) are dispatched through
 * {@link resolveProviderFamily} but not yet implemented — see the seam below.
 *
 * **Caller responsibilities** (never done here): decrypting the stored
 * credential, filtering the raw IDs to chat/text-capable models, merging with
 * the curated `KNOWN_PROVIDERS` catalog, and persisting the operator's
 * enabled selection. All of that lives in `apps/api` (spec §6.2-6.4,
 * §12 "keep the adapter dumb").
 *
 * **Secret handling (R-5)**: the API key is only ever placed in the
 * `Authorization` header of the outbound request. It is never logged, never
 * included in a thrown error message, and never echoed back in the result.
 *
 * @module ai-core/providers/list-models
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Base error for all `listProviderModels` failures.
 *
 * Every failure mode carries a stable machine-readable `code` and the
 * `providerId` that triggered it, so callers (the admin sync-models route,
 * T-004 of this spec) can map it to a typed HTTP response without parsing the
 * human-readable `message`.
 */
export class ListModelsError extends Error {
    /** Stable machine-readable error code. */
    readonly code: string;
    /** The provider id the failed request targeted. */
    readonly providerId: string;

    constructor(message: string, code: string, providerId: string) {
        super(message);
        this.name = 'ListModelsError';
        this.code = code;
        this.providerId = providerId;
    }
}

/**
 * Thrown when the provider rejects the API key (HTTP 401/403).
 *
 * Maps to `PROVIDER_UNCONFIGURED`/auth-error handling in the caller (spec §7):
 * the credential exists but the provider considers it invalid or expired.
 */
export class ListModelsAuthError extends ListModelsError {
    constructor(providerId: string, status: number) {
        super(
            `Provider '${providerId}' rejected the API key (HTTP ${status}). The key may be invalid, revoked, or expired.`,
            'LIST_MODELS_AUTH_FAILED',
            providerId
        );
        this.name = 'ListModelsAuthError';
    }
}

/**
 * Thrown when the provider rate-limits the list-models request (HTTP 429).
 */
export class ListModelsRateLimitError extends ListModelsError {
    constructor(providerId: string) {
        super(
            `Provider '${providerId}' rate-limited the list-models request (HTTP 429). Retry later.`,
            'LIST_MODELS_RATE_LIMITED',
            providerId
        );
        this.name = 'ListModelsRateLimitError';
    }
}

/**
 * Thrown for any other non-OK HTTP response (5xx, unexpected 4xx, network
 * shape errors). Distinguishes "provider is down/misbehaving" from "our key
 * is bad" so the UI can render a retry affordance instead of a credential
 * warning.
 */
export class ListModelsUpstreamError extends ListModelsError {
    /** The HTTP status returned by the provider, when available. */
    readonly status: number | undefined;

    constructor(providerId: string, status: number | undefined, detail: string) {
        super(
            `List-models request to provider '${providerId}' failed: ${detail}`,
            'LIST_MODELS_UPSTREAM_ERROR',
            providerId
        );
        this.name = 'ListModelsUpstreamError';
        this.status = status;
    }
}

/**
 * Thrown for a provider family that is dispatched by
 * {@link resolveProviderFamily} but has no fetcher implemented yet.
 *
 * This is the seam T-004 (Anthropic) and T-005 (Gemini, Ollama) fill in —
 * their fetchers replace the corresponding branch in {@link fetchModelsForFamily}
 * and this error stops being reachable for their family.
 */
export class ListModelsUnsupportedProviderError extends ListModelsError {
    constructor(providerId: string, family: ProviderFamily) {
        super(
            `List-models is not yet implemented for provider family '${family}' (provider '${providerId}').`,
            'LIST_MODELS_UNSUPPORTED_PROVIDER',
            providerId
        );
        this.name = 'ListModelsUnsupportedProviderError';
    }
}

// ---------------------------------------------------------------------------
// Provider family dispatch seam
// ---------------------------------------------------------------------------

/**
 * The families of provider HTTP shapes list-models must speak (spec §6.1).
 *
 * `openai-compatible` covers OpenAI itself plus every OpenAI-compatible
 * provider reachable via a custom `baseURL` (Groq, DeepSeek, Together,
 * Mistral, Moonshot, Zhipu, Baidu — the `KNOWN_PROVIDERS` catalog in
 * `apps/admin`). `anthropic`, `gemini`, and `ollama` are dispatched here but
 * implemented by later tasks (T-004/T-005).
 */
export type ProviderFamily = 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';

/**
 * Resolves which HTTP shape a given provider id speaks.
 *
 * Only `anthropic`, `google` (Gemini), and `ollama` need special-casing;
 * every other provider id (including OpenAI itself and all OpenAI-compatible
 * providers configured via `baseURL`) defaults to `openai-compatible`.
 *
 * @param providerId - The provider id from `ai_provider_credentials`
 *   (matches a key in the admin `KNOWN_PROVIDERS` catalog).
 * @returns The resolved provider family.
 *
 * @example
 * ```ts
 * resolveProviderFamily('openai')   // 'openai-compatible'
 * resolveProviderFamily('groq')     // 'openai-compatible'
 * resolveProviderFamily('anthropic') // 'anthropic'
 * resolveProviderFamily('google')   // 'gemini'
 * resolveProviderFamily('ollama')   // 'ollama'
 * ```
 */
export function resolveProviderFamily(providerId: string): ProviderFamily {
    if (providerId === 'anthropic') {
        return 'anthropic';
    }
    if (providerId === 'google') {
        return 'gemini';
    }
    if (providerId === 'ollama') {
        return 'ollama';
    }
    return 'openai-compatible';
}

// ---------------------------------------------------------------------------
// Input / output contracts
// ---------------------------------------------------------------------------

/**
 * Input for {@link listProviderModels}.
 */
export interface ListProviderModelsInput {
    /** The provider id (matches `AiProviderId` / `KNOWN_PROVIDERS` keys). */
    readonly providerId: string;
    /** The decrypted API key. Never logged, never echoed back. */
    readonly apiKey: string;
    /**
     * Optional custom base URL, for OpenAI-compatible providers and Ollama.
     * When absent, the provider-family default is used.
     */
    readonly baseURL?: string;
}

/**
 * Output of {@link listProviderModels}.
 */
export interface ListProviderModelsResult {
    /** Raw model IDs the credential has access to, in provider response order. */
    readonly ids: readonly string[];
    /**
     * Non-fatal warnings (e.g. an unexpected response shape for a subset of
     * entries). Absent when there is nothing to report.
     */
    readonly warnings?: string[];
}

// ---------------------------------------------------------------------------
// OpenAI + OpenAI-compatible fetcher (T-003)
// ---------------------------------------------------------------------------

/** Default OpenAI API base URL, used when no `baseURL` override is supplied. */
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

/** Minimal shape of the `GET /models` response body this parser relies on. */
interface OpenAiModelsListResponse {
    readonly data?: readonly unknown[];
}

/**
 * Fetches and parses the model catalog for OpenAI and OpenAI-compatible
 * providers via `GET {baseURL}/models`.
 *
 * @param input - Provider id, API key, and optional `baseURL` override.
 * @returns The parsed model IDs, plus warnings for any entry missing a
 *   string `id` field.
 *
 * @throws {ListModelsAuthError} On HTTP 401/403.
 * @throws {ListModelsRateLimitError} On HTTP 429.
 * @throws {ListModelsUpstreamError} On any other non-OK response, or a
 *   response body that cannot be parsed as the expected shape.
 */
async function fetchOpenAiCompatibleModels(
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    const { providerId, apiKey, baseURL } = input;
    const url = `${baseURL ?? DEFAULT_OPENAI_BASE_URL}/models`;

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`
            }
        });
    } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'network request failed';
        throw new ListModelsUpstreamError(providerId, undefined, detail);
    }

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            throw new ListModelsAuthError(providerId, response.status);
        }
        if (response.status === 429) {
            throw new ListModelsRateLimitError(providerId);
        }
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            `HTTP ${response.status} ${response.statusText}`
        );
    }

    let body: OpenAiModelsListResponse;
    try {
        body = (await response.json()) as OpenAiModelsListResponse;
    } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'invalid JSON response';
        throw new ListModelsUpstreamError(providerId, response.status, detail);
    }

    if (!Array.isArray(body.data)) {
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            'response body is missing a "data" array'
        );
    }

    const ids: string[] = [];
    const warnings: string[] = [];
    for (const entry of body.data) {
        const id = (entry as { id?: unknown } | null)?.id;
        if (typeof id === 'string' && id.length > 0) {
            ids.push(id);
        } else {
            warnings.push('Skipped a model entry with a missing or non-string "id" field.');
        }
    }

    return warnings.length > 0 ? { ids, warnings } : { ids };
}

// ---------------------------------------------------------------------------
// Family dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches to the fetcher for the resolved {@link ProviderFamily}.
 *
 * This is the seam future tasks extend: T-004 replaces the `'anthropic'`
 * branch, T-005 replaces `'gemini'` and `'ollama'`, each with a real fetcher
 * matching the shape documented in spec §6.1. Until then those branches throw
 * {@link ListModelsUnsupportedProviderError}.
 */
async function fetchModelsForFamily(
    family: ProviderFamily,
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    switch (family) {
        case 'openai-compatible':
            return fetchOpenAiCompatibleModels(input);
        case 'anthropic':
        case 'gemini':
        case 'ollama':
            throw new ListModelsUnsupportedProviderError(input.providerId, family);
        default: {
            // Exhaustiveness guard: adding a new ProviderFamily member without
            // handling it here is a compile-time error.
            const exhaustive: never = family;
            throw new ListModelsUnsupportedProviderError(input.providerId, exhaustive);
        }
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches the raw list of model IDs a provider credential has access to
 * (HOS-94 G-1, OQ-4).
 *
 * Plain `fetch`, no AI SDK involved — fully decoupled from the
 * generate/stream provider contract (`AiProvider`) and from HOS-88's SDK
 * version migration. Filtering to chat-capable models and merging with the
 * curated `KNOWN_PROVIDERS` catalog happen in the caller (`apps/api`), not
 * here — this function returns the provider's raw answer only.
 *
 * @param input - The provider id, decrypted API key, and optional `baseURL`
 *   override (used by OpenAI-compatible providers and Ollama).
 * @returns The raw model IDs, plus non-fatal warnings when some entries in
 *   the response could not be parsed.
 *
 * @throws {ListModelsAuthError} The provider rejected the API key (401/403).
 * @throws {ListModelsRateLimitError} The provider rate-limited the request (429).
 * @throws {ListModelsUpstreamError} Any other transport/response failure.
 * @throws {ListModelsUnsupportedProviderError} The resolved provider family
 *   has no fetcher implemented yet (anthropic/gemini/ollama — T-004/T-005).
 *
 * @example
 * ```ts
 * const { ids } = await listProviderModels({
 *   providerId: 'openai',
 *   apiKey: decryptedKey,
 * });
 * // ids: ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small', ...]
 * ```
 */
export async function listProviderModels(
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    const family = resolveProviderFamily(input.providerId);
    return fetchModelsForFamily(family, input);
}
