import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { I18nTextSchema, PartialI18nTextSchema } from '../../src/common/i18n.schema.js';

describe('I18nTextSchema (unchanged by HOS-142)', () => {
    it('requires es/en/pt to all be strings', () => {
        expect(() => I18nTextSchema.parse({ es: 'Hola', en: 'Hello', pt: 'Olá' })).not.toThrow();
    });

    it('rejects a null en/pt (still the strict shared variant)', () => {
        expect(() => I18nTextSchema.parse({ es: 'Hola', en: null, pt: 'Olá' })).toThrow(ZodError);
    });
});

describe('PartialI18nTextSchema (HOS-142)', () => {
    it('requires es to be a non-null string', () => {
        expect(() =>
            PartialI18nTextSchema.parse({ es: 'Casa Izquierdo', en: null, pt: null })
        ).not.toThrow();
    });

    it('rejects a missing/undefined es', () => {
        expect(() => PartialI18nTextSchema.parse({ en: null, pt: null })).toThrow(ZodError);
    });

    it('rejects a null es (es is required, not nullable)', () => {
        expect(() => PartialI18nTextSchema.parse({ es: null, en: null, pt: null })).toThrow(
            ZodError
        );
    });

    it('accepts en/pt as null', () => {
        const result = PartialI18nTextSchema.parse({ es: 'Casa Izquierdo', en: null, pt: null });
        expect(result.en).toBeNull();
        expect(result.pt).toBeNull();
    });

    it('accepts en/pt as undefined (omitted keys)', () => {
        expect(() => PartialI18nTextSchema.parse({ es: 'Casa Izquierdo' })).not.toThrow();
    });

    it('accepts en/pt as real strings too (a fully translated row)', () => {
        const result = PartialI18nTextSchema.parse({
            es: 'Casa Izquierdo',
            en: 'Izquierdo House',
            pt: 'Casa Izquierdo'
        });
        expect(result.en).toBe('Izquierdo House');
        expect(result.pt).toBe('Casa Izquierdo');
    });

    it('rejects a non-string es', () => {
        expect(() => PartialI18nTextSchema.parse({ es: 123, en: null, pt: null })).toThrow(
            ZodError
        );
    });
});
