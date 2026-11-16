/**
 * Tests for the HOS-2217 model-migration sweep: the committed migration
 * config, case selection (`--features`), the call matrix, the per-call output
 * cap, the dry-run worst-case plan and the per-feature report. No network.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMigrationCases } from '../scripts/ai-sweep/load-cases.js';
import {
    expandMigrationMatrix,
    MIGRATION_FEATURES,
    type MigrationConfig,
    MigrationConfigSchema,
    type MigrationResult,
    planCalls,
    recheckResults,
    selectCases
} from '../scripts/ai-sweep/migration-lib.js';
import { aggregateMigration, renderMigrationReport } from '../scripts/ai-sweep/migration-report.js';
import { MODEL_RATES } from '../src/usage/model-rates.js';

const DIR = resolve(import.meta.dirname, '../scripts/ai-sweep');
const config = MigrationConfigSchema.parse(
    JSON.parse(readFileSync(resolve(DIR, 'sweep.config.migration.json'), 'utf8'))
);
const { cases } = loadMigrationCases({ dir: DIR });
const rates = new Map(config.models.map((m) => [m.id, m.rates ?? null]));
const ratesFor = (model: string) => {
    const r = rates.get(model);
    return r
        ? { inputUsdPerMillion: r.inputUsdPerMillion, outputUsdPerMillion: r.outputUsdPerMillion }
        : null;
};

describe('HOS-2217 migration config', () => {
    it('baseline first, then the three non-deprecated candidates, with the agreed USD/1M rates', () => {
        // Act
        const models = config.models.map((m) => [m.id, m.reasoningEfforts, m.rates]);

        // Assert
        expect(models).toEqual([
            ['gpt-5.4-nano', ['none'], { inputUsdPerMillion: 0.2, outputUsdPerMillion: 1.25 }],
            ['gpt-6-luna', ['none', 'low'], { inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 }],
            ['gpt-5.6-luna', ['none'], { inputUsdPerMillion: 0.2, outputUsdPerMillion: 1.2 }],
            ['gpt-5.4-mini', ['none'], { inputUsdPerMillion: 0.75, outputUsdPerMillion: 4.5 }]
        ]);
        expect(config.models.every((m) => m.reasoning)).toBe(true);
    });

    it('every candidate has its production metering rate in MODEL_RATES', () => {
        // Act
        const missing = config.models.filter((m) => {
            const rate = MODEL_RATES[m.id];
            if (!m.rates) return true;
            return (
                rate?.inputMicroUsdPerMillionTokens !==
                    Math.round(m.rates.inputUsdPerMillion * 1_000_000) ||
                rate.outputMicroUsdPerMillionTokens !==
                    Math.round(m.rates.outputUsdPerMillion * 1_000_000)
            );
        });

        // Assert
        expect(missing.map((m) => m.id)).toEqual([]);
    });

    it('carries the production 30-day volumes measured 2026-11-15 and the quota tiers', () => {
        // Act
        const volumes = Object.fromEntries(
            Object.entries(config.features).map(([f, c]) => [f, c.monthlyCalls])
        );

        // Assert
        expect(volumes).toMatchObject({
            chat: 15,
            chat_answer_classifier: 12,
            search: 4,
            faq_draft: 1,
            translate: 0,
            support: 0
        });
        expect(config.monthlyQuotas).toEqual([20, 50, 100, 250, 1250]);
    });

    it('configures every AI feature', () => {
        // Assert
        expect(Object.keys(config.features).sort()).toEqual([...MIGRATION_FEATURES].sort());
    });

    it('the full plan fits under the hard call cap', () => {
        // Arrange
        const { selected } = selectCases({ config, cases, onlyFeatures: null });

        // Act
        const { calls } = expandMigrationMatrix({ config, cases: selected });

        // Assert
        const variants = config.models.reduce((a, m) => a + m.reasoningEfforts.length, 0);
        expect(calls.length).toBe(selected.length * variants * config.repetitions);
        expect(calls.length).toBeLessThanOrEqual(config.maxCalls);
    });
});

describe('HOS-2217 case selection and matrix', () => {
    it('--features narrows to the listed features', () => {
        // Act
        const { selected } = selectCases({
            config,
            cases,
            onlyFeatures: ['translate', 'faq_draft']
        });

        // Assert
        expect(new Set(selected.map((c) => c.feature))).toEqual(
            new Set(['translate', 'faq_draft'])
        );
    });

    it('--features refuses an unknown or unconfigured feature', () => {
        // Act
        const run = () => selectCases({ config, cases, onlyFeatures: ['translation'] });

        // Assert
        expect(run).toThrow(/not configured: translation/);
    });

    it('caseIds restrict a feature and an unknown id throws', () => {
        // Arrange
        const narrowed: MigrationConfig = {
            ...config,
            features: { support: { monthlyCalls: 1, caseIds: ['support-off-topic'] } }
        };
        const broken: MigrationConfig = {
            ...config,
            features: { support: { monthlyCalls: 1, caseIds: ['nope'] } }
        };

        // Act
        const { selected } = selectCases({ config: narrowed, cases, onlyFeatures: null });

        // Assert
        expect(selected.map((c) => c.id)).toEqual(['support-off-topic']);
        expect(() => selectCases({ config: broken, cases, onlyFeatures: null })).toThrow(/nope/);
    });

    it('a production-fixed cap wins over the config; otherwise the feature override applies', () => {
        // Arrange
        const { selected } = selectCases({
            config,
            cases,
            onlyFeatures: ['faq_draft', 'post_generate', 'translate']
        });

        // Act
        const { calls } = expandMigrationMatrix({ config, cases: selected });
        const capOf = (feature: string) =>
            new Set(calls.filter((c) => c.feature === feature).map((c) => c.maxOutputTokens));

        // Assert
        expect(capOf('faq_draft')).toEqual(new Set([1024]));
        expect(capOf('post_generate')).toEqual(new Set([4096]));
        expect(capOf('translate')).toEqual(new Set([config.maxOutputTokens]));
    });

    it('the model effort travels as the reasoning effort of the provider request', () => {
        // Arrange
        const { selected } = selectCases({ config, cases, onlyFeatures: ['support'] });

        // Act
        const { calls } = expandMigrationMatrix({ config, cases: selected });

        // Assert
        const efforts = new Set(
            calls.map((c) => `${c.model}:${c.request.params?.reasoningEffort}`)
        );
        expect(efforts).toEqual(
            new Set([
                'gpt-5.4-nano:none',
                'gpt-6-luna:none',
                'gpt-6-luna:low',
                'gpt-5.6-luna:none',
                'gpt-5.4-mini:none'
            ])
        );
    });
});

describe('HOS-2217 classifier effort is production-fixed', () => {
    it('every classifier call sends none, whatever the variant effort', () => {
        // Arrange
        const { selected } = selectCases({
            config,
            cases,
            onlyFeatures: ['chat_answer_classifier']
        });

        // Act
        const { calls } = expandMigrationMatrix({ config, cases: selected });

        // Assert
        expect(calls.some((c) => c.effort === 'low')).toBe(true);
        expect(new Set(calls.map((c) => c.request.params?.reasoningEffort))).toEqual(
            new Set(['none'])
        );
    });
});

describe('HOS-2217 dry-run plan', () => {
    it('totals are the sum of the feature rows and the worst case assumes the cap', () => {
        // Arrange
        const { selected } = selectCases({ config, cases, onlyFeatures: ['translate', 'support'] });
        const { calls } = expandMigrationMatrix({ config, cases: selected });

        // Act
        const { rows } = planCalls({ calls, ratesFor });
        const total = rows.at(-1);
        const features = rows.slice(0, -1);

        // Assert
        expect(features.map((r) => r.feature)).toEqual(['translate', 'support']);
        expect(total?.feature).toBe('TOTAL');
        expect(total?.calls).toBe(calls.length);
        expect(total?.outputTokens).toBe(calls.reduce((a, c) => a + c.maxOutputTokens, 0));
        expect(total?.costUsd).toBeCloseTo(
            features.reduce((a, r) => a + r.costUsd, 0),
            10
        );
        expect(total?.costKnown).toBe(true);
    });

    it('marks the cost as a lower bound when a model has no rate', () => {
        // Arrange
        const { selected } = selectCases({ config, cases, onlyFeatures: ['support'] });
        const { calls } = expandMigrationMatrix({ config, cases: selected });

        // Act
        const { rows } = planCalls({ calls, ratesFor: () => null });

        // Assert
        expect(rows.every((r) => !r.costKnown)).toBe(true);
    });
});

describe('HOS-2217 migration report', () => {
    const result = (over: Partial<MigrationResult>): MigrationResult => ({
        variantKey: 'gpt-5.4-nano | none',
        model: 'gpt-5.4-nano',
        effort: 'none',
        feature: 'support',
        caseId: 'support-off-topic',
        repetition: 1,
        maxOutputTokens: 1024,
        text: '',
        finishReason: 'stop',
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        ttftMs: 100,
        latencyMs: 400,
        costUsd: 0.001,
        error: null,
        outcome: {
            checks: { ok: true },
            passRate: 1,
            allPass: true,
            schemaValid: null,
            productionAccepts: null,
            hallucinatedFields: []
        },
        ...over
    });

    it('projects monthly cost per feature and compares each variant with the baseline', () => {
        // Arrange
        const narrowed: MigrationConfig = {
            ...config,
            features: { support: { monthlyCalls: 1000, caseIds: [] } }
        };
        const results = [
            result({}),
            result({ variantKey: 'gpt-6-luna | none', model: 'gpt-6-luna', costUsd: 0.0005 }),
            result({
                variantKey: 'gpt-6-luna | none',
                model: 'gpt-6-luna',
                caseId: 'support-injection',
                costUsd: null,
                error: 'timeout',
                outcome: null
            })
        ];

        // Act
        const { featureRows, overallRows } = aggregateMigration({ results, config: narrowed });
        const { quotas } = aggregateMigration({ results, config: narrowed });
        const md = renderMigrationReport({ featureRows, overallRows, quotas });

        // Assert
        const base = featureRows.find((r) => r.variantKey === 'gpt-5.4-nano | none');
        const cand = featureRows.find((r) => r.variantKey === 'gpt-6-luna | none');
        expect(base?.monthlyCostUsd).toBeCloseTo(1, 6);
        expect(cand?.errorRate).toBe(0.5);
        expect(cand?.effectivePassRate).toBe(0.5);
        expect(overallRows[0]?.variantKey).toBe('gpt-5.4-nano | none');
        expect(
            overallRows.find((r) => r.variantKey === 'gpt-6-luna | none')?.costVsBaseline
        ).toBeCloseTo(0.5, 6);
        expect(md).toContain('## support');
        expect(base?.quotaCostUsd[100]).toBeCloseTo(0.1, 6);
        expect(md).toContain('## Quota projection');
        expect(md).toContain('USD/mo @1250');
    });

    it('re-checking stored results re-scores them with the current checks', () => {
        // Arrange
        const stale = result({
            text: 'La Revolución Francesa empezó en 1789.',
            outcome: {
                checks: {},
                passRate: 1,
                allPass: true,
                schemaValid: null,
                productionAccepts: null,
                hallucinatedFields: []
            }
        });

        // Act
        const { results } = recheckResults({ results: [stale], cases });

        // Assert
        expect(results[0]?.outcome?.allPass).toBe(false);
    });
});
