/**
 * @file internal-bypass-report.test.ts
 * @description HOS-1153 — the admin's port of the HOS-155 startup self-check.
 *
 * The predicate itself is covered once, in `@repo/config`. What is verified
 * here is the part that is admin-specific and was the whole point of porting
 * it: a half-configured bypass produces a LOUD, unsilenceable alert instead of
 * booting quietly, and the alerting path can never take the server down.
 *
 * ## What these tests deliberately do NOT assert
 *
 * An earlier revision mocked `@sentry/react` and asserted `captureMessage` was
 * called. That assertion was vacuous in the worst way: it proved the module
 * made the call, and could never see that the real SDK had no client bound to
 * deliver it — the admin's `shouldInitializeSentry()` refuses to boot a BROWSER
 * SDK when `window` is undefined, and this code only ever runs on the server.
 * Measured with a live HTTP sink: `console.error` fired, the sink got zero
 * requests. It was injecting the consumer's input and never checking the
 * producer.
 *
 * The Sentry call is gone, so these tests assert only what the module can
 * actually guarantee — plus a guard that fails if a browser-SDK import ever
 * comes back into this server-side path.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportInternalBypassSelfCheck } from '@/lib/internal-bypass-report';

const SECRET = 'a-shared-internal-request-secret-32ch';
const INTERNAL_URL = 'http://hospeda-api-prod:3001';

describe('reportInternalBypassSelfCheck (admin, HOS-1153)', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('alerts on console when the secret is set but the internal URL is not', () => {
        // Arrange / Act: the exact half-configuration HOS-1153 can produce — an
        // operator sets the secret and forgets the URL, so the header is never
        // sent and every operator silently shares one bucket.
        const result = reportInternalBypassSelfCheck({
            internalApiUrl: undefined,
            internalRequestSecret: SECRET,
            isProd: true
        });

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const message = String(consoleErrorSpy.mock.calls[0]?.[0]);
        expect(message).toContain('HOSPEDA_INTERNAL_API_URL');
        // The issue tag is what makes the line greppable in container logs,
        // which is the only place this alert now lands.
        expect(message).toContain('HOS-1153');
    });

    it('alerts when the internal URL is set but the secret is not', () => {
        // Act
        const result = reportInternalBypassSelfCheck({
            internalApiUrl: INTERNAL_URL,
            internalRequestSecret: undefined,
            isProd: true
        });

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(String(consoleErrorSpy.mock.calls[0]?.[0])).toContain(
            'HOSPEDA_INTERNAL_REQUEST_SECRET'
        );
    });

    it('stays silent when both are configured', () => {
        // Act
        const result = reportInternalBypassSelfCheck({
            internalApiUrl: INTERNAL_URL,
            internalRequestSecret: SECRET,
            isProd: true
        });

        // Assert
        expect(result.status).toBe('ok');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('stays silent outside production, where an unconfigured bypass is normal', () => {
        // Act
        const result = reportInternalBypassSelfCheck({
            internalApiUrl: undefined,
            internalRequestSecret: undefined,
            isProd: false
        });

        // Assert
        expect(result.status).toBe('skipped');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('never throws when the alert emission itself fails', () => {
        // Arrange: this runs at server-entry module scope, so a throw here is a
        // boot crash-loop — strictly worse than the misconfiguration it reports.
        consoleErrorSpy.mockImplementationOnce(() => {
            throw new Error('stderr is gone');
        });

        // Act / Assert
        expect(() =>
            reportInternalBypassSelfCheck({
                internalApiUrl: undefined,
                internalRequestSecret: SECRET,
                isProd: true
            })
        ).not.toThrow();
        // The swallowed failure is still surfaced, not silently dropped.
        expect(consoleErrorSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
});

describe('internal-bypass-report imports (HOS-1153 guard)', () => {
    const SOURCE = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), '../../src/lib/internal-bypass-report.ts'),
        'utf8'
    );

    it('imports no @sentry/* SDK', () => {
        // This module runs ONLY on the server (module scope of `server.ts`).
        // `@sentry/react` is a browser SDK that `shouldInitializeSentry()`
        // refuses to boot without `window`, so a capture from here is a
        // guaranteed no-op — and a mocked unit test cannot detect that. It
        // shipped once; only a live HTTP sink caught it.
        //
        // Anchored on the import statement, per line, so a re-added import
        // fails here whether it is default, named or namespace.
        const sentryImports = [
            ...SOURCE.matchAll(/^\s*import[^;]*from\s+['"](@sentry\/[^'"]+)['"]/gm)
        ].map((m) => m[1]);

        expect(
            sentryImports,
            `This module runs server-side only. A Sentry capture from here has no client bound and sends nothing (measured: zero requests to a live sink). Route server-side alerts through the API's own Sentry middleware, or add a server SDK deliberately — never a browser one. Found: ${sentryImports.join(', ')}`
        ).toEqual([]);
    });

    it('still emits the alert through console.error', () => {
        // Pairs with the test above: dropping the Sentry import must not leave
        // the module with no alert path at all.
        expect(SOURCE).toMatch(/console\.error\(/);
    });
});
