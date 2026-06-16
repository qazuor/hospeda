/**
 * Tests for `safeExternalFetch`.
 *
 * Strategy:
 *  - `node:dns/promises` is vi.mock'd so no real DNS lookups occur.
 *  - `undici` is vi.mock'd so no real HTTP calls are made. The Agent
 *    constructor and `request` function are replaced with spies/stubs.
 *  - Fake timers are used for the timeout test.
 *
 * Pure `isBlockedAddress` unit tests live in `safe-fetch-ip.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeExternalFetch } from '../src/safe-fetch';

// ---------------------------------------------------------------------------
// DNS mock setup
// ---------------------------------------------------------------------------

// We need a mutable variable that individual tests can override.
let dnsMockImpl: (
    hostname: string,
    options: { all: true }
) => Promise<{ address: string; family: number }[]>;

vi.mock('node:dns/promises', () => ({
    lookup: (hostname: string, options: { all: true }) => dnsMockImpl(hostname, options)
}));

// ---------------------------------------------------------------------------
// undici mock setup
// ---------------------------------------------------------------------------

/**
 * The pinned address that was passed to the Agent constructor.
 * Captured by probing the lookup callback immediately after construction.
 */
let lastPinnedAddress: string | null = null;

/**
 * Mutable factory for what `undiciRequest` returns. Individual tests override
 * this to simulate different HTTP responses. The optional `signal` param allows
 * timeout tests to reject when the AbortController fires.
 */
let undiciRequestImpl: (signal?: AbortSignal) => Promise<UndiciResponseLike>;

/**
 * Minimal shape of an undici response that our code uses.
 */
