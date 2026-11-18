/**
 * @file google-maps-link-guard.ts
 * @description The SSRF guard of the Google Maps link resolver (HOS-2335 §5.5,
 * owner decision D-4, AC-C23d/e): which URLs may be parsed or fetched, and which
 * network addresses a fetch may connect to.
 *
 * Two independent gates, both fail closed:
 * 1. {@link checkMapsUrl} — the URL itself. `https:` only, no userinfo, no port
 *    (not even an explicit `:443`), no IP literal in any spelling, and a hostname
 *    that EQUALS one of {@link MAPS_LINK_HOST_ALLOWLIST} after the WHATWG parser
 *    lowercased it. Never `includes`/`endsWith`: `maps.app.goo.gl.evil.com` and
 *    `evilgoogle.com` are different hosts. Applied to the user's link and to
 *    every redirect target before it is followed.
 * 2. {@link createGuardedLookup} — the DNS answer. The fetcher hands it to the
 *    socket as its `lookup`, so the address checked IS the address connected to:
 *    there is no second resolution a DNS-rebinding answer could slip into. Any
 *    private, loopback, link-local, metadata, multicast or reserved address
 *    refuses the hop before a connection is opened.
 *
 * Imports nothing from `lib/mcp/` (HOS-2185 reuse).
 */

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/**
 * Hosts a Maps link may name, exact match only (spec §5.5). `goo.gl` is accepted
 * only with a `/maps/` path ({@link checkMapsUrl}).
 */
export const MAPS_LINK_HOST_ALLOWLIST = [
    'maps.app.goo.gl',
    'goo.gl',
    'www.google.com',
    'google.com',
    'maps.google.com',
    'www.google.com.ar',
    'google.com.ar'
] as const;

/** Hosts whose links are short links: resolved by following redirects. */
export const MAPS_SHORT_LINK_HOSTS: ReadonlySet<string> = new Set(['maps.app.goo.gl', 'goo.gl']);

/** Longest URL (user link or `Location` header) the resolver accepts, in characters. */
export const MAPS_LINK_MAX_URL_LENGTH = 2048;

/** Why a URL or an address was refused. Closed list; drives the Spanish message. */
export type MapsLinkRefusal =
    /** Not a URL, or longer than {@link MAPS_LINK_MAX_URL_LENGTH}. */
    | 'INVALID_URL'
    /** Scheme, userinfo, port, IP literal or host outside the allowlist. */
    | 'HOST_NOT_ALLOWED'
    /** The host resolved to an address no hop may connect to. */
    | 'PRIVATE_ADDRESS';

/** Result of {@link checkMapsUrl}. */
export type MapsUrlCheck =
    | { readonly ok: true; readonly url: URL; readonly isShortLink: boolean }
    | { readonly ok: false; readonly reason: MapsLinkRefusal };

const ALLOWED_HOSTS: ReadonlySet<string> = new Set(MAPS_LINK_HOST_ALLOWLIST);

/** Matches the authority of an absolute `scheme://authority` URL, as typed. */
const RAW_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i;

/**
 * Whether the URL as TYPED carries a port or userinfo. The WHATWG parser drops a
 * default port (`:443` becomes `''`), so the raw authority is read too: the rule
 * is "no explicit port", not "no non-default port".
 */
function rawAuthorityHasPortOrUserinfo(raw: string): boolean {
    const authority = RAW_AUTHORITY.exec(raw.trim())?.[1];
    return authority === undefined || authority.includes(':') || authority.includes('@');
}

/** Whether a parsed hostname is an IP literal (IPv4 in any WHATWG-normalized form, or `[IPv6]`). */
function isIpLiteral(hostname: string): boolean {
    return hostname.startsWith('[') || isIP(hostname) !== 0;
}

