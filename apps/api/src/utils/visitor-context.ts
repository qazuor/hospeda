/**
 * Visitor network identity for analytics session attribution (HOS-2119, T-071).
 *
 * @module utils/visitor-context
 */
import type { Context } from 'hono';

/** IP and User-Agent of the visitor behind a request. */
export interface VisitorContext {
    /** Client IP as seen by the edge proxy. */
    readonly ip: string;
    /** Raw `User-Agent` header. */
    readonly userAgent: string;
}

/**
 * Internal marker header: when present, the request was NOT initiated by the
 * visitor whose network identity the headers carry (e.g. a staff member creating
 * an account on someone's behalf), so no visitor must be attributed.
 */
export const NO_VISITOR_HEADER = 'x-hospeda-no-visitor';

/**
 * Returns a copy of the given headers marked as "not originated by the visitor".
 *
 * All original headers (cookies, origin, ...) are preserved so the receiving
 * code (e.g. Better Auth) keeps working; only {@link getVisitorContextFromHeaders}
 * behaves differently and returns `undefined` for the copy.
 *
 * @param input - Object with the request `headers`
 * @returns A new `Headers` instance carrying the marker
 *
 * @example
 * ```ts
 * await auth.api.signUpEmail({ body, headers: markHeadersAsNotVisitor({ headers: c.req.raw.headers }) });
 * ```
 */
export function markHeadersAsNotVisitor(input: { readonly headers: Headers }): Headers {
    const marked = new Headers(input.headers);
    marked.set(NO_VISITOR_HEADER, '1');
    return marked;
}

/**
 * Reads the visitor's IP and User-Agent from a set of request headers.
 *
 * Header-based twin of {@link getVisitorContext} for code that has no Hono
 * context (e.g. Better Auth hooks). Same rules: IP from `cf-connecting-ip`, else
 * the first trimmed `x-forwarded-for` entry; best-effort and spoofable, used only
 * for analytics session attribution, never for auth or rate limiting, never
 * stored or logged.
 *
 * @param input - Object with the request `headers`
 * @returns The visitor identity, or `undefined` when headers are absent / not a `Headers`-like object,
 *   carry the {@link NO_VISITOR_HEADER} marker, or the IP / User-Agent is missing or blank
 *
 * @example
 * ```ts
 * const visitor = getVisitorContextFromHeaders({ headers: request.headers });
 * ```
 */
export function getVisitorContextFromHeaders(input: {
    readonly headers: Headers | null | undefined;
}): VisitorContext | undefined {
    const { headers } = input;
    // Direct `auth.api.*` calls may pass a plain object; never throw on analytics input.
    if (!headers || typeof (headers as Headers).get !== 'function') return undefined;
    if (headers.get(NO_VISITOR_HEADER)) return undefined;
    const cf = headers.get('cf-connecting-ip')?.trim();
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = cf ? cf : forwarded;
    const userAgent = headers.get('user-agent')?.trim();
    if (!ip || !userAgent) return undefined;
    return { ip, userAgent };
}

/**
 * Reads the visitor's IP and User-Agent from the request headers of a Hono context.
 *
 * Delegates to {@link getVisitorContextFromHeaders}; see it for the header rules
 * and the best-effort / spoofable caveat.
 *
 * @param c - The Hono context of the request
 * @returns The visitor identity, or `undefined` when the IP or User-Agent is missing or blank
 *
 * @example
 * ```ts
 * const visitor = getVisitorContext(c);
 * serverAnalytics.capture({ distinctId, name, properties, ...(visitor ? { visitor } : {}) });
 * ```
 */
export function getVisitorContext(c: Context): VisitorContext | undefined {
    return getVisitorContextFromHeaders({ headers: c.req.raw.headers });
}
