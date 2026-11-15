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
 * Reads the visitor's IP and User-Agent from the request headers.
 *
 * The IP comes from `cf-connecting-ip`, else the first trimmed entry of
 * `x-forwarded-for`. These values are best-effort and spoofable: Cloudflare
 * APPENDS to an incoming `x-forwarded-for` (so its first entry is client-controlled)
 * and a request that reaches the origin directly can set `cf-connecting-ip` itself.
 * They are used only for analytics session attribution, never for auth or rate
 * limiting, and are never stored or logged.
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
    const cf = c.req.header('cf-connecting-ip')?.trim();
    const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    const ip = cf ? cf : forwarded;
    const userAgent = c.req.header('user-agent')?.trim();
    if (!ip || !userAgent) return undefined;
    return { ip, userAgent };
}
