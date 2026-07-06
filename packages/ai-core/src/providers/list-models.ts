/**
 * Standalone list-models fetcher (HOS-94, T-003, OQ-4 — resolved option b).
 *
 * Given a provider id and a decrypted API key, returns the raw model IDs the
 * credential has access to. This is deliberately **decoupled from the
 * `AiProvider` interface**: it is a plain REST `fetch`, never routed through
 * the Vercel AI SDK, so it has zero overlap with HOS-88 (AI SDK v4 migration,
 * which edits `vercel-openai.adapter.ts`) and stays SDK-version-independent.
 *
 * **Scope**: all four provider families from spec §6.1 are implemented —
 * OpenAI + OpenAI-compatible (T-003, `GET {baseURL}/models` with
 * `Authorization: Bearer <key>`), Anthropic (T-004, `GET
 * https://api.anthropic.com/v1/models` with `x-api-key` +
 * `anthropic-version`), and Google Gemini / Ollama (T-005, `GET
 * .../v1beta/models?key=<key>` and `GET {baseURL}/api/tags` respectively).
 * Dispatch happens through {@link resolveProviderFamily} /
 * {@link fetchModelsForFamily}.
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
 * {@link resolveProviderFamily} but has no fetcher implemented.
 *
 * With T-004/T-005 landed, every member of {@link ProviderFamily} has a real
 * fetcher in {@link fetchModelsForFamily}; this error is now only reachable
 * if a future {@link ProviderFamily} member is added without a matching
 * fetcher (the `default` branch's exhaustiveness guard).
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
 * `apps/admin`). `anthropic`, `gemini`, and `ollama` each speak their own
 * fixed HTTP shape (T-004/T-005).
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
// Shared HTTP helpers (T-004/T-005 — de-duplicated across all four fetchers)
// ---------------------------------------------------------------------------

/**
 * OQ-5 — per-provider path convention (spec §6.1 / §11, resolved: no
 * per-credential override in v1). Each family speaks a fixed URL shape:
 *
 * - `openai-compatible` — `{baseURL ?? https://api.openai.com/v1}/models`,
 *   `Authorization: Bearer <key>`.
 * - `anthropic` — fixed `https://api.anthropic.com/v1/models` (no custom
 *   `baseURL`), `x-api-key` + `anthropic-version`.
 * - `gemini` — fixed `https://generativelanguage.googleapis.com/v1beta/models`
 *   (no custom `baseURL`), API key passed as a `?key=` query parameter.
 * - `ollama` — `{baseURL}/api/tags`; `baseURL` is REQUIRED (Ollama is always
 *   self-hosted, there is no sensible default), no auth header.
 */
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models';
const ANTHROPIC_API_VERSION = '2023-06-01';
const GEMINI_MODELS_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_NAME_PREFIX = 'models/';

/**
 * Performs the outbound `fetch`, translating a network-level failure (DNS,
 * connection refused, timeout, …) into a {@link ListModelsUpstreamError}
 * instead of letting a raw exception escape.
 *
 * @param providerId - The provider id, for error attribution.
 * @param url - The fully-resolved request URL.
 * @param init - Standard `fetch` options (method/headers).
 */
async function performListModelsFetch(
    providerId: string,
    url: string,
    init: RequestInit
): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'network request failed';
        throw new ListModelsUpstreamError(providerId, undefined, detail);
    }
}

/**
 * Maps a non-OK HTTP response to the appropriate typed error, shared across
 * all four provider fetchers (spec §7 error contract).
 *
 * @throws {ListModelsAuthError} On HTTP 401/403.
 * @throws {ListModelsRateLimitError} On HTTP 429.
 * @throws {ListModelsUpstreamError} On any other non-OK status.
 */
