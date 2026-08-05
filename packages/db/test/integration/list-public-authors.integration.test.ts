/**
 * @file list-public-authors.integration.test.ts
 * @description Integration tests for `UserModel.listPublicAuthors` against a
 * real PostgreSQL instance (HOS-375 T-011).
 *
 * The unit tests for this method mock the query, so they can only prove the
 * wiring around it. The thing that actually matters here — WHO the predicate
 * lets through — is SQL, and only a real database can answer it. Every
 * exclusion reason of spec §6.5 gets its own fixture, each differing from the
 * fully-eligible author in exactly one respect, so a passing test names the
 * condition that did the excluding.
 *
 * Each case runs inside a rolled-back transaction, so the fixtures never
 * persist and never collide with a parallel worker.
 */

import { randomUUID } from 'node:crypto';
import { RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { UserModel } from '../../src/models/user/user.model';
import { events } from '../../src/schemas/event/event.dbschema';
import { posts } from '../../src/schemas/post/post.dbschema';
import { userRole } from '../../src/schemas/user/r_user_role.dbschema';
import { users } from '../../src/schemas/user/user.dbschema';
import type { DrizzleClient } from '../../src/types';
import { closeTestPool, testData, withTestTransaction } from './helpers';

/**
 * Gate on the EPHEMERAL test database provisioned by `pnpm test:integration`,
 * not on `helpers.isDbAvailable()` — that legacy helper checks
 * `HOSPEDA_DATABASE_URL` (the dev DB) and is documented as not for new tests,
 * so using it silently skips this whole suite even when the harness is running.
 */
const DB_AVAILABLE = Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);

const model = new UserModel();

/** A profile that satisfies BOTH the bio and the avatar condition. */
const COMPLETE_PROFILE = {
    bio: 'Escribe sobre el litoral entrerriano.',
    avatar: 'https://cdn.example.test/carmen.jpg'
};

/**
 * Inserts a user, returning its id and slug.
 *
 * Defaults describe a FULLY ELIGIBLE author, so each test overrides exactly the
 * one field it is about — that is what makes a failure point at a condition
 * instead of at the fixture.
 */
async function insertAuthor(
    tx: DrizzleClient,
    overrides: Partial<typeof users.$inferInsert> = {}
): Promise<{ id: string; slug: string }> {
    const slug = `author-${randomUUID().slice(0, 12)}`;
    const row = testData.user({
        slug,
        profile: COMPLETE_PROFILE,
        isSystemAccount: false,
        ...overrides
    });
    await tx.insert(users).values(row);
    return { id: row.id as string, slug: (row.slug ?? slug) as string };
}

/** Inserts a published post authored by `authorId`. */
async function insertPost(
    tx: DrizzleClient,
    authorId: string,
    overrides: Partial<typeof posts.$inferInsert> = {}
): Promise<void> {
    await tx.insert(posts).values({
        id: randomUUID(),
        slug: `post-${randomUUID().slice(0, 12)}`,
        category: 'CULTURE',
        title: 'Una nota',
        summary: 'Resumen de la nota',
        content: 'Contenido de la nota',
        authorId,
        moderationState: 'APPROVED',
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        ...overrides
    });
}

/** Inserts a published event authored by `authorId`. */
async function insertEvent(
    tx: DrizzleClient,
    authorId: string,
    overrides: Partial<typeof events.$inferInsert> = {}
): Promise<void> {
    await tx.insert(events).values({
        id: randomUUID(),
        slug: `event-${randomUUID().slice(0, 12)}`,
        name: 'Un evento',
        summary: 'Resumen del evento',
        category: 'MUSIC',
        date: { start: new Date('2026-09-01T20:00:00.000Z') },
        authorId,
        moderationState: 'APPROVED',
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
        ...overrides
    });
}

/** Grants a role to a user via the `user_role` junction table (HOS-296). */
async function grantRole(tx: DrizzleClient, userId: string, role: RoleEnum): Promise<void> {
    await tx.insert(userRole).values({ userId, role });
}

/** The slugs `listPublicAuthors` returned, across every page. */
async function listedSlugs(tx: DrizzleClient): Promise<string[]> {
    const { items } = await model.listPublicAuthors({ page: 1, pageSize: 100 }, tx);
    return items.map((item) => item.slug);
}

