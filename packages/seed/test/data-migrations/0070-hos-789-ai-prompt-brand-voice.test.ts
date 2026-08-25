/**
 * @fileoverview
 * Unit tests for the `0070-hos-789-ai-prompt-brand-voice` data migration,
 * using a fully mocked `ctx.db` (no real database connection) — the same
 * "mock the drizzle chain" style as
 * `0035-hos-374-approve-existing-posts-events.test.ts` and
 * `0030-clear-placeholder-blog-media.test.ts`.
 *
 * The contract these tests protect:
 *
 * 1. **Scope.** Each `content`/`rules` update must filter on the exact
 *    pre-HOS-789 value, not just `feature`. Dropping that condition would
 *    let the migration overwrite a prompt an admin already edited from the
 *    panel — exactly the failure mode `aiPrompts.seed.ts`'s
 *    `ON CONFLICT DO NOTHING` exists to prevent on the seed side.
 * 2. **Column independence.** `content` and `rules` are two SEPARATE update
 *    queries, each with its own predicate. A row may carry an
 *    operator-edited `content` next to a still-default `rules` — coupling
 *    the two into one write (or one combined predicate) would silently
 *    skip the guardrail update on any row whose prose was ever touched.
 * 3. **Idempotency.** A second run — or a run against an already-edited
 *    database — matches zero rows on every update and must report "no
 *    change" without throwing.
 * 4. **Data coherence.** The colocated `.data.json` really has the HOS-789
 *    voseo rewrite on the `after` side and NOT on the `before` side. This
 *    guards against the two halves being swapped or regenerated backwards.
 *
 * @module test/data-migrations/0070-hos-789-ai-prompt-brand-voice
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiFeature } from '@repo/schemas';
import { AiFeatureSchema, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as brandVoice from '../../src/data-migrations/0070-hos-789-ai-prompt-brand-voice.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-789-ai-prompt-brand-voice-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** One side of the frozen snapshot: every feature's `content` and `rules`. */
interface PromptSnapshot {
    readonly prompts: Record<string, string>;
    readonly rules: Record<string, string>;
}

/** Shape of the colocated frozen payload the migration reads. */
interface FrozenBaseline {
    readonly before: PromptSnapshot;
    readonly after: PromptSnapshot;
}

/** Same colocated file the migration itself reads. Loaded here as ground
 *  truth so this test never hardcodes (or drifts from) the long prompt
 *  strings — it derives its expectations from the exact same source. */
const DATA_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data-migrations/0070-hos-789-ai-prompt-brand-voice.data.json'
);

function loadFrozenBaseline(): FrozenBaseline {
    return JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as FrozenBaseline;
}

const { before, after } = loadFrozenBaseline();

/**
 * A drizzle condition tree interleaves literal SQL text with interpolated
 * values. Flattening it to a single string lets the tests assert on the
 * shape of the WHERE clause (which columns and which literal values it
 * references) without depending on drizzle's internal node layout.
 */
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

/**
 * Builds a mocked `ctx.db` whose `.update().set().where().returning()` chain
 * resolves to `rowsPerCall(callIndex)` (call-index based, so idempotent and
 * "row exists" scenarios can be configured independently), while recording
 * every `set`/`where` argument in call order.
 */
