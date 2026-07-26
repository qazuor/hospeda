/**
 * @file upload-entity.test.ts
 * @description Tests for the XHR-based `uploadEntityImage` helper.
 *
 * Covers (BETA-134 — "Invalid response from upload endpoint" / React #418):
 * - A bounded `xhr.timeout` is configured so a hanging upload does not wait
 *   forever for a response.
 * - An XHR `timeout` event surfaces a typed, actionable error message
 *   instead of leaving the caller hanging.
 * - A `load` event with an EMPTY response body (the shape of a reverse-proxy
 *   timeout page replacing our JSON response) surfaces a clear timeout-like
 *   message rather than the generic, unhelpful parse-failure message.
 * - A `load` event with a genuinely malformed (non-empty) body still
 *   surfaces the pre-existing generic parse-failure message (regression
 *   guard — this codepath is intentionally unchanged for real corruption).
 * - The happy path (valid JSON success response) still resolves correctly.
 *
 * Covers (HOS-201 — host photo upload 404 in prod):
 * - The upload targets an ABSOLUTE API URL (host included), never a relative
 *   path. In prod, web and API are separate origins, so a relative path 404s
 *   against the web origin. The XHR must open the `getApiUrl()`-prefixed URL.
 */

import { DEFAULT_ENTITY_MAX_FILE_SIZE_MB, mbToBytes } from '@repo/media';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveUploadTimeoutMs, uploadEntityImage } from '../../../src/lib/media/upload-entity';

/**
 * Minimal XHR stub sufficient to drive `uploadEntityImage`'s event-driven
 * flow. Tests trigger `load` / `error` / `timeout` manually via `trigger()`
 * instead of relying on a real network stack.
 */
class MockXHR {
    static instances: MockXHR[] = [];

    method = '';
    url = '';
    withCredentials = false;
    timeout = 0;
    status = 0;
    responseText = '';

    upload = {
        addEventListener: vi.fn()
    };

    private readonly listeners: Record<string, Array<() => void>> = {};

    constructor() {
        MockXHR.instances.push(this);
    }

    open(method: string, url: string): void {
        this.method = method;
        this.url = url;
    }

    addEventListener(event: string, handler: () => void): void {
        this.listeners[event] = this.listeners[event] ?? [];
        this.listeners[event]?.push(handler);
    }

    send(): void {
        // No-op — tests trigger response events manually.
    }

    /** Fires every handler registered for `event`, simulating a real XHR event. */
    trigger(event: string): void {
        for (const handler of this.listeners[event] ?? []) {
            handler();
        }
    }
}

const buildTestFile = (): File =>
    new File(['fake-image-bytes'], 'photo.jpg', { type: 'image/jpeg' });

