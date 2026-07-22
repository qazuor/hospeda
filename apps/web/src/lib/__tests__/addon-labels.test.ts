/**
 * @file addon-labels.test.ts
 * @description Tests for the add-on display-name/description resolver (BETA-198).
 * Verifies that `translateAddonName`/`translateAddonDescription` look up the
 * localized copy under `account.addons.catalog.<slug>.*` and pass the addon
 * definition's raw string as the fallback so nothing renders blank when a key
 * is missing.
 */

import { describe, expect, it, vi } from 'vitest';
import { translateAddonDescription, translateAddonName } from '../addon-labels';

describe('translateAddonName', () => {
    it('resolves the localized name under account.addons.catalog.<slug>.name', () => {
        const t = vi.fn((key: string) =>
            key === 'account.addons.catalog.visibility-boost-7d.name'
                ? 'Impulso de visibilidad (7 días)'
                : key
        );
        expect(
            translateAddonName({
                t,
                slug: 'visibility-boost-7d',
                fallback: 'Visibility Boost (7 days)'
            })
        ).toBe('Impulso de visibilidad (7 días)');
        expect(t).toHaveBeenCalledWith(
            'account.addons.catalog.visibility-boost-7d.name',
            'Visibility Boost (7 days)'
        );
    });

    it('passes the raw definition name as the fallback (used when the key is missing)', () => {
        // Emulate createT: return the fallback (2nd arg) when the key is absent.
        const t = vi.fn((_key: string, fallback?: string) => fallback ?? _key);
        expect(
            translateAddonName({
                t,
                slug: 'extra-photos-20',
                fallback: 'Extra Photos Pack (+20 photos)'
            })
        ).toBe('Extra Photos Pack (+20 photos)');
    });
});

describe('translateAddonDescription', () => {
    it('resolves the localized description under account.addons.catalog.<slug>.description', () => {
        const t = vi.fn((key: string) =>
            key === 'account.addons.catalog.extra-photos-20.description'
                ? 'Agrega 20 fotos adicionales a cada alojamiento. Se renueva mensualmente.'
                : key
        );
        expect(
            translateAddonDescription({
                t,
                slug: 'extra-photos-20',
                fallback: 'Adds 20 additional photos to each accommodation. Renews monthly.'
            })
        ).toBe('Agrega 20 fotos adicionales a cada alojamiento. Se renueva mensualmente.');
        expect(t).toHaveBeenCalledWith(
            'account.addons.catalog.extra-photos-20.description',
            'Adds 20 additional photos to each accommodation. Renews monthly.'
        );
    });

    it('passes the raw definition description as the fallback', () => {
        const t = vi.fn((_key: string, fallback?: string) => fallback ?? _key);
        expect(
            translateAddonDescription({
                t,
                slug: 'ai-support-monthly',
                fallback: 'Unlocks AI-powered support tools for hosts.'
            })
        ).toBe('Unlocks AI-powered support tools for hosts.');
    });
});