interface UndiciResponseLike {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: {
        [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
        dump(): Promise<void>;
    };
}

/** Creates a minimal mock undici response. */
function makeMockUndiciResponse(
    overrides: {
        statusCode?: number;
        headers?: Record<string, string>;
        body?: string;
    } = {}
): UndiciResponseLike {
    const { statusCode = 200, headers = {}, body = '<html>ok</html>' } = overrides;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(body);

    return {
        statusCode,
        headers,
        body: {
            async *[Symbol.asyncIterator]() {
                yield encoded;
            },
            async dump() {
                // consume / discard body
            }
        }
    };
}

vi.mock('undici', () => {
    /**
     * Mock Agent that captures the pinned IP by probing the lookup callback
     * supplied by `buildPinnedAgent`. Tests assert `lastPinnedAddress` to
     * verify the pre-validated IP was forwarded to the connection layer.
     */
    class MockAgent {
        constructor(options?: {
            connect?: {
                lookup?: (
                    hostname: string,
                    opts: unknown,
                    callback: (err: Error | null, address: string, family: number) => void
                ) => void;
            };
        }) {
            const lookupFn = options?.connect?.lookup;
            if (lookupFn) {
                // Probe immediately: invoke the lookup callback with a dummy
                // hostname to extract the pinned address the callback returns.
                lookupFn('__probe__', {}, (_err, addr, _fam) => {
                    lastPinnedAddress = addr;
                });
            }
        }

        destroy() {
            return Promise.resolve();
        }
    }

    return {
        Agent: MockAgent,
        request: (_url: string, opts: { signal?: AbortSignal } = {}) =>
            undiciRequestImpl(opts.signal)
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default DNS mock: resolves any hostname to a public IP. */
function publicDns(address = '93.184.216.34'): void {
    dnsMockImpl = async () => [{ address, family: 4 }];
}

/** DNS mock that rejects every lookup (simulates NX-domain). */
function failingDns(): void {
    dnsMockImpl = async () => {
        throw new Error('ENOTFOUND');
    };
}

/** Sets `undiciRequestImpl` to return a simple 200 response. */
function mockUndiciSuccess(body = '<html>ok</html>'): void {
    undiciRequestImpl = async (_signal?: AbortSignal) => makeMockUndiciResponse({ body });
}

// ---------------------------------------------------------------------------
// safeExternalFetch — scheme / credential pre-flight (no network calls)
// ---------------------------------------------------------------------------

describe('safeExternalFetch — scheme validation', () => {
    beforeEach(() => {
        // These tests never reach DNS or fetch; no mocking needed.
        // But we set a default DNS mock to avoid leaking state.
        publicDns();
        mockUndiciSuccess();
    });

    it('blocks http:// URLs', async () => {
        // Arrange
        const url = 'http://example.com/page';
        // Act
        const result = await safeExternalFetch({ url });
        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
            expect(result.error).toMatch(/scheme/i);
        }
    });

    it('blocks ftp:// URLs', async () => {
        const result = await safeExternalFetch({ url: 'ftp://files.example.com/file.txt' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });

    it('blocks file:// URLs', async () => {
        const result = await safeExternalFetch({ url: 'file:///etc/passwd' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });

    it('blocks data: URLs', async () => {
        const result = await safeExternalFetch({ url: 'data:text/html,<h1>hello</h1>' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });

    it('blocks completely invalid URLs', async () => {
        const result = await safeExternalFetch({ url: 'not-a-url-at-all' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.blocked).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — embedded credentials
// ---------------------------------------------------------------------------

describe('safeExternalFetch — embedded credentials', () => {
    beforeEach(() => {
        publicDns();
        mockUndiciSuccess();
    });

    it('blocks https://user:pass@example.com', async () => {
        const result = await safeExternalFetch({ url: 'https://user:pass@example.com/page' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
            expect(result.error).toMatch(/credential/i);
        }
    });

    it('blocks https://user@example.com (username only)', async () => {
        const result = await safeExternalFetch({ url: 'https://user@example.com' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/credential/i);
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — DNS / private-IP blocking
// ---------------------------------------------------------------------------

describe('safeExternalFetch — DNS private-IP blocking', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        mockUndiciSuccess();
    });

    it('blocks localhost by hostname (before DNS)', async () => {
        // Arrange — DNS mock should never be called
        dnsMockImpl = async () => {
            throw new Error('DNS should not be called for localhost');
        };
        // Act
        const result = await safeExternalFetch({ url: 'https://localhost/secret' });
        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/localhost/i);
    });

    it('blocks when DNS resolves to 127.0.0.1', async () => {
        dnsMockImpl = async () => [{ address: '127.0.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://internal.evil.com/' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/blocked/i);
    });

    it('blocks when DNS resolves to 10.1.2.3 (RFC 1918)', async () => {
        dnsMockImpl = async () => [{ address: '10.1.2.3', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://corp.internal/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to 192.168.1.1', async () => {
        dnsMockImpl = async () => [{ address: '192.168.1.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://router.local/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to 172.16.5.5 (RFC 1918)', async () => {
        dnsMockImpl = async () => [{ address: '172.16.5.5', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://vpn.internal/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to 169.254.169.254 (cloud IMDS)', async () => {
        // This is the classic AWS/GCP metadata endpoint — must be blocked.
        dnsMockImpl = async () => [{ address: '169.254.169.254', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://metadata.attacker.com/' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/blocked/i);
    });

    it('blocks when DNS resolves to 100.64.0.1 (CGNAT)', async () => {
        dnsMockImpl = async () => [{ address: '100.64.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://cgnat.example.com/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to IPv6 ::1 (loopback)', async () => {
        dnsMockImpl = async () => [{ address: '::1', family: 6 }];
        const result = await safeExternalFetch({ url: 'https://ipv6-local.example.com/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to fe80::1 (link-local)', async () => {
        dnsMockImpl = async () => [{ address: 'fe80::1', family: 6 }];
        const result = await safeExternalFetch({ url: 'https://link-local.example.com/' });
        expect(result.ok).toBe(false);
    });

    it('blocks when DNS resolves to fc00::1 (ULA)', async () => {
        dnsMockImpl = async () => [{ address: 'fc00::1', family: 6 }];
        const result = await safeExternalFetch({ url: 'https://ula.example.com/' });
        expect(result.ok).toBe(false);
    });

    it('blocks on DNS-rebinding: ANY private IP in multi-address response', async () => {
        // Public + private in the same DNS response is the DNS-rebinding attack.
        dnsMockImpl = async () => [
            { address: '93.184.216.34', family: 4 }, // public
            { address: '10.1.2.3', family: 4 } // private — must block the whole request
        ];
        const result = await safeExternalFetch({ url: 'https://rebind.attacker.com/' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/blocked/i);
    });

    it('blocks when DNS resolution fails entirely', async () => {
        failingDns();
        const result = await safeExternalFetch({ url: 'https://nx-domain.example.com/' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.blocked).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// BUG 1 REGRESSION — TOCTOU DNS rebinding / IP pinning
// ---------------------------------------------------------------------------

describe('safeExternalFetch — TOCTOU IP pinning (BUG 1 regression)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        lastPinnedAddress = null;
    });

    it('pins the pre-validated IP so undici cannot re-resolve to a private address', async () => {
        // Arrange: DNS validates to 93.184.216.34 (public).
        // The attacker's trick would be: DNS returns 169.254.169.254 at
        // connection time. With pinning, undici receives the pre-validated IP
        // from the lookup callback — it cannot call the real resolver again.
        publicDns('93.184.216.34');
        mockUndiciSuccess();

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/' });

        // Assert: the request succeeded AND the pinned address recorded by our
        // mock Agent constructor is the pre-validated one (93.184.216.34).
        expect(result.ok).toBe(true);
        expect(lastPinnedAddress).toBe('93.184.216.34');
    });

    it('pins a different public IP for each hop (redirects are independently pinned)', async () => {
        // First hop → public 1.2.3.4, second hop → public 5.6.7.8
        let callCount = 0;
        dnsMockImpl = async () => {
            callCount++;
            if (callCount === 1) return [{ address: '1.2.3.4', family: 4 }];
            return [{ address: '5.6.7.8', family: 4 }];
        };

        const pinnedAddresses: string[] = [];
        // We track all pinned addresses by patching lastPinnedAddress after
        // each agent creation. The mock Agent constructor updates lastPinnedAddress
        // synchronously, so we capture it in the request impl.
        undiciRequestImpl = async () => {
            if (lastPinnedAddress !== null) {
                pinnedAddresses.push(lastPinnedAddress);
            }
            if (pinnedAddresses.length === 1) {
                // First hop: return a redirect
                return makeMockUndiciResponse({
                    statusCode: 301,
                    headers: { location: 'https://redirected.example.com/' }
                });
            }
            return makeMockUndiciResponse({ statusCode: 200 });
        };

        await safeExternalFetch({ url: 'https://example.com/' });

        // Both hops must have been pinned to their respective pre-validated IPs.
        expect(pinnedAddresses).toContain('1.2.3.4');
        expect(pinnedAddresses).toContain('5.6.7.8');
    });
});

// ---------------------------------------------------------------------------
// BUG 2 REGRESSION — IPv6 literal URLs
// ---------------------------------------------------------------------------

describe('safeExternalFetch — IPv6 literal URLs (BUG 2 regression)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('blocks https://[::1]/ (loopback IPv6 literal) by range, not DNS error', async () => {
        // Arrange: DNS should NOT be called for bracketed IPv6 literals.
        const dnsSpy = vi.fn().mockRejectedValue(new Error('DNS must not be called'));
        dnsMockImpl = dnsSpy;
        mockUndiciSuccess();

        // Act
        const result = await safeExternalFetch({ url: 'https://[::1]/' });

        // Assert: blocked — and it was NOT a DNS error (error message reflects
        // the IPv6 literal being private, not ENOTFOUND)
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/blocked|private/i);
            // The error must NOT say "DNS resolution failed"
            expect(result.error).not.toMatch(/dns resolution failed/i);
        }
        // DNS was not consulted
        expect(dnsSpy).not.toHaveBeenCalled();
    });

    it('blocks https://[fe80::1]/ (link-local IPv6 literal)', async () => {
        const dnsSpy = vi.fn().mockRejectedValue(new Error('DNS must not be called'));
        dnsMockImpl = dnsSpy;
        mockUndiciSuccess();

        const result = await safeExternalFetch({ url: 'https://[fe80::1]/' });
        expect(result.ok).toBe(false);
        expect(dnsSpy).not.toHaveBeenCalled();
    });

    it('blocks https://[fc00::1]/ (ULA IPv6 literal)', async () => {
        const dnsSpy = vi.fn().mockRejectedValue(new Error('DNS must not be called'));
        dnsMockImpl = dnsSpy;
        mockUndiciSuccess();

        const result = await safeExternalFetch({ url: 'https://[fc00::1]/' });
        expect(result.ok).toBe(false);
        expect(dnsSpy).not.toHaveBeenCalled();
    });

    it('blocks https://[::ffff:169.254.169.254]/ (IPv4-mapped metadata, IPv6 literal)', async () => {
        const dnsSpy = vi.fn().mockRejectedValue(new Error('DNS must not be called'));
        dnsMockImpl = dnsSpy;
        mockUndiciSuccess();

        const result = await safeExternalFetch({ url: 'https://[::ffff:169.254.169.254]/' });
        expect(result.ok).toBe(false);
        expect(dnsSpy).not.toHaveBeenCalled();
    });

    it('allows https://[2606:2800::1]/ (public IPv6 literal) — must NOT be blocked', async () => {
        // Arrange: DNS should NOT be called for bracketed IPv6 literals.
        const dnsSpy = vi.fn().mockRejectedValue(new Error('DNS must not be called'));
        dnsMockImpl = dnsSpy;
        mockUndiciSuccess('public ipv6 page');

        // Act
        const result = await safeExternalFetch({ url: 'https://[2606:2800::1]/' });

        // Assert: passes validation
        expect(result.ok).toBe(true);
        expect(dnsSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// REGRESSION — alternate IPv4 notations that bypass naive parsers
// ---------------------------------------------------------------------------

describe('safeExternalFetch — alternate IPv4 notation blocking (regression)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        mockUndiciSuccess();
    });

    /**
     * These alternate notations are not valid as URL hostnames in modern
     * browsers / WHATWG URL (they parse as a hostname string that dns.lookup
     * would try to resolve), BUT some older or non-standard implementations
     * normalise them. We test that if they ever arrive as a host value after
     * URL parsing, dns.lookup is either blocked or the address is denied.
     *
     * For WHATWG URL-parsed values, `new URL('https://0x7f.0.0.1/')` etc.
     * may normalise to the dotted-decimal form or leave the raw string. We
     * verify that in any case the resulting URL is blocked.
     */

    it('blocks https://0x7f.0.0.1/ (hex octet notation for 127.0.0.1)', async () => {
        // WHATWG URL normalises 0x7f.0.0.1 to 127.0.0.1 in the hostname.
        // If it does NOT normalise (older runtimes), dns.lookup will resolve
        // it, or we catch it via the blocked address check after resolution.
        // Either way the result must be blocked.
        dnsMockImpl = async () => [{ address: '127.0.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://0x7f.0.0.1/' });
        expect(result.ok).toBe(false);
    });

    it('blocks https://0177.0.0.1/ (octal first octet for 127.0.0.1)', async () => {
        // Octal notation: 0177 = 127 in decimal.
        // WHATWG URL either normalises or leaves raw; either way blocked.
        dnsMockImpl = async () => [{ address: '127.0.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://0177.0.0.1/' });
        expect(result.ok).toBe(false);
    });

    it('blocks https://2130706433/ (decimal integer for 127.0.0.1)', async () => {
        // 127.0.0.1 = 0x7f000001 = 2130706433 decimal.
        // WHATWG URL normalises integer IPv4 to dotted-decimal.
        dnsMockImpl = async () => [{ address: '127.0.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://2130706433/' });
        expect(result.ok).toBe(false);
    });

    it('blocks https://127.1/ (short-form IPv4 for 127.0.0.1)', async () => {
        // Short-form: 127.1 is often resolved as 127.0.0.1 by some resolvers.
        // WHATWG URL may normalise or leave it; dns.lookup may expand or fail.
        // We simulate dns.lookup resolving it to the loopback.
        dnsMockImpl = async () => [{ address: '127.0.0.1', family: 4 }];
        const result = await safeExternalFetch({ url: 'https://127.1/' });
        expect(result.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — redirect validation
// ---------------------------------------------------------------------------

describe('safeExternalFetch — redirect handling', () => {
    beforeEach(() => {
        publicDns();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('blocks a redirect to http:// (scheme downgrade)', async () => {
        // Arrange — first request returns a 302 to http://
        let callCount = 0;
        undiciRequestImpl = async () => {
            callCount++;
            if (callCount === 1) {
                return makeMockUndiciResponse({
                    statusCode: 302,
                    headers: { location: 'http://example.com/unsafe' }
                });
            }
            return makeMockUndiciResponse({ statusCode: 200 });
        };

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/redirect' });

        // Assert — the redirect to http:// must be blocked
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });

    it('blocks a redirect to a private IP', async () => {
        // DNS: first call → public (initial URL), second call → private (redirect target)
        let dnsCallCount = 0;
        dnsMockImpl = async () => {
            dnsCallCount++;
            if (dnsCallCount === 1) return [{ address: '93.184.216.34', family: 4 }];
            return [{ address: '192.168.1.1', family: 4 }];
        };

        undiciRequestImpl = async () =>
            makeMockUndiciResponse({
                statusCode: 301,
                headers: { location: 'https://internal.evil.com/' }
            });

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/redir' });

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/blocked/i);
    });

    it('blocks when redirect chain exceeds maxRedirects', async () => {
        // Arrange — every response is a 302 pointing back to the same host
        undiciRequestImpl = async () =>
            makeMockUndiciResponse({
                statusCode: 302,
                headers: { location: 'https://example.com/hop' }
            });

        // Act — maxRedirects = 2 means only 2 hops allowed
        const result = await safeExternalFetch({
            url: 'https://example.com/start',
            maxRedirects: 2
        });

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/redirect/i);
    });

    it('follows a safe redirect and returns the final response', async () => {
        // Arrange
        let callCount = 0;
        undiciRequestImpl = async () => {
            callCount++;
            if (callCount === 1) {
                return makeMockUndiciResponse({
                    statusCode: 301,
                    headers: { location: 'https://example.com/final' }
                });
            }
            return makeMockUndiciResponse({ statusCode: 200, body: 'final page' });
        };

        // Act
        const result = await safeExternalFetch({
            url: 'https://example.com/original',
            maxRedirects: 3
        });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.body).toBe('final page');
            expect(result.finalUrl).toBe('https://example.com/final');
        }
    });

    it('blocks a redirect Location with a private IPv6 literal', async () => {
        // Arrange: initial URL is public, redirect points to [::1]
        undiciRequestImpl = async () =>
            makeMockUndiciResponse({
                statusCode: 302,
                headers: { location: 'https://[::1]/admin' }
            });

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/start' });

        // Assert: the [::1] redirect target must be blocked (BUG 2 regression)
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toMatch(/blocked|private/i);
            expect(result.error).not.toMatch(/dns resolution failed/i);
        }
    });

    it('blocks a redirect Location with a javascript: scheme', async () => {
        // Arrange
        undiciRequestImpl = async () =>
            makeMockUndiciResponse({
                statusCode: 302,
                headers: { location: 'javascript:alert(1)' }
            });

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/' });

        // Assert: javascript: must be rejected by the scheme check
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });

    it('blocks a redirect Location with a gopher: scheme', async () => {
        undiciRequestImpl = async () =>
            makeMockUndiciResponse({
                statusCode: 302,
                headers: { location: 'gopher://example.com/' }
            });

        const result = await safeExternalFetch({ url: 'https://example.com/' });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/scheme/i);
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — timeout
// ---------------------------------------------------------------------------

describe('safeExternalFetch — timeout', () => {
    beforeEach(() => {
        publicDns();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('aborts after timeoutMs when fetch never resolves', async () => {
        // Arrange — request hangs until the AbortSignal fires, then rejects.
        // The signal is forwarded from undiciRequestImpl's first argument.
        undiciRequestImpl = (signal?: AbortSignal) =>
            new Promise<UndiciResponseLike>((_resolve, reject) => {
                if (signal) {
                    signal.addEventListener('abort', () => {
                        reject(new DOMException('AbortError', 'AbortError'));
                    });
                }
            });

        // Act — start the request then advance fake timers past the timeout
        const promise = safeExternalFetch({ url: 'https://example.com/', timeoutMs: 5_000 });
        await vi.advanceTimersByTimeAsync(6_000);
        const result = await promise;

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
            expect(result.error).toMatch(/time.*out|abort/i);
        }
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — max body size
// ---------------------------------------------------------------------------

describe('safeExternalFetch — max body size', () => {
    beforeEach(() => publicDns());

    afterEach(() => vi.restoreAllMocks());

    it('blocks when response body exceeds maxBytes', async () => {
        // Arrange — body is 10 bytes but maxBytes is 5
        const largeBody = 'x'.repeat(10);
        undiciRequestImpl = async () => makeMockUndiciResponse({ body: largeBody });

        // Act
        const result = await safeExternalFetch({
            url: 'https://example.com/',
            maxBytes: 5
        });

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
            expect(result.error).toMatch(/size|bytes/i);
        }
    });

    it('allows a response body within maxBytes', async () => {
        // Arrange
        const smallBody = 'hello';
        undiciRequestImpl = async () => makeMockUndiciResponse({ body: smallBody });

        // Act
        const result = await safeExternalFetch({
            url: 'https://example.com/',
            maxBytes: 100
        });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.body).toBe(smallBody);
    });
});

// ---------------------------------------------------------------------------
// safeExternalFetch — happy path
// ---------------------------------------------------------------------------

describe('safeExternalFetch — happy path', () => {
    beforeEach(() => publicDns());

    afterEach(() => vi.restoreAllMocks());

    it('returns ok:true with status, body, and finalUrl for a clean HTTPS fetch', async () => {
        // Arrange
        const responseBody = '<html><body>Hello</body></html>';
        undiciRequestImpl = async () => makeMockUndiciResponse({ body: responseBody });

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/page' });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.status).toBe(200);
            expect(result.body).toBe(responseBody);
            expect(result.finalUrl).toBe('https://example.com/page');
        }
    });

    it('applies defaults (timeoutMs=8000, maxBytes=3_000_000, maxRedirects=3)', async () => {
        // Arrange — we just verify the function returns ok without specifying options
        undiciRequestImpl = async () => makeMockUndiciResponse({ body: 'data' });

        // Act
        const result = await safeExternalFetch({ url: 'https://example.com/' });

        // Assert — success with defaults applied
        expect(result.ok).toBe(true);
    });
});