describe('uploadEntityImage', () => {
    beforeEach(() => {
        MockXHR.instances = [];
        vi.stubGlobal('XMLHttpRequest', MockXHR);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('timeout resiliency (BETA-134)', () => {
        it('should configure a bounded, positive xhr.timeout', () => {
            void uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });

            const xhr = MockXHR.instances[0];
            expect(xhr).toBeDefined();
            expect(typeof xhr?.timeout).toBe('number');
            expect(xhr?.timeout).toBeGreaterThan(0);
        });

        it('should reject with a typed timeout error when the XHR times out', async () => {
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];

            xhr?.trigger('timeout');

            await expect(promise).rejects.toThrow(/timed out/i);
        });

        it('should reject with a clear timeout-like message (not a generic parse failure) when the response body is empty', async () => {
            // Arrange: simulates a reverse proxy killing the connection and
            // replacing our JSON response with an empty/non-JSON body.
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];
            if (!xhr) throw new Error('expected an XHR instance to have been created');
            xhr.status = 504;
            xhr.responseText = '';

            // Act
            xhr.trigger('load');

            // Assert: a specific, actionable message — never the old generic
            // "Invalid response from upload endpoint" for this empty-body case.
            await expect(promise).rejects.toThrow(/timed out|server did not respond/i);
        });

        it('should still surface the generic invalid-response message for a genuinely malformed, non-empty body', async () => {
            // Regression guard: real corruption (non-empty but unparseable
            // body) keeps its original, distinct message.
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];
            if (!xhr) throw new Error('expected an XHR instance to have been created');
            xhr.status = 200;
            xhr.responseText = '<html>not json</html>';

            xhr.trigger('load');

            await expect(promise).rejects.toThrow('Invalid response from upload endpoint');
        });
    });

    describe('absolute API URL (HOS-201)', () => {
        it('should open an absolute API URL (with host), not a relative path', () => {
            void uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });

            const xhr = MockXHR.instances[0];
            if (!xhr) throw new Error('expected an XHR instance to have been created');

            // Must be absolute — a relative '/api/...' 404s cross-origin in prod.
            expect(xhr.url.startsWith('/')).toBe(false);
            expect(/^https?:\/\//.test(xhr.url)).toBe(true);
            // Points at the API base (getApiUrl()), preserving the endpoint path.
            expect(xhr.url).toBe('http://localhost:3001/api/v1/protected/media/upload-entity');
        });

        it('should keep sending the session cookie cross-origin (withCredentials)', () => {
            void uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });

            const xhr = MockXHR.instances[0];
            expect(xhr?.withCredentials).toBe(true);
        });
    });

    describe('happy path (regression)', () => {
        it('should resolve with the uploaded image metadata on a valid success response', async () => {
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];
            if (!xhr) throw new Error('expected an XHR instance to have been created');
            xhr.status = 200;
            xhr.responseText = JSON.stringify({
                success: true,
                data: {
                    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/photo.jpg',
                    publicId: 'hospeda/dev/accommodations/acc-1/gallery/abc',
                    width: 1920,
                    height: 1080
                }
            });

            xhr.trigger('load');

            const result = await promise;
            expect(result.url).toContain('cloudinary.com');
            expect(result.publicId).toBe('hospeda/dev/accommodations/acc-1/gallery/abc');
        });

        it('should reject with the server error message on a typed error response', async () => {
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];
            if (!xhr) throw new Error('expected an XHR instance to have been created');
            xhr.status = 502;
            xhr.responseText = JSON.stringify({
                success: false,
                error: { code: 'UPSTREAM_ERROR', message: 'Image upload failed' }
            });

            xhr.trigger('load');

            await expect(promise).rejects.toThrow('Image upload failed');
        });
    });

    describe('resolveUploadTimeoutMs (HOS-322)', () => {
        // The clamp and the finite-size guard are the load-bearing parts of
        // this function, and a review found both could be deleted with the
        // whole suite still green — the only existing assertion was
        // `timeout > 0`, which passes for any positive number.

        it('gives a small file the floor, not a proportionally tiny budget', () => {
            expect(resolveUploadTimeoutMs(mbToBytes(1))).toBe(40_000);
        });

        it('scales with the file between the floor and the ceiling', () => {
            // 5 MB at the assumed 1 Mbps uplink: 25s server budget + ~42s wire.
            expect(resolveUploadTimeoutMs(mbToBytes(5))).toBe(66_944);
        });

        it('never waits past the proxy window, even at the size cap', () => {
            // Unclamped this would be ~109s, past Cloudflare's 100s origin
            // window — where the reply becomes an HTML page that dies in
            // JSON.parse instead of a typed timeout.
            expect(resolveUploadTimeoutMs(mbToBytes(DEFAULT_ENTITY_MAX_FILE_SIZE_MB))).toBe(90_000);
        });

        it('falls back to the floor for a size that is not a usable number', () => {
            // `Math.max(floor, NaN)` is NaN, and `xhr.timeout = NaN` coerces to
            // 0 — meaning NO timeout at all. Failing toward the floor keeps the
            // protection this function exists to provide.
            expect(resolveUploadTimeoutMs(Number.NaN)).toBe(40_000);
            expect(resolveUploadTimeoutMs(0)).toBe(40_000);
            expect(resolveUploadTimeoutMs(-1)).toBe(40_000);
            expect(resolveUploadTimeoutMs(Number.POSITIVE_INFINITY)).toBe(40_000);
        });

        it('stays within its own bounds for every size up to the cap', () => {
            for (let mb = 0; mb <= DEFAULT_ENTITY_MAX_FILE_SIZE_MB; mb += 1) {
                const value = resolveUploadTimeoutMs(mbToBytes(mb));
                expect(value).toBeGreaterThanOrEqual(40_000);
                expect(value).toBeLessThanOrEqual(90_000);
            }
        });
    });

    describe('network error (regression)', () => {
        it('should reject with a network error message on an XHR error event', async () => {
            const promise = uploadEntityImage({ file: buildTestFile(), accommodationId: 'acc-1' });
            const xhr = MockXHR.instances[0];

            xhr?.trigger('error');

            await expect(promise).rejects.toThrow('Network error during upload');
        });
    });
});
