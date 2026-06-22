/**
 * Integration tests for `safeExternalFetch` against a real local HTTPS server.
 *
 * ## What these tests prove
 *
 * The existing unit tests in `safe-fetch.test.ts` mock both `node:dns/promises`
 * and `undici`, so they never exercise the real undici dispatcher/agent path.
 * Two bugs introduced by the undici 7.x upgrade were invisible to those mocks:
 *
 * **BUG 1 — lookup callback shape (fixed in buildPinnedAgent)**
 *   undici >= 7 expects the `{ all: true }` dns.lookup array shape:
 *   `callback(null, [{ address, family }])`.
 *   The legacy positional form `callback(null, address, family)` made undici
 *   read `addresses[0].address` as `undefined` → "Invalid IP address: undefined".
 *
 * **BUG 2 — per-hop Agent.destroy() before body read (fixed in _doFetch)**
 *   `pinnedAgent.destroy()` ran in a `finally` immediately after
 *   `undiciRequest` returned, before the response body was iterated.
 *   undici 7 invalidates a still-pending response body when the dispatcher is
 *   destroyed → "The client is destroyed".
 *   The fix moved body consumption INSIDE the try so `finally` runs after.
 *
 * ## SSRF bypass strategy (approach A)
 *
 * `safeExternalFetch` blocks private IPs via `isBlockedAddress` (imported from
 * `./safe-fetch-ip`). We `vi.mock` that module so `isBlockedAddress` always
 * returns `false`, allowing 127.0.0.1 to pass the SSRF check.
 *
 * The scheme check requires `https:`. We stand up a real local HTTPS server
 * with a self-signed certificate for 127.0.0.1 generated at runtime by openssl.
 * Tests set `NODE_TLS_REJECT_UNAUTHORIZED=0` so Node's TLS stack accepts the
 * cert; since `buildPinnedAgent` does NOT explicitly set `rejectUnauthorized:
 * true` in the Agent connect options, undici's `tls.connect` call inherits the
 * env-var default.
 *
 * **undici is NOT mocked** — the real `Agent` and `request` from the installed
 * undici 7.28.0 package are used, exercising the exact code paths the bugs
 * affected.
 */

// Must be set before any import so Node's TLS stack reads it during tls.connect.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import type * as http from 'node:http';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { safeExternalFetch } from '../src/safe-fetch';

// ---------------------------------------------------------------------------
// Mock isBlockedAddress to allow 127.0.0.1 through the SSRF guard.
// This is the ONLY mock — undici itself is NOT mocked.
// ---------------------------------------------------------------------------

vi.mock('../src/safe-fetch-ip', () => ({
    isBlockedAddress: () => false
}));

// ---------------------------------------------------------------------------
// Local HTTPS test server — cert + key generated at runtime via openssl
// ---------------------------------------------------------------------------

let server: https.Server;
let port: number;
let tmpDir: string;

/**
 * Starts the test HTTPS server before all tests.
 *
 * A temporary directory is created inside os.tmpdir(), openssl is called to
 * produce a self-signed certificate for 127.0.0.1 (1-day validity), and the
 * resulting PEM files are read into memory. The tmp dir is removed in afterAll.
 *
 * Routes:
 *   GET /hello  → 200 "world"
 *   GET /start  → 302 Location: /end
 *   GET /end    → 200 "arrived"
 *   GET /big    → 200 body of 20 "x" chars (for maxBytes cap test)
 */
