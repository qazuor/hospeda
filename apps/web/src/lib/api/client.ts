/**
 * Centralized API client for consuming apps/api public endpoints.
 * Provides typed fetch wrapper with error handling, timeout, and query serialization.
 */
import type {
    ApiError,
    ApiErrorResponse,
    ApiResult,
    ApiSuccessResponse,
    PaginatedResponse
} from './types';

/** Configuration for the API client */
interface ApiClientConfig {
    readonly baseUrl: string;
    readonly timeout: number;
}

/** Resolve the API base URL from environment variables */
function resolveBaseUrl(): string {
    const url =
        import.meta.env.PUBLIC_API_URL ??
        import.meta.env.HOSPEDA_API_URL ??
        'http://localhost:3001';
    return url.replace(/\/$/, '');
}

const config: ApiClientConfig = {
    baseUrl: resolveBaseUrl(),
    timeout: 10_000
};

/**
 * Serialize query parameters into a URL search string.
 * Filters out undefined/null values.
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
    withCredentials
}: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    params?: Record<string, unknown>;
    body?: unknown;
    withCredentials?: boolean;
}): Promise<ApiResult<T>> {
    const url = `${config.baseUrl}${path}${serializeParams(params)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
        const headers: Record<string, string> = {
            Accept: 'application/json'
        };
        if (body) {
            headers['Content-Type'] = 'application/json';
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
                error: { status: 408, message: `Request timeout after ${config.timeout}ms` }
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
 * All public endpoints are under /api/v1/public/*.
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

    /** DELETE request */
    delete<T>({ path }: { path: string }): Promise<ApiResult<T>> {
        return request<T>({ method: 'DELETE', path, withCredentials: true });
    },

    /** GET request with authentication credentials */
    getProtected<T>({
        path,
        params
    }: { path: string; params?: Record<string, unknown> }): Promise<ApiResult<T>> {
        return request<T>({ method: 'GET', path, params, withCredentials: true });
    },

    /** POST request with authentication credentials */
    postProtected<T>({ path, body }: { path: string; body?: unknown }): Promise<ApiResult<T>> {
        return request<T>({ method: 'POST', path, body, withCredentials: true });
    }
};
