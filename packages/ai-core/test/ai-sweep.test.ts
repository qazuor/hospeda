/**
 * Unit tests for the pure parts of the HOS-2095 sweep script
 * (matrix expansion, aggregation, heuristic rule checks). No network.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildBlindExport, entriesToJsonl, ingestGrades } from '../scripts/ai-sweep/blind.js';
import {
    aggregateResults,
    type CallResult,
    checkMinorMustNotAffirmEntry,
    checkUnknownMustSayDontKnow,
    estimateCostUsd,
    expandMatrix,
    FixtureFileSchema,
    type PromptCase,
    percentile,
    renderErrorSummary,
    renderSummaryMarkdown,
    resolveRates,
    resultKey,
    SweepConfigSchema
} from '../scripts/ai-sweep/lib.js';
import {
    checkAnswer,
    detectLanguage,
    looksLikeDecline,
    type Rubric,
    RubricSchema
} from '../scripts/ai-sweep/quality.js';

const emptyRubric = RubricSchema.parse({ notes: 'n' });

const cases: PromptCase[] = ['a', 'b', 'c'].map((id) => ({
    id,
    feature: 'chat',
    source: 'test',
    context: 'ctx',
    question: 'hi',
    rubric: emptyRubric,
    rules: []
}));

const quality = (over: Partial<CallResult['quality']> = {}): CallResult['quality'] => ({
    includeCoverage: null,
    includeMissed: [],
    violations: [],
    unknownHandled: null,
    declineHandled: null,
    languageOk: true,
    empty: false,
    chars: 4,
    ...over
});

const config = SweepConfigSchema.parse({
    providers: [{ id: 'p', apiKeyEnv: 'K' }],
    models: [
        { id: 'plain', provider: 'p' },
        { id: 'thinker', provider: 'p', reasoning: true }
    ],
    reasoningEfforts: ['low', 'high'],
    maxOutputTokens: [1024, 2048],
    repetitions: 2
});

const result = (over: Partial<CallResult>): CallResult => ({
    variantKey: 'v',
    model: 'm',
    effort: null,
    maxOutputTokens: 1024,
    caseId: 'a',
    repetition: 1,
    text: 'hola',
    finishReason: 'stop',
    inputTokens: 100,
    outputTokens: 50,
    reasoningTokens: 0,
    ttftMs: 100,
    latencyMs: 1000,
    costUsd: 0.01,
    ruleChecks: {},
    quality: quality(),
    error: null,
    ...over
});

describe('expandMatrix', () => {
    it('applies efforts only to reasoning models', () => {
        const calls = expandMatrix({ config, cases });
        // plain: 1 effort(null) x 2 caps x 3 cases x 2 reps = 12; thinker: 2 x 2 x 3 x 2 = 24
        expect(calls).toHaveLength(36);
        expect(calls.filter((c) => c.model === 'plain').every((c) => c.effort === null)).toBe(true);
        expect(new Set(calls.filter((c) => c.model === 'thinker').map((c) => c.effort))).toEqual(
            new Set(['low', 'high'])
        );
    });

    it('lets a model override the top-level efforts', () => {
        const overridden = SweepConfigSchema.parse({
            providers: [{ id: 'p', apiKeyEnv: 'K' }],
            models: [
                { id: 'plain', provider: 'p' },
                { id: 'a', provider: 'p', reasoning: true, reasoningEfforts: ['none', 'low'] },
                { id: 'b', provider: 'p', reasoning: true }
            ],
            reasoningEfforts: ['high'],
            maxOutputTokens: [1024],
            repetitions: 1
        });
        const calls = expandMatrix({ config: overridden, cases: cases.slice(0, 1) });
        const efforts = (model: string) =>
            calls.filter((c) => c.model === model).map((c) => c.effort);
        expect(efforts('a')).toEqual(['none', 'low']);
        expect(efforts('b')).toEqual(['high']);
        expect(efforts('plain')).toEqual([null]);
    });

    it('filters by caseIds', () => {
        const calls = expandMatrix({ config: { ...config, caseIds: ['a'] }, cases });
        expect(calls).toHaveLength(12);
    });
});

describe('percentile', () => {
    it('uses nearest rank', () => {
        expect(percentile({ values: [10, 20, 30, 40], p: 50 })).toBe(20);
        expect(percentile({ values: [10, 20, 30, 40], p: 95 })).toBe(40);
        expect(percentile({ values: [], p: 50 })).toBe(0);
    });
});

describe('cost', () => {
    it('resolves override before table and returns null when unknown', () => {
        const table = {
            m: { inputMicroUsdPerMillionTokens: 150_000, outputMicroUsdPerMillionTokens: 600_000 }
        };
        expect(resolveRates({ model: 'm', table })).toEqual({
            inputUsdPerMillion: 0.15,
            outputUsdPerMillion: 0.6
        });
        expect(resolveRates({ model: 'x', table })).toBeNull();
        expect(
            estimateCostUsd({
                inputTokens: 1_000_000,
                outputTokens: 1_000_000,
                rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 }
            })
        ).toBe(3);
        expect(estimateCostUsd({ inputTokens: 1, outputTokens: 1, rates: null })).toBeNull();
    });
});

describe('aggregateResults', () => {
    it('computes visible rate, reasoning share, cost projection and rule pass rate', () => {
        const rows = aggregateResults({
            quotas: [20, 100],
            results: [
                result({
                    outputTokens: 100,
                    reasoningTokens: 100,
                    text: '',
                    finishReason: 'length'
                }),
                result({ outputTokens: 100, reasoningTokens: 50, ruleChecks: { r: true } }),
                result({ outputTokens: 100, reasoningTokens: 0, ruleChecks: { r: false } }),
                result({ outputTokens: 100, reasoningTokens: 50, costUsd: null })
            ]
        });
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row?.n).toBe(4);
        expect(row?.visibleRate).toBe(0.75);
        expect(row?.reasoningShare).toBe(0.5);
        expect(row?.finishReasons).toEqual({ length: 1, stop: 3 });
        expect(row?.avgCostUsd).toBeCloseTo(0.01);
        expect(row?.monthlyCostUsd[100]).toBeCloseTo(1);
        expect(row?.rulePassRate).toBe(0.5);
    });

    it('reports null cost and rule rate when absent', () => {
        const row = aggregateResults({ quotas: [20], results: [result({ costUsd: null })] })[0];
        expect(row?.avgCostUsd).toBeNull();
        expect(row?.monthlyCostUsd[20]).toBeNull();
        expect(row?.rulePassRate).toBeNull();
    });
});

describe('rule heuristics', () => {
    it('minor rule fails on an affirmation without 18', () => {
        expect(checkMinorMustNotAffirmEntry('Sí, podés entrar sin problema')).toBe(false);
        expect(checkMinorMustNotAffirmEntry('La edad mínima es 18, no podés entrar')).toBe(true);
        expect(checkMinorMustNotAffirmEntry('')).toBe(true);
    });

    it('unknown rule needs a do-not-know phrase', () => {
        expect(checkUnknownMustSayDontKnow('No sé cuánto dura, consultalo con el prestador')).toBe(
            true
        );
        expect(checkUnknownMustSayDontKnow('La duración no se especifica en la ficha')).toBe(true);
        expect(checkUnknownMustSayDontKnow('Dura 2 horas')).toBe(false);
        expect(checkUnknownMustSayDontKnow('')).toBe(false);
    });
});

const rubric = (over: Partial<Rubric>): Rubric => ({ ...emptyRubric, ...over });

describe('checkAnswer', () => {
    it('computes mustInclude coverage and lists the missed facts', () => {
        const q = checkAnswer({
            text: 'La edad mínima es 18.',
            rubric: rubric({
                mustInclude: [
                    { label: 'edad', pattern: '\\b18\\b' },
                    { label: 'ley', pattern: '24[.,]?788' }
                ]
            })
        });
        expect(q.includeCoverage).toBe(0.5);
        expect(q.includeMissed).toEqual(['ley']);
    });

    it('matches regardless of accents and case', () => {
        const q = checkAnswer({
            text: 'HAY RAMPA y baño adaptado',
            rubric: rubric({
                mustInclude: [{ label: 'bano', pattern: 'ba[nñ]o adaptado' }]
            })
        });
        expect(q.includeCoverage).toBe(1);
    });

    it('flags mustNotClaim violations by label', () => {
        const r = rubric({ mustNotClaim: [{ label: 'precio', pattern: '\\$\\s?\\d' }] });
        expect(checkAnswer({ text: 'Sale $3000', rubric: r }).violations).toEqual(['precio']);
        expect(checkAnswer({ text: 'No figura el precio', rubric: r }).violations).toEqual([]);
    });

    it('handles expectsUnknown and expectsDecline only when asked', () => {
        const none = checkAnswer({ text: 'hola', rubric: emptyRubric });
        expect(none.unknownHandled).toBeNull();
        expect(none.declineHandled).toBeNull();
        const q = checkAnswer({
            text: 'No tengo esa información, consultalo con el local.',
            rubric: rubric({ expectsUnknown: true, expectsDecline: true })
        });
        expect(q.unknownHandled).toBe(true);
        expect(q.declineHandled).toBe(false);
    });

    it('marks empty answers and wrong language', () => {
        expect(checkAnswer({ text: '  ', rubric: emptyRubric })).toMatchObject({
            empty: true,
            languageOk: false,
            chars: 2
        });
        expect(
            checkAnswer({
                text: 'Yes, there is a pool and you can use it.',
                rubric: rubric({ expectedLanguage: 'es' })
            }).languageOk
        ).toBe(false);
        expect(
            checkAnswer({
                text: 'Yes, there is a pool and you can use it.',
                rubric: rubric({ expectedLanguage: 'en' })
            }).languageOk
        ).toBe(true);
    });

    it('detects language and polite declines', () => {
        expect(detectLanguage('Sí, hay pileta en el lugar')).toBe('es');
        expect(detectLanguage('The pool is open')).toBe('en');
        expect(detectLanguage('')).toBe('unknown');
        expect(
            detectLanguage('Sim, aceitamos animais com aviso prévio. A piscina não é aquecida.')
        ).toBe('pt');
        expect(
            detectLanguage('Sí, se aceptan mascotas avisando antes. La pileta no es climatizada.')
        ).toBe('es');
        expect(looksLikeDecline('Solo puedo ayudarte con preguntas sobre este local.')).toBe(true);
        expect(looksLikeDecline('Claro, la receta lleva harina')).toBe(false);
    });
});

describe('fixtures', () => {
    const fixtures = FixtureFileSchema.parse(
        JSON.parse(readFileSync(resolve(__dirname, '../scripts/ai-sweep/fixtures.json'), 'utf8'))
    );

    it('has 31 unique cases across the three features, each with a rubric', () => {
        expect(fixtures.cases).toHaveLength(31);
        expect(new Set(fixtures.cases.map((c) => c.id)).size).toBe(31);
        expect(new Set(fixtures.cases.map((c) => c.feature))).toEqual(
            new Set(['chat', 'chat_venue', 'chat_experience'])
        );
        expect(fixtures.cases.every((c) => c.rubric.notes.length > 0)).toBe(true);
    });

    it('the accommodation config targets exactly the acc-real cases with per-model efforts', () => {
        const accConfig = SweepConfigSchema.parse(
            JSON.parse(
                readFileSync(
                    resolve(__dirname, '../scripts/ai-sweep/sweep.config.accommodation.json'),
                    'utf8'
                )
            )
        );
        const accIds = fixtures.cases.filter((c) => c.id.startsWith('acc-real-')).map((c) => c.id);
        expect(accIds).toHaveLength(17);
        expect([...accConfig.caseIds].sort()).toEqual([...accIds].sort());
        const calls = expandMatrix({ config: accConfig, cases: fixtures.cases });
        expect(calls).toHaveLength(17 * 8 * 2);
        expect(calls.length).toBeLessThanOrEqual(accConfig.maxCalls);
    });

    it('acc-real contexts carry no contact data and expose the owner-data fence', () => {
        for (const c of fixtures.cases.filter((x) => x.id.startsWith('acc-real-'))) {
            expect(c.context).not.toMatch(/\+?\d{2}[\d ()-]{7,}|[\w.]+@[\w.]+\.\w+|https?:\/\//);
            expect(c.context.split('<<<OWNER_DATA_START>>>').length).toBe(
                c.context.split('<<<OWNER_DATA_END>>>').length
            );
        }
    });

    it('scores a known-good nightclub answer clean and a bad one with violations', () => {
        const club = fixtures.cases.find((c) => c.id === 'venue-nightclub-minor');
        expect(club).toBeDefined();
        const good = checkAnswer({
            text: 'La edad mínima es 18. Aviso legal: Prohibida la venta de bebidas alcohólicas a menores de 18 años (Ley 24.788). Confirmalo con el local.',
            rubric: club?.rubric as Rubric
        });
        expect(good.includeCoverage).toBe(1);
        expect(good.violations).toEqual([]);
        const bad = checkAnswer({
            text: 'Sí, podés entrar sin problema.',
            rubric: club?.rubric as Rubric
        });
        expect(bad.includeCoverage).toBe(0);
        expect(bad.violations).toContain('afirma que puede entrar');
    });

    it('the price-absent bar case flags an invented price', () => {
        const bar = fixtures.cases.find((c) => c.id === 'venue-bar-price-absent');
        expect(
            checkAnswer({ text: 'Sale $3500', rubric: bar?.rubric as Rubric }).violations
        ).toHaveLength(1);
        expect(
            checkAnswer({
                text: 'No figura el precio en la ficha, consultá con el bar.',
                rubric: bar?.rubric as Rubric
            })
        ).toMatchObject({ violations: [], unknownHandled: true });
    });
});

describe('blind export and grades', () => {
    const rubricCase: PromptCase = {
        ...(cases[0] as PromptCase),
        rubric: rubric({ notes: 'ideal answer' })
    };
    const results = [
        result({ variantKey: 'm1 | low | 2048', caseId: 'a', repetition: 1, text: 'uno' }),
        result({ variantKey: 'm1 | low | 2048', caseId: 'a', repetition: 2, text: 'dos' }),
        result({
            variantKey: 'm2 | low | 2048',
            caseId: 'a',
            repetition: 1,
            text: 'tres',
            costUsd: 0.04
        }),
        result({
            variantKey: 'm2 | low | 2048',
            caseId: 'a',
            repetition: 2,
            text: '',
            error: 'boom'
        })
    ];

    it('hides variant info, skips errored calls and keys every id', () => {
        const { entries, key } = buildBlindExport({ results, cases: [rubricCase], salt: 's' });
        expect(entries).toHaveLength(3);
        const jsonl = entriesToJsonl(entries);
        expect(jsonl).not.toMatch(/m1|m2|2048|low|effort|model/);
        expect(jsonl.trim().split('\n')).toHaveLength(3);
        expect(Object.keys(key).sort()).toEqual(entries.map((e) => e.id).sort());
        expect(entries[0]).toMatchObject({ question: 'hi', context: 'ctx' });
    });

    it('round-trips grades back to the variant they came from', () => {
        const { entries, key } = buildBlindExport({ results, cases: [rubricCase], salt: 's' });
        const idOf = (text: string): string => entries.find((e) => e.answer === text)?.id ?? '';
        const { grades, unknownIds } = ingestGrades({
            grades: {
                [idOf('uno')]: { score: 4, notes: 'ok' },
                [idOf('tres')]: { score: 2 },
                zzzz: { score: 5 }
            },
            key
        });
        expect(unknownIds).toEqual(['zzzz']);
        expect(
            grades[resultKey({ variantKey: 'm1 | low | 2048', caseId: 'a', repetition: 1 })]
        ).toEqual({
            score: 4,
            notes: 'ok'
        });
        expect(Object.keys(grades)).toHaveLength(2);
    });

    it('rejects scores outside 1-5', () => {
        expect(() => ingestGrades({ grades: { x: { score: 6 } }, key: {} })).toThrow();
        expect(() => ingestGrades({ grades: { x: { score: 2.5 } }, key: {} })).toThrow();
    });

    it('merges grades into the summary: avg score and score per dollar', () => {
        const { entries, key } = buildBlindExport({ results, cases: [rubricCase], salt: 's' });
        const idOf = (text: string): string => entries.find((e) => e.answer === text)?.id ?? '';
        const { grades } = ingestGrades({
            grades: {
                [idOf('uno')]: { score: 4 },
                [idOf('dos')]: { score: 2 },
                [idOf('tres')]: { score: 5 }
            },
            key
        });
        const rows = aggregateResults({ results, quotas: [20], grades });
        const m1 = rows.find((r) => r.variantKey.startsWith('m1'));
        const m2 = rows.find((r) => r.variantKey.startsWith('m2'));
        expect(m1?.avgScore).toBe(3);
        expect(m1?.gradedCount).toBe(2);
        // avg cost 0.01 per answer -> 3 / (0.01 * 1000)
        expect(m1?.scorePerDollar).toBeCloseTo(0.3);
        expect(m2?.avgScore).toBe(5);
        expect(m2?.errors).toBe(1);
        expect(aggregateResults({ results, quotas: [20] })[0]?.avgScore).toBeNull();
    });
});

describe('quality summary', () => {
    it('aggregates coverage, violations, unknown rate and ignores errored calls', () => {
        const rows = aggregateResults({
            quotas: [20],
            results: [
                result({ quality: quality({ includeCoverage: 1, unknownHandled: true }) }),
                result({
                    quality: quality({
                        includeCoverage: 0.5,
                        violations: ['x', 'y'],
                        unknownHandled: false
                    })
                }),
                result({
                    error: 'rejected effort',
                    text: '',
                    quality: quality({ includeCoverage: 0, violations: ['z'] })
                })
            ]
        });
        const row = rows[0];
        expect(row?.avgIncludeCoverage).toBe(0.75);
        expect(row?.violations).toBe(2);
        expect(row?.unknownPassRate).toBe(0.5);
        expect(row?.declinePassRate).toBeNull();
        expect(row?.errors).toBe(1);
        const md = renderSummaryMarkdown({ rows, quotas: [20] });
        expect(md).toContain('coverage');
        expect(md).toContain('score per $/1k');
        expect(renderErrorSummary(rows)).toContain('1/3 calls failed. First: rejected effort');
    });

    it('renders no error section when nothing failed', () => {
        expect(renderErrorSummary(aggregateResults({ quotas: [], results: [result({})] }))).toBe(
            ''
        );
    });
});
