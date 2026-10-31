/**
 * @file visitor-ip-context.ts
 * @description Server-only carrier for the visiting client's IP (HOS-1973).
 *
 * Every SSR call from web to the API arrives at the API from the web
 * container's own internal address. Without a forwarded client IP, the API's
 * `getClientIp` falls into the `proxy:<socket-ip>` branch and ALL visitors
 * share one rate-limit bucket. The web middleware opens a scope per request
 * with {@link runWithVisitorIp}; the shared API client reads it through
 * {@link getVisitorForwardHeaders} and attaches the headers in one place.
 *
 * The browser-safe `client.ts` must not import `node:async_hooks`, so the
 * AsyncLocalStorage lives here and is exposed to the client via a
 * `globalThis` accessor registered at module load. This module is imported
 * only by the (server-side) middleware.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';

/** Global key under which the accessor is published for `client.ts`. */
export const VISITOR_FORWARD_HEADERS_GLOBAL = Symbol.for('hospeda.web.visitorForwardHeaders');

const storage = new AsyncLocalStorage<string>();

/**
 * Extracts the visitor IP from an incoming request.
 *
 * Only `cf-connecting-ip` is trusted: Cloudflare overwrites it on every
 * request, so it is the one header the visitor cannot choose when traffic
 * comes through the edge. `x-forwarded-for` is deliberately NOT read here
 * because its first hop is client-controlled. The value must parse as an IP.
 *
 * @param params.headers - Incoming request headers.
 * @returns The IP, or `undefined` when absent or malformed.
 */
export function extractVisitorIp({ headers }: { readonly headers: Headers }): string | undefined {
    const raw = headers.get('cf-connecting-ip')?.trim();
    return raw && isIP(raw) !== 0 ? raw : undefined;
}

/**
 * Runs `fn` with the visitor IP bound to the async context. When the request
 * carries no trustworthy IP, `fn` runs unchanged and nothing is forwarded.
 *
 * @param params.headers - Incoming request headers.
 * @param params.fn - The work to run (typically the middleware pipeline).
 */
export function runWithVisitorIp<T>({
    headers,
    fn
}: {
    readonly headers: Headers;
    readonly fn: () => T;
}): T {
    const ip = extractVisitorIp({ headers });
    return ip ? storage.run(ip, fn) : fn();
}

/**
 * Headers that carry the current visitor IP to the API, or an empty object
 * outside a request scope.
 */
export function getVisitorForwardHeaders(): Record<string, string> {
    const ip = storage.getStore();
    return ip ? { 'cf-connecting-ip': ip, 'x-forwarded-for': ip } : {};
}

(globalThis as Record<symbol, unknown>)[VISITOR_FORWARD_HEADERS_GLOBAL] = getVisitorForwardHeaders;
