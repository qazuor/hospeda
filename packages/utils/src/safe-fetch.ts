/**
 * SSRF-hardened external fetch wrapper.
 *
 * Provides `safeExternalFetch` — a drop-in replacement for `fetch` when the
 * target URL comes from untrusted user input. All network calls go through a
 * multi-layer SSRF defence:
 *
 *   1. Scheme allow-list (HTTPS only)
 *   2. Embedded-credential rejection
 *   3. DNS resolution + private-IP block on every hop (defeats DNS rebinding)
 *   4. **IP pinning via undici Agent** — the validated IP is pinned so the
 *      TCP connection goes to the exact address that passed the SSRF check.
 *      undici cannot independently re-resolve the hostname to a different IP,
 *      which eliminates the TOCTOU DNS-rebinding window.
 *   5. Manual redirect following with the same checks + pin on each Location
 *   6. Hard timeout via AbortController
 *   7. Streaming body with a max-bytes cap
 *
 * ## Security invariant (TOCTOU-free DNS)
 *
 * The classical SSRF TOCTOU attack works by returning a public IP during
 * validation and a private IP (e.g. 169.254.169.254) at connection time via a
 * low-TTL DNS record. We defeat this by:
 *   a. Resolving DNS with `node:dns/promises` (all records, `{ all: true }`).
 *   b. Asserting every resolved address passes `isBlockedAddress`.
 *   c. Selecting the first verified address as the "pinned IP".
 *   d. Building an undici `Agent` whose `connect.lookup` unconditionally
 *      returns the pinned IP — undici never performs a second DNS lookup.
 *   e. The original hostname is still used for the `Host` header and TLS SNI
 *      (`servername`), so virtual hosting and certificate validation work.
 *
 * IP-address classification (blocked CIDR tables + helpers) lives in the
 * sibling module `./safe-fetch-ip`.
 *
 * @module utils/safe-fetch
 */

import { lookup } from 'node:dns/promises';
import { Agent, request as undiciRequest } from 'undici';
import type { Dispatcher } from 'undici';
import { isBlockedAddress } from './safe-fetch-ip';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Returned when the fetch succeeds (HTTP response received, body fits within
 * `maxBytes`, and all SSRF checks pass on every hop).
 */
export interface SafeFetchSuccess {
    readonly ok: true;
    readonly status: number;
    readonly body: string;
    /** The final URL after following all redirects. */
    readonly finalUrl: string;
}

/**
 * Returned when the request is blocked by SSRF policy, times out, or exceeds
 * the max-body-size cap. The `blocked` flag is always `true` here so callers
 * can narrow the union with a simple property check.
 */
export interface SafeFetchBlocked {
    readonly ok: false;
    readonly status: 0;
    readonly error: string;
    readonly blocked: true;
}

/**
 * Discriminated union returned by {@link safeExternalFetch}.
 *
 * Narrow with `result.ok`:
 * ```ts
 * const result = await safeExternalFetch({ url });
 * if (result.ok) {
 *   console.log(result.body);
 * } else {
 *   console.error(result.error); // blocked reason
 * }
 * ```
 */
export type SafeFetchResult = SafeFetchSuccess | SafeFetchBlocked;

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link safeExternalFetch}.
 */
export interface SafeFetchInput {
    /** The URL to fetch. Must be HTTPS with no embedded credentials. */
    readonly url: string;
    /**
     * Abort the request if it has not completed within this many milliseconds.
     * @default 8000
     */
    readonly timeoutMs?: number;
    /**
     * Maximum response body size in bytes. The body is streamed; if the
     * accumulated length exceeds this cap the request is aborted.
     * @default 3_000_000 (3 MB)
     */
    readonly maxBytes?: number;
    /**
     * Maximum number of HTTP redirects to follow before giving up.
     * @default 3
     */
    readonly maxRedirects?: number;
    /**
     * Extra request headers forwarded verbatim to the upstream server.
     * Caller must NOT include `Host` — it is derived from the URL.
     */
    readonly headers?: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Private helpers — SSRF checks
// ---------------------------------------------------------------------------

/** Parsed safe URL details returned by {@link assertSafeUrl}. */
interface SafeUrlInfo {
    readonly host: string;
    readonly href: string;
}

/**
 * Validates URL policy synchronously (no network I/O).
 *
 * Checks:
 * - Must be parseable as a URL
 * - Scheme must be `https:`
 * - No userinfo (embedded credentials) in the URL
 *
 * @throws `SafeFetchBlocked` object (not an `Error`) when the URL is unsafe.
 *   Callers `return` the thrown value directly.
 */
function assertSafeUrl(rawUrl: string): SafeUrlInfo {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return throwBlocked(`Invalid URL: ${rawUrl}`);
    }