beforeAll(
    () =>
        new Promise<void>((resolve, reject) => {
            // Generate a self-signed cert at runtime — no PEM literals in source.
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safefetch-'));
            const keyPath = path.join(tmpDir, 'key.pem');
            const certPath = path.join(tmpDir, 'cert.pem');

            execFileSync('openssl', [
                'req',
                '-x509',
                '-newkey',
                'rsa:2048',
                '-nodes',
                '-keyout',
                keyPath,
                '-out',
                certPath,
                '-days',
                '1',
                '-subj',
                '/CN=127.0.0.1',
                '-addext',
                'subjectAltName=IP:127.0.0.1'
            ]);

            const testCert = fs.readFileSync(certPath, 'utf8');
            const testKey = fs.readFileSync(keyPath, 'utf8');

            server = https.createServer(
                { key: testKey, cert: testCert },
                (req: http.IncomingMessage, res: http.ServerResponse) => {
                    if (req.url === '/hello') {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('world');
                        return;
                    }

                    if (req.url === '/start') {
                        // Use a relative redirect — safe-fetch.ts resolves it against currentUrl.
                        res.writeHead(302, { Location: '/end' });
                        res.end();
                        return;
                    }

                    if (req.url === '/end') {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('arrived');
                        return;
                    }

                    if (req.url === '/big') {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('x'.repeat(20));
                        return;
                    }

                    if (req.url === '/short') {
                        // Short-link style: a single redirect to the canonical page.
                        res.writeHead(302, { Location: '/canonical' });
                        res.end();
                        return;
                    }

                    if (req.url === '/canonical') {
                        // Terminal page with a LARGE body (5000 bytes) — emulates a
                        // canonical Google Maps page. resolveOnly must NOT read it.
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end('y'.repeat(5000));
                        return;
                    }

                    res.writeHead(404);
                    res.end('not found');
                }
            );

            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                if (!addr || typeof addr === 'string') {
                    reject(new Error('Failed to get server address'));
                    return;
                }
                port = addr.port;
                resolve();
            });

            server.on('error', reject);
        }),
    // Allow up to 30 s: openssl keygen (rsa:2048) can take a few seconds on CI.
    30_000
);

afterAll(
    () =>
        new Promise<void>((resolve) => {
            server.close(() => {
                fs.rmSync(tmpDir, { recursive: true, force: true });
                resolve();
            });
        })
);

// ---------------------------------------------------------------------------
// Integration tests — real undici Agent + request path
// ---------------------------------------------------------------------------

