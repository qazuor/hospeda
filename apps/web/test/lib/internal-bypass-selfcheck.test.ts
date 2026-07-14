/**
 * @file internal-bypass-selfcheck.test.ts
 * @description Regression tests for the HOS-155 SSR internal-bypass startup
 * self-check (root cause of the 2026-07-13 mass-429 prod incident: HOSPEDA_
 * INTERNAL_API_URL unset while HOSPEDA_INTERNAL_REQUEST_SECRET was set,
 * silently disabling the SSR rate-limit bypass).
 */

import { describe, expect, it } from 'vitest';
import { checkInternalBypassConfig } from '../../src/lib/internal-bypass-selfcheck';

describe('checkInternalBypassConfig', () => {
    it('returns skipped outside production, regardless of config', () => {
        // Arrange
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: undefined,
            isProd: false
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result).toEqual({ status: 'skipped' });
    });

    it('returns skipped outside production even when both values are present', () => {
        // Arrange
        const params = {
            internalApiUrl: 'https://internal.hospeda.test',
            internalRequestSecret: 'super-secret',
            isProd: false
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result).toEqual({ status: 'skipped' });
    });

    it('returns ok in production when both url and secret are present', () => {
        // Arrange
        const params = {
            internalApiUrl: 'https://internal.hospeda.com.ar',
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result).toEqual({ status: 'ok' });
    });

    it('returns misconfigured in production when the internal API URL is missing (the HOS-155 incident shape)', () => {
        // Arrange
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_API_URL');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_REQUEST_SECRET');
    });

    it('returns misconfigured in production when the internal request secret is missing', () => {
        // Arrange
        const params = {
            internalApiUrl: 'https://internal.hospeda.com.ar',
            internalRequestSecret: undefined,
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_REQUEST_SECRET');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_API_URL');
    });

    it('returns misconfigured in production when both values are missing', () => {
        // Arrange
        const params = {
            internalApiUrl: undefined,
            internalRequestSecret: undefined,
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result.status).toBe('misconfigured');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_API_URL');
        expect(result.reason).toContain('HOSPEDA_INTERNAL_REQUEST_SECRET');
    });

    it('treats an empty-string value as missing (falsy), not present', () => {
        // Arrange
        const params = {
            internalApiUrl: '',
            internalRequestSecret: 'super-secret',
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result.status).toBe('misconfigured');
    });

    it('treats an empty-string secret as missing (falsy), not present', () => {
        // Arrange
        const params = {
            internalApiUrl: 'https://internal.hospeda.com.ar',
            internalRequestSecret: '',
            isProd: true
        };

        // Act
        const result = checkInternalBypassConfig(params);

        // Assert
        expect(result.status).toBe('misconfigured');
    });
});