function buildDbMock(rowsPerCall: (callIndex: number) => readonly unknown[]): {
    db: SeedMigrationCtx['db'];
    captures: UpdateCapture[];
} {
    const captures: UpdateCapture[] = [];
    let callIndex = 0;

    const update = vi.fn().mockImplementation(() => {
        const capture: UpdateCapture = { setArgs: [], whereArgs: [] };
        captures.push(capture);
        const rows = rowsPerCall(callIndex);
        callIndex += 1;

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

    return { db: { update } as unknown as SeedMigrationCtx['db'], captures };
}

function buildCtx(rowsPerCall: (callIndex: number) => readonly unknown[]): {
    ctx: SeedMigrationCtx;
    captures: UpdateCapture[];
} {
    const { db, captures } = buildDbMock(rowsPerCall);
    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, captures };
}

/** One (feature, column) pair the migration is expected to issue an update
 *  for, given the current frozen snapshot. */
interface ExpectedCall {
    readonly feature: AiFeature;
    readonly column: 'content' | 'rules';
    readonly oldValue: string;
    readonly newValue: string;
}

/**
 * Derives, from the same frozen snapshot the migration reads, exactly which
 * (feature, column) updates `up()` is expected to issue and in what order —
 * mirroring `up()`'s own loop (features in `AiFeatureSchema.options` order,
 * `content` before `rules` within a feature). Never hardcoded: if the
 * colocated `.data.json` changes which features actually differ, this
 * recomputes instead of silently going stale.
 */
function computeExpectedCalls(): ExpectedCall[] {
    const calls: ExpectedCall[] = [];
    for (const feature of AiFeatureSchema.options as readonly AiFeature[]) {
        const oldContent = before.prompts[feature];
        const newContent = after.prompts[feature];
        const oldRules = before.rules[feature];
        const newRules = after.rules[feature];

        if (oldContent === undefined || newContent === undefined) continue;
        if (oldRules === undefined || newRules === undefined) continue;

        if (oldContent !== newContent) {
            calls.push({ feature, column: 'content', oldValue: oldContent, newValue: newContent });
        }
        if (oldRules !== newRules) {
            calls.push({ feature, column: 'rules', oldValue: oldRules, newValue: newRules });
        }
    }
    return calls;
}

describe('0070-hos-789-ai-prompt-brand-voice', () => {
    const expectedCalls = computeExpectedCalls();

    it('sanity: the frozen snapshot has at least one changed column (guards the rest of this suite against a no-op fixture)', () => {
        expect(expectedCalls.length).toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------------
    // AC-1: scope — each update filters on the exact old value, not just
    // `feature`. This is what stops the migration from overwriting a prompt
    // an admin has already edited from the panel.
    // -----------------------------------------------------------------------

    it('AC-1: scopes every update to rows that still hold the exact pre-HOS-789 value', async () => {
        // Arrange
        const { ctx, captures } = buildCtx(() => [{ id: 'row-id' }]);

        // Act
        await brandVoice.up(ctx);

        // Assert — one query per expected (feature, column) pair, each WHERE
        // referencing both the feature AND the exact frozen old value.
        expect(captures).toHaveLength(expectedCalls.length);
        captures.forEach((capture, index) => {
            const expected = expectedCalls[index] as ExpectedCall;
            const where = flattenSql(capture.whereArgs[0]);
            expect(where).toContain(expected.feature);
            expect(where).toContain(expected.oldValue);
            // The scope must not be satisfied by the feature alone: a WHERE
            // that dropped the value condition would still contain the
            // feature name, so the value check above is the load-bearing one.
        });
    });

    // -----------------------------------------------------------------------
    // AC-2: column independence — content and rules are two separate
    // queries with two separate predicates, never a combined write.
    // -----------------------------------------------------------------------

    it('AC-2: writes content and rules as independent queries, each scoped to its own column only', async () => {
        // Arrange
        const { ctx, captures } = buildCtx(() => [{ id: 'row-id' }]);

        // Act
        await brandVoice.up(ctx);

        // Assert — every single `set` touches exactly one of the two
        // columns. A `set` carrying both keys (a combined write) or a test
        // that only counted total updates would not catch that coupling.
        for (const capture of captures) {
            const setArg = capture.setArgs[0] as Record<string, unknown>;
            const keys = Object.keys(setArg);
            expect(keys).toHaveLength(1);
            expect(['content', 'rules']).toContain(keys[0]);
        }

        const contentCaptures = captures.filter(
            (c) => 'content' in (c.setArgs[0] as Record<string, unknown>)
        );
        const rulesCaptures = captures.filter(
            (c) => 'rules' in (c.setArgs[0] as Record<string, unknown>)
        );
        expect(contentCaptures.length).toBe(
            expectedCalls.filter((c) => c.column === 'content').length
        );
        expect(rulesCaptures.length).toBe(expectedCalls.filter((c) => c.column === 'rules').length);

        // And each column's WHERE only ever references its own column, never
        // reaching into the sibling column's predicate.
        for (const capture of contentCaptures) {
            const where = flattenSql(capture.whereArgs[0]);
            expect(where).toContain('content');
            expect(where).not.toContain('rules');
        }
        for (const capture of rulesCaptures) {
            const where = flattenSql(capture.whereArgs[0]);
            expect(where).toContain('rules');
        }
    });

    // -----------------------------------------------------------------------
    // AC-3: idempotency — zero matching rows (already migrated, or every
    // row operator-edited) reports "no change" and does not throw.
    // -----------------------------------------------------------------------

    it('AC-3: is idempotent — reports no changes and does not throw when nothing matches', async () => {
        // Arrange: every update() call resolves to zero affected rows.
        const { ctx, captures } = buildCtx(() => []);

        // Act
        const result = await brandVoice.up(ctx);

        // Assert — the migration still issued its full set of scoped
        // queries (it doesn't skip work speculatively), but nothing matched.
        expect(captures).toHaveLength(expectedCalls.length);
        expect(result.counts.contentUpdated).toBe(0);
        expect(result.counts.rulesUpdated).toBe(0);
        expect(result.summary.toLowerCase()).toContain('no change');
    });

    // -----------------------------------------------------------------------
    // AC-4: data coherence — `after` carries the HOS-789 voseo rewrite,
    // `before` does not. Catches a swapped or misregenerated `.data.json`.
    // -----------------------------------------------------------------------

    it('AC-4: the frozen "after" snapshot carries the HOS-789 voseo rewrite and "before" does not', () => {
        // Arrange
        const beforeText = [...Object.values(before.prompts), ...Object.values(before.rules)]
            .join('\n')
            .toLowerCase();
        const afterText = [...Object.values(after.prompts), ...Object.values(after.rules)]
            .join('\n')
            .toLowerCase();

        // Act / Assert — anchored on a single inevitable token from the
        // HOS-789 register fix, not the full sentence, so future copy edits
        // to the surrounding wording don't break this test.
        expect(beforeText).not.toContain('voseo');
        expect(afterText).toContain('voseo');
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(brandVoice.meta.destructive).toBe(false);
        expect(brandVoice.meta.group).toBe('required');
    });
});
