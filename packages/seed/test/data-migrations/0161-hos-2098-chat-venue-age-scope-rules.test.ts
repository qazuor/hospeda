/**
 * @fileoverview
 * Unit tests for the `0161-hos-2098-chat-venue-age-scope-rules` data migration,
 * with a fully mocked `ctx.db` — the same "mock the drizzle chain" style as
 * `0160-hos-2095-chat-answer-quality-rules-2.test.ts`.
 *
 * Contract:
 * 1. **Scope.** The update filters on `chat_venue` AND the exact `rules`
 *    string 0160 wrote, so an operator-edited row is never overwritten.
 * 2. **Rules only.** Only the `rules` column is written.
 * 3. **Idempotency.** Zero matches reports "no change" without throwing.
 * 4. **Data coherence.** `after` reads the structured scope line; `before`
 *    still narrowed the age from the listing text (guards swapped halves).
 * 5. **Chain.** `before` is byte-identical to 0160's frozen `chat_venue` `after`.
 * 6. **No drift.** `after` equals `DEFAULT_RULES.chat_venue` read from source.
 * 7. **Legal floor.** Every clause that protects the legal notice survives.
 *
 * @module test/data-migrations/0161-hos-2098-chat-venue-age-scope-rules
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';

const { warnSpy } = vi.hoisted(() => ({ warnSpy: vi.fn() }));
vi.mock('../../src/utils/logger.js', () => ({
    logger: { warn: warnSpy, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Read from SOURCE, never from the built package that `@repo/ai-core` resolves
// to: a stale build would make this sync check compare old strings.
import { DEFAULT_RULES } from '../../../ai-core/src/engine/default-prompts.js';
import * as migration from '../../src/data-migrations/0161-hos-2098-chat-venue-age-scope-rules.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-2098-chat-venue-age-scope-rules-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

interface FrozenBaseline {
    readonly before: { readonly rules: { readonly chat_venue: string } };
    readonly after: { readonly rules: { readonly chat_venue: string } };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readFrozen = (file: string): FrozenBaseline =>
    JSON.parse(
        readFileSync(path.resolve(HERE, '../../src/data-migrations', file), 'utf-8')
    ) as FrozenBaseline;

const { before, after } = readFrozen('0161-hos-2098-chat-venue-age-scope-rules.data.json');
const previous = readFrozen('0160-hos-2095-chat-answer-quality-rules-2.data.json');

/** Clauses that keep the legal notice and the age boundary intact (DEC-FAC-053). */
const LEGAL_FLOOR = [
    'You MUST NOT suggest any way to get around that minimum age',
    'your answer MUST start with an explicit "no"',
    'give the minimum age and the legal notice exactly as your context states them: repeat both verbatim, without paraphrasing or softening them',
    'If your context does not state a minimum age, you MUST NOT infer that minors may enter',
    'You MUST NOT state that alcoholic beverages are sold or served to anyone under 18.'
] as const;

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

interface UpdateCapture {
    readonly setArgs: unknown[];
    readonly whereArgs: unknown[];
}

function buildCtx(
    rows: readonly unknown[],
    editedRows: readonly { id: string }[] = []
): { ctx: SeedMigrationCtx; captures: UpdateCapture[]; selectWhere: unknown[] } {
    const captures: UpdateCapture[] = [];
    const selectWhere: unknown[] = [];
    const select = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation((arg: unknown) => {
                selectWhere.push(arg);
                return Promise.resolve(editedRows);
            })
        }))
    }));
    const update = vi.fn().mockImplementation(() => {
        const capture: UpdateCapture = { setArgs: [], whereArgs: [] };
        captures.push(capture);
        const returning = vi.fn().mockResolvedValue(rows);
        const where = vi.fn().mockImplementation((arg: unknown) => {
            capture.whereArgs.push(arg);
            return { returning };
        });
        const set = vi.fn().mockImplementation((arg: unknown) => {
            capture.setArgs.push(arg);
            return { where };
        });
        return { set };
    });
    const ctx = {
        db: { update, select },
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, captures, selectWhere };
}

describe('0161-hos-2098-chat-venue-age-scope-rules', () => {
    it('AC-1: scopes the update to chat_venue AND the exact rules 0160 wrote', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([{ id: 'row-id' }]);

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(captures).toHaveLength(1);
        const where = flattenSql(captures[0]?.whereArgs[0]);
        expect(where).toContain('chat_venue');
        expect(where).toContain(before.rules.chat_venue);
        expect(captures[0]?.setArgs[0]).toEqual({ rules: after.rules.chat_venue });
        expect(result.counts).toEqual({ chat_venue: 1, chat_venue_operator_edited: 0 });
    });

    it('AC-2: writes only the rules column', async () => {
        const { ctx, captures } = buildCtx([{ id: 'row-id' }]);
        await migration.up(ctx);
        expect(Object.keys(captures[0]?.setArgs[0] as Record<string, unknown>)).toEqual(['rules']);
    });

    it('AC-3: is idempotent — reports no change when nothing matches', async () => {
        const { ctx } = buildCtx([]);
        const result = await migration.up(ctx);
        expect(result.counts).toEqual({ chat_venue: 0, chat_venue_operator_edited: 0 });
        expect(result.summary?.toLowerCase()).toContain('no change');
    });

    it('AC-3b: warns, per prompt-version id, about each operator-edited row it skipped', async () => {
        // Arrange
        warnSpy.mockClear();
        const { ctx, selectWhere } = buildCtx([], [{ id: 'pv-edited-1' }, { id: 'pv-edited-2' }]);

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(result.counts).toEqual({ chat_venue: 0, chat_venue_operator_edited: 2 });
        const where = flattenSql(selectWhere[0]);
        expect(where).toContain('chat_venue');
        expect(where).toContain(after.rules.chat_venue);
        expect(warnSpy).toHaveBeenCalledTimes(2);
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain('pv-edited-1');
        expect(String(warnSpy.mock.calls[1]?.[0])).toContain('pv-edited-2');
        expect(String(warnSpy.mock.calls[0]?.[0])).toContain('operator-edited');
    });

    it('AC-3c: an already-applied run warns about nothing', async () => {
        warnSpy.mockClear();
        const { ctx } = buildCtx([]);
        await migration.up(ctx);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('AC-4: "after" narrows the age only from the scope line; "before" read the listing text', () => {
        expect(before.rules.chat_venue).toContain('listing text explicitly');
        expect(after.rules.chat_venue).not.toContain('listing text explicitly');
        expect(before.rules.chat_venue).not.toContain('Alcance de la edad mínima');
        expect(after.rules.chat_venue).toContain(
            'using ONLY the "Alcance de la edad mínima" line of your context'
        );
    });

    it('AC-4b: "before" is exactly the chat_venue rules 0160 wrote (chain without a gap)', () => {
        expect(before.rules.chat_venue).toBe(previous.after.rules.chat_venue);
    });

    it('AC-5: the frozen "after" rules equal DEFAULT_RULES.chat_venue read from source', () => {
        expect(after.rules.chat_venue).toBe(DEFAULT_RULES.chat_venue);
    });

    it.each(LEGAL_FLOOR)('AC-6: keeps the legal-floor clause on both sides: %s', (clause) => {
        expect(before.rules.chat_venue).toContain(clause);
        expect(after.rules.chat_venue).toContain(clause);
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0161-hos-2098-chat-venue-age-scope-rules');
    });
});
