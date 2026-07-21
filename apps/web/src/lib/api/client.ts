/**
 * Centralized API client for consuming apps/api public endpoints.
 * Provides typed fetch wrapper with error handling, timeout, and query serialization.
 */
import { getApiUrl, getInternalApiUrl, getInternalRequestSecret } from '../env';
import { getOrSetCached } from './ssr-cache';
import type {
    ApiError,
    ApiErrorResponse,
    ApiResult,
    ApiSuccessResponse,
    PaginatedResponse
} from './types';

/** Resolved lazily on first request so module import never throws. */
let _cachedBaseUrl: string | undefined;

/**
 * Resolves the API base URL. During SSR, prefers the internal API URL
 * (HOS-103) so server-to-server fetches stay on the internal network; the
 * browser bundle and any SSR call without an internal URL configured fall back
 * to the public URL.
 */
function resolveBaseUrl(): string {
    if (import.meta.env.SSR) {
        const internal = getInternalApiUrl();
        if (internal) {
            return internal;
        }
    }
    return getApiUrl().replace(/\/$/, '');
}

function getBaseUrl(): string {
    if (!_cachedBaseUrl) {
        _cachedBaseUrl = resolveBaseUrl();
    }
    return _cachedBaseUrl;
}

const REQUEST_TIMEOUT = 10_000;

/**
 * Serialize query parameters into a URL search string.
 */
function serializeParams(params?: Record<string, unknown>): string {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.set(key, String(value));
        }
    }
    const str = searchParams.toString();
    return str ? `?${str}` : '';
}

/**
 * Parse an error response or network error into a structured ApiError.
 */
function parseError({ status, body }: { status: number; body?: unknown }): ApiError {
    if (body && typeof body === 'object' && 'error' in body) {
        const errBody = body as ApiErrorResponse;
        return {
            status,
            message: errBody.error.message,
            code: errBody.error.code,
            reason: errBody.error.reason,
            details: errBody.error.details
        };
    }
    return {
        status,
        message: `API request failed with status ${status}`
    };
}

/**
 * Execute a fetch request with timeout and error handling.
 */
