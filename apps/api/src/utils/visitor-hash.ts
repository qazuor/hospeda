/**
 * Privacy-safe visitor hash utility for cross-entity view tracking.
 *
 * Computes a cookieless, non-reversible hash that uniquely identifies an
 * anonymous visitor within a single UTC day. The hash is derived from:
 *
 *   dailySalt = HMAC-SHA256(secret, 'yyyy-mm-dd')
 *   hash      = SHA-256(dailySalt + truncatedIp + userAgent)
 *
 * **IP truncation strategy:**
 *   - IPv4: last octet dropped (`192.168.1.x` → `192.168.1`), effectively a /24 window.
 *   - IPv6: only the first 4 colon-separated groups are kept, the rest are discarded.
 *     This corresponds roughly to a /64 boundary, which is the typical ISP allocation
 *     unit and balances dedup accuracy against privacy.
 *
 * **Privacy guarantees:**
 *   - Raw IPs are NEVER stored, logged, or returned.
 *   - Hashes are day-scoped (dailySalt changes every day), so they cannot be used
 *     to track a visitor across multiple days.
 *   - The secret acts as a pepper, making offline dictionary attacks infeasible.
 *
 * **Authenticated visitors:** When `userId` is supplied, the function short-circuits
 * and returns `user:<uuid>` without performing any hashing. This lets the route
 * handler use a single call regardless of auth state and keeps the dedup logic
 * consistent with the view-tracking service.
 *
 * @module utils/visitor-hash
 */

import { createHash, createHmac } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for {@link computeVisitorHash}.
 */
export interface ComputeVisitorHashParams {
    /** Raw IP address from the request (IPv4 or IPv6). Never stored or logged. */
    readonly ip: string;
    /** User-Agent header value from the request. */
    readonly userAgent: string;
    /**
     * UTC date used to derive the daily salt.
     * Defaults to `new Date()` when omitted (current moment).
     */
    readonly date?: Date | undefined;
    /**
     * Server-side HMAC secret (`HOSPEDA_VIEWS_HASH_SECRET`).
     * Must be at least 32 characters. Never logged.
     */
    readonly secret: string;
    /**
     * When present, the function returns `user:<userId>` directly, bypassing
     * all hashing. Pass the authenticated user's UUID from the session.
     */
    readonly userId?: string | undefined;
}

/**
 * Result of {@link computeVisitorHash}.
 *
 * Either:
 *   - A lowercase hex SHA-256 string (anonymous visitor), or
 *   - `user:<uuid>` (authenticated visitor).
 */
export type VisitorHash = string;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as a `yyyy-mm-dd` string in UTC.
 * This is the input to the daily-salt derivation.
 *
 * @internal
 */
function toUtcDateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Trust-chain prefixes that `getClientIp` (rate-limit middleware) may prepend
 * to its return value. They MUST be stripped before truncation, otherwise the
 * embedded IP would be misparsed (e.g. `proxy:192.168.1.5` contains a colon
 * and would be treated as IPv6, skipping the /24 truncation entirely).
 *
 * @internal
 */
const CLIENT_IP_PREFIXES = ['internal:', 'proxy:', 'untrusted:'] as const;

/**
 * Truncate an IP address for privacy before hashing.
 *
 * Strips any `getClientIp` trust-chain prefix first, then:
 * IPv4: drops the last octet (`a.b.c.d` → `a.b.c`).
 * IPv6: keeps the first 4 groups (`a:b:c:d:e:f:g:h` → `a:b:c:d`).
 * Unknown format (no dots or colons, e.g. `unknown`): returned as-is,
 * nothing is logged.
 *
 * @internal
 */
function truncateIp(ip: string): string {
    let raw = ip;
    for (const prefix of CLIENT_IP_PREFIXES) {
        if (raw.startsWith(prefix)) {
            raw = raw.slice(prefix.length);
            break;
        }
    }
    if (raw.includes(':')) {
        // IPv6 — keep first 4 colon-delimited groups
        const groups = raw.split(':');
        return groups.slice(0, 4).join(':');
    }
    if (raw.includes('.')) {
        // IPv4 — drop the last octet (/24 window)
        const octets = raw.split('.');
        return octets.slice(0, 3).join('.');
    }
    // Unknown format — return as-is (will still be hashed, never logged raw)
    return raw;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a privacy-safe, day-scoped visitor deduplication hash.
 *
 * For anonymous visitors the hash is derived from a daily HMAC salt, the
 * truncated IP address, and the User-Agent header so it changes every day
 * and cannot be reversed to identify the individual.
 *
 * For authenticated visitors (when `userId` is supplied) the function returns
 * `user:<userId>` directly, which the view-tracking service can store as-is
 * without exposing any session details.
 *
 * **Raw IPs are never stored, logged, or returned by this function.**
 *
 * @param params - See {@link ComputeVisitorHashParams}.
 * @returns A {@link VisitorHash}: hex SHA-256 string or `user:<uuid>`.
 *
 * @example
 * ```ts
 * // Anonymous visitor
 * const hash = computeVisitorHash({
 *   ip: c.req.header('cf-connecting-ip') ?? '',
 *   userAgent: c.req.header('user-agent') ?? '',
 *   secret: env.HOSPEDA_VIEWS_HASH_SECRET,
 * });
 *
 * // Authenticated visitor
 * const hash = computeVisitorHash({
 *   ip: '',
 *   userAgent: '',
 *   secret: env.HOSPEDA_VIEWS_HASH_SECRET,
 *   userId: session.user.id,
 * });
 * ```
 */
export function computeVisitorHash({
    ip,
    userAgent,
    date,
    secret,
    userId
}: ComputeVisitorHashParams): VisitorHash {
    // Authenticated path: short-circuit, no hashing needed.
    if (userId !== undefined && userId !== '') {
        return `user:${userId}`;
    }

    const effectiveDate = date ?? new Date();
    const dateKey = toUtcDateString(effectiveDate);

    // Derive a daily salt that changes every UTC day and is non-reversible.
    // Using HMAC-SHA256 with the secret as the key and the date string as the
    // data prevents offline pre-computation of the salt across days.
    const dailySalt = createHmac('sha256', secret).update(dateKey).digest('hex');

    // Truncate the IP before it ever participates in hashing.
    const truncated = truncateIp(ip);

    // Final hash: SHA-256(dailySalt + truncatedIp + userAgent).
    // Concatenation with fixed-length dailySalt (64 hex chars) avoids
    // length-extension ambiguities between the components.
    const hash = createHash('sha256')
        .update(dailySalt)
        .update(truncated)
        .update(userAgent)
        .digest('hex');

    return hash;
}
