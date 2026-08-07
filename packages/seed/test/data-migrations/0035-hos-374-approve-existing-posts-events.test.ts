/**
 * @fileoverview
 * Unit tests for the `0035-hos-374-approve-existing-posts-events` data
 * migration, using a fully mocked `ctx.db` (no real database connection) — the
 * same "mock the drizzle chain" style as
 * `0030-clear-placeholder-blog-media.test.ts`.
 *
 * The contract these tests protect is the migration's SCOPE. Grandfathering
 * content ahead of the HOS-374 publication gate is only safe while it is
 * narrow:
 *
 * - it must filter on `PENDING`, so a `REJECTED` row — a decision a human made
 *   deliberately — is never silently approved;
 * - it must filter on `deletedAt IS NULL`, so a soft-deleted row is not
 *   approved behind the scenes and does not come back public if restored.
 *
 * Dropping either condition turns a bounded backfill into a blanket approval of
 * everything in the table, which is exactly the failure mode this migration
 * must never have. These are assertions about the WHERE clause the migration
 * builds — a unit test with a mocked db can verify the query's shape, not the
 * rows a real database would return.
 *
 * @module test/data-migrations/0035-hos-374-approve-existing-posts-events
 */
import { ModerationStatusEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as approveExisting from '../../src/data-migrations/0035-hos-374-approve-existing-posts-events.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos-374-approve-existing-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

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
 * resolves to the supplied row batches — first call for posts, second for
 * events — while recording every `set`/`where` argument.
 */
function buildDbMock(returningBatches: ReadonlyArray<readonly unknown[]>): {
    db: SeedMigrationCtx['db'];
    captures: UpdateCapture[];
} {
    const captures: UpdateCapture[] = [];
    let callIndex = 0;

    const update = vi.fn().mockImplementation(() => {
        const capture: UpdateCapture = { setArgs: [], whereArgs: [] };
        captures.push(capture);
        const rows = returningBatches[callIndex] ?? [];
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

function buildCtx(returningBatches: ReadonlyArray<readonly unknown[]>): {
    ctx: SeedMigrationCtx;
    captures: UpdateCapture[];
} {
    const { db, captures } = buildDbMock(returningBatches);
    const ctx = {
        db,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
    return { ctx, captures };
}

describe('0035-hos-374-approve-existing-posts-events', () => {
    it('reports how many posts and events were grandfathered', async () => {
        // Arrange
        const { ctx } = buildCtx([[{ slug: 'post-a' }, { slug: 'post-b' }], [{ slug: 'event-a' }]]);

        // Act
        const result = await approveExisting.up(ctx);

        // Assert
        expect(result.counts).toEqual({ postsApproved: 2, eventsApproved: 1 });
        expect(result.summary).toContain('2 post(s)');
        expect(result.summary).toContain('1 event(s)');
    });

    it('is a no-op report when nothing matches (idempotent re-run)', async () => {
        // Arrange
        const { ctx } = buildCtx([[], []]);

        // Act
        const result = await approveExisting.up(ctx);

        // Assert
        expect(result.counts).toEqual({ postsApproved: 0, eventsApproved: 0 });
    });

    it('writes APPROVED to both tables', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([[], []]);

        // Act
        await approveExisting.up(ctx);

        // Assert
        expect(captures).toHaveLength(2);
        for (const capture of captures) {
            const set = capture.setArgs[0] as { moderationState?: string };
            expect(set.moderationState).toBe(ModerationStatusEnum.APPROVED);
        }
    });

    for (const [index, table] of (['posts', 'events'] as const).entries()) {
        it(`restricts the ${table} update to PENDING rows only`, async () => {
            // Arrange
            const { ctx, captures } = buildCtx([[], []]);

            // Act
            await approveExisting.up(ctx);

            // Assert — a REJECTED row is a deliberate human decision and must
            // never be laundered into APPROVED by a backfill.
            const where = flattenSql(captures[index]?.whereArgs[0]);
            expect(where).toContain(ModerationStatusEnum.PENDING);
            expect(where).not.toContain(ModerationStatusEnum.REJECTED);
        });

        it(`restricts the ${table} update to rows that are not soft-deleted`, async () => {
            // Arrange
            const { ctx, captures } = buildCtx([[], []]);

            // Act
            await approveExisting.up(ctx);

            // Assert — approving a deleted row would misrepresent it the moment
            // someone restores it.
            const where = flattenSql(captures[index]?.whereArgs[0]);
            expect(where.toLowerCase()).toContain('is null');
            expect(where).toContain('deleted_at');
        });

        it(`leaves visibility and lifecycle untouched on ${table}`, async () => {
            // Arrange
            const { ctx, captures } = buildCtx([[], []]);

            // Act
            await approveExisting.up(ctx);

            // Assert — this migration grandfathers the moderation verdict only.
            const set = captures[index]?.setArgs[0] as Record<string, unknown>;
            expect(set).not.toHaveProperty('visibility');
            expect(set).not.toHaveProperty('lifecycleState');
        });
    }

    it('is declared non-destructive and belongs to the required group', () => {
        expect(approveExisting.meta.destructive).toBe(false);
        expect(approveExisting.meta.group).toBe('required');
    });
});