function throwForHttpError(providerId: string, response: Response): never {
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

/**
 * Parses a response body as JSON, wrapping a parse failure in a
 * {@link ListModelsUpstreamError} instead of letting it escape as a raw
 * `SyntaxError`.
 */
async function parseJsonBody<T>(providerId: string, response: Response): Promise<T> {
    try {
        return (await response.json()) as T;
    } catch (cause) {
        const detail = cause instanceof Error ? cause.message : 'invalid JSON response';
        throw new ListModelsUpstreamError(providerId, response.status, detail);
    }
}

/**
 * Extracts a string field from each entry of a raw model-list array,
 * skipping (with a warning) any entry where the field is missing or not a
 * string. Shared parsing logic for the `data[].id` (OpenAI/Anthropic) and
 * `models[].name` (Gemini/Ollama) response shapes.
 *
 * @param entries - The raw array of model entries from the response body.
 * @param field - Which field to extract (`'id'` or `'name'`).
 * @param transform - Optional post-processing applied to each extracted
 *   value (e.g. stripping Gemini's `models/` prefix).
 */
function extractModelIds(
    entries: readonly unknown[],
    field: 'id' | 'name',
    transform?: (value: string) => string
): ListProviderModelsResult {
    const ids: string[] = [];
    const warnings: string[] = [];
    for (const entry of entries) {
        const value = (entry as Record<string, unknown> | null)?.[field];
        if (typeof value === 'string' && value.length > 0) {
            ids.push(transform ? transform(value) : value);
        } else {
            warnings.push(`Skipped a model entry with a missing or non-string "${field}" field.`);
        }
    }
    return warnings.length > 0 ? { ids, warnings } : { ids };
}

// ---------------------------------------------------------------------------
// OpenAI + OpenAI-compatible fetcher (T-003)
// ---------------------------------------------------------------------------

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

    const response = await performListModelsFetch(providerId, url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        throwForHttpError(providerId, response);
    }

    const body = await parseJsonBody<OpenAiModelsListResponse>(providerId, response);

    if (!Array.isArray(body.data)) {
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            'response body is missing a "data" array'
        );
    }

    return extractModelIds(body.data, 'id');
}

// ---------------------------------------------------------------------------
// Anthropic fetcher (T-004)
// ---------------------------------------------------------------------------

/** Minimal shape of the Anthropic `GET /v1/models` response body. */
interface AnthropicModelsListResponse {
    readonly data?: readonly unknown[];
}

/**
 * Fetches and parses the model catalog for Anthropic via
 * `GET https://api.anthropic.com/v1/models`.
 *
 * Anthropic does not accept a custom `baseURL` in this fetcher — it is a
 * fixed first-party endpoint, unlike the OpenAI-compatible family (OQ-5: no
 * per-credential path override in v1).
 *
 * @param input - Provider id and API key. Any `baseURL` on the input is
 *   ignored for this family.
 * @returns The parsed model IDs, plus warnings for any entry missing a
 *   string `id` field.
 *
 * @throws {ListModelsAuthError} On HTTP 401/403.
 * @throws {ListModelsRateLimitError} On HTTP 429.
 * @throws {ListModelsUpstreamError} On any other non-OK response, or a
 *   response body that cannot be parsed as the expected shape.
 */
async function fetchAnthropicModels(
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    const { providerId, apiKey } = input;

    const response = await performListModelsFetch(providerId, ANTHROPIC_MODELS_URL, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION
        }
    });

    if (!response.ok) {
        throwForHttpError(providerId, response);
    }

    const body = await parseJsonBody<AnthropicModelsListResponse>(providerId, response);

    if (!Array.isArray(body.data)) {
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            'response body is missing a "data" array'
        );
    }

    return extractModelIds(body.data, 'id');
}

// ---------------------------------------------------------------------------
// Google Gemini fetcher (T-005)
// ---------------------------------------------------------------------------

/** Minimal shape of the Gemini `GET /v1beta/models` response body. */
interface GeminiModelsListResponse {
    readonly models?: readonly unknown[];
}

/**
 * Fetches and parses the model catalog for Google Gemini via
 * `GET https://generativelanguage.googleapis.com/v1beta/models?key=<apiKey>`.
 *
 * The API key travels as a `?key=` query parameter (Gemini's convention, not
 * an `Authorization` header). Each entry's `name` field arrives prefixed
 * with `models/` (e.g. `models/gemini-1.5-pro`); this fetcher strips that
 * prefix so the returned ids match the bare model id used elsewhere in the
 * catalog (spec §6.1, AC-2).
 *
 * @param input - Provider id and API key. Any `baseURL` on the input is
 *   ignored for this family (fixed first-party endpoint, OQ-5).
 * @returns The parsed, prefix-stripped model ids, plus warnings for any
 *   entry missing a string `name` field.
 *
 * @throws {ListModelsAuthError} On HTTP 401/403.
 * @throws {ListModelsRateLimitError} On HTTP 429.
 * @throws {ListModelsUpstreamError} On any other non-OK response, or a
 *   response body that cannot be parsed as the expected shape.
 */
