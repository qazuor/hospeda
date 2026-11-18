/**
 * @file google-maps-link-fetcher.ts
 * @description The one outbound call of the Google Maps link resolver (HOS-2335
 * §5.5): one HTTPS request to an allowlisted short-link host that reads the
 * status line and the `Location` header, and nothing else.
 *
 * - Built on `node:https`, not `fetch`, because `https.request` takes the
 *   socket's `lookup`: the guarded lookup (`google-maps-link-guard.ts`) both
 *   checks the DNS answer and supplies the address the socket connects to, so
 *   the checked address cannot differ from the connected one.
 * - No agent (`agent: false`): no pooled socket is reused across hosts.
 * - No cookies, no credentials, no body sent. The response body is never read:
 *   the socket is destroyed as soon as the headers arrive.
 * - Headers are capped at {@link MAPS_LINK_MAX_HEADER_BYTES}.
 * - The caller's `AbortSignal` carries the per-hop and total timeouts.
 *
 * Tests never use this module against the network: the resolver takes the
 * fetcher as a dependency, and this module's own test injects a DNS function
 * that answers a blocked address, so the request fails before any socket opens.
 */

import { request } from 'node:https';
import {
    createGuardedLookup,
    type MapsDnsLookup,
    MapsLinkAddressError
} from './google-maps-link-guard';

/** Largest response head a hop accepts, in bytes. */
export const MAPS_LINK_MAX_HEADER_BYTES = 16 * 1024;

/** The `User-Agent` of a hop. Generic: it names no user, project or contact. */
const MAPS_LINK_USER_AGENT = 'Mozilla/5.0 (compatible; MapsLinkResolver/1.0)';

/** One request a hop makes. */
export interface MapsHopRequest {
    /** An allowlisted short-link URL (already checked by the resolver). */
    readonly url: URL;
    /** `HEAD` first; `GET` only after a 405. */
    readonly method: 'HEAD' | 'GET';
    /** Aborts the hop (per-hop and total deadlines). */
    readonly signal: AbortSignal;
}

/** What a hop reads back: the status and the raw `Location` header, nothing else. */
export interface MapsHopResponse {
    /** HTTP status code. */
    readonly status: number;
    /** The `Location` header, `null` when absent. Untrusted: the resolver checks it. */
    readonly location: string | null;
}

/** Performs one hop. Rejects on a network error, a refused address or an abort. */
export type MapsHopFetcher = (request: MapsHopRequest) => Promise<MapsHopResponse>;

/** Thrown by a hop that was aborted (timeout). */
export class MapsLinkTimeoutError extends Error {
    constructor() {
        super('Maps link hop aborted');
        this.name = 'MapsLinkTimeoutError';
    }
}

/**
 * Builds the default hop fetcher.
 *
 * @param args - Optional DNS function for the guarded lookup (tests only)
 * @returns A {@link MapsHopFetcher}
 */
export function createNodeMapsHopFetcher(
    args: { readonly dns?: MapsDnsLookup } = {}
): MapsHopFetcher {
    const lookup = createGuardedLookup({ dns: args.dns });
    return ({ url, method, signal }) =>
        new Promise<MapsHopResponse>((resolve, reject) => {
            if (signal.aborted) {
                reject(new MapsLinkTimeoutError());
                return;
            }
            const req = request({
                protocol: 'https:',
                hostname: url.hostname,
                port: 443,
                path: `${url.pathname}${url.search}`,
                method,
                agent: false,
                lookup,
                maxHeaderSize: MAPS_LINK_MAX_HEADER_BYTES,
                headers: { 'user-agent': MAPS_LINK_USER_AGENT, accept: '*/*' }
            });
            const onAbort = () => {
                req.destroy(new MapsLinkTimeoutError());
            };
            signal.addEventListener('abort', onAbort, { once: true });
            req.on('response', (res) => {
                const header = res.headers.location;
                resolve({
                    status: res.statusCode ?? 0,
                    location: typeof header === 'string' ? header : null
                });
                // Never read the body.
                res.destroy();
                req.destroy();
                signal.removeEventListener('abort', onAbort);
            });
            req.on('error', (error) => {
                signal.removeEventListener('abort', onAbort);
                reject(
                    error instanceof MapsLinkAddressError || error instanceof MapsLinkTimeoutError
                        ? error
                        : new Error('Maps link hop failed')
                );
            });
            req.end();
        });
}
