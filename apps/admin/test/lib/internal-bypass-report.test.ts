/**
 * @file internal-bypass-report.test.ts
 * @description HOS-1153 — the admin's port of the HOS-155 startup self-check.
 *
 * The predicate itself is covered once, in `@repo/config`. What is verified
 * here is the part that is admin-specific and was the whole point of porting
 * it: a half-configured bypass produces a LOUD, unsilenceable alert instead of
 * booting quietly, and the alerting path can never take the server down.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureMessageMock = vi.fn();

vi.mock('@sentry/react', () => ({
    captureMessage: (...args: unknown[]) => captureMessageMock(...args)
}));

const { reportInternalBypassSelfCheck } = await import('@/lib/internal-bypass-report');

const SECRET = 'a-shared-internal-request-secret-32ch';
const INTERNAL_URL = 'http://hospeda-api-prod:3001';

describe('reportInternalBypassSelfCheck (admin, HOS-1153)', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        captureMessageMock.mockReset();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('alerts on console AND Sentry when the secret is set but the internal URL is not', () => {
        // Arrange: the exact half-configuration HOS-1153 can produce — an
        // operator sets the secret and forgets the URL, so the header is never
        // sent and every operator silently shares one bucket.

        // Act
        const result = reportInternalBypassSelfCheck({
            internalApiUrl: undefined,
            internalRequestSecret: SECRET,
            isProd: true
        });

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(String(consoleErrorSpy.mock.calls[0]?.[0])).toContain('HOSPEDA_INTERNAL_API_URL');
        expect(captureMessageMock).toHaveBeenCalledTimes(1);
        expect(captureMessageMock.mock.calls[0]?.[1]).toMatchObject({
            level: 'error',
            tags: { module: 'admin', subsystem: 'startup-selfcheck' }
        });
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
        expect(captureMessageMock).toHaveBeenCalledTimes(1);
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
        expect(captureMessageMock).not.toHaveBeenCalled();
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
        expect(captureMessageMock).not.toHaveBeenCalled();
    });

    it('never throws when the alert transport itself fails', () => {
        // Arrange: this runs at server-entry module scope, so a throw here is a
        // boot crash-loop — strictly worse than the misconfiguration it reports.
        captureMessageMock.mockImplementation(() => {
            throw new Error('sentry is down');
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
