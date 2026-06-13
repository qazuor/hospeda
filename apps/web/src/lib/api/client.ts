/**
 * Centralized API client for consuming apps/api public endpoints.
 * Provides typed fetch wrapper with error handling, timeout, and query serialization.
 */
import { getApiUrl } from '../env';
import type {
    ApiError,
    ApiErrorResponse,
    ApiResult,
    ApiSuccessResponse,
    PaginatedResponse
} from './types';

/** Resolved lazily on first request so module import never throws. */
let _cachedBaseUrl: string | undefined;

function getBaseUrl(): string {
    if (!_cachedBaseUrl) {
        _cachedBaseUrl = getApiUrl().replace(/\/$/, '');
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
    headers: extraHeaders
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
}): Promise<ApiResult<T>> {
    // SPEC-131: compute the URL inside the try block so a misconfigured
    // env (no PUBLIC_API_URL / HOSPEDA_API_URL) returns { ok: false } instead
    // of letting the async function throw — which would violate the ApiResult<T>
    // return type contract and bypass the `catch` in the component's click handler.
    let url = '';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        url = `${getBaseUrl()}${path}${serializeParams(params)}`;
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
                error: { status: 408, message: `Request timeout after ${REQUEST_TIMEOUT}ms` }
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
}

/**
 * API client with typed HTTP methods.
 */
export const apiClient = {
    /** GET request returning typed data */
    get<T>({
        path,
        params
    }: { path: string; params?: Record<string, unknown> }): Promise<ApiResult<T>> {
        return request<T>({ method: 'GET', path, params });
    },

    /** GET request returning paginated data */
    getList<T>({
        path,
        params
    }: {
        path: string;
        params?: Record<string, unknown>;
    }): Promise<ApiResult<PaginatedResponse<T>>> {
        return request<PaginatedResponse<T>>({ method: 'GET', path, params });
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
     * POST request with authentication credentials.
     *
     * @param headers - Optional extra request headers. Required when hitting
     *   endpoints wrapped by `idempotencyKeyMiddleware`
     *   (`/billing/subscriptions/start-paid`, `/billing/addons/:slug/purchase`,
     *   `/billing/addons/:id/cancel`) which enforce `X-Idempotency-Key`. Send
     *   a fresh UUID v4 per logical user action (`crypto.randomUUID()`).
     */
    postProtected<T>({
        path,
        body,
        cookieHeader,
        headers
    }: {
        path: string;
        body?: unknown;
        cookieHeader?: string;
        headers?: Record<string, string>;
    }): Promise<ApiResult<T>> {
        return request<T>({
            method: 'POST',
            path,
            body,
            withCredentials: true,
            cookieHeader,
            headers
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
