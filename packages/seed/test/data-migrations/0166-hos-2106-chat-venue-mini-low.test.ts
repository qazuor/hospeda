import { describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
    logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import { up } from '../../src/data-migrations/0166-hos-2106-chat-venue-mini-low.js';
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
    return { ctx, update, updateSet, updateWhere };
}

describe('0166 chat venue model migration', () => {
    it('migrates the production shape with empty params and preserves unrelated fields', async () => {
        const initial = {
            providers: { openai: { enabled: true, credentialConfigured: true } },
            features: {
                chat_venue: { model: 'gpt-5.4-nano', params: {}, enabled: true },
                chat: { model: 'keep', params: { temperature: 0.2 } }
            },
            costCeilings: { monthlyUsd: 12 }
        };
        const { ctx, updateSet } = context(initial);
        const result = await up(ctx);
        const saved = updateSet.mock.calls[0]?.[0]?.value;
        expect(result.counts).toEqual({ updated: 1, skipped: 0 });
        expect(saved).toEqual({
            ...initial,
            features: {
                ...initial.features,
                chat_venue: {
                    model: 'gpt-5.4-mini',
                    params: { reasoningEffort: 'low' },
                    enabled: true
                }
            }
        });
    });

    it('does not change anything on re-run after a successful migration', async () => {
        const migrated = {
            features: {
                chat_venue: { model: 'gpt-5.4-mini', params: { reasoningEffort: 'low' } },
                chat: { model: 'keep' }
            },
            other: true
        };
        const { ctx, update } = context(migrated);
        const result = await up(ctx);
        expect(result.counts).toEqual({ updated: 0, skipped: 1 });
        expect(update).not.toHaveBeenCalled();
        expect(migrated).toEqual({
            features: {
                chat_venue: { model: 'gpt-5.4-mini', params: { reasoningEffort: 'low' } },
                chat: { model: 'keep' }
            },
            other: true
        });
    });

    it('updates only chat_venue and keeps sibling fields', async () => {
        const { ctx, update, updateSet } = context({
            features: {
                chat_venue: { model: 'gpt-5.4-nano', params: { maxTokens: 2048 }, enabled: true },
                chat: { model: 'keep' }
            },
            other: true
        });
        const result = await up(ctx);
        expect(result.counts).toEqual({ updated: 1, skipped: 0 });
        expect(update).toHaveBeenCalledOnce();
        const saved = updateSet.mock.calls[0]?.[0]?.value;
        expect(saved.features.chat_venue).toMatchObject({
            model: 'gpt-5.4-mini',
            params: { maxTokens: 2048, reasoningEffort: 'low' }
        });
        expect(saved.features.chat).toEqual({ model: 'keep' });
        expect(saved.other).toBe(true);
    });

    it('skips an operator-selected model and is idempotent', async () => {
        const { ctx, update } = context({ features: { chat_venue: { model: 'operator-model' } } });
        const result = await up(ctx);
        expect(result.counts).toEqual({ updated: 0, skipped: 1 });
        expect(update).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledOnce();
    });
});
