/**
 * @fileoverview
 * Unit tests for the `0162-hos-2100-chat-group-pet-rules` data migration,
 * with a fully mocked `ctx.db` — the same "mock the drizzle chain" style as
 * `0134-hos1864-chat-venue-neutral-prompt.test.ts`.
 *
 * Contract:
 * 1. **Scope.** Every update filters on the feature AND the exact `rules`
 *    string the previous migration wrote, so an operator-edited row is never overwritten.
 * 2. **Rules only.** Only the `rules` column is written; `content` is untouched.
 * 3. **Idempotency.** Zero matches reports "no change" without throwing.
 * 4. **Data coherence.** The `after` side carries the HOS-2100 clauses and the
 *    `before` side does not (guards against swapped halves).
 * 5. **Chain.** `before` is byte-identical to the previous frozen `after`:
 *    0161-hos-2098 for `chat_venue`, 0160 for `chat` and `chat_experience`.
 * 6. **No drift.** `after` equals `DEFAULT_RULES` read from source.
 *
 * @module test/data-migrations/0162-hos-2100-chat-group-pet-rules
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
import * as migration from '../../src/data-migrations/0162-hos-2100-chat-group-pet-rules.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-2100-chat-group-pet-rules-test',
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
    '../../src/data-migrations/0162-hos-2100-chat-group-pet-rules.data.json'
);
const { before, after } = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as FrozenBaseline;

/** 0160's frozen snapshot: its `after` is this migration's `before`. */
const previous = JSON.parse(
    readFileSync(
        path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../src/data-migrations/0160-hos-2095-chat-answer-quality-rules-2.data.json'
        ),
        'utf-8'
    )
) as FrozenBaseline;

/** 0161-hos-2098's frozen snapshot: its `chat_venue` `after` is this `before`. */
const venueAgeScope = JSON.parse(
    readFileSync(
        path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../src/data-migrations/0161-hos-2098-chat-venue-age-scope-rules.data.json'
        ),
        'utf-8'
    )
) as { readonly after: { readonly rules: { readonly chat_venue: string } } };

/** One anchor per HOS-2100 shared clause. */
const HOS_2100_CLAUSES = [
    "For a group or capacity question, first compare the visitor's group with the total capacity your context states",
    'If the group is larger than the total capacity, answer only that they do not fit and state the total capacity. Stop there',
    'Only when the group fits within the total capacity: do not answer "yes, you fit"',
    'to confirm it with the place, in the reply language',
    'the split into units, rooms or beds',
    'depende de cómo se repartan y de la disponibilidad: confirmalo con el lugar',
    'Never say the group surely fits ("entran sin problema", "sí, entran")',
    'Use a group size the visitor already gave',
    'never answer "yes" to a number or size of pets'
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

describe('0162-hos-2100-chat-group-pet-rules', () => {
    it('sanity: all three chat features changed their rules', () => {
        expect(changedFeatures).toEqual(['chat', 'chat_venue', 'chat_experience']);
    });

    it('AC-1: scopes each update to the feature AND the exact rules the previous migration wrote', async () => {
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

    it('AC-4: "after" carries the HOS-2100 clauses; "before" does not', () => {
        for (const feature of migration.CHAT_FEATURES) {
            for (const clause of HOS_2100_CLAUSES) {
                expect(before.rules[feature]).not.toContain(clause);
                expect(after.rules[feature]).toContain(clause);
            }
            // The replaced clauses are gone, the rest of round 2 is kept.
            expect(after.rules[feature]).not.toContain('state the capacity and stop');
            expect(after.rules[feature]).not.toContain('"pet-friendly" does not say how many pets');
            expect(after.rules[feature]).toContain('decline in ONE short sentence');
        }
        // The venue age rules are not this migration's business (HOS-2098).
        const ageClauses = (rules: string) =>
            rules.slice(
                rules.indexOf('You MUST NOT state or imply that anyone below the minimum age')
            );
        expect(ageClauses(after.rules.chat_venue)).toBe(ageClauses(before.rules.chat_venue));
    });

    it('AC-4b: "before" is exactly what the previous migrations wrote (chain without a gap)', () => {
        expect(before.rules.chat_venue).toBe(venueAgeScope.after.rules.chat_venue);
        expect(before.rules.chat).toBe(previous.after.rules.chat);
        expect(before.rules.chat_experience).toBe(previous.after.rules.chat_experience);
    });

    it('AC-5: the frozen "after" rules equal DEFAULT_RULES read from source (no drift)', () => {
        for (const feature of migration.CHAT_FEATURES) {
            expect(after.rules[feature]).toBe(DEFAULT_RULES[feature]);
        }
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0162-hos-2100-chat-group-pet-rules');
    });
});
