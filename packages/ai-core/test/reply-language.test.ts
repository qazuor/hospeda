/**
 * HOS-2095 (round 2): deterministic reply language for the listing chat.
 *
 * A blind-graded sweep of 560 answers showed that half of gpt-5.4-nano's
 * answers to English or Portuguese questions still came back in Spanish, even
 * with the "answer in the language of the latest message" rule. The fix is to
 * decide the language server-side and state it as the LAST line of the system
 * message. These tests pin the detector on realistic tourist messages and the
 * exact instruction it produces.
 *
 * @module test/reply-language
 */

import { describe, expect, it } from 'vitest';
import {
    appendReplyLanguageInstruction,
    buildReplyLanguageInstruction,
    detectMessageLanguage,
    REPLY_LANGUAGE_INSTRUCTIONS
} from '../src/language/reply-language.js';

/** Realistic visitor messages and the language a reply must be written in. */
const CONFIDENT_CASES: ReadonlyArray<readonly [string, 'es' | 'en' | 'pt']> = [
    // English
    ['Hi! Is breakfast included?', 'en'],
    ['Do you allow dogs?', 'en'],
    ['How much is a night for two people?', 'en'],
    ['Is there a pool?', 'en'],
    ['Can I bring my cat?', 'en'],
    ["What's the check-in time?", 'en'],
    ['How far is it from the beach?', 'en'],
    ['Hola! Do you have parking for two cars?', 'en'],
    ['We are a family of 6 with 3 kids, does it fit us?', 'en'],
    ['Is the restaurant open for lunch on Sundays?', 'en'],
    ['What time does the tour leave?', 'en'],
    ['Are pets allowed in the rooms?', 'en'],
    // Spanish (rioplatense and neutral)
    ['hola, tienen pileta?', 'es'],
    ['¿Aceptan mascotas?', 'es'],
    ['Cuánto sale la noche para dos?', 'es'],
    ['Tienen cochera?', 'es'],
    ['¿El desayuno está incluido?', 'es'],
    ['Somos 6, entramos en la cabaña?', 'es'],
    ['Puedo ir a almorzar con mi hijo de 10 años?', 'es'],
    ['A qué hora sale la excursión?', 'es'],
    ['che, se puede llevar al perro?', 'es'],
    ['Hay wifi en las habitaciones?', 'es'],
    ['¿Qué tan lejos queda de la playa?', 'es'],
    // Portuguese
    ['oi, aceita cachorro?', 'pt'],
    ['Olá! O café da manhã está incluído?', 'pt'],
    ['Vocês têm piscina?', 'pt'],
    ['Quanto custa a diária para duas pessoas?', 'pt'],
    ['Tem estacionamento?', 'pt'],
    ['Posso levar meu cachorro?', 'pt'],
    ['Somos uma família com duas crianças, cabe todo mundo?', 'pt'],
    ['Qual é o horário de saída do passeio?', 'pt'],
    ['Fica perto da praia?', 'pt'],
    ['Não tem wifi no quarto?', 'pt'],
    // Second batch: measured held-out first (12/21 right, 0 wrong), then tuned.
    ['Is there a grill?', 'en'],
    ['What is the minimum age to get in?', 'en'],
    ['Is the tour cancelled if it rains?', 'en'],
    ['Do I need to book in advance?', 'en'],
    ['How many bedrooms does it have?', 'en'],
    ['Can my 16 year old son come in?', 'en'],
    ['Is smoking allowed?', 'en'],
    ['Does the cabin have air conditioning?', 'en'],
    ['Can we pay by card?', 'en'],
    ['Do they serve vegan food?', 'en'],
    ['Tiene parrilla?', 'es'],
    ['Cuál es la edad mínima para entrar?', 'es'],
    ['Si llueve se suspende la excursión?', 'es'],
    ['Cuántos dormitorios tiene?', 'es'],
    ['Mi hijo de 16 puede entrar?', 'es'],
    ['Se puede fumar?', 'es'],
    ['Hay que reservar antes?', 'es'],
    ['Tiene aire acondicionado?', 'es'],
    ['somos 4 adultos y 2 nenes, entramos?', 'es'],
    ['Tem churrasqueira?', 'pt'],
    ['Qual é a idade mínima para entrar?', 'pt'],
    ['Se chover o passeio é cancelado?', 'pt'],
    ['Quantos quartos tem?', 'pt'],
    ['Meu filho de 16 anos pode entrar?', 'pt'],
    ['Pode fumar?', 'pt'],
    ['Tem ar condicionado?', 'pt']
];

