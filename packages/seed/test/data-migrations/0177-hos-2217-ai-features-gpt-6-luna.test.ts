import { describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
    logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    LUNA_EFFORT_BY_FEATURE,
    LUNA_MODEL_RATES,
    up
} from '../../src/data-migrations/0177-hos-2217-ai-features-gpt-6-luna.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

function context(value: unknown) {
    const updateSet = vi.fn();
    const updateWhere = vi.fn();
    const update = vi.fn(() => ({
        set: updateSet.mockImplementation(() => ({ where: updateWhere }))
    }));
    const ctx = {
        db: {
            select: () => ({
                from: () => ({
                    where: () => ({ limit: async () => (value === null ? [] : [{ value }]) })
                })
            }),
            update
        }
    } as unknown as SeedMigrationCtx;
    return { ctx, update, updateSet };
}

const feature = (model: string, params: Record<string, unknown> = {}) => ({
    enabled: true,
    primaryProvider: 'openai',
    fallbackChain: [],
    model,
    params
});

/** The production shape before the migration: nano everywhere, mini on venue and faq. */
function productionBlob() {
    return {
        providers: { openai: { enabled: true, credentialConfigured: true } },
        features: {
            chat: feature('gpt-5.4-nano'),
            chat_venue: feature('gpt-5.4-mini', { reasoningEffort: 'low' }),
            chat_experience: feature('gpt-5.4-nano'),
            search: feature('gpt-5.4-nano'),
            translate: feature('gpt-5.4-nano', { temperature: 0.2 }),
            post_generate: feature('gpt-5.4-nano'),
            text_improve: feature('gpt-5.4-nano'),
            accommodation_import: feature('gpt-5.4-nano'),
            faq_draft: feature('gpt-5.4-mini'),
            support: feature('gpt-5.4-nano')
        },
        modelRates: {
            'gpt-5.4-nano': {
                inputMicroUsdPerMillionTokens: 200_000,
                outputMicroUsdPerMillionTokens: 1_250_000
            }
        },
        costCeilings: { globalMonthlyMicroUsd: 100_000_000 }
    };
}

describe('0177 AI features to gpt-6-luna', () => {
    it('moves every previous-default feature to luna with its sweep effort and keeps other fields', async () => {
        // Arrange
        const initial = productionBlob();
        const { ctx, updateSet } = context(initial);

        // Act
        const result = await up(ctx);

        // Assert
        const saved = updateSet.mock.calls[0]?.[0]?.value;
        expect(result.counts).toEqual({
            updated: 10,
            alreadyLuna: 0,
            operatorEdited: 0,
            ratesAdded: 2
        });
        for (const [name, effort] of Object.entries(LUNA_EFFORT_BY_FEATURE)) {
            expect(saved.features[name].model).toBe('gpt-6-luna');
            expect(saved.features[name].params.reasoningEffort).toBe(effort);
            expect(saved.features[name].primaryProvider).toBe('openai');
        }
        expect(saved.features.chat_venue.params).toEqual({ reasoningEffort: 'none' });
        expect(saved.features.translate.params).toEqual({
            temperature: 0.2,
            reasoningEffort: 'none'
        });
        expect(saved.features.text_improve.params).toEqual({ reasoningEffort: 'low' });
        expect(saved.modelRates).toEqual({ ...initial.modelRates, ...LUNA_MODEL_RATES });
        expect(saved.providers).toEqual(initial.providers);
        expect(saved.costCeilings).toEqual(initial.costCeilings);
    });

    it('is a no-op when the values were already set to luna by hand', async () => {
        // Arrange
        const handSet = productionBlob();
        for (const [name, effort] of Object.entries(LUNA_EFFORT_BY_FEATURE)) {
            (handSet.features as Record<string, unknown>)[name] = feature('gpt-6-luna', {
                reasoningEffort: effort
            });
        }
        const withRates = {
            ...handSet,
            modelRates: { ...handSet.modelRates, ...LUNA_MODEL_RATES }
        };
        const { ctx, update } = context(withRates);

        // Act
        const result = await up(ctx);

        // Assert
        expect(result.counts).toEqual({
            updated: 0,
            alreadyLuna: 10,
            operatorEdited: 0,
            ratesAdded: 0
        });
        expect(update).not.toHaveBeenCalled();
    });

    it('re-running after a successful migration changes nothing', async () => {
        // Arrange
        const first = context(productionBlob());
        await up(first.ctx);
        const migrated = first.updateSet.mock.calls[0]?.[0]?.value;
        const second = context(migrated);

        // Act
        const result = await up(second.ctx);

        // Assert
        expect(result.counts?.updated).toBe(0);
        expect(second.update).not.toHaveBeenCalled();
    });

    it('keeps an operator-edited model and an operator rate, with a warning', async () => {
        // Arrange
        const blob = productionBlob();
        blob.features.chat = feature('gpt-4o-mini', { temperature: 0.1 });
        const operatorRate = {
            inputMicroUsdPerMillionTokens: 1,
            outputMicroUsdPerMillionTokens: 2
        };
        const withRate = {
            ...blob,
            modelRates: { ...blob.modelRates, 'gpt-6-luna': operatorRate }
        };
        const { ctx, updateSet } = context(withRate);
        warn.mockClear();

        // Act
        const result = await up(ctx);

        // Assert
        const saved = updateSet.mock.calls[0]?.[0]?.value;
        expect(saved.features.chat).toEqual(feature('gpt-4o-mini', { temperature: 0.1 }));
        expect(saved.modelRates['gpt-6-luna']).toEqual(operatorRate);
        expect(saved.modelRates['gpt-5.6-luna']).toEqual(LUNA_MODEL_RATES['gpt-5.6-luna']);
        expect(result.counts).toEqual({
            updated: 9,
            alreadyLuna: 0,
            operatorEdited: 1,
            ratesAdded: 1
        });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('chat'));
    });

    it('skips without a settings row and ignores features that are not configured', async () => {
        // Arrange
        const missing = context(null);
        const partial = context({ features: { search: feature('gpt-5.4-nano') } });

        // Act
        const none = await up(missing.ctx);
        const some = await up(partial.ctx);

        // Assert
        expect(none.counts?.updated).toBe(0);
        expect(missing.update).not.toHaveBeenCalled();
        expect(some.counts?.updated).toBe(1);
        expect(Object.keys(partial.updateSet.mock.calls[0]?.[0]?.value.features)).toEqual([
            'search'
        ]);
    });
});
