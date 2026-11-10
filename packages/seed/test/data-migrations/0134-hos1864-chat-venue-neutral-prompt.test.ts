/**
 * @fileoverview
 * Unit tests for the `0134-hos1864-chat-venue-neutral-prompt` data migration,
 * using a fully mocked `ctx.db` (no real database connection) — the same
 * "mock the drizzle chain" style as
 * `0100-hos-1030-ai-translate-url-rule.test.ts`, which this migration follows
 * line for line (scoped to `chat_venue`).
 *
 * The contract these tests protect:
 *
 * 1. **Scope.** Each `content`/`rules` update must filter on the exact
 *    pre-HOS-1864 value, not just `feature = 'chat_venue'`. Dropping that
 *    condition would let the migration overwrite a prompt an admin already
 *    edited from the panel — the failure mode `aiPrompts.seed.ts`'s
 *    `ON CONFLICT DO NOTHING` exists to prevent on the seed side.
 * 2. **Column independence.** `content` and `rules` are two SEPARATE update
 *    queries, each with its own predicate. A row may carry an operator-edited
 *    `content` next to a still-default `rules` — coupling the two into one
 *    write would silently skip the guardrail update.
 * 3. **Idempotency.** A second run — or a run against an already-edited
 *    database — matches zero rows and reports "no change" without throwing.
 * 4. **Data coherence.** The colocated `.data.json` really has the HOS-1864
 *    neutral prompt and the age clause on the `after` side and NOT on the
 *    `before` side. This guards against swapped or backwards-regenerated
 *    halves.
 *
 * @module test/data-migrations/0134-hos1864-chat-venue-neutral-prompt
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as neutralPrompt from '../../src/data-migrations/0134-hos1864-chat-venue-neutral-prompt.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-1864-chat-venue-neutral-prompt-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** One side of the frozen snapshot: the `chat_venue` feature's `content` and `rules`. */
interface PromptSnapshot {
    readonly prompts: { readonly chat_venue: string };
    readonly rules: { readonly chat_venue: string };
}

/** Shape of the colocated frozen payload the migration reads. */
interface FrozenBaseline {
    readonly before: PromptSnapshot;
    readonly after: PromptSnapshot;
}

/** Same colocated file the migration itself reads, used here as ground truth. */
const DATA_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/data-migrations/0134-hos1864-chat-venue-neutral-prompt.data.json'
);

function loadFrozenBaseline(): FrozenBaseline {
    return JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as FrozenBaseline;
}

const { before, after } = loadFrozenBaseline();

/**
 * A drizzle condition tree interleaves literal SQL text with interpolated
 * values. Flattening it to a single string lets the tests assert on the shape
 * of the WHERE clause without depending on drizzle's internal node layout.
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
 * resolves to `rowsPerCall(callIndex)` while recording every `set`/`where`
 * argument in call order.
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

/** One column the migration is expected to issue an update for. */
interface ExpectedCall {
    readonly column: 'content' | 'rules';
    readonly oldValue: string;
    readonly newValue: string;
}

/**
 * Derives, from the same frozen snapshot the migration reads, exactly which
 * column updates `up()` is expected to issue and in what order (`content`
 * before `rules`).
 */
function computeExpectedCalls(): ExpectedCall[] {
    const calls: ExpectedCall[] = [];
    if (before.prompts.chat_venue !== after.prompts.chat_venue) {
        calls.push({
            column: 'content',
            oldValue: before.prompts.chat_venue,
            newValue: after.prompts.chat_venue
        });
    }
    if (before.rules.chat_venue !== after.rules.chat_venue) {
        calls.push({
            column: 'rules',
            oldValue: before.rules.chat_venue,
            newValue: after.rules.chat_venue
        });
    }
    return calls;
}

describe('0134-hos1864-chat-venue-neutral-prompt', () => {
    const expectedCalls = computeExpectedCalls();

    it('sanity: the frozen snapshot has at least one changed column', () => {
        expect(expectedCalls.length).toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------------
    // AC-1: scope — each update filters on the exact old value, not just
    // `feature = 'chat_venue'`.
    // -----------------------------------------------------------------------

    it('AC-1: scopes every update to rows that still hold the exact pre-HOS-1864 value', async () => {
        // Arrange
        const { ctx, captures } = buildCtx(() => [{ id: 'row-id' }]);

        // Act
        await neutralPrompt.up(ctx);

        // Assert
        expect(captures).toHaveLength(expectedCalls.length);
        captures.forEach((capture, index) => {
            const expected = expectedCalls[index] as ExpectedCall;
            const where = flattenSql(capture.whereArgs[0]);
            expect(where).toContain('chat_venue');
            expect(where).toContain(expected.oldValue);
        });
    });

    // -----------------------------------------------------------------------
    // AC-2: column independence.
    // -----------------------------------------------------------------------

    it('AC-2: writes content and rules as independent queries, each scoped to its own column only', async () => {
        // Arrange
        const { ctx, captures } = buildCtx(() => [{ id: 'row-id' }]);

        // Act
        await neutralPrompt.up(ctx);

        // Assert
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
    // AC-3: idempotency.
    // -----------------------------------------------------------------------

    it('AC-3: is idempotent — reports no changes and does not throw when nothing matches', async () => {
        // Arrange
        const { ctx, captures } = buildCtx(() => []);

        // Act
        const result = await neutralPrompt.up(ctx);

        // Assert
        expect(captures).toHaveLength(expectedCalls.length);
        expect(result.counts.contentUpdated).toBe(0);
        expect(result.counts.rulesUpdated).toBe(0);
        expect(result.summary.toLowerCase()).toContain('no change');
    });

    // -----------------------------------------------------------------------
    // AC-4: data coherence.
    // -----------------------------------------------------------------------

    it('AC-4: "after" carries the neutral prompt and the age clause; "before" does not', () => {
        // Arrange
        const beforePrompt = before.prompts.chat_venue.toLowerCase();
        const afterPrompt = after.prompts.chat_venue.toLowerCase();
        const beforeRules = before.rules.chat_venue;
        const afterRules = after.rules.chat_venue;

        // Act / Assert — the age clause lives only in the rules on the after side.
        expect(beforeRules).not.toContain('below the minimum age');
        expect(afterRules).toContain('below the minimum age');
        expect(afterRules).toContain('under 18');

        // And the prompt stopped being a dining assistant in a restaurant page.
        expect(beforePrompt).toContain('dining assistant');
        expect(afterPrompt).not.toContain('dining assistant');
        expect(afterPrompt).not.toContain('restaurant detail page');
        expect(afterPrompt).toContain('a place to eat or to go out');
    });

    it('is declared non-destructive and belongs to the required group', () => {
        expect(neutralPrompt.meta.destructive).toBe(false);
        expect(neutralPrompt.meta.group).toBe('required');
        expect(neutralPrompt.meta.name).toBe('0134-hos1864-chat-venue-neutral-prompt');
    });
});
