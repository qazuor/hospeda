/**
 * Tests for the Cloudinary preview-deploy advisory warn.
 *
 * SPEC-078-GAPS T-051 / GAP-078-134:
 *   Verifies that {@link warnIfCloudinaryMissingOnPreview} only fires on
 *   Vercel preview deploys with at least one missing Cloudinary credential,
 *   and stays silent in every other environment combination.
 */
import { describe, expect, it, vi } from 'vitest';
import { warnIfCloudinaryMissingOnPreview } from '../../src/utils/cloudinary-preview-warn';

const buildEnv = (
    overrides: Readonly<Record<string, string | undefined>>
): Record<string, string | undefined> => ({
    HOSPEDA_CLOUDINARY_CLOUD_NAME: undefined,
    HOSPEDA_CLOUDINARY_API_KEY: undefined,
    HOSPEDA_CLOUDINARY_API_SECRET: undefined,
    VERCEL_ENV: undefined,
    ...overrides
});

describe('warnIfCloudinaryMissingOnPreview()', () => {
    it('warns on preview when all Cloudinary vars are missing', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({ VERCEL_ENV: 'preview' });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(true);
        expect(result.missing).toEqual([
            'HOSPEDA_CLOUDINARY_CLOUD_NAME',
            'HOSPEDA_CLOUDINARY_API_KEY',
            'HOSPEDA_CLOUDINARY_API_SECRET'
        ]);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        const call = logger.warn.mock.calls[0]?.[0];
        expect(call).toMatchObject({
            vercelEnv: 'preview'
        });
        expect(String((call as { message: string }).message)).toContain('Cloudinary');
    });

    it('warns on preview when only one Cloudinary var is missing', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({
            VERCEL_ENV: 'preview',
            HOSPEDA_CLOUDINARY_CLOUD_NAME: 'demo',
            HOSPEDA_CLOUDINARY_API_KEY: 'key'
            // HOSPEDA_CLOUDINARY_API_SECRET intentionally missing.
        });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(true);
        expect(result.missing).toEqual(['HOSPEDA_CLOUDINARY_API_SECRET']);
        expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('treats blank/whitespace values as missing', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({
            VERCEL_ENV: 'preview',
            HOSPEDA_CLOUDINARY_CLOUD_NAME: '  ',
            HOSPEDA_CLOUDINARY_API_KEY: '',
            HOSPEDA_CLOUDINARY_API_SECRET: 'secret'
        });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(true);
        expect(result.missing).toEqual([
            'HOSPEDA_CLOUDINARY_CLOUD_NAME',
            'HOSPEDA_CLOUDINARY_API_KEY'
        ]);
    });

    it('stays silent on preview when all Cloudinary vars are present', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({
            VERCEL_ENV: 'preview',
            HOSPEDA_CLOUDINARY_CLOUD_NAME: 'demo',
            HOSPEDA_CLOUDINARY_API_KEY: 'key',
            HOSPEDA_CLOUDINARY_API_SECRET: 'secret'
        });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(false);
        expect(result.missing).toEqual([]);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays silent in production even when Cloudinary vars are missing', () => {
        // Arrange — production validation throws hard via Zod elsewhere.
        const logger = { warn: vi.fn() };
        const env = buildEnv({ VERCEL_ENV: 'production' });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(false);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays silent in development (no VERCEL_ENV) when Cloudinary vars are missing', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({});

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(false);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it('stays silent in test/CI when VERCEL_ENV is not preview', () => {
        // Arrange.
        const logger = { warn: vi.fn() };
        const env = buildEnv({ VERCEL_ENV: 'development' });

        // Act.
        const result = warnIfCloudinaryMissingOnPreview({ env, logger });

        // Assert.
        expect(result.triggered).toBe(false);
        expect(logger.warn).not.toHaveBeenCalled();
    });
});
