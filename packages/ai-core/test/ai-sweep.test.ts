/**
 * Unit tests for the pure parts of the HOS-2095 sweep script
 * (matrix expansion, aggregation, heuristic rule checks). No network.
 */

import { describe, expect, it } from 'vitest';
import {
    aggregateResults,
    type CallResult,
    checkMinorMustNotAffirmEntry,
    checkUnknownMustSayDontKnow,
    estimateCostUsd,
    expandMatrix,
    type PromptCase,
    percentile,
    resolveRates,
    SweepConfigSchema
} from '../scripts/ai-sweep/lib.js';

const cases: PromptCase[] = ['a', 'b', 'c'].map((id) => ({
    id,
    feature: 'chat',
    source: 'test',
    contextBlock: '',
    userMessage: 'hi',
    rules: []
}));

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