async function request<T>({
    method,
    path,
    params,
    body,
    withCredentials,
    cookieHeader,
    headers: extraHeaders,
    cacheTtlMs,
    timeoutMs
}: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    params?: Record<string, unknown>;
    body?: unknown;
    withCredentials?: boolean;
    /**
     * Raw `Cookie` header to forward on the outgoing request. Required for SSR
     * callers because `credentials: 'include'` only forwards cookies in browser
     * context — server-to-server fetch has no cookie jar to draw from.
     */
    cookieHeader?: string;
    /**
     * Additional request headers to merge in alongside the defaults (Accept,
     * Content-Type, cookie). Used by callers that hit endpoints requiring
     * extra headers like `X-Idempotency-Key` (the billing mutating endpoints
     * enforce this via `idempotencyKeyMiddleware` — see SPEC-143 T-143-60).
     */
    headers?: Record<string, string>;
    /**
     * When set (> 0), enables the short-TTL SSR cache for this request (HOS-103).
     * Only honoured for anonymous GETs during SSR (see the `cacheable` guard
     * below). Used by public "catalog" endpoints (destinations, stats,
     * announcements, featured accommodations, latest posts, testimonials) whose
     * SSR fan-out otherwise exhausts the public rate-limit bucket.
     */
    cacheTtlMs?: number;
    /**
     * Optional override for the request's abort timeout, in milliseconds.
     * Defaults to {@link REQUEST_TIMEOUT} (10s) when omitted. Use this for
     * endpoints whose backend work legitimately exceeds the default budget
     * (e.g. the AI translate endpoint, which performs up to ~8 sequential
     * LLM calls) — BETA-135.
     */
    timeoutMs?: number;
}): Promise<ApiResult<T>> {
    // SPEC-131: never let this function throw — a misconfigured env or network
    // error must resolve to { ok: false } so callers keep the ApiResult<T>
    // contract. The fetch + parse lives in `exec`; the URL is computed inside it
    // so a bad base URL surfaces as an error result, not a thrown exception.
    const effectiveTimeoutMs = timeoutMs ?? REQUEST_TIMEOUT;
    const exec = async (): Promise<ApiResult<T>> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);
        try {
            const url = `${getBaseUrl()}${path}${serializeParams(params)}`;
            const headers: Record<string, string> = {
                Accept: 'application/json',
                ...extraHeaders
            };
            if (body) {
                headers['Content-Type'] = 'application/json';
            }
            if (cookieHeader) {
                headers.cookie = cookieHeader;
            }
            // HOS-103: over the internal URL during SSR, attach the shared secret
            // so the API exempts this server-to-server traffic from the public
            // per-IP rate limit. Gated on SSR + a configured internal URL so the
            // secret never reaches the browser bundle nor travels over the public
            // network. Fails safe: no secret configured → no header → no bypass.
            if (import.meta.env.SSR && getInternalApiUrl()) {
                const internalSecret = getInternalRequestSecret();
                if (internalSecret) {
                    headers['X-Internal-Request'] = internalSecret;
                }
            }

            const response = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
                ...(withCredentials ? { credentials: 'include' as RequestCredentials } : {})
            });

            const responseBody: unknown = await response.json().catch(() => null);

            if (!response.ok) {
                return {
                    ok: false,
                    error: parseError({ status: response.status, body: responseBody })
                };
            }

            // API responses are wrapped in { success, data, metadata }
            const successBody = responseBody as ApiSuccessResponse<T>;
            if (successBody && typeof successBody === 'object' && 'data' in successBody) {
                return { ok: true, data: successBody.data };
            }

            // Fallback: return raw body as data
            return { ok: true, data: responseBody as T };
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                return {
                    ok: false,
                    error: { status: 408, message: `Request timeout after ${effectiveTimeoutMs}ms` }
                };
            }
            return {
                ok: false,
                error: {
                    status: 0,
                    message: err instanceof Error ? err.message : 'Network error'
                }
            };
        } finally {
            clearTimeout(timeoutId);
        }
    };

    // Route anonymous GETs through the short-TTL SSR cache when the caller opts
    // in (HOS-103). Every other request (mutations, authenticated reads, and all
    // browser-side calls) executes directly.
    const cacheable =
        method === 'GET' &&
        !withCredentials &&
        !cookieHeader &&
        body === undefined &&
        typeof cacheTtlMs === 'number' &&
        cacheTtlMs > 0 &&
        import.meta.env.SSR;

    if (!cacheable) {
        return exec();
    }

    return getOrSetCached<ApiResult<T>>({
        key: `GET ${path}${serializeParams(params)}`,
        ttlMs: cacheTtlMs as number,
        loader: exec,
        // Only cache successful responses; errors are retried next call.
        isCacheable: (result) => result.ok === true
    });
}

/**
 * API client with typed HTTP methods.
 */