async function fetchGeminiModels(
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    const { providerId, apiKey } = input;
    const url = `${GEMINI_MODELS_BASE_URL}?key=${encodeURIComponent(apiKey)}`;

    const response = await performListModelsFetch(providerId, url, { method: 'GET' });

    if (!response.ok) {
        throwForHttpError(providerId, response);
    }

    const body = await parseJsonBody<GeminiModelsListResponse>(providerId, response);

    if (!Array.isArray(body.models)) {
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            'response body is missing a "models" array'
        );
    }

    return extractModelIds(body.models, 'name', (name) =>
        name.startsWith(GEMINI_NAME_PREFIX) ? name.slice(GEMINI_NAME_PREFIX.length) : name
    );
}

// ---------------------------------------------------------------------------
// Ollama fetcher (T-005)
// ---------------------------------------------------------------------------

/** Minimal shape of the Ollama `GET /api/tags` response body. */
interface OllamaTagsResponse {
    readonly models?: readonly unknown[];
}

/**
 * Fetches and parses the model catalog for a local/self-hosted Ollama
 * instance via `GET {baseURL}/api/tags`. Ollama has no first-party hosted
 * endpoint and needs no authentication — the request carries no
 * `Authorization` header.
 *
 * @param input - Provider id and a **required** `baseURL` (e.g.
 *   `http://localhost:11434`). `apiKey` is accepted for interface
 *   uniformity but unused — Ollama does not authenticate list-models calls.
 * @returns The parsed model ids, plus warnings for any entry missing a
 *   string `name` field.
 *
 * @throws {ListModelsUpstreamError} When `baseURL` is missing (Ollama has
 *   no sensible default — OQ-5), on any non-OK response, or when the
 *   response body cannot be parsed as the expected shape.
 * @throws {ListModelsAuthError} On HTTP 401/403 (unusual for Ollama, but
 *   handled for consistency if a proxied/secured instance returns one).
 * @throws {ListModelsRateLimitError} On HTTP 429.
 */
async function fetchOllamaModels(
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    const { providerId, baseURL } = input;

    if (!baseURL) {
        throw new ListModelsUpstreamError(
            providerId,
            undefined,
            'Ollama requires a baseURL (e.g. http://localhost:11434); none was provided.'
        );
    }

    const url = `${baseURL}/api/tags`;
    const response = await performListModelsFetch(providerId, url, { method: 'GET' });

    if (!response.ok) {
        throwForHttpError(providerId, response);
    }

    const body = await parseJsonBody<OllamaTagsResponse>(providerId, response);

    if (!Array.isArray(body.models)) {
        throw new ListModelsUpstreamError(
            providerId,
            response.status,
            'response body is missing a "models" array'
        );
    }

    return extractModelIds(body.models, 'name');
}

// ---------------------------------------------------------------------------
// Family dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatches to the fetcher for the resolved {@link ProviderFamily}.
 *
 * Every family now has a real fetcher (T-003 OpenAI-compatible, T-004
 * Anthropic, T-005 Gemini/Ollama), each matching the HTTP shape documented
 * in spec §6.1. {@link ListModelsUnsupportedProviderError} remains reachable
 * only through the `default` exhaustiveness guard, for a future
 * {@link ProviderFamily} member added without a matching fetcher.
 */
async function fetchModelsForFamily(
    family: ProviderFamily,
    input: ListProviderModelsInput
): Promise<ListProviderModelsResult> {
    switch (family) {
        case 'openai-compatible':
            return fetchOpenAiCompatibleModels(input);
        case 'anthropic':
            return fetchAnthropicModels(input);
        case 'gemini':
            return fetchGeminiModels(input);
        case 'ollama':
            return fetchOllamaModels(input);
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
 * @throws {ListModelsUpstreamError} Any other transport/response failure
 *   (including a missing required `baseURL` for Ollama).
 * @throws {ListModelsUnsupportedProviderError} Reachable only if a future
 *   {@link ProviderFamily} member is added without a matching fetcher; every
 *   family currently supported (openai-compatible/anthropic/gemini/ollama)
 *   has one.
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
