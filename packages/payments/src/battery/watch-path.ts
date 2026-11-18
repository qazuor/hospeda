/**
 * Request path normalization for the watch battery (HOS-1512, M3).
 *
 * A path is never trusted as typed. Every request, in the engine and again in the transport, is
 * parsed with `new URL(path, origin)` and must stay on the provider's origin with a path that is
 * already in its canonical form. Anything that a URL parser would "fix up" is refused instead,
 * because the guards classify the NORMALIZED pathname: `/v1/payments#x`, `//evil.host/v1/payments`,
 * `/v1/%70ayments`, `/./v1/payments` and `/x/../v1/payments` must never reach a different route
 * than the one the guard saw, nor another host with the bearer token.
 *
 * @module battery/watch-path
 */
import { WatchGuardError } from './types';

/** Origin the engine normalizes against; only the transport knows the real one. */
export const WATCH_INTERNAL_ORIGIN = 'https://provider.invalid';

function refuse(args: { readonly path: string; readonly why: string }): never {
    throw new WatchGuardError({
        code: 'PATH_REJECTED',
        message: `Request path refused (${args.why}): ${JSON.stringify(args.path.slice(0, 80))}`
    });
}

/**
 * Normalizes a request path, or refuses it.
 *
 * Rules: it starts with a single `/`; the PATH part holds no `#`, `%`, `\`, `@`, whitespace or
 * control character, no empty segment (`//`) and no `.` or `..` segment; the query holds no `#` and
 * no control character; and the parsed URL stays on `origin` with the very pathname that was typed.
 *
 * @param args.path - The path with its optional query string
 * @param args.origin - The provider origin the request will be sent to
 * @returns The pathname and the query string
 * @throws {WatchGuardError} `PATH_REJECTED`
 */
export function normalizeRequestPath(args: { readonly path: string; readonly origin: string }): {
    readonly pathname: string;
    readonly search: string;
} {
    const { path, origin } = args;
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
        return refuse({ path: String(path), why: 'must start with a single slash' });
    }
    const queryAt = path.indexOf('?');
    const pathPart = queryAt === -1 ? path : path.slice(0, queryAt);
    const query = queryAt === -1 ? '' : path.slice(queryAt);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is refused
    if (/[#%\\@\s\u0000-\u001f\u007f]/.test(pathPart)) {
        return refuse({ path, why: 'forbidden character in the path' });
    }
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what is refused
    if (query.includes('#') || /[\s\u0000-\u001f\u007f]/.test(query)) {
        return refuse({ path, why: 'forbidden character in the query' });
    }
    const segments = pathPart.split('/').slice(1);
    if (segments.some((segment, index) => segment === '' && index < segments.length - 1)) {
        return refuse({ path, why: 'empty segment' });
    }
    if (segments.some((segment) => segment === '.' || segment === '..')) {
        return refuse({ path, why: 'dot segment' });
    }
    let parsed: URL;
    try {
        parsed = new URL(path, origin);
    } catch {
        return refuse({ path, why: 'not a URL' });
    }
    if (parsed.origin !== new URL(origin).origin) return refuse({ path, why: 'another origin' });
    if (parsed.pathname !== pathPart) return refuse({ path, why: 'not in canonical form' });
    return { pathname: parsed.pathname, search: parsed.search };
}
