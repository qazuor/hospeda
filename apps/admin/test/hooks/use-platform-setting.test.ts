/**
 * @file use-platform-setting.test.ts
 * @description Unit tests for the `usePlatformSetting` + `useUpdatePlatformSetting`
 * hook layer added in SPEC-156 PR-3 (T-028). Covers the legacy `localStorage`
 * migration adapters end-to-end at the parser level: shape mapping, missing
 * fields, malformed JSON.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyAdapters, platformSettingsQueryKeys } from '../../src/hooks/use-platform-setting';

// `localStorage` is provided by jsdom in vitest. Reset between tests so the
// adapters never see leaked state from a previous case.
beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('platformSettingsQueryKeys', () => {
    it('scopes detail keys under the platform-settings namespace', () => {
        expect(platformSettingsQueryKeys.all).toEqual(['platform-settings']);
        expect(platformSettingsQueryKeys.detail('maintenance.mode')).toEqual([
            'platform-settings',
            'maintenance.mode'
        ]);
        expect(platformSettingsQueryKeys.detail('seo.defaults')).toEqual([
            'platform-settings',
            'seo.defaults'
        ]);
    });
});

describe('legacyAdapters.maintenanceMode', () => {
    it('returns null when the legacy key is absent', () => {
        expect(legacyAdapters.maintenanceMode.read()).toBeNull();
    });

    it('maps a bare boolean true to { enabled: true }', () => {
        localStorage.setItem('hospeda-admin-maintenance-mode', 'true');
        expect(legacyAdapters.maintenanceMode.read()).toEqual({ enabled: true });
    });

    it('maps a bare boolean false to { enabled: false }', () => {
        localStorage.setItem('hospeda-admin-maintenance-mode', 'false');
        expect(legacyAdapters.maintenanceMode.read()).toEqual({ enabled: false });
    });

    it('returns null on malformed JSON instead of throwing', () => {
        localStorage.setItem('hospeda-admin-maintenance-mode', '{not-json');
        expect(legacyAdapters.maintenanceMode.read()).toBeNull();
    });

    it('returns null when the stored shape is unexpected (object, string, etc.)', () => {
        localStorage.setItem('hospeda-admin-maintenance-mode', '"yes"');
        expect(legacyAdapters.maintenanceMode.read()).toBeNull();

        localStorage.setItem('hospeda-admin-maintenance-mode', '{"enabled":true}');
        // The legacy adapter only accepted bare booleans; later shapes are
        // ignored to avoid silently double-counting state that should now be
        // round-tripped through the API.
        expect(legacyAdapters.maintenanceMode.read()).toBeNull();
    });
});

describe('legacyAdapters.seoDefaults', () => {
    it('returns null when the legacy key is absent', () => {
        expect(legacyAdapters.seoDefaults.read()).toBeNull();
    });

    it('translates legacy field names (titleTemplate/defaultDescription/defaultOgImage)', () => {
        localStorage.setItem(
            'hospeda-admin-seo-settings',
            JSON.stringify({
                titleTemplate: '{page} | Hospeda',
                defaultDescription: 'Descripción de respaldo',
                defaultOgImage: 'https://cdn.example.com/og.png'
            })
        );
        expect(legacyAdapters.seoDefaults.read()).toEqual({
            metaTitleTemplate: '{page} | Hospeda',
            metaDescriptionDefault: 'Descripción de respaldo',
            ogImageDefault: 'https://cdn.example.com/og.png'
        });
    });

    it('accepts already-modern field names so callers that pre-migrated still load', () => {
        localStorage.setItem(
            'hospeda-admin-seo-settings',
            JSON.stringify({
                metaTitleTemplate: '{page} | Hospeda',
                metaDescriptionDefault: 'Otro fallback',
                ogImageDefault: 'https://cdn.example.com/og2.png'
            })
        );
        expect(legacyAdapters.seoDefaults.read()).toEqual({
            metaTitleTemplate: '{page} | Hospeda',
            metaDescriptionDefault: 'Otro fallback',
            ogImageDefault: 'https://cdn.example.com/og2.png'
        });
    });

    it('returns null on malformed JSON', () => {
        localStorage.setItem('hospeda-admin-seo-settings', '{not-json');
        expect(legacyAdapters.seoDefaults.read()).toBeNull();
    });

    it('returns null when any required field is missing (no partial migration)', () => {
        localStorage.setItem(
            'hospeda-admin-seo-settings',
            JSON.stringify({
                titleTemplate: '{page} | Hospeda',
                defaultDescription: 'Sólo dos campos'
                // defaultOgImage missing
            })
        );
        expect(legacyAdapters.seoDefaults.read()).toBeNull();
    });

    it('returns null when a field is the wrong type (e.g. number)', () => {
        localStorage.setItem(
            'hospeda-admin-seo-settings',
            JSON.stringify({
                titleTemplate: 123,
                defaultDescription: 'ok',
                defaultOgImage: 'https://example.com'
            })
        );
        expect(legacyAdapters.seoDefaults.read()).toBeNull();
    });
});

describe('legacy keys are exposed for removal on save', () => {
    it('exposes the maintenanceMode legacy key for cleanup', () => {
        expect(legacyAdapters.maintenanceMode.legacyKey).toBe('hospeda-admin-maintenance-mode');
    });

    it('exposes the seoDefaults legacy key for cleanup', () => {
        expect(legacyAdapters.seoDefaults.legacyKey).toBe('hospeda-admin-seo-settings');
    });
});