/** Messages too short or too mixed to decide: the generic rule must stay in charge. */
const UNSURE_CASES: readonly string[] = [
    'ok',
    'wifi?',
    'hola?',
    'Hi',
    '👍',
    '4',
    'Colón',
    '',
    '   ',
    'pileta?',
    'tienen parking for two cars?',
    'gracias, thanks'
];

describe('detectMessageLanguage — confident cases', () => {
    it.each(CONFIDENT_CASES)('"%s" → %s', (text, expected) => {
        // Arrange + Act
        const { language } = detectMessageLanguage({ text });

        // Assert
        expect(language).toBe(expected);
    });
});

describe('detectMessageLanguage — unsure cases return null', () => {
    it.each(UNSURE_CASES)('"%s" → null', (text) => {
        expect(detectMessageLanguage({ text }).language).toBeNull();
    });
});

/**
 * Review of #4253 (B1/B2): English loanwords ("pet friendly", "bed and
 * breakfast") and web addresses (`com`, `ar` are Portuguese words) used to
 * flip Spanish and Portuguese questions.
 */
const LOANWORD_AND_ADDRESS_CASES: ReadonlyArray<
    readonly [string, ReadonlyArray<'es' | 'en' | 'pt' | null>]
> = [
    ['es pet friendly?', ['es', null]],
    ['son pet friendly?', ['es', null]],
    ['es family friendly?', ['es', null]],
    ['es dog friendly?', ['es', null]],
    ['es dog-friendly?', ['es', null]],
    ['tiene bed and breakfast?', ['es', null]],
    ['hacen B&B?', ['es', null]],
    ['tem pet friendly?', ['pt', null]],
    ['is it pet friendly?', ['en']],
    ['vi esto en www.lacasona.com.ar, es así?', ['es', null]],
    ['me pasás la web lacasona.com.ar', ['es', null]],
    ['tienen mail? info@lacasona.com.ar', ['es', null]],
    ['lo vi en https://hospeda.com.ar/alojamientos/la-casona, tienen pileta?', ['es']],
    ['vi en hospeda.com.ar que tienen cochera', ['es']],
    ['tienen instagram? @lacasona.ar', ['es', null]],
    ['I saw it on hospeda.com.ar, is breakfast included?', ['en']]
];

describe('detectMessageLanguage — loanwords and addresses never flip the language', () => {
    it.each(LOANWORD_AND_ADDRESS_CASES)('"%s" → one of %j', (text, allowed) => {
        expect(allowed).toContain(detectMessageLanguage({ text }).language);
    });

    it('a web address alone never scores Portuguese', () => {
        expect(
            detectMessageLanguage({ text: 'www.lacasona.com.ar info@lacasona.com.ar' }).scores.pt
        ).toBe(0);
    });
});

describe('detectMessageLanguage — accuracy over the whole set', () => {
    it('gets every confident case right and never guesses on an unsure one', () => {
        // Arrange
        const right = CONFIDENT_CASES.filter(
            ([text, expected]) => detectMessageLanguage({ text }).language === expected
        ).length;
        const wrongGuesses = CONFIDENT_CASES.filter(([text, expected]) => {
            const { language } = detectMessageLanguage({ text });
            return language !== null && language !== expected;
        }).length;
        const unsureGuesses = UNSURE_CASES.filter(
            (text) => detectMessageLanguage({ text }).language !== null
        ).length;

        // Assert
        expect(right).toBe(CONFIDENT_CASES.length);
        expect(wrongGuesses).toBe(0);
        expect(unsureGuesses).toBe(0);
    });

    it('exposes the per-language scores it decided on', () => {
        const { scores } = detectMessageLanguage({ text: 'Is breakfast included?' });
        expect(scores.en).toBeGreaterThan(scores.es);
        expect(scores.en).toBeGreaterThan(scores.pt);
    });

    it('treats a curly apostrophe like a straight one', () => {
        expect(detectMessageLanguage({ text: 'What’s the check-in time?' }).language).toBe('en');
    });
});