    if (parsed.protocol !== 'https:') {
        return throwBlocked(`Blocked scheme "${parsed.protocol}" — only HTTPS is allowed`);
    }

    // URL.username / URL.password are populated when userinfo is present.
    if (parsed.username !== '' || parsed.password !== '') {
        return throwBlocked('Embedded credentials in URL are not allowed');
    }

    return { host: parsed.hostname, href: parsed.href };
}

/** Construct a blocked result and throw it (used as a non-Error flow-control mechanism). */
function throwBlocked(error: string): never {
    // We use `throw` here so TypeScript's control-flow analysis treats callers
    // as terminated. The `catch` in `safeExternalFetch` re-packages it.
    throw { ok: false as const, status: 0 as const, error, blocked: true as const };
}

// ---------------------------------------------------------------------------
// DNS check + IP pinning
// ---------------------------------------------------------------------------

/**
 * Result of a successful private-address assertion: the first verified IP
 * that will be used to pin the TCP connection, and its address family.
 */
interface PinnedAddress {
    readonly address: string;
    readonly family: 4 | 6;
}

/**
 * Resolves `hostname` via DNS and asserts ALL addresses are public.
 * Bracketed IPv6 literals (BUG 2 fix) are validated directly without DNS.
 * Uses `{ all: true }` to catch DNS-rebinding (mixed public+private records).
 *
 * @returns The first verified IP + its family (used to pin the TCP connection).
 * @throws A {@link SafeFetchBlocked} object when any resolved address is blocked.
 */
async function assertNoPrivateAddress(hostname: string): Promise<PinnedAddress> {
    // Block bare "localhost" before DNS (it resolves to 127.0.0.1/::1 but an
    // attacker might configure a wildcard; block the name itself too).
    if (hostname === 'localhost') {
        throwBlocked('Hostname "localhost" is not allowed');
    }

    // --- BUG 2 FIX: IPv6 literal detection ---
    // URL.hostname for https://[::1]/ returns "[::1]" WITH brackets.
    // dns.lookup rejects bracketed addresses with ENOTFOUND, which is the
    // wrong error signal and fails public IPv6 literals like [2606:2800::1].
    // Instead: strip brackets, validate directly, skip DNS.
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
        const addr = hostname.slice(1, -1);
        if (isBlockedAddress(addr)) {
            throwBlocked(`IPv6 literal "${hostname}" is a blocked private address: ${addr}`);
        }
        // Determine family: all stripped bracket addresses are IPv6
        return { address: addr, family: 6 };
    }

    let addresses: { address: string; family: number }[];
    try {
        addresses = await lookup(hostname, { all: true });
    } catch {
        throwBlocked(`DNS resolution failed for hostname: ${hostname}`);
    }

    if (addresses.length === 0) {
        throwBlocked(`No DNS records found for hostname: ${hostname}`);
    }

    for (const { address } of addresses) {
        if (isBlockedAddress(address)) {
            throwBlocked(
                `Hostname "${hostname}" resolves to a blocked private address: ${address}`
            );
        }
    }

    // Return the first address as the pinned IP. All records were verified
    // above so any of them is safe; we pin the first to be deterministic.
    const first = addresses[0];
    if (first === undefined) {
        throwBlocked(`No DNS records found for hostname: ${hostname}`);
    }
    const family = first.family === 6 ? 6 : 4;
    return { address: first.address, family };
}

// ---------------------------------------------------------------------------
// IP-pinning undici Agent factory
// ---------------------------------------------------------------------------

/**
 * Creates an undici `Agent` whose `connect.lookup` always returns the
 * pre-validated `pinnedAddress` (TOCTOU elimination — BUG 1 fix).
 *
 * The custom lookup callback never triggers a real DNS resolution, so
 * undici always connects to the IP that passed `isBlockedAddress`. The
 * original hostname is still used for the `Host` header and TLS SNI.
 *
 * @param pinnedAddress - The pre-validated IP to pin the connection to.
 * @param family - IP family (4 or 6), forwarded to the lookup callback.
 */