export const apiClient = {
    /**
     * GET request returning typed data.
     *
     * @param cacheTtlMs - Optional. When set (> 0), enables the short-TTL SSR
     *   cache for this call (HOS-103). Only public "catalog" endpoints should
     *   opt in; never pass it for interactive (search) or personalized reads.
     */
    get<T>({
        path,
        params,
        cacheTtlMs
    }: {
        path: string;
        params?: Record<string, unknown>;
        cacheTtlMs?: number;
    }): Promise<ApiResult<T>> {
        return request<T>({ method: 'GET', path, params, cacheTtlMs });
    },

    /**
     * GET request returning paginated data.
     *
     * @param cacheTtlMs - Optional. When set (> 0), enables the short-TTL SSR
     *   cache for this call (HOS-103). Only public "catalog" endpoints should
     *   opt in; never pass it for interactive (search) or personalized reads.
     */
    getList<T>({
        path,
        params,
        cacheTtlMs
    }: {
        path: string;
        params?: Record<string, unknown>;
        cacheTtlMs?: number;
    }): Promise<ApiResult<PaginatedResponse<T>>> {
        return request<PaginatedResponse<T>>({ method: 'GET', path, params, cacheTtlMs });
    },

    /** POST request */
    post<T>({ path, body }: { path: string; body?: unknown }): Promise<ApiResult<T>> {
        return request<T>({ method: 'POST', path, body });
    },

    /** PATCH request */
    patch<T>({ path, body }: { path: string; body?: unknown }): Promise<ApiResult<T>> {
        return request<T>({ method: 'PATCH', path, body, withCredentials: true });
    },

    /** PUT request (full-replacement update, authenticated) */
    put<T>({ path, body }: { path: string; body?: unknown }): Promise<ApiResult<T>> {
        return request<T>({ method: 'PUT', path, body, withCredentials: true });
    },

    /** DELETE request */
    delete<T>({ path }: { path: string }): Promise<ApiResult<T>> {
        return request<T>({ method: 'DELETE', path, withCredentials: true });
    },

    /**
     * GET request with authentication credentials.
     * Pass `cookieHeader` from SSR callers (e.g. Astro pages) — browser callers
     * can rely on `credentials: 'include'` and should omit it.
     */
    getProtected<T>({
        path,
        params,
        cookieHeader
    }: {
        path: string;
        params?: Record<string, unknown>;
        cookieHeader?: string;
    }): Promise<ApiResult<T>> {
        return request<T>({
            method: 'GET',
            path,
            params,
            withCredentials: true,
            cookieHeader
        });
    },

    /**
     * GET request returning paginated data with authentication credentials.
     * Protected counterpart of `getList`: forwards the session cookie so
     * browser callers (`credentials: 'include'`) and SSR callers (`cookieHeader`)
     * can hit `/protected/*` list endpoints without a 401.
     */
    getListProtected<T>({
        path,
        params,
        cookieHeader
    }: {
        path: string;
        params?: Record<string, unknown>;
        cookieHeader?: string;
    }): Promise<ApiResult<PaginatedResponse<T>>> {
        return request<PaginatedResponse<T>>({
            method: 'GET',
            path,
            params,
            withCredentials: true,
            cookieHeader
        });
    },

    /**
     * POST request with authentication credentials.
     *
     * @param headers - Optional extra request headers. Required when hitting
     *   endpoints wrapped by `idempotencyKeyMiddleware`
     *   (`/billing/subscriptions/start-paid`, `/billing/addons/:slug/purchase`,
     *   `/billing/addons/:id/cancel`) which enforce `X-Idempotency-Key`. Send
     *   a fresh UUID v4 per logical user action (`crypto.randomUUID()`).
     * @param timeoutMs - Optional override for the request's abort timeout, in
     *   milliseconds. Defaults to 10s. Use for endpoints whose backend work
     *   legitimately exceeds the default budget (e.g. the AI translate
     *   endpoint — BETA-135).
     */
    postProtected<T>({
        path,
        body,
        cookieHeader,
        headers,
        timeoutMs
    }: {
        path: string;
        body?: unknown;
        cookieHeader?: string;
        headers?: Record<string, string>;
        timeoutMs?: number;
    }): Promise<ApiResult<T>> {
        return request<T>({
            method: 'POST',
            path,
            body,
            withCredentials: true,
            cookieHeader,
            headers,
            timeoutMs
        });
    }
};

/** Maximum page size allowed by the API validation layer */
const MAX_PAGE_SIZE = 100;

/**
 * Fetch all items from a paginated list endpoint by iterating through pages.
 *
 * @param fetcher - Function that fetches a single page given params
 * @param params - Additional query parameters to pass through
 * @returns All items concatenated across all pages
 */
export async function fetchAllPages<T>({
    fetcher,
    params
}: {
    fetcher: (p: Record<string, unknown>) => Promise<ApiResult<PaginatedResponse<T>>>;
    params?: Record<string, unknown>;
}): Promise<readonly T[]> {
    const baseParams = { ...params, pageSize: MAX_PAGE_SIZE, page: 1 };
    const firstResult = await fetcher(baseParams);

    if (!firstResult.ok) {
        return [];
    }

    const { items, pagination } = firstResult.data;
    const allItems: T[] = [...items];

    if (pagination.totalPages > 1) {
        const pageNumbers = Array.from({ length: pagination.totalPages - 1 }, (_, i) => i + 2);
        const results = await Promise.all(
            pageNumbers.map((page) => fetcher({ ...baseParams, page }))
        );
        for (const result of results) {
            if (result.ok) {
                allItems.push(...result.data.items);
            }
        }
    }

    return allItems;
}
