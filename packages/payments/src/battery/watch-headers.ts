/**
 * Request headers of the watch battery (HOS-1512, n5): a closed list. The transport sets the bearer
 * token itself; a measurement may never send its own `Authorization` (in any casing), nor
 * `X-HTTP-Method-Override`, which would turn a GET into a write the guards never saw.
 *
 * @module battery/watch-headers
 */
import { WatchGuardError } from './types';

/** The only request headers a measurement may set (lower case). */
export const WATCH_ALLOWED_HEADERS: ReadonlySet<string> = new Set(['x-idempotency-key']);

/**
 * Refuses any header that is not on the list.
 *
 * @param args.headers - The headers the caller asked for
 * @throws {WatchGuardError} `HEADER_REJECTED`
 */
export function assertHeadersAllowed(args: {
    readonly headers?: Readonly<Record<string, string>> | undefined;
}): void {
    for (const name of Object.keys(args.headers ?? {})) {
        const lower = name.toLowerCase();
        if (WATCH_ALLOWED_HEADERS.has(lower)) continue;
        const why =
            lower === 'authorization'
                ? 'the bearer token is set by the transport only'
                : lower === 'x-http-method-override'
                  ? 'a method override would hide a write from the guards'
                  : 'not on the list of allowed headers';
        throw new WatchGuardError({
            code: 'HEADER_REJECTED',
            message: `Request header ${JSON.stringify(lower)} refused: ${why}`
        });
    }
}