describe.skipIf(!DB_AVAILABLE)('UserModel.listPublicAuthors — the §6.5 predicate', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('includes an author with a post, a bio and an avatar', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).toContain(author.slug);
        });
    });

    it('includes an author whose only content is an event', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — the whole point of HOS-375: an events-only author has a
            // page too, so the OR must be a real OR.
            const author = await insertAuthor(tx);
            await insertEvent(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).toContain(author.slug);
        });
    });

    it('EXCLUDES a system account, however complete its profile is', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — content, bio and avatar all present; only the flag
            // differs (AC-13). This is what keeps /autores/super-admin-user/
            // out of Google.
            const author = await insertAuthor(tx, { isSystemAccount: true });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES an author with no published content', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — a complete profile and nothing published.
            const author = await insertAuthor(tx);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES an author whose bio is missing', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx, {
                profile: { avatar: COMPLETE_PROFILE.avatar }
            });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES an author whose bio is whitespace only', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — a stored `"   "` is empty in every sense the page cares
            // about, and the web predicate trims before testing. A plain
            // `IS NOT NULL` here would disagree with it.
            const author = await insertAuthor(tx, {
                profile: { bio: '   ', avatar: COMPLETE_PROFILE.avatar }
            });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES an author whose avatar is missing', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx, { profile: { bio: COMPLETE_PROFILE.bio } });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES an author with no profile at all', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — `profile` is nullable, so `->>` yields SQL NULL rather
            // than an empty string. `coalesce` is what makes those the same.
            const author = await insertAuthor(tx, { profile: null });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('EXCLUDES a soft-deleted author', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx, { deletedAt: new Date() });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('includes an eligible author PROMOTED to ADMIN (HOS-375 T-031)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — an ordinary, fully-eligible author (isSystemAccount:
            // false) who also happens to hold the ADMIN hat. Eligibility must
            // key off the stored `is_system_account` column, never off the
            // live role set, or promoting a real editor to ADMIN would
            // silently unpublish their author page.
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id);
            await grantRole(tx, author.id, RoleEnum.ADMIN);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).toContain(author.slug);
        });
    });

    it('EXCLUDES a system account DEMOTED to EDITOR (HOS-375 T-031)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — a system account (the actual exclusion trigger) that
            // also holds only the EDITOR role, i.e. no ADMIN/SUPER_ADMIN hat
            // left. If the predicate were (mis-)coupled to role instead of
            // the flag, demoting a staff account would make its page appear.
            const author = await insertAuthor(tx, { isSystemAccount: true });
            await insertPost(tx, author.id);
            await grantRole(tx, author.id, RoleEnum.EDITOR);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });
});

describe.skipIf(!DB_AVAILABLE)('UserModel.listPublicAuthors — what counts as published', () => {
    afterAll(async () => {
        await closeTestPool();
    });

    it('does not count a soft-deleted post', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id, { deletedAt: new Date() });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('does not count a PRIVATE post', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id, { visibility: 'PRIVATE' });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('does not count a DRAFT post', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id, { lifecycleState: 'DRAFT' });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('does not count a DRAFT event', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — the same rule on the other side of the OR, so a future
            // edit cannot tighten one table and forget the other.
            const author = await insertAuthor(tx);
            await insertEvent(tx, author.id, { lifecycleState: 'DRAFT' });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('does not count a post the platform has not approved', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — `moderation_state` is the third column of the public
            // read floor (HOS-374 §7.6.5). The author page's own content reads
            // require APPROVED, so this predicate must too: an author listed
            // here on the strength of a PENDING post would be advertised in the
            // sitemap while the page itself renders empty and `noindex`.
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id, { moderationState: 'PENDING' });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('does not count an event the platform has not approved', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — the same rule on the other side of the OR.
            const author = await insertAuthor(tx);
            await insertEvent(tx, author.id, { moderationState: 'REJECTED' });
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).not.toContain(author.slug);
        });
    });

    it('includes an author whose draft post sits beside a published one', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — non-vacuity guard for the three exclusions above: they
            // must exclude the CONTENT, not the author.
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id, { lifecycleState: 'DRAFT' });
            await insertPost(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs).toContain(author.slug);
        });
    });

    it('returns an author once, not once per published item', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — EXISTS rather than a join is what prevents the row
            // multiplying, and a duplicated slug would duplicate a sitemap URL.
            const author = await insertAuthor(tx);
            await insertPost(tx, author.id);
            await insertPost(tx, author.id);
            await insertEvent(tx, author.id);
            // Act
            const slugs = await listedSlugs(tx);
            // Assert
            expect(slugs.filter((slug) => slug === author.slug)).toHaveLength(1);
        });
    });
});
