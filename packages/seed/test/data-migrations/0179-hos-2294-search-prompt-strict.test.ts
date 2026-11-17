/**
 * @fileoverview
 * Unit tests for the `0179-hos-2294-search-prompt-strict` data migration, with a
 * mocked `ctx.db` (the 0178 "mock the drizzle chain" style).
 *
 * Contract:
 * 1. **Scope.** `content` is rewritten only where it still equals a known old
 *    default (the staging-HEAD text or the measured production v3 text);
 *    `rules` only where it still equals the old rules.
 * 2. **Operator edits are reported**, never written.
 * 3. **Idempotency.** Zero matches reports "no change".
 * 4. **Data coherence.** `after` equals the current source defaults (a later edit
 *    without a new migration fails here) and carries the strict-mode wording;
 *    `before` carries the retired "omit" wording.
 *
 * @module test/data-migrations/0179-hos-2294-search-prompt-strict
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
// Read from SOURCE, never from the build `@repo/ai-core` resolves to.
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../../../ai-core/src/engine/default-prompts.js';
import * as migration from '../../src/data-migrations/0179-hos-2294-search-prompt-strict.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
    logger: { warn: mockWarn, info: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

interface Frozen {
    readonly before: { readonly contents: readonly string[]; readonly rules: string };
    readonly after: { readonly content: string; readonly rules: string };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const frozen = JSON.parse(
    readFileSync(
        path.resolve(
            HERE,
            '../../src/data-migrations/0179-hos-2294-search-prompt-strict.data.json'
        ),
        'utf-8'
    )
) as Frozen;

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

/** Builds a ctx whose two updates (content, then rules) return the given rows. */
function buildCtx(input: {
    contentRows: readonly unknown[];
    rulesRows: readonly unknown[];
    edited: readonly unknown[];
}) {
    const capture = { set: [] as unknown[], where: [] as unknown[] };
    const returns = [input.contentRows, input.rulesRows];
    const update = vi.fn(() => ({
        set: (arg: unknown) => {
            capture.set.push(arg);
            return {
                where: (cond: unknown) => {
                    capture.where.push(cond);
                    return { returning: vi.fn().mockResolvedValue(returns.shift() ?? []) };
                }
            };
        }
    }));
    const select = vi.fn(() => ({
        from: () => ({
            where: (cond: unknown) => {
                capture.where.push(cond);
                return Promise.resolve(input.edited);
            }
        })
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

describe('0179-hos-2294-search-prompt-strict', () => {
    it('rewrites content and rules only where they still hold a known old value', async () => {
        // Arrange
        mockWarn.mockClear();
        const { ctx, capture, update } = buildCtx({
            contentRows: [{ id: 'r1' }],
            rulesRows: [{ id: 'r1' }, { id: 'r2' }],
            edited: []
        });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(update).toHaveBeenCalledTimes(2);
        expect(capture.set).toEqual([
            { content: frozen.after.content },
            { rules: frozen.after.rules }
        ]);
        const contentWhere = flattenSql(capture.where[0]);
        expect(contentWhere).toContain('search');
        for (const old of frozen.before.contents) expect(contentWhere).toContain(old);
        expect(flattenSql(capture.where[1])).toContain(frozen.before.rules);
        expect(result.counts).toEqual({ contentUpdated: 1, rulesUpdated: 2, operatorEdited: 0 });
        expect(mockWarn).not.toHaveBeenCalled();
    });

    it('leaves an operator-edited active row alone and logs it', async () => {
        // Arrange
        mockWarn.mockClear();
        const { ctx } = buildCtx({
            contentRows: [],
            rulesRows: [],
            edited: [{ id: 'r3', version: 4 }]
        });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({ contentUpdated: 0, rulesUpdated: 0, operatorEdited: 1 });
        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(String(mockWarn.mock.calls[0]?.[0])).toContain('operator-edited');
    });

    it('is idempotent: nothing matching reports no change', async () => {
        // Arrange
        const { ctx } = buildCtx({ contentRows: [], rulesRows: [], edited: [] });

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.summary?.toLowerCase()).toContain('no change');
    });

    it('frozen halves: before says omit, after says null and lists the new slots', () => {
        // Assert
        expect(frozen.before.contents).toHaveLength(2);
        for (const old of frozen.before.contents) {
            expect(old).toContain('optional sub-fields only');
            expect(old).not.toContain('attractionSlugs');
        }
        expect(frozen.before.rules).toContain('Omit the rest entirely');
        expect(frozen.after.content).toContain('Set a sub-field to null');
        for (const key of ['expandToNearby', 'attractionSlugs', 'poiSlugs', 'isNewSearch']) {
            expect(frozen.after.content).toContain(key);
        }
        expect(frozen.after.rules).toContain('Set every other field to null');
    });

    it('chain: after is the current source default', () => {
        // Assert
        expect(frozen.after.content).toBe(DEFAULT_PROMPTS.search);
        expect(frozen.after.rules).toBe(DEFAULT_RULES.search);
    });
});
