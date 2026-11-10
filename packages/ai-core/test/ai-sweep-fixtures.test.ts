/**
 * Tests for the HOS-2095 sweep cases: fixtures joined with the contexts that
 * apps/api generates with the real builders, the per-case rubrics, and the
 * global answer checks (raw codes, owner voice, impossible promises). No network.
 *
 * Byte parity with production's `buildChatSystemMessage` is proven on the
 * apps/api side (`apps/api/test/scripts/ai-sweep-contexts-parity.test.ts`),
 * because ai-core may not import apps/api. This file checks what ai-core can
 * see on its own: every system message carries the CURRENT in-code prompt and
 * rules, and the generated file covers exactly the stored cases.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    aggregateResults,
    type CallResult,
    expandMatrix,
    FixtureFileSchema,
    GeneratedFileSchema,
    joinGeneratedCases,
    renderSummaryMarkdown,
    SweepConfigSchema
} from '../scripts/ai-sweep/lib.js';
import {
    checkAnswer,
    findRawCodes,
    looksLikeOwnerVoice,
    promisesImpossibleCapability,
    type Rubric
} from '../scripts/ai-sweep/quality.js';
import { composeSystemPrompt } from '../src/config/prompt-resolver.js';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../src/engine/default-prompts.js';
import {
    appendReplyLanguageInstruction,
    REPLY_LANGUAGE_INSTRUCTIONS
} from '../src/language/reply-language.js';

const DIR = resolve(__dirname, '../scripts/ai-sweep');
const readJson = (name: string): unknown => JSON.parse(readFileSync(resolve(DIR, name), 'utf8'));

const fixtures = FixtureFileSchema.parse(readJson('fixtures.json'));
const generated = GeneratedFileSchema.parse(readJson('contexts.generated.json'));
const cases = joinGeneratedCases({ fixtures: fixtures.cases, generated });
const rubricOf = (id: string): Rubric => {
    const found = cases.find((c) => c.id === id);
    if (!found) throw new Error(`missing case ${id}`);
    return found.rubric;
};
const config = (name: string) => SweepConfigSchema.parse(readJson(name));

describe('fixtures joined with the generated contexts', () => {
    it('has 55 unique cases across the three features, each with a rubric', () => {
        // Assert
        expect(cases).toHaveLength(55);
        expect(new Set(cases.map((c) => c.id)).size).toBe(55);
        expect(new Set(cases.map((c) => c.feature))).toEqual(
            new Set(['chat', 'chat_venue', 'chat_experience'])
        );
        expect(cases.every((c) => c.rubric.notes.length > 0)).toBe(true);
    });

    it('the generated file covers exactly the stored cases', () => {
        expect(Object.keys(generated.cases).sort()).toEqual(cases.map((c) => c.id).sort());
    });

    it('every system message is context + the current in-code prompt, rules and language rule', () => {
        for (const c of cases) {
            const prompt = composeSystemPrompt({
                content: DEFAULT_PROMPTS[c.feature],
                rules: DEFAULT_RULES[c.feature]
            });
            expect(c.system.startsWith(c.context)).toBe(true);
            expect(c.system).toContain(`\n---\n\n${prompt}\n`);
            expect(c.system).toContain(
                `The page locale is "${c.locale}". Use it only as a fallback`
            );
            // The pre-#4249 line that made models answer English questions in Spanish.
            expect(c.system).not.toContain('locale is "es".`');
            expect(c.system).not.toMatch(/You MUST respond in the user's language: locale is/);
        }
    });

    it('refuses a stale generated file', () => {
        // Arrange
        const first = fixtures.cases[0];
        if (!first) throw new Error('no cases');
        const moved = { ...first, entity: 'some-other-entity' };

        // Act + Assert
        expect(() => joinGeneratedCases({ fixtures: [moved], generated })).toThrow(/stale/);
        expect(() =>
            joinGeneratedCases({ fixtures: [{ ...first, id: 'nope' }], generated })
        ).toThrow(/nope/);
    });

    it('contexts carry no contact data, balanced fences and only human labels', () => {
        for (const c of cases) {
            expect(c.context).not.toMatch(/\+?\d{2}[\d ()-]{7,}|[\w.]+@[\w.]+\.\w+|https?:\/\//);
            expect(c.context.split('<<<OWNER_DATA_START>>>').length).toBe(
                c.context.split('<<<OWNER_DATA_END>>>').length
            );
            const body = c.context
                .split('\n')
                .slice(1)
                .join('\n')
                .replaceAll(/<<<OWNER_DATA_(START|END)>>>/g, '');
            expect(findRawCodes(body), c.id).toEqual([]);
        }
    });

    it('renders the bugs #4249 fixed the way production now does', () => {
        const ctx = (id: string): string => cases.find((c) => c.id === id)?.context ?? '';
        expect(ctx('venue-restaurant-price-range')).toContain('**Rango de precios**: Moderado');
        expect(ctx('venue-restaurant-price-range')).toContain('**Asado de tira** — $');
        expect(ctx('experience-price-cents')).toMatch(/\*\*Desde\*\*: \$\s18\.500 por persona/);
        expect(ctx('venue-hours-missing-day')).toContain('- Domingo: sin información');
        expect(ctx('venue-hours-missing-day')).toContain('- Lunes: Cerrado');
        expect(ctx('acc-ac-past-position-20')).toContain('- Aire acondicionado');
        expect(ctx('acc-real-casa-pool-heated-ac')).toContain('- Aire acondicionado');
        expect(ctx('acc-real-isla-parking-no-price')).toContain(
            'No contamos con estacionamiento propio'
        );
        expect(ctx('acc-real-ruca-pool-size-checkin-pets')).toContain('4 × 9 metros');
        // HOS-2100: venue and experience amenities reach the context.
        expect(ctx('venue-amenities-ac-parking')).toContain('### Comodidades');
        expect(ctx('venue-amenities-ac-parking')).toContain('- Aire acondicionado');
        expect(ctx('experience-price-cents')).toContain('- Guía incluido');
    });
});

describe('configs', () => {
    it('all: every case, the 8 variants, 2 repetitions, within the cap', () => {
        const all = config('sweep.config.all.json');
        const calls = expandMatrix({ config: all, cases });
        expect(new Set(calls.map((c) => c.variantKey)).size).toBe(8);
        expect(calls).toHaveLength(55 * 8 * 2);
        expect(calls.length).toBeLessThanOrEqual(all.maxCalls);
    });

    it('accommodation: exactly the acc-real cases; example: exactly the others', () => {
        const accIds = cases.filter((c) => c.id.startsWith('acc-real-')).map((c) => c.id);
        const otherIds = cases.filter((c) => !c.id.startsWith('acc-real-')).map((c) => c.id);
        expect(accIds).toHaveLength(22);
        expect([...config('sweep.config.accommodation.json').caseIds].sort()).toEqual(
            accIds.sort()
        );
        expect([...config('sweep.config.example.json').caseIds].sort()).toEqual(otherIds.sort());
        for (const name of ['sweep.config.accommodation.json', 'sweep.config.example.json']) {
            const c = config(name);
            expect(expandMatrix({ config: c, cases }).length).toBeLessThanOrEqual(c.maxCalls);
        }
    });
});

describe('HOS-2098 age-scope config', () => {
    it('runs only existing chat_venue cases, on gpt-5.4-nano without reasoning, within its cap', () => {
        const c = config('sweep.config.age-scope.json');
        const calls = expandMatrix({ config: c, cases });
        expect(calls.length).toBe(c.caseIds.length * c.repetitions);
        expect(calls.length).toBeLessThanOrEqual(c.maxCalls);
        expect(new Set(calls.map((call) => call.variantKey))).toEqual(
            new Set(['gpt-5.4-nano | none | 2048'])
        );
        for (const id of c.caseIds) {
            expect(cases.find((x) => x.id === id)?.feature, id).toBe('chat_venue');
        }
    });

    it('the smoke bars print the scope line the staging smoke saw', () => {
        const ctx = (id: string): string => cases.find((c) => c.id === id)?.context ?? '';
        expect(ctx('venue-scope-00-saturday-22')).toContain(
            '**Alcance de la edad mínima**: Rige desde las 00:00 hasta el cierre'
        );
        expect(ctx('venue-scope-00-saturday-22')).toContain('- Sábado: 21:00–03:00');
        expect(ctx('venue-scope-2330-saturday-22-leave-23')).toContain(
            '**Alcance de la edad mínima**: Rige desde las 23:30 hasta el cierre'
        );
        expect(ctx('venue-scope-all-day-saturday-22')).toContain(
            '**Alcance de la edad mínima**: Rige todo el día'
        );
    });

    it('the smoke bars carry the scope resolved into explicit windows (HOS-2098 root fix)', () => {
        const ctx = (id: string): string => cases.find((c) => c.id === id)?.context ?? '';
        expect(ctx('venue-scope-00-saturday-22')).toContain(
            '- Sábado de 21:00 a 00:00 (medianoche): sin edad mínima informada'
        );
        expect(ctx('venue-scope-00-saturday-22')).toContain(
            '- Sábado, pasada la medianoche, de 00:00 a 03:00: edad mínima 18'
        );
        expect(ctx('venue-scope-2330-saturday-22-leave-23')).toContain(
            '- Sábado de 21:00 a 23:30: sin edad mínima informada'
        );
        expect(ctx('venue-mixed-lunch-with-child')).toContain(
            '- Sábado de 12:00 a 15:30: sin edad mínima informada'
        );
        // The "only at night" free-text venue has no scope: every hour, no free window.
        const freeText = ctx('venue-mixed-free-text-no-scope');
        expect(freeText).toContain(
            '- Todos los días, a toda hora (mediodía, tarde y noche) y en todo el local: edad mínima 18'
        );
        expect(freeText).not.toContain('sin edad mínima informada');
    });

    it('an outside-scope case fails an answer that opens with "No" and passes one that opens with "Sí"', () => {
        const r = rubricOf('venue-scope-00-saturday-22');
        const no = checkAnswer({
            rubric: r,
            text: 'No. La edad mínima es 18 y rige desde las 00:00. Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788).'
        });
        const yes = checkAnswer({
            rubric: r,
            text: 'Sí, a las 22 la ficha no indica un límite de edad: desde la medianoche (00:00) la edad mínima es 18. Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). Confirmalo con el lugar.'
        });
        expect(no.violations).toContain('arranca con un no');
        expect(yes.violations).toEqual([]);
        expect(yes.includeCoverage).toBe(1);
    });
});

describe('rubrics', () => {
    it('HOS-2100 monogris: the capacity 2 must be stated as a capacity, not any "2"', () => {
        const r = rubricOf('acc-real-monogris-parking-kid-pets-absent');
        const covered = (text: string) => checkAnswer({ rubric: r, text }).includeCoverage;
        expect(covered('La capacidad es de 2 huéspedes; estacionamiento no figura.')).toBe(1);
        expect(covered('Es para dos personas.')).toBe(1);
        expect(covered('Queda a 2 cuadras de la terminal y no figura estacionamiento.')).toBe(0);
    });

    it('HOS-2100 ruca: each of 3, 4 and 6 must be a cabin capacity', () => {
        const r = rubricOf('acc-real-ruca-group-14-cabins');
        const missed = (text: string) => checkAnswer({ rubric: r, text }).includeMissed;
        expect(
            missed(
                'Hay seis cabañas: dos para 3, dos para 4 y dos para 6 personas (26 en total). Depende de la disponibilidad: confirmalo con el lugar.'
            )
        ).toEqual([]);
        expect(missed('Son 3 dormitorios, 4 baños y 6 camas.')).toContain('capacidades 3, 4 y 6');
    });

    it('HOS-2100 casa-booking: a negated discount or deposit is not an invented one', () => {
        const r = rubricOf('acc-real-casa-booking-price-ask');
        const violations = (text: string) => checkAnswer({ rubric: r, text }).violations;
        expect(
            violations('El precio base es $195.000 por noche; no figuran descuentos ni seña.')
        ).not.toContain('inventa descuentos o seña');
        expect(violations('Con una seña del 30 % te lo dejan.')).toContain(
            'inventa descuentos o seña'
        );
        expect(violations('Tiene un descuento por estadía larga.')).toContain(
            'inventa descuentos o seña'
        );
        // A negation in an earlier clause does not cover the discount.
        expect(violations('No incluye desayuno, pero hay descuento por semana.')).toContain(
            'inventa descuentos o seña'
        );
        expect(violations('No se indica ningún descuento.')).not.toContain(
            'inventa descuentos o seña'
        );
    });

    it('HOS-2100 group cases: close with distribution/availability, never "entran sin problema"', () => {
        for (const id of [
            'acc-real-isla-two-families-8',
            'acc-real-casa-two-families-kids-recommend',
            'acc-real-ruca-group-14-cabins'
        ]) {
            const r = rubricOf(id);
            expect(
                checkAnswer({ rubric: r, text: 'Sí, entran sin problema.' }).violations
            ).toContain('afirma que entran seguro');
            expect(
                checkAnswer({
                    rubric: r,
                    text: 'Depende de cómo se repartan y de la disponibilidad: confirmalo con el lugar.'
                }).includeMissed
            ).not.toContain('remite reparto o disponibilidad al lugar');
            // A bare "confirm" is not the close.
            expect(
                checkAnswer({ rubric: r, text: 'No puedo confirmar eso.' }).includeMissed
            ).toContain('remite reparto o disponibilidad al lugar');
        }
    });

    it.each([
        [
            'acc-real-balcones-group-over-capacity',
            'No, 7 no entran: la capacidad es de 4 huéspedes.'
        ],
        [
            'acc-real-monogris-group-over-capacity',
            'No, 5 no entran: la capacidad es de 2 huéspedes.'
        ],
        ['acc-real-casa-group-over-capacity', 'No, 14 no entran: la capacidad es de 11 huéspedes.']
    ])('HOS-2100 over capacity (%s): only "no" and the capacity, nothing else', (id, clean) => {
        const r = rubricOf(id);
        expect(checkAnswer({ rubric: r, text: clean })).toMatchObject({
            includeCoverage: 1,
            violations: []
        });
        for (const hope of [
            `${clean} Depende de la disponibilidad.`,
            `${clean} Podrían ver otras unidades.`,
            `${clean} Consultá con el lugar.`
        ]) {
            expect(checkAnswer({ rubric: r, text: hope }).violations).toContain(
                'agrega esperanza falsa (unidades, disponibilidad, consultar)'
            );
        }
    });

    it('HOS-2100 en/pt groups: the close is translated, never copied in Spanish', () => {
        const en = rubricOf('acc-real-isla-english-two-families');
        expect(
            checkAnswer({
                rubric: en,
                text: 'The complex takes 12 guests in apartments for 2 and for 4. It depends on how you split and on availability: confirm it with the place.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [] });
        expect(
            checkAnswer({
                rubric: en,
                text: '12 guests. Depende de la disponibilidad: confirmalo.'
            }).violations
        ).toContain('cierre copiado en español');
        const pt = rubricOf('acc-real-casa-portuguese-group');
        expect(
            checkAnswer({
                rubric: pt,
                text: 'A casa recebe até 11 hóspedes. Depende de como se distribuírem e da disponibilidade: confirme com o lugar.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [] });
    });

    it('HOS-2100 venue amenities: AC yes, parking not listed', () => {
        const r = rubricOf('venue-amenities-ac-parking');
        expect(
            checkAnswer({
                rubric: r,
                text: 'Sí, tiene aire acondicionado. El estacionamiento no figura en la ficha: consultalo con el local.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [] });
        expect(
            checkAnswer({ rubric: r, text: 'Sí, tiene estacionamiento y aire acondicionado.' })
                .violations
        ).toContain('afirma estacionamiento');
    });

    it('nightclub minor: needs an explicit no, 18 and the law', () => {
        const r = rubricOf('venue-nightclub-minor');
        const good = checkAnswer({
            rubric: r,
            text: 'No, no podés entrar: la edad mínima es 18. Aviso legal: Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). Confirmalo con el local.'
        });
        expect(good).toMatchObject({ includeCoverage: 1, violations: [] });
        const soft = checkAnswer({ rubric: r, text: 'La edad mínima es 18 (Ley 24.788).' });
        expect(soft.includeMissed).toEqual(['no explícito']);
        expect(checkAnswer({ rubric: r, text: 'Sí, podés entrar.' }).violations).toContain(
            'afirma que puede entrar'
        );
    });

    it('restaurant price range: human label plus a menu price, never MID', () => {
        const r = rubricOf('venue-restaurant-price-range');
        expect(
            checkAnswer({
                rubric: r,
                text: 'El rango es moderado: el asado de tira sale $ 9.500 y el flan $ 3.500.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [] });
        expect(checkAnswer({ rubric: r, text: 'El rango es MID.' }).violations).toContain(
            'código crudo MID'
        );
    });

    it('new cases: scoped minor, missing day, cents, amenity past 20', () => {
        expect(
            checkAnswer({
                rubric: rubricOf('venue-mixed-lunch-with-child'),
                text: 'No, menores no pueden ir.'
            }).violations.length
        ).toBeGreaterThan(0);
        expect(
            checkAnswer({
                rubric: rubricOf('venue-mixed-lunch-with-child'),
                text: 'Al mediodía funciona como restaurante; la edad mínima de 18 aplica a la noche de boliche. Confirmalo con el local.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [] });
        expect(
            checkAnswer({
                rubric: rubricOf('venue-hours-missing-day'),
                text: 'Los domingos está cerrado.'
            }).violations
        ).toContain('dice que el domingo está cerrado');
        expect(
            checkAnswer({
                rubric: rubricOf('venue-hours-missing-day'),
                text: 'El horario del domingo no figura en la ficha, consultá con la heladería.'
            })
        ).toMatchObject({ includeCoverage: 1, violations: [], unknownHandled: true });
        const cents = rubricOf('experience-price-cents');
        expect(
            checkAnswer({ rubric: cents, text: 'Desde $ 18.500 por persona.' }).violations
        ).toEqual([]);
        expect(checkAnswer({ rubric: cents, text: 'Sale $1.850.000.' }).violations).toHaveLength(1);
        expect(
            checkAnswer({
                rubric: rubricOf('acc-ac-past-position-20'),
                text: 'No figura aire acondicionado.'
            }).violations
        ).toHaveLength(1);
    });

    it('booking cases forbid implying Hospeda books', () => {
        const r = rubricOf('venue-reservation-policy');
        expect(
            checkAnswer({ rubric: r, text: 'Hospeda te confirma la reserva para 10.' }).violations
        ).toContain('implica que Hospeda reserva o confirma');
    });
});

describe('global answer checks', () => {
    it('raw code leaked: enum codes and slugs, not acronyms or accented caps', () => {
        expect(findRawCodes('Rango MID, tipo COUNTRY_HOUSE, tiene air_conditioning. ARS')).toEqual([
            'MID',
            'COUNTRY_HOUSE',
            'air_conditioning'
        ]);
        expect(findRawCodes('NO PODÉS entrar. Precio en ARS, Wi-Fi gratis.')).toEqual([]);
    });

    it('owner voice and impossible promises', () => {
        expect(looksLikeOwnerVoice('Aceptamos reservas por WhatsApp.')).toBe(true);
        expect(looksLikeOwnerVoice('We accept pets.')).toBe(true);
        expect(looksLikeOwnerVoice('El lugar acepta reservas por WhatsApp.')).toBe(false);
        // HOS-2100: the guide's voice on an experience.
        expect(looksLikeOwnerVoice('Nos encontramos en el Muelle del Puerto Viejo.')).toBe(true);
        expect(looksLikeOwnerVoice('El punto de encuentro es el Muelle del Puerto Viejo.')).toBe(
            false
        );
        expect(promisesImpossibleCapability('Te reservo la cabaña ya mismo.')).toBe(true);
        expect(promisesImpossibleCapability("I'll book it for you.")).toBe(true);
        expect(
            promisesImpossibleCapability('Reservá desde las opciones de contacto de la página.')
        ).toBe(false);
    });

    it('feed three summary columns', () => {
        // Arrange
        const row = (text: string): CallResult => ({
            variantKey: 'v',
            model: 'm',
            effort: null,
            maxOutputTokens: 1,
            caseId: 'x',
            repetition: 1,
            text,
            finishReason: 'stop',
            inputTokens: 1,
            outputTokens: 1,
            reasoningTokens: 0,
            ttftMs: null,
            latencyMs: 1,
            costUsd: null,
            ruleChecks: {},
            quality: checkAnswer({ text, rubric: rubricOf('venue-bar-price-absent') }),
            error: null
        });

        // Act
        const [summary] = aggregateResults({
            quotas: [],
            results: [
                row('Tenemos el rango MID y te reservo mesa.'),
                row('El bar no lista precios.')
            ]
        });

        // Assert
        expect(summary).toMatchObject({
            rawCodeRate: 0.5,
            ownerVoiceRate: 0.5,
            impossiblePromiseRate: 0.5
        });
        const md = renderSummaryMarkdown({ rows: summary ? [summary] : [], quotas: [] });
        expect(md).toContain('raw code | owner voice | impossible promise');
    });
});

describe('sweep system message carries the production reply-language line', () => {
    const first = fixtures.cases[0];
    if (!first) throw new Error('no fixtures');
    const base = joinGeneratedCases({
        fixtures: [{ ...first, question: '.' }],
        generated
    })[0]?.system;
    const systemFor = (question: string): string => {
        const joined = joinGeneratedCases({ fixtures: [{ ...first, question }], generated })[0];
        if (!joined) throw new Error('join failed');
        return joined.system;
    };

    it.each([
        ['en', 'Do you allow dogs and is breakfast included?'],
        ['pt', 'Vocês aceitam animais de estimação e tem estacionamento?'],
        ['es', 'Tienen pileta y aceptan mascotas?']
    ] as const)('ends with the %s instruction production would add', (language, question) => {
        // Act
        const system = systemFor(question);
        const production = appendReplyLanguageInstruction({
            system: base ?? '',
            latestUserMessage: question
        });

        // Assert
        expect(system.endsWith(`\n${REPLY_LANGUAGE_INSTRUCTIONS[language]}`)).toBe(true);
        expect(production.language).toBe(language);
        expect(system).toBe(production.system);
    });

    it('adds no line for an ambiguous question', () => {
        // Act
        const system = systemFor('ok');

        // Assert
        expect(system).toBe(base);
        expect(Object.values(REPLY_LANGUAGE_INSTRUCTIONS).some((l) => system.includes(l))).toBe(
            false
        );
    });
});
