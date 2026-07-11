import { describe, expect, it } from 'vitest';
import { faqSetInLanguage, toDestinationFaqs } from '../../../src/lib/api/transforms';

describe('toDestinationFaqs — HOS-117 i18n resolution', () => {
    it('resolves localized question/answer for the requested locale', () => {
        const raw = [
            {
                id: 'f1',
                question: '¿Cómo llego?',
                answer: 'En auto.',
                questionI18n: { es: '¿Cómo llego?', en: 'How do I get there?', pt: 'Como chego?' },
                answerI18n: { es: 'En auto.', en: 'By car.', pt: 'De carro.' }
            }
        ];
        const [faq] = toDestinationFaqs(raw, 'en');
        expect(faq.question).toBe('How do I get there?');
        expect(faq.answer).toBe('By car.');
        expect(faq.resolvedLocale).toBe('en');
    });

    it('falls back to the legacy Spanish text and reports es when i18n is absent', () => {
        const raw = [{ id: 'f1', question: '¿Cómo llego?', answer: 'En auto.' }];
        const [faq] = toDestinationFaqs(raw, 'en');
        expect(faq.question).toBe('¿Cómo llego?');
        expect(faq.answer).toBe('En auto.');
        expect(faq.resolvedLocale).toBe('es');
    });

    it('reports es when only one of question/answer is translated (mixed pair)', () => {
        const raw = [
            {
                id: 'f1',
                question: '¿Cómo llego?',
                answer: 'En auto.',
                questionI18n: { es: '¿Cómo llego?', en: 'How do I get there?', pt: 'Como chego?' }
                // answerI18n absent → answer resolves to es
            }
        ];
        const [faq] = toDestinationFaqs(raw, 'en');
        expect(faq.resolvedLocale).toBe('es');
    });

    it('returns [] for a non-array input', () => {
        expect(toDestinationFaqs(undefined, 'es')).toEqual([]);
    });

    it('prefers the legacy es text when the i18n object lacks the requested-locale key (no cross-fallback)', () => {
        const raw = [
            {
                id: 'f1',
                question: '¿Cómo llego?',
                answer: 'En auto.',
                // Partial i18n object: only en/pt translated, no es key.
                questionI18n: { en: 'How do I get there?', pt: 'Como chego?' },
                answerI18n: { en: 'By car.', pt: 'De carro.' }
            }
        ];
        const [faq] = toDestinationFaqs(raw, 'es');
        // es request must NOT surface the English/Portuguese text.
        expect(faq.question).toBe('¿Cómo llego?');
        expect(faq.answer).toBe('En auto.');
        expect(faq.resolvedLocale).toBe('es');
    });
});

describe('faqSetInLanguage — HOS-117 honest inLanguage', () => {
    it('returns the requested locale when every FAQ resolved to it', () => {
        expect(faqSetInLanguage([{ resolvedLocale: 'en' }, { resolvedLocale: 'en' }], 'en')).toBe(
            'en'
        );
    });

    it('returns es when any FAQ fell back (untranslated / mixed set)', () => {
        expect(faqSetInLanguage([{ resolvedLocale: 'en' }, { resolvedLocale: 'es' }], 'en')).toBe(
            'es'
        );
    });

    it('returns es for an empty set', () => {
        expect(faqSetInLanguage([], 'en')).toBe('es');
    });
});
