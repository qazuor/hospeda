/**
 * @fileoverview
 * Unit tests for the `0178-hos-2250-accommodation-import-prompt-keys` data
 * migration, with a mocked `ctx.db` (the 0169 "mock the drizzle chain" style).
 *
 * Contract:
 * 1. **Scope.** The update filters on the feature AND the exact old default
 *    `content`, so an operator-edited row is never overwritten.
 * 2. **Content only.** Only the `content` column is written.
 * 3. **Operator edits are reported.** Rows holding neither default are counted
 *    and logged, never written.
 * 4. **Idempotency.** Zero matches reports "no change" without throwing.
 * 5. **Data coherence.** `before` names the retired keys, `after` does not;
 *    `before` equals 0070's frozen `after` (no gap in the chain); `after`
 *    equals `DEFAULT_PROMPTS` read from SOURCE (a later edit without a new
 *    migration fails here).
 *
 * @module test/data-migrations/0178-hos-2250-accommodation-import-prompt-keys
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
// Read from SOURCE, never from the build `@repo/ai-core` resolves to.
import { DEFAULT_PROMPTS } from '../../../ai-core/src/engine/default-prompts.js';
import * as migration from '../../src/data-migrations/0178-hos-2250-accommodation-import-prompt-keys.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
    logger: { warn: mockWarn, info: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

interface Frozen {
    readonly before: { readonly content: string };
    readonly after: { readonly content: string };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.resolve(HERE, '../../src/data-migrations');
const frozen = JSON.parse(
    readFileSync(
        path.resolve(MIGRATIONS, '0178-hos-2250-accommodation-import-prompt-keys.data.json'),
        'utf-8'
    )
) as Frozen;
const previous = JSON.parse(
    readFileSync(path.resolve(MIGRATIONS, '0070-hos-789-ai-prompt-brand-voice.data.json'), 'utf-8')
) as { after: { prompts: Record<string, string> } };

/** Flattens a drizzle condition tree into one string for shape assertions. */
function flattenSql(node: unknown, depth = 0): string {
    if (node === null || node === undefined || depth > 12) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map((child) => flattenSql(child, depth + 1)).join(' ');
    if (typeof node === 'object') {
        const record = node as Record<string, unknown>;
        const parts: string[] = [];
        for (const key of ['queryChunks', 'value', 'name', 'left', 'right', 'conditions']) {
            if (key in record) parts.push(flattenSql(record[key], depth + 1));
        }
        return parts.join(' ');
    }
    return '';
}

/** Builds a ctx whose update returns `updated` rows and whose select returns `edited` rows. */
function buildCtx(input: { updated: readonly unknown[]; edited: readonly unknown[] }) {
    const capture = { set: [] as unknown[], where: [] as unknown[] };
    const update = vi.fn(() => ({
        set: (arg: unknown) => {
            capture.set.push(arg);
            return {
                where: (cond: unknown) => {
                    capture.where.push(cond);
                    return { returning: vi.fn().mockResolvedValue(input.updated) };
                }
            };
        }
    }));
    const select = vi.fn(() => ({
        from: () => ({ where: vi.fn().mockResolvedValue(input.edited) })
    }));
    const ctx = {
        db: { update, select },
        actor: { id: 'actor', permissions: [] },
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, capture, update };
}

describe('0178-hos-2250-accommodation-import-prompt-keys', () => {
    it('rewrites only rows that still hold the exact old default, content only', async () => {
        // Arrange
        mockWarn.mockClear();
        const { ctx, capture, update } = buildCtx({ updated: [{ id: 'r1' }], edited: [] });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(update).toHaveBeenCalledTimes(1);
        expect(capture.set).toEqual([{ content: frozen.after.content }]);
        const where = flattenSql(capture.where[0]);
        expect(where).toContain('accommodation_import');
        expect(where).toContain(frozen.before.content);
        expect(result.counts).toEqual({ updated: 1, operatorEdited: 0 });
        expect(mockWarn).not.toHaveBeenCalled();
    });

    it('leaves an operator-edited row alone and logs it', async () => {
        // Arrange
        mockWarn.mockClear();
        const { ctx } = buildCtx({ updated: [], edited: [{ id: 'r2', version: 2 }] });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({ updated: 0, operatorEdited: 1 });
        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(String(mockWarn.mock.calls[0]?.[0])).toContain('operator-edited');
    });

    it('is idempotent: nothing matching reports no change', async () => {
        // Arrange
        const { ctx } = buildCtx({ updated: [], edited: [] });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({ updated: 0, operatorEdited: 0 });
        expect(result.summary?.toLowerCase()).toContain('no change');
    });

    it('frozen halves: before names the retired keys, after names the schema keys', () => {
        for (const retired of ['maxGuests', 'pricePerNight', 'amenities (', 'address (']) {
            expect(frozen.before.content).toContain(retired);
            expect(frozen.after.content).not.toContain(retired);
        }
        for (const key of ['capacity (', 'amenityNames (', 'price (', 'streetNumber (']) {
            expect(frozen.after.content).toContain(key);
        }
    });

    it('chain: before is 0070 frozen after, and after is the current source default', () => {
        expect(frozen.before.content).toBe(previous.after.prompts.accommodation_import);
        expect(frozen.after.content).toBe(DEFAULT_PROMPTS.accommodation_import);
    });
});
