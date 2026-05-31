/**
 * Thin client for the Hospeda admin API. Used by `cron-list` and
 * `cron-trigger`.
 *
 * Auth: the admin endpoints (`/api/v1/admin/*`) require a Better Auth
 * session cookie minted from an admin login. There is NO bearer-token
 * auth on these endpoints today — see `.qtm/specs/SPEC-102-*` for
 * the planned alternative.
 *
 * Until SPEC-102 lands, the operator pastes the full `Cookie` header
 * value (cookie-name + `=` + value, semicolons between multiple) into
 * `HOPS_ADMIN_COOKIE` in `.env.local`. hops sends it verbatim with
 * every request. When the cookie expires, the API returns 401 and the
 * operator pulls a fresh value from browser DevTools.
 *
 * Response shape (mirrors `apps/api/src/schemas/response-schemas.ts`):
 *   success: { success: true, data: T, metadata?: {...} }
 *   error:   { success: false, error: { code, message, details?, reason? } }
 */

import { get, required } from './env.ts';

/** Standard success envelope returned by the Hospeda API. */
export interface ApiSuccess<T> {
    readonly success: true;
    readonly data: T;
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Standard error envelope returned by the Hospeda API. */
export interface ApiError {
    readonly success: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
        readonly reason?: string;
    };
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Thrown when the API returns non-2xx OR the success envelope says
 * `success: false`. Carries the status + parsed body so callers can
 * surface the API's own error message.
 */
export class HospedaApiError extends Error {
    readonly status: number;
    readonly body: unknown;

    constructor(message: string, status: number, body: unknown) {
        super(message);
        this.name = 'HospedaApiError';
        this.status = status;
        this.body = body;
    }
}

interface ClientOptions {
    /** Override base URL (defaults to env HOSPEDA_API_URL). */
    readonly baseUrl?: string;
    /** Override cookie header (defaults to env HOPS_ADMIN_COOKIE). */
    readonly cookie?: string;
}

/**
 * Build a client pointed at the production Hospeda API. Throws (with
 * a helpful message pointing at `.env.local.example`) if the cookie is
 * not configured.
 */
export function createHospedaApiClient(options: ClientOptions = {}): HospedaApiClient {
    const baseUrl = options.baseUrl ?? get('HOSPEDA_API_URL') ?? 'https://api.hospeda.com.ar';
    const cookie = options.cookie ?? required('HOPS_ADMIN_COOKIE');
    return new HospedaApiClient(baseUrl.replace(/\/$/, ''), cookie);
}

class HospedaApiClient {
    constructor(
        private readonly _baseUrl: string,
        private readonly cookie: string
    ) {}

    /** Base URL the client is talking to (host + scheme, no trailing slash). */
    baseUrl(): string {
        return this._baseUrl;
    }

    /** Issue an authenticated GET and return the unwrapped `data` field. */
    async get<T>(path: string, query: Record<string, string> = {}): Promise<T> {
        return this.request<T>('GET', path, { query });
    }

    /** Issue an authenticated POST and return the unwrapped `data` field. */
    async post<T>(path: string, body?: unknown, query: Record<string, string> = {}): Promise<T> {
        return this.request<T>('POST', path, { body, query });
    }

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        init: { body?: unknown; query?: Record<string, string> }
    ): Promise<T> {
        const url = new URL(`${this._baseUrl}${path}`);
        for (const [k, v] of Object.entries(init.query ?? {})) {
            url.searchParams.set(k, v);
        }

        const response = await fetch(url, {
            method,
            headers: {
                Cookie: this.cookie,
                Accept: 'application/json',
                ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {})
            },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            // Better Auth uses SameSite=Lax; an explicit Origin header
            // mirrors what a browser would send so origin-check
            // middleware does not bounce us.
            redirect: 'manual'
        });

        const text = await response.text();
        const parsed = text ? safeJsonParse(text) : undefined;

        if (!response.ok) {
            const message = formatErrorMessage(parsed, response.status, response.statusText);
            // 401 is the most common failure mode (cookie expired) — make
            // the error actionable so the operator knows what to do.
            if (response.status === 401) {
                throw new HospedaApiError(
                    `${message}\n\nThe admin session cookie has expired. Refresh HOPS_ADMIN_COOKIE in scripts/server-tools/.env.local with a value copied from the browser DevTools (admin app → Application → Cookies).`,
                    401,
                    parsed ?? text
                );
            }
            throw new HospedaApiError(message, response.status, parsed ?? text);
        }

        // The standard envelope is { success: true, data: T }. Surface
        // the inner `data` so callers don't have to unwrap manually.
        if (isApiSuccess<T>(parsed)) {
            return parsed.data;
        }
        if (isApiError(parsed)) {
            throw new HospedaApiError(
                `API ${method} ${path} replied success:false — ${parsed.error.message}`,
                response.status,
                parsed
            );
        }
        // Some 204-style responses have no body — return undefined cast
        // as T. Callers expecting data should not call those endpoints.
        return parsed as T;
    }
}

export type { HospedaApiClient };

function isApiSuccess<T>(value: unknown): value is ApiSuccess<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { success?: unknown }).success === true &&
        'data' in (value as object)
    );
}

function isApiError(value: unknown): value is ApiError {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { success?: unknown }).success === false &&
        'error' in (value as object)
    );
}

function safeJsonParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function formatErrorMessage(body: unknown, status: number, statusText: string): string {
    if (isApiError(body)) {
        return `Hospeda API ${status} ${body.error.code}: ${body.error.message}`;
    }
    return `Hospeda API ${status} ${statusText}`;
}