describe('safeExternalFetch — undici-7 integration (real dispatcher)', () => {
    /**
     * Test 1: Plain 200 response with a body.
     *
     * Fails WITHOUT the fix because:
     * - BUG 1: buildPinnedAgent called callback(null, address, family) →
     *   undici 7 reads addresses[0].address as undefined →
     *   "Invalid IP address: undefined" before TCP connect.
     * - BUG 2 (if bug 1 were fixed): pinnedAgent.destroy() ran in finally
     *   before readBodyCapped iterated the body → "The client is destroyed".
     */
    it('returns ok:true with status 200, body, and finalUrl for a plain HTTPS GET', async () => {
        // Arrange
        const url = `https://127.0.0.1:${port}/hello`;

        // Act — real undici Agent + real TCP+TLS connection to our local server
        const result = await safeExternalFetch({ url, timeoutMs: 5_000 });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.status).toBe(200);
            expect(result.body).toBe('world');
            expect(result.finalUrl).toBe(url);
        }
    });

    /**
     * Test 2: 302 redirect followed to a second path.
     *
     * Exercises the multi-hop agent lifecycle: each hop creates a new pinned
     * Agent, issues a real request, consumes (or dumps) the response body,
     * then destroys the Agent — all via real undici.
     *
     * BUG 2 is particularly visible here: if destroy() runs before the body
     * dump on the redirect hop, the next hop's request fails on the same
     * dispatcher ("The client is destroyed").
     */
    it('follows a 302 redirect and returns ok:true with the final body', async () => {
        // Arrange
        const startUrl = `https://127.0.0.1:${port}/start`;
        const expectedFinalPath = '/end';

        // Act
        const result = await safeExternalFetch({ url: startUrl, timeoutMs: 5_000 });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.status).toBe(200);
            expect(result.body).toBe('arrived');
            // finalUrl must end with /end (absolute URL after redirect resolution)
            expect(result.finalUrl).toMatch(new RegExp(`${expectedFinalPath}$`));
        }
    });

    /**
     * Test 3: maxBytes body cap still works over a real connection.
     *
     * The /big endpoint returns 20 bytes. With maxBytes=10 the streaming cap
     * must trigger and return ok:false blocked:true.
     *
     * Note on error message: readBodyCapped calls abortController.abort() before
     * throwBlocked('...size...'), so signal.aborted is true when the catch block
     * in _doFetch sees the thrown blocked object — it re-wraps it as a timeout
     * message. The observable invariant is ok:false + blocked:true, which is
     * correct regardless of which path triggered the abort. We assert that here
     * without coupling to the specific error string.
     *
     * Contrast: a successful 200 with body that fits within the cap returns
     * ok:true — tested separately to confirm the cap logic does not spuriously
     * block valid responses.
     */
    it('blocks a response body that exceeds maxBytes (ok:false, blocked:true)', async () => {
        // Arrange — /big returns 20 "x" chars; cap at 10 → must block
        const url = `https://127.0.0.1:${port}/big`;

        // Act
        const result = await safeExternalFetch({ url, maxBytes: 10, timeoutMs: 5_000 });

        // Assert: blocked, not ok
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
        }
    });

    /**
     * Test 3b: a body that fits within maxBytes is NOT blocked.
     *
     * Complements test 3 — proves the cap is directional and does not fire
     * spuriously when the body is small enough.
     */
    it('allows a body within maxBytes and returns it in full', async () => {
        // Arrange — /hello returns "world" (5 bytes); cap at 100
        const url = `https://127.0.0.1:${port}/hello`;

        // Act
        const result = await safeExternalFetch({ url, maxBytes: 100, timeoutMs: 5_000 });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.body).toBe('world');
        }
    });

    /**
     * Test 4 (resolve-only): follows a 302 to a LARGE terminal page and returns
     * the resolved URL without reading the body — even when maxBytes is tiny.
     *
     * This is the SPEC-257 regression guard. The /canonical body is 5000 bytes;
     * with maxBytes:10 the default mode would return ok:false (blocked) and lose
     * finalUrl (the exact bug that left Google maps.app.goo.gl short links
     * unresolved). resolveOnly:true must skip the body read entirely → ok:true,
     * finalUrl ~ /canonical, body === ''.
     */
    it('resolveOnly: follows redirect to a large terminal page without reading the body', async () => {
        // Arrange — /short → 302 → /canonical (5000-byte body), cap deliberately tiny
        const shortUrl = `https://127.0.0.1:${port}/short`;

        // Act
        const result = await safeExternalFetch({
            url: shortUrl,
            timeoutMs: 5_000,
            maxBytes: 10,
            maxRedirects: 5,
            resolveOnly: true
        });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.status).toBe(200);
            expect(result.body).toBe('');
            expect(result.finalUrl).toMatch(/\/canonical$/);
        }
    });

    /**
     * Test 5 (resolve-only): a direct (non-redirect) 2xx URL returns ok:true with
     * the input URL as finalUrl and an empty body — no body download.
     */
    it('resolveOnly: returns the input URL with empty body for a direct 2xx response', async () => {
        // Arrange
        const url = `https://127.0.0.1:${port}/hello`;

        // Act
        const result = await safeExternalFetch({ url, timeoutMs: 5_000, resolveOnly: true });

        // Assert
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.status).toBe(200);
            expect(result.body).toBe('');
            expect(result.finalUrl).toBe(url);
        }
    });

    /**
     * Test 6 (resolve-only): the redirect cap still applies. With maxRedirects:0
     * a redirecting short link must be blocked (no silent bypass via resolveOnly).
     */
    it('resolveOnly: still enforces the redirect cap (ok:false when exceeded)', async () => {
        // Arrange — /short redirects once; cap at 0 hops → must block
        const shortUrl = `https://127.0.0.1:${port}/short`;

        // Act
        const result = await safeExternalFetch({
            url: shortUrl,
            timeoutMs: 5_000,
            maxRedirects: 0,
            resolveOnly: true
        });

        // Assert
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.blocked).toBe(true);
        }
    });
});
