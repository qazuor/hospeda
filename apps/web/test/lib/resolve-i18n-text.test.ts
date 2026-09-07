import { describe, expect, it } from 'vitest';
import {
    resolveI18nText,
    resolveI18nTextWithLegacyFallback
} from '../../src/lib/resolve-i18n-text';

describe('resolveI18nText', () => {
    it('returns the requested locale when its text is present', () => {
        expect(resolveI18nText({ es: 'Hola', en: 'Hi', pt: 'Oi' }, 'en')).toBe('Hi');
    });

    it('falls back through es → en → pt when the requested locale is empty', () => {
        expect(resolveI18nText({ es: '', en: 'Pool', pt: 'Piscina' }, 'es')).toBe('Pool');
    });

    it('passes a legacy plain string through unchanged', () => {
        expect(resolveI18nText('Wifi', 'en')).toBe('Wifi');
    });

    it('returns an empty string for null/undefined', () => {
        expect(resolveI18nText(null, 'es')).toBe('');
        expect(resolveI18nText(undefined, 'es')).toBe('');
    });
});

describe('resolveI18nTextWithLegacyFallback', () => {
    it('falls back to the legacy value when the i18n object has every key empty (HOS-802)', () => {
        expect(
            resolveI18nTextWithLegacyFallback({
                i18n: { es: '', en: '', pt: '' },
                legacy: 'Casa del Sol',
                locale: 'es'
            })
        ).toBe('Casa del Sol');
    });

    it('uses the requested locale from the i18n object when present, ignoring the legacy value', () => {
        expect(
            resolveI18nTextWithLegacyFallback({
                i18n: { es: 'Casa', en: 'House', pt: 'Casa' },
                legacy: 'Legacy Name',
                locale: 'en'
            })
        ).toBe('House');
    });

    it('returns an empty string when both the i18n object and the legacy value are empty', () => {
        expect(
            resolveI18nTextWithLegacyFallback({
                i18n: { es: '', en: '', pt: '' },
                legacy: '',
                locale: 'es'
            })
        ).toBe('');
    });

    it('returns an empty string when both i18n and legacy are null/undefined', () => {
        expect(
            resolveI18nTextWithLegacyFallback({ i18n: null, legacy: undefined, locale: 'es' })
        ).toBe('');
        expect(
            resolveI18nTextWithLegacyFallback({ i18n: undefined, legacy: null, locale: 'es' })
        ).toBe('');
    });

    it('falls back to the legacy value when the i18n object is entirely absent', () => {
        expect(
            resolveI18nTextWithLegacyFallback({
                i18n: undefined,
                legacy: 'Plain Legacy Text',
                locale: 'es'
            })
        ).toBe('Plain Legacy Text');
    });

    it('stringifies a non-string legacy value', () => {
        expect(resolveI18nTextWithLegacyFallback({ i18n: null, legacy: 42, locale: 'es' })).toBe(
            '42'
        );
    });
});
