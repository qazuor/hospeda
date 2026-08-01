/**
 * @fileoverview
 * Unit tests for the `0030-clear-placeholder-blog-media` data migration,
 * using a fully mocked `ctx.db` (no real database connection) — the same
 * "mock the drizzle chain" style as
 * `0007-remove-legacy-make-webhook-url-setting.test.ts`.
 *
 * The contract these tests protect is the migration's safety guard: it must
 * match the two `placehold.co` URLs `0025-seed-real-blog-posts` wrote
 * **exactly**. Loosening that to a prefix/`LIKE` match would silently wipe
 * covers an operator had already replaced with real photography, which is the
 * one failure mode this migration must never have.
 *
 * @module test/data-migrations/0030-clear-placeholder-blog-media
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { describe, expect, it, vi } from 'vitest';
import * as clearPlaceholderMedia from '../../src/data-migrations/0030-clear-placeholder-blog-media.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-clear-placeholder-blog-media-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** The exact URLs `0025` wrote. Duplicated here on purpose: if the migration
 *  changes either constant, this test must fail rather than follow along. */
const PLACEHOLDER_FEATURED_IMAGE_URL = 'https://placehold.co/1200x630/1b6b4c/ffffff?text=Hospeda';
const PLACEHOLDER_AVATAR_URL = 'https://placehold.co/400x400/1b6b4c/ffffff?text=Hospeda';
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * A drizzle `sql` fragment's `queryChunks` array interleaves literal SQL text
 * (objects whose `value` is a `string[]`) with the interpolated values —
 * columns as objects, bound scalars as raw primitives.
 */
function queryChunksOf(fragment: unknown): unknown[] {
    return (fragment as { queryChunks?: unknown[] })?.queryChunks ?? [];
}

/** The literal SQL text of a `sql` fragment, with interpolations elided. */
function sqlText(fragment: unknown): string {
    return queryChunksOf(fragment)
        .flatMap((chunk) => {
            const value = (chunk as { value?: unknown })?.value;
            return Array.isArray(value) && value.every((v) => typeof v === 'string')
                ? (value as string[])
                : [];
        })
        .join('');
}

/** The scalar values a `sql` fragment binds as parameters. */
function boundValues(fragment: unknown): string[] {
    return queryChunksOf(fragment).filter((chunk): chunk is string => typeof chunk === 'string');
}

interface UpdateCapture {
    readonly setArgs: unknown[];
    readonly whereArgs: unknown[];
}

/**
 * Builds a mocked `ctx.db` whose `.update().set().where().returning()` chain
 * resolves to the supplied row batches — first call for posts, second for the
 * editorial author — while recording every `set`/`where` argument.
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

describe('0030-clear-placeholder-blog-media', () => {
    it('reports how many posts and author profiles were cleared', async () => {
        // Arrange
        const { ctx } = buildCtx([
            [{ slug: 'post-a' }, { slug: 'post-b' }],
            [{ email: EDITORIAL_EMAIL }]
        ]);

        // Act
        const result = await clearPlaceholderMedia.up(ctx);

        // Assert
        expect(result.counts).toEqual({ postsCleared: 2, authorsCleared: 1 });
        expect(result.summary).toContain('2 blog post(s)');
        expect(result.summary).toContain('1 editorial author profile(s)');
    });

    it('is a no-op report when nothing matches (idempotent re-run)', async () => {
        // Arrange
        const { ctx } = buildCtx([[], []]);

        // Act
        const result = await clearPlaceholderMedia.up(ctx);

        // Assert
        expect(result.counts).toEqual({ postsCleared: 0, authorsCleared: 0 });
    });

    it('matches the post cover URL exactly, never by prefix or wildcard', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([[], []]);

        // Act
        await clearPlaceholderMedia.up(ctx);

        // Assert
        const where = captures[0]?.whereArgs[0];
        expect(boundValues(where)).toContain(PLACEHOLDER_FEATURED_IMAGE_URL);
        // A LIKE/ILIKE match would also wipe a real replacement URL that
        // happened to share the host.
        expect(sqlText(where)).toContain("->'featuredImage'->>'url' = ");
        expect(sqlText(where)).not.toMatch(/like/i);
        expect(sqlText(where)).not.toContain('%');
    });

    it('scopes the avatar clear to the editorial author AND the exact placeholder URL', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([[], []]);

        // Act
        await clearPlaceholderMedia.up(ctx);

        // Assert
        const where = captures[1]?.whereArgs[0];
        expect(boundValues(where)).toContain(EDITORIAL_EMAIL);
        expect(boundValues(where)).toContain(PLACEHOLDER_AVATAR_URL);
        expect(sqlText(where)).toContain('AND');
    });

    it('removes only the targeted JSONB key, preserving sibling media and profile data', async () => {
        // Arrange
        const { ctx, captures } = buildCtx([[], []]);

        // Act
        await clearPlaceholderMedia.up(ctx);

        // Assert: the SET clauses subtract a single key rather than nulling the
        // whole column, so a gallery/videos block or the author bio survives.
        const postSet = captures[0]?.setArgs[0] as Record<string, unknown>;
        expect(sqlText(postSet?.media)).toContain("- 'featuredImage'");
        expect(sqlText(postSet?.media)).toContain('NULLIF(');

        const authorSet = captures[1]?.setArgs[0] as Record<string, unknown>;
        expect(sqlText(authorSet?.profile)).toContain("- 'avatar'");
    });

    it('declares itself non-destructive and part of the required group', () => {
        expect(clearPlaceholderMedia.meta).toMatchObject({
            name: '0030-clear-placeholder-blog-media',
            group: 'required',
            destructive: false
        });
    });
});