/**
 * Checks a Maps URL against the SSRF rules. Pure: no DNS, no network.
 *
 * @param args - The URL as typed by the user or as read from a `Location`
 *   header, and the base to resolve a relative `Location` against
 * @returns The parsed URL and whether it is a short link, or the refusal
 *
 * @example
 * ```typescript
 * checkMapsUrl({ raw: 'https://maps.app.goo.gl/AbC123' });
 * // { ok: true, url, isShortLink: true }
 * checkMapsUrl({ raw: 'https://maps.app.goo.gl.evil.com/x' });
 * // { ok: false, reason: 'HOST_NOT_ALLOWED' }
 * ```
 */
export function checkMapsUrl(args: { readonly raw: string; readonly base?: URL }): MapsUrlCheck {
    const raw = args.raw.trim();
    if (raw === '' || raw.length > MAPS_LINK_MAX_URL_LENGTH) {
        return { ok: false, reason: 'INVALID_URL' };
    }
    let url: URL;
    try {
        url = args.base === undefined ? new URL(raw) : new URL(raw, args.base);
    } catch {
        return { ok: false, reason: 'INVALID_URL' };
    }
    // A relative Location inherits the (already checked) base authority; an
    // absolute one is checked as typed.
    const isAbsolute = RAW_AUTHORITY.test(raw);
    if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.port !== '' ||
        (isAbsolute && rawAuthorityHasPortOrUserinfo(raw)) ||
        (!isAbsolute && args.base === undefined) ||
        isIpLiteral(url.hostname) ||
        !ALLOWED_HOSTS.has(url.hostname)
    ) {
        return { ok: false, reason: 'HOST_NOT_ALLOWED' };
    }
    if (url.hostname === 'goo.gl' && !url.pathname.startsWith('/maps/')) {
        return { ok: false, reason: 'HOST_NOT_ALLOWED' };
    }
    return { ok: true, url, isShortLink: MAPS_SHORT_LINK_HOSTS.has(url.hostname) };
}

/** IPv4 ranges no hop may connect to (RFC 6890 special-purpose space). */
const BLOCKED_IPV4_SUBNETS: readonly (readonly [string, number])[] = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16], // link-local, including the 169.254.169.254 metadata endpoint
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4]
];

/** IPv6 ranges no hop may connect to. IPv4-embedding ranges are unwrapped instead. */
const BLOCKED_IPV6_SUBNETS: readonly (readonly [string, number])[] = [
    ['::', 128],
    ['::1', 128],
    ['100::', 64],
    ['2001::', 23],
    ['2001:db8::', 32],
    // Documentation (RFC 9637).
    ['3fff::', 20],
    // SRv6 SIDs (RFC 9602): never a public web host.
    ['5f00::', 16],
    // Local-use NAT64 (RFC 8215): translates to whatever the local network chose.
    ['64:ff9b:1::', 48],
    ['fc00::', 7],
    ['fe80::', 10],
    ['fec0::', 10],
    ['ff00::', 8]
];

const BLOCKLIST = (() => {
    const list = new BlockList();
    for (const [network, prefix] of BLOCKED_IPV4_SUBNETS) {
        list.addSubnet(network, prefix, 'ipv4');
    }
    for (const [network, prefix] of BLOCKED_IPV6_SUBNETS) {
        list.addSubnet(network, prefix, 'ipv6');
    }
    return list;
})();

/** Expands an IPv6 address into its 8 hextets, or `undefined` when it does not parse. */
function ipv6Hextets(address: string): number[] | undefined {
    let normalized: string;
    try {
        normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    } catch {
        return undefined;
    }
    const [head = '', tail] = normalized.split('::');
    const parts = (text: string) => (text === '' ? [] : text.split(':'));
    const left = parts(head);
    const right = tail === undefined ? [] : parts(tail);
    const fill = tail === undefined ? [] : new Array(8 - left.length - right.length).fill('0');
    const hextets = [...left, ...fill, ...right].map((part) => Number.parseInt(part, 16));
    return hextets.length === 8 && hextets.every((h) => Number.isInteger(h)) ? hextets : undefined;
}

