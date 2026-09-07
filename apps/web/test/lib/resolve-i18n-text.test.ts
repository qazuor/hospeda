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

    // HOS-802 review F3: every legacy field these call sites read is
    // `z.string()`-typed, so a non-string legacy value only reaches here
    // through an unparsed/defensive `Record<string, unknown>` payload. Match
    // what the pre-fix `resolveI18nText(i18n ?? legacy, locale)` chain already
    // did in that case — degrade to `''`, never coerce with `String()`
    // (which would otherwise turn a stray i18n-shaped object into the literal
    // string `"[object Object]"`, an array into `"a,b"`, etc.).
    it('degrades a non-string legacy value to an empty string instead of coercing it', () => {
        expect(resolveI18nTextWithLegacyFallback({ i18n: null, legacy: 42, locale: 'es' })).toBe(
            ''
        );
        expect(resolveI18nTextWithLegacyFallback({ i18n: null, legacy: false, locale: 'es' })).toBe(
            ''
        );
        expect(
            resolveI18nTextWithLegacyFallback({ i18n: null, legacy: ['a', 'b'], locale: 'es' })
        ).toBe('');
        expect(
            resolveI18nTextWithLegacyFallback({
                i18n: null,
                legacy: { es: 'Hola' },
                locale: 'es'
            })
        ).toBe('');
    });
});
