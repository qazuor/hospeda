import type { Locale } from '@repo/i18n';
/**
 * @file i18n.test.ts
 * @description Unit tests for the mobile i18n helper (SPEC-243 T-013).
 *
 * Covers the `getTranslation` lookup + fallback chain and the re-exported
 * locale metadata. Translation VALUES are not hard-asserted (they may change
 * in @repo/i18n); the tests assert structural invariants and the fallback
 * behaviour instead.
 */
import { describe, expect, it } from 'vitest';
import { LifecycleStatusEnum, appDefaultLocale, getTranslation, supportedLocales } from './i18n';

const MISSING_SENTINEL = (key: string): string => `[MISSING: ${key}]`;

describe('locale metadata exports', () => {
    it('exposes the supported locales (es, en, pt)', () => {
        // Arrange / Act / Assert
        expect(supportedLocales).toEqual(expect.arrayContaining(['es', 'en', 'pt']));
    });

    it('defaults to Spanish', () => {
        expect(appDefaultLocale).toBe('es');
    });

    it('re-exports LifecycleStatusEnum from @repo/schemas', () => {
        expect(LifecycleStatusEnum).toBeDefined();
    });
});

describe('getTranslation', () => {
    const knownKey = 'common.accommodations';

    it('resolves a known key in the default locale to a real string', () => {
        // Act
        const value = getTranslation(knownKey);
        // Assert
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toBe(MISSING_SENTINEL(knownKey));
    });

    it('resolves a known key in an explicit non-default locale', () => {
        const value = getTranslation(knownKey, 'en');
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
        expect(value).not.toBe(MISSING_SENTINEL(knownKey));
    });

    it('returns the [MISSING: key] sentinel for an unknown key', () => {
        const key = 'this.key.does.not.exist.xyz';
        expect(getTranslation(key)).toBe(MISSING_SENTINEL(key));
    });

    it('falls back to the default locale when the requested locale map is absent', () => {
        // Arrange — an invalid locale forces the `trans[locale] ?? default` branch.
        const value = getTranslation(knownKey, 'zz' as Locale);
        // Assert — resolved via the default-locale fallback, not the missing sentinel.
        expect(value).not.toBe(MISSING_SENTINEL(knownKey));
        expect(value.length).toBeGreaterThan(0);
    });
});
