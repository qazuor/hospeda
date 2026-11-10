/**
 * @fileoverview
 * Unit tests for the `0160-hos-2095-chat-answer-quality-rules-2` data migration,
 * with a fully mocked `ctx.db` — the same "mock the drizzle chain" style as
 * `0134-hos1864-chat-venue-neutral-prompt.test.ts`.
 *
 * Contract:
 * 1. **Scope.** Every update filters on the feature AND the exact `rules`
 *    string 0159 wrote, so an operator-edited row is never overwritten.
 * 2. **Rules only.** Only the `rules` column is written; `content` is untouched.
 * 3. **Idempotency.** Zero matches reports "no change" without throwing.
 * 4. **Data coherence.** The `after` side carries the round 2 clauses and the
 *    `before` side does not (guards against swapped halves).
 * 5. **Chain.** `before` is byte-identical to 0159's frozen `after`.
 * 6. **No drift.** `after` equals `DEFAULT_RULES` read from source.
 *
 * @module test/data-migrations/0160-hos-2095-chat-answer-quality-rules-2
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
// Read from SOURCE, never from the built package that `@repo/ai-core` resolves
// to: a stale build would make this sync check compare old strings.
import { DEFAULT_RULES } from '../../../ai-core/src/engine/default-prompts.js';
import * as migration from '../../src/data-migrations/0160-hos-2095-chat-answer-quality-rules-2.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-2095-chat-answer-quality-rules-2-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

type Feature = (typeof migration.CHAT_FEATURES)[number];

interface FrozenBaseline {
    readonly before: { readonly rules: Readonly<Record<Feature, string>> };
    readonly after: { readonly rules: Readonly<Record<Feature, string>> };
}

const DATA_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data-migrations/0160-hos-2095-chat-answer-quality-rules-2.data.json'
);
const { before, after } = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as FrozenBaseline;

/** 0159's frozen snapshot: its `after` is this migration's `before`. */
const previous = JSON.parse(
    readFileSync(
        path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../src/data-migrations/0159-hos-2095-chat-answer-quality-rules.data.json'
        ),
        'utf-8'
    )
) as FrozenBaseline;

/** One anchor per round 2 shared clause. */
const ROUND_2_CLAUSES = [
    'that sentence is the whole reply',
    'A question about this listing is on-topic whatever language it is written in',
    'You MUST NOT ask the visitor for dates, a number of nights or a number of guests',
    'Answer ONLY what the visitor asked',
    'You MUST NOT extend a fact in your context to a quantity',
    "compare the visitor's group with the capacity your context states",
    'say plainly that the listing does not detail it',
    'Only refer the visitor to a section of this page'
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

function buildCtx(rows: readonly unknown[]): { ctx: SeedMigrationCtx; captures: UpdateCapture[] } {
    const captures: UpdateCapture[] = [];
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
        db: { update },
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, captures };
}

const changedFeatures = migration.CHAT_FEATURES.filter((f) => before.rules[f] !== after.rules[f]);

describe('0160-hos-2095-chat-answer-quality-rules-2', () => {
    it('sanity: all three chat features changed their rules', () => {
        expect(changedFeatures).toEqual(['chat', 'chat_venue', 'chat_experience']);
    });

    it('AC-1: scopes each update to the feature AND the exact rules 0159 wrote', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([{ id: 'row-id' }]);

        // Act
        const result = await migration.up(ctx);

        // Assert
        expect(captures).toHaveLength(changedFeatures.length);
        captures.forEach((capture, index) => {
            const feature = changedFeatures[index] as Feature;
            const where = flattenSql(capture.whereArgs[0]);
            expect(where).toContain(feature);
            expect(where).toContain(before.rules[feature]);
            expect(capture.setArgs[0]).toEqual({ rules: after.rules[feature] });
        });
        expect(result.counts).toEqual({ chat: 1, chat_venue: 1, chat_experience: 1 });
    });

    it('AC-2: writes only the rules column', async () => {
        const { ctx, captures } = buildCtx([{ id: 'row-id' }]);
        await migration.up(ctx);
        for (const capture of captures) {
            expect(Object.keys(capture.setArgs[0] as Record<string, unknown>)).toEqual(['rules']);
        }
    });

    it('AC-3: is idempotent — reports no change when nothing matches', async () => {
        const { ctx } = buildCtx([]);
        const result = await migration.up(ctx);
        expect(result.counts).toEqual({ chat: 0, chat_venue: 0, chat_experience: 0 });
        expect(result.summary?.toLowerCase()).toContain('no change');
    });

    it('AC-4: "after" carries the round 2 clauses; "before" does not', () => {
        for (const feature of migration.CHAT_FEATURES) {
            for (const clause of ROUND_2_CLAUSES) {
                expect(before.rules[feature]).not.toContain(clause);
                expect(after.rules[feature]).toContain(clause);
            }
            // Round 1 is kept, not replaced.
            expect(after.rules[feature]).toContain('decline in ONE short sentence');
        }
        expect(before.rules.chat_venue).not.toContain('first decide whether the activity');
        expect(after.rules.chat_venue).toContain('first decide whether the activity');
        expect(after.rules.chat_venue).toContain(
            'You MUST NOT add your own reason for the minimum age'
        );
        expect(after.rules.chat_venue).toContain(
            'unless the listing text explicitly says it applies only to'
        );
    });

    it('AC-4b: "before" is exactly the rules 0159 wrote (chain without a gap)', () => {
        for (const feature of migration.CHAT_FEATURES) {
            expect(before.rules[feature]).toBe(previous.after.rules[feature]);
        }
    });

    it('AC-5: the frozen "after" rules equal DEFAULT_RULES read from source (no drift)', () => {
        for (const feature of migration.CHAT_FEATURES) {
            expect(after.rules[feature]).toBe(DEFAULT_RULES[feature]);
        }
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0160-hos-2095-chat-answer-quality-rules-2');
    });
});