describe('buildReplyLanguageInstruction', () => {
    it('states the reply language explicitly, in that language', () => {
        expect(REPLY_LANGUAGE_INSTRUCTIONS.en).toContain('Reply in English.');
        expect(REPLY_LANGUAGE_INSTRUCTIONS.es).toContain('Respondé en español.');
        expect(REPLY_LANGUAGE_INSTRUCTIONS.pt).toContain('Responda em português.');
    });

    it('tells the model a foreign-language question about the listing is on-topic', () => {
        expect(REPLY_LANGUAGE_INSTRUCTIONS.en).toContain('on-topic');
        expect(REPLY_LANGUAGE_INSTRUCTIONS.pt).toContain('dentro do tema');
        // Review M4: the Spanish line says it too, for consistency.
        expect(REPLY_LANGUAGE_INSTRUCTIONS.es).toContain('dentro del tema');
    });

    it('HOS-2100: demands every word in the reply language, translating Spanish listing values', () => {
        // Arrange / Act: the instruction table is the unit under test.
        const { en, pt } = REPLY_LANGUAGE_INSTRUCTIONS;

        // Assert
        expect(en).toContain('Write every word of the answer in English');
        expect(en).toContain('"pileta" → "pool"');
        expect(pt).toContain('Escreva toda a resposta em português, sem nenhuma frase em espanhol');
        expect(pt).toContain('"pileta" → "piscina"');
        // Proper names are still never translated.
        expect(en).toContain('keeping only proper names unchanged');
        expect(pt).toContain('mantendo apenas os nomes próprios');
    });

    it('HOS-2100: the Spanish line reminds conjugation and the plural of vos', () => {
        expect(REPLY_LANGUAGE_INSTRUCTIONS.es).toContain('oraciones completas y bien conjugadas');
        expect(REPLY_LANGUAGE_INSTRUCTIONS.es).toContain(
            'lo mejor es que lo consultes con el lugar'
        );
        expect(REPLY_LANGUAGE_INSTRUCTIONS.es).toContain('el plural de «vos» es «ustedes»');
    });

    it('returns the instruction for a confident message and null otherwise', () => {
        expect(
            buildReplyLanguageInstruction({ latestUserMessage: 'Is breakfast included?' })
        ).toEqual({ language: 'en', instruction: REPLY_LANGUAGE_INSTRUCTIONS.en });
        expect(buildReplyLanguageInstruction({ latestUserMessage: 'ok' })).toEqual({
            language: null,
            instruction: null
        });
    });
});

describe('appendReplyLanguageInstruction', () => {
    it('appends the instruction as the very last line when confident', () => {
        // Arrange
        const base = 'CONTEXT\n\n---\n\nPROMPT\n- fallback line';

        // Act
        const { system, language } = appendReplyLanguageInstruction({
            system: base,
            latestUserMessage: 'Vocês têm piscina?'
        });

        // Assert
        expect(language).toBe('pt');
        expect(system).toBe(`${base}\n${REPLY_LANGUAGE_INSTRUCTIONS.pt}`);
        expect(system.split('\n').at(-1)).toBe(REPLY_LANGUAGE_INSTRUCTIONS.pt);
    });

    it('leaves the system message byte-identical when unsure', () => {
        const base = 'CONTEXT\n\n---\n\nPROMPT';
        expect(appendReplyLanguageInstruction({ system: base, latestUserMessage: 'ok' })).toEqual({
            system: base,
            language: null
        });
    });
});

describe('detectMessageLanguage — adversarial input stays linear (CodeQL ReDoS)', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
        ['a long run of "!" (address patterns)', '!'.repeat(50_000)],
        ['a long run of apostrophes (token trim)', `${"'".repeat(50_000)}a`],
        ['a long word with no "friendly" (loanword phrase)', 'a'.repeat(50_000)],
        ['a long dotted label with no TLD (domain pattern)', `${'a.'.repeat(25_000)}x`],
        ['a long run of "@" (e-mail pattern)', '@'.repeat(50_000)]
    ];

    it.each(cases)('handles %s quickly', (_label, text) => {
        // Arrange
        const startedAt = performance.now();

        // Act
        const result = detectMessageLanguage({ text });

        // Assert
        expect(result.language).toBeNull();
        expect(performance.now() - startedAt).toBeLessThan(250);
    });

    it('still drops addresses and loanword phrases after the rewrite', () => {
        // Arrange
        const text =
            'tienen mail? (info@lacasona.com.ar) o la web www.lacasona.com.ar/contacto, es pet friendly?';

        // Act
        const { language, scores } = detectMessageLanguage({ text });

        // Assert
        expect(language).toBe('es');
        expect(scores.pt).toBe(0);
        expect(scores.en).toBe(0);
    });
});
