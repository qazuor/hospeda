import { adminLogger } from '../../utils/logger';
import { ApiError } from '../errors';

export type FetchApiInput = {
    readonly path: string;
    readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
    readonly signal?: AbortSignal;
};

export type FetchApiOutput<T> = {
    readonly data: T;
    readonly status: number;
};

/**
 * Reads a Vite environment variable by name.
 *
 * Vite statically replaces `import.meta.env.*` at build time for known
 * variable names. For dynamic key access we fall back to the full
 * `import.meta.env` object, which Vite exposes at runtime.
 */
const getEnvVar = (key: string): string | undefined => {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    return value;
};

const getBaseUrl = (): string => {
    const url = getEnvVar('VITE_API_URL');
    if (!url) {
        throw new Error('[admin] VITE_API_URL is not configured. Set it in your .env.local file.');
    }
    return url.replace(/\/$/, '');
};

export const fetchApi = async <T>({
    path,
    method = 'GET',
    headers,
    body,
    signal
}: FetchApiInput): Promise<FetchApiOutput<T>> => {
    const base = getBaseUrl();
    const url =
        path.startsWith('http://') || path.startsWith('https://')
            ? path
            : `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const isJson = body !== undefined;
    const debugActorId = getEnvVar('VITE_DEBUG_ACTOR_ID');

    adminLogger.debug(`Making API call to: ${url}`);

    const res = await fetch(url, {
        method,
        headers: {
            ...(isJson ? { 'Content-Type': 'application/json' } : {}),
            ...(debugActorId ? { 'x-actor-id': debugActorId, 'x-user-id': debugActorId } : {}),
            ...headers
        },
        body: isJson ? JSON.stringify(body) : undefined,
        signal,
        credentials: 'include'
    });
    const status = res.status;
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
        parsed = text ? JSON.parse(text) : undefined;
    } catch {
        // not json
        parsed = undefined;
    }
    if (!res.ok) {
        // Try to extract error message from different possible structures
        const errorBody = parsed as
            | {
                  message?: string;
                  error?: { message?: string; name?: string; code?: string };
                  success?: boolean;
              }
            | undefined;

        let message = `Request failed (${status})`;
        let errorCode: string | undefined;

        if (errorBody?.error?.message) {
            // API error with nested error object (like Zod errors)
            message = errorBody.error.message;
            errorCode = errorBody.error.code;
        } else if (errorBody?.message) {
            // Direct message property
            message = errorBody.message;
        }

        throw new ApiError(message, {
            status,
            code: errorCode as import('../errors').ApiErrorCode | undefined,
            body: parsed,
            url,
            method
        });
    }
    // Guard against empty/null response body on successful responses
    if (parsed === undefined || parsed === null) {
        adminLogger.warn(`[fetchApi] Empty response body from ${method} ${url} (status ${status})`);
        return { data: {} as T, status };
    }

    return { data: parsed as T, status };
};