/** Dotted IPv4 from two hextets. */
function ipv4Of(high: number, low: number): string {
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
}

/**
 * The IPv4 address an IPv6 address embeds, when it is IPv4-mapped (`::ffff:a.b.c.d`),
 * IPv4-compatible (`::a.b.c.d`), IPv4-translated (`::ffff:0:a.b.c.d`, RFC 2765),
 * well-known NAT64 (`64:ff9b::a.b.c.d`) or 6to4 (`2002:aabb:ccdd::/48`, bits
 * 16-48). Each one reaches the IPv4 it carries, so that IPv4 is what gets checked.
 */
function embeddedIpv4(hextets: readonly number[]): string | undefined {
    const [h0, h1 = 0, h2 = 0, h3, h4, h5, h6 = 0, h7 = 0] = hextets;
    if (h0 === 0x2002) {
        return ipv4Of(h1, h2);
    }
    const zeroHead = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0;
    const mapped = zeroHead && h4 === 0 && (h5 === 0xffff || h5 === 0);
    const translated = zeroHead && h4 === 0xffff && h5 === 0;
    const nat64 = h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0;
    return mapped || translated || nat64 ? ipv4Of(h6, h7) : undefined;
}

/**
 * Whether a hop may NOT connect to an address: private, loopback, link-local,
 * metadata, multicast, documentation, reserved, or anything that does not parse.
 *
 * @param args - The address a DNS answer named
 * @returns `true` when the address is refused
 */
export function isBlockedAddress({ address }: { readonly address: string }): boolean {
    const family = isIP(address);
    if (family === 4) {
        return address === '255.255.255.255' || BLOCKLIST.check(address, 'ipv4');
    }
    if (family !== 6) {
        return true;
    }
    const hextets = ipv6Hextets(address);
    if (hextets === undefined) {
        return true;
    }
    const v4 = embeddedIpv4(hextets);
    if (v4 !== undefined) {
        return isBlockedAddress({ address: v4 });
    }
    return BLOCKLIST.check(address, 'ipv6');
}

/** The error a guarded lookup fails with; carries the refusal for the resolver. */
export class MapsLinkAddressError extends Error {
    /** Always `PRIVATE_ADDRESS`. */
    readonly reason: MapsLinkRefusal = 'PRIVATE_ADDRESS';

    constructor() {
        super('Maps link host resolved to a refused address');
        this.name = 'MapsLinkAddressError';
    }
}

/** The DNS function a guarded lookup reads through (Node's `dns.lookup` with `all: true`). */
export type MapsDnsLookup = (
    hostname: string,
    callback: (error: NodeJS.ErrnoException | null, addresses: readonly LookupAddress[]) => void
) => void;

/** Node's default resolver, asked for every address. */
const defaultDnsLookup: MapsDnsLookup = (hostname, callback) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => callback(error, addresses ?? []));
};

/** The `lookup` signature `net`/`tls` sockets call. */
export type SocketLookup = LookupFunction;

/**
 * Builds the `lookup` a hop's socket resolves through. It resolves every
 * address of the host and refuses the hop when ANY of them is blocked, so a
 * host that answers one public and one private address cannot be raced into
 * the private one.
 *
 * @param args - Optional DNS function (tests inject one; no real DNS in tests)
 * @returns A socket `lookup` function
 */
export function createGuardedLookup(args: { readonly dns?: MapsDnsLookup } = {}): SocketLookup {
    const dns = args.dns ?? defaultDnsLookup;
    return (hostname, options, callback) => {
        dns(hostname, (error, addresses) => {
            if (error) {
                callback(error, []);
                return;
            }
            const [first] = addresses;
            if (
                first === undefined ||
                addresses.some(({ address }) => isBlockedAddress({ address }))
            ) {
                callback(new MapsLinkAddressError(), []);
                return;
            }
            if (options.all) {
                callback(null, [...addresses]);
                return;
            }
            callback(null, first.address, first.family);
        });
    };
}
