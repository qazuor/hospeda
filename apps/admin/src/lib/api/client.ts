import { adminLogger } from '../../utils/logger';

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
 * Retrieve a Clerk session token from the browser if available.
 * Safely checks for the global Clerk object provided by the `ClerkProvider`.
 * Returns `undefined` when not running in a browser or no session/token exists.
 */
const getClerkToken = async (): Promise<string | undefined> => {
    if (typeof window === 'undefined') return undefined;
    // Narrow the window type to safely access Clerk
    type ClerkSessionGetter = () => Promise<string | null>;
    type ClerkWindow = Window & {
        Clerk?: {
            session?: {
                getToken?: ClerkSessionGetter;
            };
        };
    };
    const w = window as unknown as ClerkWindow;
    adminLogger.debug(!!w.Clerk, 'getClerkToken: Clerk object');
    adminLogger.debug(!!w.Clerk?.session, 'getClerkToken: Clerk session');
    adminLogger.debug(typeof w.Clerk?.session?.getToken, 'getClerkToken: getToken function');

    const getToken = w.Clerk?.session?.getToken;
    if (typeof getToken !== 'function') {
        adminLogger.debug('getClerkToken: No getToken function available');
        return undefined;
    }
    try {
        const token = await getToken();
        adminLogger.debug(!!token, 'getClerkToken: Token obtained');
        return token ?? undefined;
    } catch (error) {
        adminLogger.error(error, 'getClerkToken: Error getting token');
        return undefined;
    }
};

const getBaseUrl = (): string => {
    // Use the API URL from environment or fallback to localhost:3001
    const url = import.meta.env.VITE_API_URL as string | undefined;
    return (url ?? 'http://localhost:3001').replace(/\/$/, '');
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
    const debugActorId = import.meta.env.VITE_DEBUG_ACTOR_ID as string | undefined;
    const bearer = await getClerkToken();

    // Debug logs
    adminLogger.debug(`Making API call to: ${url}`);
    adminLogger.debug(`Bearer token present: ${!!bearer}`);
    if (bearer) {
        adminLogger.debug(`Bearer token length: ${bearer.length}`);
        adminLogger.debug(`Bearer token preview: ${bearer.substring(0, 20)}...`);
    }

    const res = await fetch(url, {
        method,
        headers: {
            ...(isJson ? { 'Content-Type': 'application/json' } : {}),
            ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
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
        const message =
            (parsed as { message?: string } | undefined)?.message ?? `Request failed (${status})`;
        throw Object.assign(new Error(message), { status, body: parsed });
    }
    return { data: parsed as T, status };
};
