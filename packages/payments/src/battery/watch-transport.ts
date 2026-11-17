/**
 * Raw HTTP to Mercado Pago for the watch battery (HOS-1512). No SDK: the battery
 * must see the bytes the provider answers, not what a client library makes of them.
 *
 * @module battery/watch-transport
 */
import type { WatchRequest, WatchResponse, WatchTransport } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Builds the transport a run sends its requests through.
 *
 * The access token goes only in the `Authorization` header and is never part of a
 * thrown message. A network failure or a timeout rejects; a non-2xx answer does not,
 * because a measurement reads what the provider answers whatever it is.
 *
 * @param args.baseUrl - Provider base URL, without a trailing slash
 * @param args.accessToken - The access token of the account the run targets
 * @param args.fetch - Injection point for `fetch`; defaults to the global one
 * @param args.timeoutMs - Per-request timeout; defaults to 30 s
 * @param args.signal - The run's cancellation signal, combined with the timeout: a cancelled run
 *   stops sending (HOS-1512)
 * @returns The transport
 */
export function createWatchTransport(args: {
    readonly baseUrl: string;
    readonly accessToken: string;
    readonly fetch?: typeof globalThis.fetch;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal | undefined;
}): WatchTransport {
    const fetchFn = args.fetch ?? globalThis.fetch.bind(globalThis);
    const baseUrl = args.baseUrl.replace(/\/+$/, '');
    return async (request: WatchRequest): Promise<WatchResponse> => {
        const hasBody = request.body !== undefined;
        const response = await fetchFn(`${baseUrl}${request.path}`, {
            method: request.method,
            headers: {
                ...(hasBody ? { 'content-type': 'application/json' } : {}),
                ...request.headers,
                authorization: `Bearer ${args.accessToken}`
            },
            ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
            signal: AbortSignal.any([
                AbortSignal.timeout(args.timeoutMs ?? DEFAULT_TIMEOUT_MS),
                ...(args.signal ? [args.signal] : [])
            ])
        });
        const text = await response.text();
        let body: unknown;
        try {
            body = text.length === 0 ? undefined : JSON.parse(text);
        } catch {
            body = undefined;
        }
        return { status: response.status, body };
    };
}
