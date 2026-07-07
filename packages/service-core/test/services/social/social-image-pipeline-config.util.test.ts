/**
 * Unit tests for the image-pipeline settings fallback helpers (HOS-64 / SPEC-297a G-2).
 *
 * @module test/services/social/social-image-pipeline-config.util
 */

import { describe, expect, it } from 'vitest';
import {
    buildSocialAssetsFolder,
    DOWNLOAD_TIMEOUT_MS_FALLBACK,
    resolveNumericSettingWithFallback,
    resolveStringSettingWithFallback,
    SOCIAL_ASSETS_FOLDER_BASE_FALLBACK
} from '../../../src/services/social/social-image-pipeline-config.util';

describe('resolveNumericSettingWithFallback', () => {
    it('should return the parsed value when it is a finite number', () => {
        expect(resolveNumericSettingWithFallback({ rawValue: '20000', fallback: 15_000 })).toBe(
            20_000
        );
    });

    it('should fall back when rawValue is undefined', () => {
        expect(resolveNumericSettingWithFallback({ rawValue: undefined, fallback: 15_000 })).toBe(
            15_000
        );
    });

    it('should fall back when rawValue is null', () => {
        expect(resolveNumericSettingWithFallback({ rawValue: null, fallback: 15_000 })).toBe(
            15_000
        );
    });

    it('should fall back when rawValue is an empty string', () => {
        expect(resolveNumericSettingWithFallback({ rawValue: '', fallback: 15_000 })).toBe(15_000);
    });

    it('should fall back when rawValue is non-numeric', () => {
        expect(
            resolveNumericSettingWithFallback({ rawValue: 'not-a-number', fallback: 15_000 })
        ).toBe(15_000);
    });

    it('should use the documented default for download_timeout_ms', () => {
        expect(DOWNLOAD_TIMEOUT_MS_FALLBACK).toBe(15_000);
    });
});

describe('resolveStringSettingWithFallback', () => {
    it('should return rawValue when it is a non-empty string', () => {
        expect(
            resolveStringSettingWithFallback({
                rawValue: 'custom/folder/path',
                fallback: 'hospeda/social/assets'
            })
        ).toBe('custom/folder/path');
    });

    it('should fall back when rawValue is undefined', () => {
        expect(
            resolveStringSettingWithFallback({
                rawValue: undefined,
                fallback: 'hospeda/social/assets'
            })
        ).toBe('hospeda/social/assets');
    });

    it('should fall back when rawValue is null', () => {
        expect(
            resolveStringSettingWithFallback({ rawValue: null, fallback: 'hospeda/social/assets' })
        ).toBe('hospeda/social/assets');
    });

    it('should fall back when rawValue is an empty string', () => {
        expect(
            resolveStringSettingWithFallback({ rawValue: '', fallback: 'hospeda/social/assets' })
        ).toBe('hospeda/social/assets');
    });

    it('should use the documented default base prefix for social_assets_folder', () => {
        expect(SOCIAL_ASSETS_FOLDER_BASE_FALLBACK).toBe('hospeda/social');
    });
});

describe('buildSocialAssetsFolder', () => {
    it('should compose the folder for the prod environment', () => {
        expect(buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'prod' })).toBe(
            'hospeda/social/prod/assets'
        );
    });

    it('should compose the folder for the preview environment', () => {
        expect(buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'preview' })).toBe(
            'hospeda/social/preview/assets'
        );
    });

    it('should compose the folder for the dev environment', () => {
        expect(buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'dev' })).toBe(
            'hospeda/social/dev/assets'
        );
    });

    it('should compose the folder for the test environment', () => {
        expect(buildSocialAssetsFolder({ base: 'hospeda/social', environment: 'test' })).toBe(
            'hospeda/social/test/assets'
        );
    });

    it('should honor a custom base prefix', () => {
        expect(buildSocialAssetsFolder({ base: 'custom/base', environment: 'prod' })).toBe(
            'custom/base/prod/assets'
        );
    });
});