function buildPinnedAgent(pinnedAddress: string, family: 4 | 6): Agent {
    return new Agent({
        connect: {
            lookup: (
                _hostname: string,
                _options: unknown,
                callback: (
                    err: Error | null,
                    addresses: { address: string; family: number }[]
                ) => void
            ) => {
                // Always return the pre-validated IP — never re-resolve.
                // undici >= 7.x expects the dns.lookup `{ all: true }` shape:
                // an array of { address, family } records (NOT the legacy
                // `callback(err, address, family)` positional form, which makes
                // undici read `undefined` as the IP → "Invalid IP address").
                callback(null, [{ address: pinnedAddress, family }]);
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Body streaming with cap
// ---------------------------------------------------------------------------

/**
 * Reads the undici response body as a stream, accumulating text and aborting
 * via `abortController` if the byte count exceeds `maxBytes`.
 *
 * @returns The full response body as a UTF-8 string.
 * @throws A {@link SafeFetchBlocked} object when the body exceeds `maxBytes`.
 */
async function readBodyCapped(
    body: Dispatcher.ResponseData['body'],
    maxBytes: number,
    abortController: AbortController
): Promise<string> {
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    for await (const chunk of body) {
        const value = chunk as Uint8Array;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            abortController.abort();
            throwBlocked(`Response body exceeds maximum allowed size of ${maxBytes} bytes`);
        }
        chunks.push(decoder.decode(value, { stream: true }));
    }

    // Flush the decoder's internal buffer.
    chunks.push(decoder.decode());
    return chunks.join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * SSRF-hardened external fetch.
 *
 * Fetches `url` after validating it against a strict allow-list:
 *
 * - **HTTPS only** — `http:`, `file:`, `ftp:`, `data:`, etc. are rejected.
 * - **No embedded credentials** — `https://user:pass@host` is rejected.
 * - **No private/reserved IPs** — the hostname is resolved via DNS (with
 *   `{ all: true }`) and every returned address is checked against RFC 1918,
 *   loopback, link-local, CGNAT, and IPv6 ULA/link-local ranges. This defeats
 *   DNS-rebinding attacks.
 * - **IPv6 literals validated without DNS** — bracketed addresses like
 *   `[::1]` are stripped and checked directly; public literals like
 *   `[2606:2800::1]` are allowed without a DNS round-trip.
 * - **IP pinning (TOCTOU-free)** — the first validated IP is pinned via an
 *   undici `Agent` that overrides the lookup callback, so the TCP connection
 *   goes to exactly the address that passed the SSRF check; undici cannot
 *   independently re-resolve to a different IP.
 * - **Manual redirect following** — each `Location` header goes through the
 *   full scheme + DNS + private-IP check before the next hop is made, and
 *   each hop's IP is pinned independently. Chains longer than `maxRedirects`
 *   are rejected.
 * - **Timeout** — the request is aborted after `timeoutMs` ms via
 *   `AbortController`.
 * - **Body size cap** — the response is streamed; accumulation stops and the
 *   request is aborted once `maxBytes` is exceeded.
 *
 * The function **never throws** on a policy violation — it always returns a
 * `SafeFetchResult`. Throw-shaped control flow is used internally but is
 * caught before returning to the caller.
 *
 * @example
 * ```ts
 * const result = await safeExternalFetch({ url: 'https://example.com/page' });
 * if (result.ok) {
 *   console.log(result.body);   // HTML / JSON string
 *   console.log(result.status); // e.g. 200
 * } else {
 *   console.error(result.error); // human-readable block reason
 * }
 * ```
 *
 * @param input - Fetch options (URL is required; all others have safe defaults).
 * @returns A {@link SafeFetchResult} — never throws.
 */
export async function safeExternalFetch(input: SafeFetchInput): Promise<SafeFetchResult> {
    const { url, timeoutMs = 8_000, maxBytes = 3_000_000, maxRedirects = 3, headers = {} } = input;

    try {
        return await _doFetch({ url, timeoutMs, maxBytes, maxRedirects, headers });
    } catch (err) {
        // Internal `throwBlocked` calls land here — they are plain objects, not
        // Error instances, shaped as SafeFetchBlocked.
        if (isBlockedShape(err)) {
            return err;
        }

        // Genuine unexpected errors (network failure, etc.)
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, status: 0, error: message, blocked: true };
    }
}

/** Type-guard for our internal blocked-result throw token. */
function isBlockedShape(value: unknown): value is SafeFetchBlocked {
    return (
        typeof value === 'object' &&
        value !== null &&
        'ok' in value &&
        (value as Record<string, unknown>).ok === false &&
        'blocked' in value &&
        (value as Record<string, unknown>).blocked === true
    );
}

// ---------------------------------------------------------------------------
// Core fetch implementation (separate function so the outer try/catch is clean)
// ---------------------------------------------------------------------------

interface FetchParams {
    readonly url: string;
    readonly timeoutMs: number;
    readonly maxBytes: number;
    readonly maxRedirects: number;
    readonly headers: Readonly<Record<string, string>>;
}

async function _doFetch(params: FetchParams): Promise<SafeFetchResult> {
    const { timeoutMs, maxBytes, maxRedirects, headers } = params;
    let currentUrl = params.url;
    let hopsRemaining = maxRedirects;

    // Set up a single AbortController for the entire request chain.
    const abortController = new AbortController();
    const timer = setTimeout(() => {
        abortController.abort();
    }, timeoutMs);

    try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            // --- Validate scheme + credentials (synchronous) ---
            const { host, href } = assertSafeUrl(currentUrl);

            // --- Validate DNS / private-IP (async) ---
            // Returns the first verified address so we can pin the connection.
            const pinned = await assertNoPrivateAddress(host);

            // --- Build a pinned-IP undici Agent (BUG 1 fix) ---
            // This Agent's lookup callback always returns the pre-validated IP,
            // so undici cannot re-resolve the hostname to a different address
            // between our check and the TCP connect. The original hostname is
            // still used for the Host header and TLS SNI by undici from the URL.
            const pinnedAgent = buildPinnedAgent(pinned.address, pinned.family);

            // --- Issue the request via undici with the pinned dispatcher ---
            let response: Dispatcher.ResponseData;
            try {
                response = await undiciRequest(href, {
                    method: 'GET',
                    headers: { ...headers },
                    // maxRedirections defaults to 0 in undici 7 — we handle
                    // redirects manually so auto-follow is intentionally off.
                    signal: abortController.signal,
                    dispatcher: pinnedAgent
                });
                // --- Handle redirects manually (inside the try so the body is
                // consumed BEFORE the finally destroys the dispatcher) ---
                const isRedirect =
                    response.statusCode === 301 ||
                    response.statusCode === 302 ||
                    response.statusCode === 303 ||
                    response.statusCode === 307 ||
                    response.statusCode === 308;

                if (isRedirect) {
                    // Consume the body so the connection can be reused / closed.
                    await response.body.dump().catch(() => undefined);

                    const location = response.headers.location;
                    const locationStr = Array.isArray(location) ? location[0] : location;

                    if (!locationStr) {
                        throwBlocked(
                            `Redirect response missing Location header (status ${response.statusCode})`
                        );
                    }

                    if (hopsRemaining <= 0) {
                        throwBlocked(`Exceeded maximum redirect limit of ${maxRedirects}`);
                    }

                    // Resolve relative Location against the current URL.
                    let nextUrl: string;
                    try {
                        nextUrl = new URL(locationStr, currentUrl).href;
                    } catch {
                        throwBlocked(`Invalid Location header: ${locationStr}`);
                    }

                    hopsRemaining--;
                    currentUrl = nextUrl;
                    continue; // Loop back: re-run ALL checks on the next URL.
                }

                // --- Stream body with cap ---
                const body = await readBodyCapped(response.body, maxBytes, abortController);

                return {
                    ok: true,
                    status: response.statusCode,
                    body,
                    finalUrl: currentUrl
                };
            } catch (fetchErr) {
                // A SafeFetchBlocked thrown by the body handling (e.g. the
                // maxBytes cap in readBodyCapped, which calls abort() before
                // throwing) must propagate verbatim — it already carries its own
                // reason. Only a genuine timeout/abort with no blocked payload is
                // reclassified as a timeout below.
                if (
                    fetchErr !== null &&
                    typeof fetchErr === 'object' &&
                    (fetchErr as { blocked?: unknown }).blocked === true
                ) {
                    throw fetchErr;
                }
                if (abortController.signal.aborted) {
                    throwBlocked(`Request timed out after ${timeoutMs} ms`);
                }
                throw fetchErr;
            } finally {
                // Destroy the per-hop agent AFTER its response body has been
                // consumed. undici >= 7 invalidates a still-pending response body
                // if the dispatcher is destroyed first ("The client is
                // destroyed"). A new agent is built for each hop so each hop's IP
                // is independently pinned.
                pinnedAgent.destroy().catch(() => undefined);
            }
        }
    } finally {
        clearTimeout(timer);
    }
}
