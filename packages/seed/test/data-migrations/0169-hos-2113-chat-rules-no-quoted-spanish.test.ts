/**
 * @fileoverview
 * Unit tests for the `0169-hos-2113-chat-rules-no-quoted-spanish` data migration,
 * with a fully mocked `ctx.db` — the same "mock the drizzle chain" style as
 * `0165-hos-2102-chat-residual-rules.test.ts`.
 *
 * Contract:
 * 1. **Scope.** Every update filters on the feature AND the exact `rules`
 *    string the previous migration wrote, so an operator-edited row is never overwritten.
 * 2. **Rules only.** Only the `rules` column is written; `content` is untouched.
 * 3. **Idempotency.** Zero matches reports "no change" without throwing.
 * 4. **Data coherence.** The `after` side carries the HOS-2113 clauses and the
 *    `before` side carries the retired Spanish example phrases instead
 *    (guards against swapped halves).
 * 5. **Chain.** `before` is byte-identical to the previous frozen `after`:
 *    0165-hos-2102 for all three chat features.
 * 6. **No drift.** `after` equals `DEFAULT_RULES` read from source for all
 *    three features — a future rules edit without a new migration fails here.
 *
 * @module test/data-migrations/0169-hos-2113-chat-rules-no-quoted-spanish
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
import * as migration from '../../src/data-migrations/0169-hos-2113-chat-rules-no-quoted-spanish.js';
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

const { before, after } = readFrozen('0169-hos-2113-chat-rules-no-quoted-spanish.data.json');

/** 0165's frozen snapshot: its `after` is this migration's predecessor for all features. */
const previous = readFrozen('0165-hos-2102-chat-residual-rules.data.json');

/** One anchor per HOS-2113 shared clause. */
const HOS_2113_CLAUSES = [
    'no suggestion to divide the group or seek another option or place, nothing about availability or distribution',
    'never close an over-capacity answer with the confirmation phrase used for groups that fit, and never suggest',
    'When your context states that the listing does not inform pets, NEVER use any verb or adjective meaning acceptance, permission or welcome next to pets or animals, in any language',
    'never say they are rejected either: say only that the listing does not inform it',
    'never leave any Spanish word in the reply, even a lone yes/no response or article.',
    'and do not begin with an affirmative or enthusiastic opener.',
    'Spanish output MUST use the rioplatense voseo register: "imaginate" / "vení" / "dejate" / "elegí" / "descubrí"; never use tuteo imperatives.',
    'Never address the reader with tuteo pronouns or with any vosotros form.'
] as const;

/** Retired Spanish example phrases the rules carried before HOS-2113. */
const RETIRED_PHRASES = [
    'such as "Claro" or "Sure"',
    'not even a lone word such as "sí"',
    '"la capacidad" instead of',
    'do not use the words "acepta", "aceptan", "admite", "admiten"',
    '"aceita(m)" next to "animais"',
    '"repartirse", "otra opción"',
    '"depende…" style closings included',
    'NEVER "imagina" / "ven" / "déjate" / "elige" / "descubre"',
    '"tú", "ti", "contigo"'
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

describe('0169-hos-2113-chat-rules-no-quoted-spanish', () => {
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

    it('AC-4: "after" carries the HOS-2113 clauses; "before" does not', () => {
        for (const feature of migration.CHAT_FEATURES) {
            for (const clause of HOS_2113_CLAUSES) {
                expect(before.rules[feature]).not.toContain(clause);
                expect(after.rules[feature]).toContain(clause);
            }
            // The retired Spanish example phrases are gone from "after" and
            // were still in "before" (proves the halves are not swapped).
            for (const phrase of RETIRED_PHRASES) {
                expect(after.rules[feature]).not.toContain(phrase);
                expect(before.rules[feature]).toContain(phrase);
            }
            // Unrelated shared guardrails remain intact.
            expect(after.rules[feature]).toContain('decline in ONE short sentence');
            expect(after.rules[feature]).toContain(
                '"pets accepted" does not say how many or which size'
            );
        }
        expect(before.rules.chat_venue).toContain('never "Para", "Según", "No" or the venue name');
        expect(before.rules.chat_venue).toContain('"podés ir", "no hay problema"');
        expect(after.rules.chat_venue).not.toContain(
            'never "Para", "Según", "No" or the venue name'
        );
        expect(after.rules.chat_venue).not.toContain('"podés ir", "no hay problema"');
        expect(after.rules.chat_venue).toContain(
            'never begin with a preposition, a source-attribution word'
        );
    });

    it('AC-4b: "before" is exactly what the previous migrations wrote (chain without a gap)', () => {
        for (const feature of migration.CHAT_FEATURES) {
            expect(before.rules[feature]).toBe(previous.after.rules[feature]);
        }
    });

    it('AC-5: the frozen "after" rules equal DEFAULT_RULES read from source (no drift)', () => {
        expect(after.rules.chat).toBe(DEFAULT_RULES.chat);
        expect(after.rules.chat_venue).toBe(DEFAULT_RULES.chat_venue);
        expect(after.rules.chat_experience).toBe(DEFAULT_RULES.chat_experience);
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.name).toBe('0169-hos-2113-chat-rules-no-quoted-spanish');
    });
});
