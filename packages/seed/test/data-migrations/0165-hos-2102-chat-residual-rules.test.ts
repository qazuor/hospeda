/**
 * @fileoverview
 * Unit tests for the `0165-hos-2102-chat-residual-rules` data migration,
 * with a fully mocked `ctx.db` — the same "mock the drizzle chain" style as
 * `0162-hos-2100-chat-group-pet-rules.test.ts`.
 *
 * Contract:
 * 1. **Scope.** Every update filters on the feature AND the exact `rules`
 *    string the previous migration wrote, so an operator-edited row is never overwritten.
 * 2. **Rules only.** Only the `rules` column is written; `content` is untouched.
 * 3. **Idempotency.** Zero matches reports "no change" without throwing.
 * 4. **Data coherence.** The `after` side carries the HOS-2102 clauses and the
 *    `before` side carries the retired Spanish example phrases instead
 *    (guards against swapped halves).
 * 5. **Chain.** `before` is byte-identical to the previous frozen `after`:
 *    0164-hos-2098 for `chat_venue`, 0162-hos-2100 for `chat` and
 *    `chat_experience`.
 * 6. **No drift.** `after` equals `DEFAULT_RULES` read from source for all
 *    three features — a future rules edit without a new migration fails here.
 *
 * @module test/data-migrations/0165-hos-2102-chat-residual-rules
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
import * as migration from '../../src/data-migrations/0165-hos-2102-chat-residual-rules.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-2102-chat-residual-rules-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

type Feature = (typeof migration.CHAT_FEATURES)[number];

interface FrozenBaseline {
    readonly before: { readonly rules: Readonly<Record<Feature, string>> };
    readonly after: { readonly rules: Readonly<Record<Feature, string>> };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const readFrozen = (file: string): FrozenBaseline =>
    JSON.parse(
        readFileSync(path.resolve(HERE, '../../src/data-migrations', file), 'utf-8')
    ) as FrozenBaseline;

const { before, after } = readFrozen('0165-hos-2102-chat-residual-rules.data.json');

/** 0162's frozen snapshot: its `after` is this `before` for `chat` and `chat_experience`. */
const previous = readFrozen('0162-hos-2100-chat-group-pet-rules.data.json');

/** 0164's frozen snapshot: its `chat_venue` `after` is this `before`. */
const venueResolvedWindows = readFrozen('0164-hos-2098-chat-venue-age-resolved-windows.data.json');

/** One anchor per HOS-2102 shared clause. */
const HOS_2102_CLAUSES = [
    "If the visitor's group is larger than the total capacity your context states, your ENTIRE answer is ONE short sentence: say the group does not fit and state the total capacity.",
    'Nothing else, and no second sentence at all: no question to the visitor, no conditional about a smaller or different group ("if you were fewer…")',
    'When your context states that the listing does not inform pets, NEVER write that pets are accepted, allowed or welcome',
    'never say they are not accepted either: say only that the listing does not inform it',
    'Every sentence of your answer must be in that language: the rule examples above and the listing data are Spanish illustrations of WHAT to say, not phrases to copy',
    'written IN THE REPLY LANGUAGE in your own words (never copy a phrase from these rules)',
    'These voseo examples apply ONLY when the answer is written in Spanish: never copy any of them into an answer written in English or Portuguese.'
] as const;

/** Retired Spanish example phrases the rules carried before HOS-2102. */
const RETIRED_PHRASES = [
    'decime las fechas',
    '¡De una!',
    'depende de cómo se repartan y de la disponibilidad: confirmalo con el lugar'
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

describe('0165-hos-2102-chat-residual-rules', () => {
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

    it('AC-4: "after" carries the HOS-2102 clauses; "before" does not', () => {
        for (const feature of migration.CHAT_FEATURES) {
            for (const clause of HOS_2102_CLAUSES) {
                expect(before.rules[feature]).not.toContain(clause);
                expect(after.rules[feature]).toContain(clause);
            }
            // The retired Spanish example phrases are gone from "after" and
            // were still in "before" (proves the halves are not swapped).
            for (const phrase of RETIRED_PHRASES) {
                expect(after.rules[feature]).not.toContain(phrase);
                expect(before.rules[feature]).toContain(phrase);
            }
            // The rest of the shared block is kept from 0162's round.
            expect(after.rules[feature]).toContain('decline in ONE short sentence');
            expect(after.rules[feature]).toContain(
                '"pets accepted" does not say how many or which size'
            );
        }
        // The venue age rules are not this migration's business (HOS-2098).
        const venueClauses = (rules: string) =>
            rules.slice(rules.indexOf('You MUST NOT state that a dish is available right now'));
        expect(venueClauses(after.rules.chat_venue)).toBe(venueClauses(before.rules.chat_venue));
    });

    it('AC-4b: "before" is exactly what the previous migrations wrote (chain without a gap)', () => {
        expect(before.rules.chat_venue).toBe(venueResolvedWindows.after.rules.chat_venue);
        expect(before.rules.chat).toBe(previous.after.rules.chat);
        expect(before.rules.chat_experience).toBe(previous.after.rules.chat_experience);
    });

    it('AC-5: the frozen "after" rules equal DEFAULT_RULES read from source (no drift)', () => {
        expect(after.rules.chat).toBe(DEFAULT_RULES.chat);
        expect(after.rules.chat_venue).toBe(DEFAULT_RULES.chat_venue);
        expect(after.rules.chat_experience).toBe(DEFAULT_RULES.chat_experience);
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0165-hos-2102-chat-residual-rules');
    });
});
