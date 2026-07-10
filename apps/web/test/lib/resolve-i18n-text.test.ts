import { describe, expect, it } from 'vitest';
import { resolveI18nLocale, resolveI18nText } from '../../src/lib/resolve-i18n-text';

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

describe('resolveI18nLocale', () => {
    it('reports the requested locale when its text exists', () => {
        expect(resolveI18nLocale({ es: 'Hola', en: 'Hi', pt: 'Oi' }, 'en')).toBe('en');
    });

    it('reports the fallback locale when the requested one is empty', () => {
        expect(resolveI18nLocale({ es: 'Hola', en: '', pt: '' }, 'en')).toBe('es');
    });

    it('reports es for a legacy plain string (unlocalized Spanish text)', () => {
        expect(resolveI18nLocale('Hola', 'en')).toBe('es');
    });

    it('reports es for null/undefined', () => {
        expect(resolveI18nLocale(null, 'en')).toBe('es');
        expect(resolveI18nLocale(undefined, 'pt')).toBe('es');
    });
});
