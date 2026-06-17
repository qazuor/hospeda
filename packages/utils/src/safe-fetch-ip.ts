/**
 * IP-address classification helpers for SSRF defence.
 *
 * Pure, side-effect-free functions that classify IPv4 and IPv6 addresses
 * against the private/reserved CIDR ranges that must never be reachable from
 * user-supplied URLs. These helpers are consumed by `safe-fetch.ts` and can
 * be tested independently without any mocking.
 *
 * @module utils/safe-fetch-ip
 */

// ---------------------------------------------------------------------------
// Private helpers — IPv4 CIDR tables
// ---------------------------------------------------------------------------

/** IPv4 CIDR range descriptor used for private-address matching. */
interface Ipv4Range {
    readonly network: number;
    readonly mask: number;
}

/** IPv4 ranges that must never be reached from user-supplied URLs. */
const BLOCKED_IPV4_RANGES: readonly Ipv4Range[] = [
    // 0.0.0.0/8 — "this" network
    { network: 0x00000000, mask: 0xff000000 },
    // 10.0.0.0/8 — RFC 1918 private
    { network: 0x0a000000, mask: 0xff000000 },
    // 127.0.0.0/8 — loopback
    { network: 0x7f000000, mask: 0xff000000 },
    // 169.254.0.0/16 — link-local / cloud IMDS (e.g. AWS 169.254.169.254)
    { network: 0xa9fe0000, mask: 0xffff0000 },
    // 172.16.0.0/12 — RFC 1918 private
    { network: 0xac100000, mask: 0xfff00000 },
    // 192.168.0.0/16 — RFC 1918 private
    { network: 0xc0a80000, mask: 0xffff0000 },
    // 100.64.0.0/10 — CGNAT (Carrier-Grade NAT, RFC 6598)
    { network: 0x64400000, mask: 0xffc00000 }
];

// ---------------------------------------------------------------------------
// IPv4 helpers
// ---------------------------------------------------------------------------

/**
 * Converts a dotted-decimal IPv4 string to a 32-bit unsigned integer.
 * Returns `null` when the string is not a valid IPv4 address.
 */
function ipv4ToInt(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let result = 0;
    for (const part of parts) {
        const octet = Number(part);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
        result = (result << 8) | octet;
    }
    // Convert signed 32-bit result from `<<` to unsigned.
    return result >>> 0;
}

/**
 * Returns `true` when `ip` is an IPv4 address that falls in any of the
 * private / reserved ranges blocked by SSRF policy.
 */
function isBlockedIpv4(ip: string): boolean {
    const int = ipv4ToInt(ip);
    if (int === null) return false;
    return BLOCKED_IPV4_RANGES.some((r) => (int & r.mask) >>> 0 === r.network);
}

// ---------------------------------------------------------------------------
// IPv6 helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `ip` is an IPv6 address that falls in a
 * private / reserved range blocked by SSRF policy:
 *
 * - `::1` (loopback)
 * - `fe80::/10` (link-local)
 * - `fc00::/7` (Unique Local Address)
 * - `::ffff:0:0/96` mapped IPv4 — delegates to {@link isBlockedIpv4}
 */
function isBlockedIpv6(ip: string): boolean {
    // Normalise: strip surrounding brackets that may appear in URL hostnames.
    const addr = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
    const lower = addr.toLowerCase();

    // ::1 — loopback
    if (lower === '::1') return true;

    // Expand abbreviated address just enough for prefix checks.
    // We split on '::' to detect whether it is an abbreviated form.
    const colonParts = lower.split(':');

    // fe80::/10 — link-local: first 16 bits start with 1111 1110 10
    // i.e. fe80 – febf
    const first16 = colonParts[0] ?? '';
    if (first16.length >= 2) {
        const high8 = Number.parseInt(first16.slice(0, 2), 16);
        const next4bits = Number.parseInt(first16[2] ?? '0', 16);
        // fe80::/10 → first byte 0xfe, next nibble bit-9 = 1 → 8 or 9 or ...
        // Simpler: fe80::/10 covers fe80..febf (first 10 bits = 1111 1110 10)
        if (high8 === 0xfe && (next4bits & 0xc) === 0x8) return true;
    }

    // fc00::/7 — ULA: first byte 0xfc or 0xfd
    if (first16.length >= 2) {
        const high8 = Number.parseInt(first16.slice(0, 2), 16);
        if (high8 === 0xfc || high8 === 0xfd) return true;
    }

    // ::ffff:0:0/96 — IPv4-mapped: "::ffff:a.b.c.d" or "::ffff:0a01:0203"
    if (lower.includes('::ffff:')) {
        const afterPrefix = lower.split('::ffff:')[1] ?? '';
        // Dotted-decimal form: ::ffff:192.168.1.1
        if (afterPrefix.includes('.')) {
            return isBlockedIpv4(afterPrefix);
        }
        // Hex form: ::ffff:c0a8:0101 → 192.168.1.1
        const hexParts = afterPrefix.split(':');
        if (hexParts.length === 2) {
            const hi = Number.parseInt(hexParts[0] ?? '0', 16);
            const lo = Number.parseInt(hexParts[1] ?? '0', 16);
            const dotted = [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join('.');
            return isBlockedIpv4(dotted);
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the resolved IP address (IPv4 or IPv6) is in a range
 * that must not be reachable from user-supplied URLs.
 *
 * Also exported so the test suite can assert individual address decisions.
 *
 * @param ip - IPv4 dotted-decimal or IPv6 string (brackets optional for IPv6).
 * @returns `true` if the address is blocked (private/reserved), `false` if public.
 *
 * @example
 * ```ts
 * isBlockedAddress('127.0.0.1')          // true  — loopback
 * isBlockedAddress('169.254.169.254')    // true  — AWS metadata
 * isBlockedAddress('93.184.216.34')      // false — public IP
 * isBlockedAddress('::1')               // true  — IPv6 loopback
 * isBlockedAddress('2606:2800::1')      // false — public IPv6
 * ```
 */
export function isBlockedAddress(ip: string): boolean {
    // Simple heuristic: if the address contains a colon it is IPv6.
    const isIpv6 = ip.includes(':');
    return isIpv6 ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}
