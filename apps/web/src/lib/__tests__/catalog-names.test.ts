/**
 * @file catalog-names.test.ts
 * @description Tests for the amenity catalog display-name resolver
 * (SPEC-249 commerce editor refinement). Verifies that `translateAmenityName`
 * resolves the i18n label for a catalog key, and falls back to a humanized key
 * when the translation is missing (the `[MISSING:` sentinel from `createTranslations`).
 */

import { describe, expect, it, vi } from 'vitest';
import { translateAmenityName } from '../catalog-names';

describe('translateAmenityName', () => {
    it('returns the i18n label when the key resolves', () => {
        const t = vi.fn((key: string) =>
            key === 'accommodations.amenityNames.wifi' ? 'WiFi' : key
        );
        expect(translateAmenityName({ t, name: 'wifi' })).toBe('WiFi');
        expect(t).toHaveBeenCalledWith('accommodations.amenityNames.wifi');
    });

    it('looks up under the accommodations.amenityNames namespace', () => {
        const t = vi.fn(() => 'Aire acondicionado');
        translateAmenityName({ t, name: 'air_conditioning' });
        expect(t).toHaveBeenCalledWith('accommodations.amenityNames.air_conditioning');
    });

    it('humanizes the key (underscores → title-cased words) when the translation is missing', () => {
        const t = vi.fn(() => '[MISSING:accommodations.amenityNames.air_conditioning]');
        expect(translateAmenityName({ t, name: 'air_conditioning' })).toBe('Air Conditioning');
    });

    it('humanizes a single-word key with no underscores', () => {
        const t = vi.fn(() => '[MISSING:accommodations.amenityNames.bar]');
        expect(translateAmenityName({ t, name: 'bar' })).toBe('Bar');
    });

    it('does not humanize a real translation that happens to contain words', () => {
        const t = vi.fn(() => 'Recepción 24 horas');
        expect(translateAmenityName({ t, name: '24h_reception' })).toBe('Recepción 24 horas');
    });
});
