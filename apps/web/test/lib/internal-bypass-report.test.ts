/**
 * @file internal-bypass-report.test.ts
 * @description Regression tests for the HOS-155 SSR internal-bypass alerting
 * wrapper. Unlike `internal-bypass-selfcheck.test.ts` (which only tests the
 * pure check), these tests exercise the actual side effects (console +
 * Sentry) that fire when the bypass is misconfigured in production, plus the
 * never-throws guarantee that keeps a Sentry failure from crash-looping the
 * SSR server boot.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureMessageMock = vi.fn();

vi.mock('@sentry/astro', () => ({
    captureMessage: (...args: unknown[]) => captureMessageMock(...args)
}));

import { reportInternalBypassSelfCheck } from '../../src/lib/internal-bypass-report';

describe('reportInternalBypassSelfCheck', () => {
    beforeEach(() => {
        // resetAllMocks (not clearAllMocks) so a `mockImplementation` set by one
        // test — e.g. the throwing Sentry mock below — never leaks into a test
        // appended after it.
        vi.resetAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('alerts via console.error and Sentry.captureMessage when misconfigured in production', () => {
        // Arrange
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        const result = reportInternalBypassSelfCheck(params);

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(captureMessageMock).toHaveBeenCalledTimes(1);
        expect(captureMessageMock).toHaveBeenCalledWith(
            expect.stringContaining('HOS-155'),
            expect.objectContaining({ level: 'error' })
        );
    });

    it('does not alert when the config is ok in production', () => {
        // Arrange
        const params = {
            internalApiUrl: 'https://internal.hospeda.com.ar',
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        const result = reportInternalBypassSelfCheck(params);

        // Assert
        expect(result.status).toBe('ok');
        expect(console.error).not.toHaveBeenCalled();
        expect(captureMessageMock).not.toHaveBeenCalled();
    });

    it('does not alert when the check is skipped outside production', () => {
        // Arrange
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: undefined,
            isProd: false
        };

        // Act
        const result = reportInternalBypassSelfCheck(params);

        // Assert
        expect(result.status).toBe('skipped');
        expect(console.error).not.toHaveBeenCalled();
        expect(captureMessageMock).not.toHaveBeenCalled();
    });

    it('never throws even when Sentry.captureMessage itself throws', () => {
        // Arrange
        captureMessageMock.mockImplementation(() => {
            throw new Error('Sentry transport unavailable');
        });
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        let result: ReturnType<typeof reportInternalBypassSelfCheck> | undefined;
        const act = () => {
            result = reportInternalBypassSelfCheck(params);
        };

        // Assert
        expect(act).not.toThrow();
        expect(result).toEqual(expect.objectContaining({ status: 'misconfigured' }));
        // Two console.error calls in the single invocation: the misconfiguration
        // alert, then the caught Sentry-failure log (the report's catch branch).
        expect(console.error).toHaveBeenCalledTimes(2);
    });
});
