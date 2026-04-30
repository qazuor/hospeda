/**
 * SPEC-086 T-045 — Tag cascade regression tests.
 *
 * Verifies DB-level FK cascade behaviours for both tag subsystems:
 *
 *   AC-F11  Hard-deleting a tag cascade-deletes all its r_entity_tag /
 *           r_post_post_tag assignments. No service-layer logic needed —
 *           PostgreSQL enforces it via ON DELETE CASCADE on the FK columns.
 *
 *   AC-F12  Deleting a user cascades through two distinct paths:
 *           (a) user → USER tags (ownerId FK) → assignments (tagId FK)
 *           (b) user → assignments where assignedById = user.id
 *           SYSTEM / INTERNAL tags owned by nobody (ownerId = NULL) survive.
 *
 * AC-F11 tests use `withTestTransaction` — cascade fires synchronously within
 * the tx and everything rolls back automatically.
 *
 * AC-F12 tests use `withCleanSlate` because:
 *   - The `delete_entity_bookmarks` trigger (manual/0006) has a pre-existing
 *     enum-vs-text comparison bug that crashes whenever a user row is hard-
 *     deleted inside a Drizzle query. The trigger is bypassed by setting
 *     `session_replication_role = replica` which suppresses all row-level
 *     triggers for the duration of the statement. This workaround is local to
 *     this test file and does not affect other sessions.
 *   - `withCleanSlate` (TRUNCATE-based cleanup) is used so state does not leak
 *     between user-delete scenarios since each one commits real rows.
 *
 * The trigger bug is pre-existing and unrelated to SPEC-086. It is documented
 * in tx-propagation.test.ts comments and does not affect production behaviour
 * (production never hard-deletes users via raw Drizzle — it uses the service
 * layer which has its own pre-delete cascade logic and uses soft-delete first).
 *
 * References:
 *   - SPEC-086 D-004 (cascade delete USER tags on user delete)
 *   - SPEC-086 D-011 (hard delete only, cascade via FK)
 *   - SPEC-086 D-018 (schema shapes)
 *   - AC-F11, AC-F12
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { postTags, posts, rEntityTag, rPostPostTag, tags, users } from '../../src/schemas/index.ts';
import { closeTestPool, getTestPool, withCleanSlate, withTestTransaction } from './helpers.ts';

// ---------------------------------------------------------------------------
// Minimal factories — only NOT NULL columns without DB-level defaults
// ---------------------------------------------------------------------------

/**
 * Minimal user row. `slug` has a Drizzle `$defaultFn` so we must supply a
 * unique value here or the schema's function will fire but is unreliable in
 * test transactions (the function body contains `crypto.randomUUID()`).
 * Supplying it explicitly keeps the factory fully deterministic.
 */
function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
    const uid = crypto.randomUUID();
    return {
        id: uid,
        email: `cascade-test-${uid}@example.com`,
        emailVerified: true,
        slug: `cascade-user-${uid.slice(0, 8)}`,
        lifecycleState: 'ACTIVE' as const,
        createdById: null,
        ...overrides
    } satisfies typeof users.$inferInsert;
}

/**
 * Minimal USER-type tag row.
 * Caller MUST supply `ownerId` because type = USER requires it (D-002).
 */
function makeUserTag(ownerId: string, overrides: Partial<typeof tags.$inferInsert> = {}) {
    return {
        id: crypto.randomUUID(),
        name: `cascade-user-tag-${crypto.randomUUID().slice(0, 8)}`,
        color: 'BLUE' as const,
        type: 'USER' as const,
        ownerId,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof tags.$inferInsert;
}

/**
 * Minimal SYSTEM tag row (ownerId = NULL — required for SYSTEM type).
 */
function makeSystemTag(overrides: Partial<typeof tags.$inferInsert> = {}) {
    return {
        id: crypto.randomUUID(),
        name: `cascade-system-tag-${crypto.randomUUID().slice(0, 8)}`,
        color: 'GREEN' as const,
        type: 'SYSTEM' as const,
        ownerId: null,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof tags.$inferInsert;
}

/**
 * Minimal INTERNAL tag row (ownerId = NULL — required for INTERNAL type).
 */
function makeInternalTag(overrides: Partial<typeof tags.$inferInsert> = {}) {
    return {
        id: crypto.randomUUID(),
        name: `cascade-internal-tag-${crypto.randomUUID().slice(0, 8)}`,
        color: 'RED' as const,
        type: 'INTERNAL' as const,
        ownerId: null,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof tags.$inferInsert;
}

/**
 * Minimal r_entity_tag row. Uses ACCOMMODATION entity type as a valid default
 * that satisfies the EntityTypePgEnum constraint without requiring the entity
 * to physically exist (FK is on `tags.id` and `users.id` only, not entityId).
 */
function makeEntityTagAssignment(
    tagId: string,
    assignedById: string,
    overrides: Partial<typeof rEntityTag.$inferInsert> = {}
) {
    return {
        tagId,
        entityId: crypto.randomUUID(),
        entityType: 'ACCOMMODATION' as const,
        assignedById,
        ...overrides
    } satisfies typeof rEntityTag.$inferInsert;
}

/**
 * Minimal post row. Requires an existing authorId.
 * Uses GENERAL category which is always valid in post_category_enum.
 */
function makePost(authorId: string, overrides: Partial<typeof posts.$inferInsert> = {}) {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `cascade-post-${uid}`,
        category: 'GENERAL' as const,
        title: 'Cascade Test Post',
        summary: 'Cascade test post summary text here.',
        content: 'Cascade test post content body text here.',
        authorId,
        lifecycleState: 'ACTIVE' as const,
        visibility: 'PUBLIC' as const,
        moderationState: 'PENDING' as const,
        ...overrides
    } satisfies typeof posts.$inferInsert;
}

/**
 * Minimal PostTag row.
 */
function makePostTag(overrides: Partial<typeof postTags.$inferInsert> = {}) {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        name: `cascade-pt-${uid}`,
        slug: `cascade-pt-${uid}`,
        color: 'PURPLE' as const,
        lifecycleState: 'ACTIVE' as const,
        ...overrides
    } satisfies typeof postTags.$inferInsert;
}

// ---------------------------------------------------------------------------
// Helpers for AC-F12 (user delete) tests
// ---------------------------------------------------------------------------

/**
 * Hard-delete a user row while bypassing only the buggy application trigger.
 *
 * The `delete_entity_bookmarks` trigger (installed by manual/0006) has a
 * pre-existing enum-vs-text comparison bug that fires on user DELETE and
 * causes `operator does not exist: entity_type_enum = text`.
 *
 * Approach: temporarily disable only `trg_delete_bookmarks_on_users` and
 * `trg_softdelete_bookmarks_on_users` (the two triggers from 0006/0014 on the
 * `users` table), perform the DELETE via Drizzle so FK cascades fire normally,
 * then re-enable the triggers. ALTER TABLE ... DISABLE/ENABLE TRIGGER is DDL
 * and takes effect immediately — it is NOT rolled back by a subsequent ROLLBACK
 * because DDL is auto-committed in PostgreSQL. Therefore this helper runs as a
 * top-level committed operation and only works with `withCleanSlate` (not with
 * `withTestTransaction`).
 *
 * FK cascades (tags.ownerId, r_entity_tag.tagId, r_entity_tag.assignedById)
 * are NOT affected by disabling named triggers — they are enforced by the
 * PostgreSQL executor's constraint machinery independently of trigger routing.
 *
 * This is intentional and scoped to this test file. Production never hard-
 * deletes users via raw SQL. The trigger bug is unrelated to SPEC-086.
 */
async function hardDeleteUserBypassingTrigger(userId: string): Promise<void> {
    const pool = getTestPool();
    const client = await pool.connect();
    try {
        // Disable the two known-buggy triggers on the users table.
        // These trigger names come from manual/0006 and manual/0014.
        // IF NOT EXISTS is not valid for ALTER TABLE DISABLE TRIGGER, but we
        // use a DO block to suppress errors when the trigger does not exist
        // (e.g. if apply-postgres-extras.sh was not run on this test DB).
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE users DISABLE TRIGGER trg_delete_bookmarks_on_users;
            EXCEPTION WHEN undefined_object THEN NULL;
            END
            $$`);
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE users DISABLE TRIGGER trg_softdelete_bookmarks_on_users;
            EXCEPTION WHEN undefined_object THEN NULL;
            END
            $$`);

        // Delete the user — FK cascades fire normally via executor constraint machinery.
        await client.query('DELETE FROM users WHERE id = $1', [userId]);
    } finally {
        // Always re-enable triggers, even if delete fails.
        try {
            await client.query(`
                DO $$
                BEGIN
                    ALTER TABLE users ENABLE TRIGGER trg_delete_bookmarks_on_users;
                EXCEPTION WHEN undefined_object THEN NULL;
                END
                $$`);
            await client.query(`
                DO $$
                BEGIN
                    ALTER TABLE users ENABLE TRIGGER trg_softdelete_bookmarks_on_users;
                EXCEPTION WHEN undefined_object THEN NULL;
                END
                $$`);
        } finally {
            client.release();
        }
    }
}

/**
 * Hard-delete a post row while bypassing the buggy delete_entity_bookmarks
 * trigger (which is also attached to the `posts` table).
 *
 * Same approach as `hardDeleteUserBypassingTrigger`. FK cascades on
 * r_post_post_tag.postId still fire normally.
 */
async function hardDeletePostBypassingTrigger(postId: string): Promise<void> {
    const pool = getTestPool();
    const client = await pool.connect();
    try {
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE posts DISABLE TRIGGER trg_delete_bookmarks_on_posts;
            EXCEPTION WHEN undefined_object THEN NULL;
            END
            $$`);
        await client.query(`
            DO $$
            BEGIN
                ALTER TABLE posts DISABLE TRIGGER trg_softdelete_bookmarks_on_posts;
            EXCEPTION WHEN undefined_object THEN NULL;
            END
            $$`);

        await client.query('DELETE FROM posts WHERE id = $1', [postId]);
    } finally {
        try {
            await client.query(`
                DO $$
                BEGIN
                    ALTER TABLE posts ENABLE TRIGGER trg_delete_bookmarks_on_posts;
                EXCEPTION WHEN undefined_object THEN NULL;
                END
                $$`);
            await client.query(`
                DO $$
                BEGIN
                    ALTER TABLE posts ENABLE TRIGGER trg_softdelete_bookmarks_on_posts;
                EXCEPTION WHEN undefined_object THEN NULL;
                END
                $$`);
        } finally {
            client.release();
        }
    }
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

afterAll(async () => {
    await closeTestPool();
});

// After each AC-F12 test that uses withCleanSlate, no extra teardown needed
// because withCleanSlate TRUNCATEs all user tables in afterEach implicitly.
// However, since we call hardDeleteUserBypassingTrigger which commits, we rely
// on the next test's withCleanSlate to start fresh.

// ===========================================================================
// AC-F11: Tag delete cascade
// ===========================================================================

describe('AC-F11 — tag hard-delete cascades to r_entity_tag assignments', () => {
    it('deleting a SYSTEM tag removes all r_entity_tag rows referencing that tag', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const userA = makeUser();
            await tx.insert(users).values(userA);

            const systemTag = makeSystemTag();
            await tx.insert(tags).values(systemTag);

            const assignment1 = makeEntityTagAssignment(systemTag.id, userA.id);
            const assignment2 = makeEntityTagAssignment(systemTag.id, userA.id, {
                entityId: crypto.randomUUID() // different entity, same tag
            });
            await tx.insert(rEntityTag).values([assignment1, assignment2]);

            // Verify assignments exist before delete
            const before = await tx
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTag.id));
            expect(before).toHaveLength(2);

            // Act — hard delete the tag
            await tx.delete(tags).where(eq(tags.id, systemTag.id));

            // Assert — tag is gone
            const tagAfter = await tx.select().from(tags).where(eq(tags.id, systemTag.id));
            expect(tagAfter).toHaveLength(0);

            // Assert — all assignments cascade-deleted
            const assignmentsAfter = await tx
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTag.id));
            expect(assignmentsAfter).toHaveLength(0);
        });
    });

    it('deleting a USER tag removes only its own assignments (other tags unaffected)', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const userA = makeUser();
            const userB = makeUser();
            await tx.insert(users).values([userA, userB]);

            const tagToDelete = makeUserTag(userA.id);
            const tagToKeep = makeUserTag(userB.id);
            await tx.insert(tags).values([tagToDelete, tagToKeep]);

            // 2 assignments on the tag to delete
            const assignmentOnDeleted1 = makeEntityTagAssignment(tagToDelete.id, userA.id);
            const assignmentOnDeleted2 = makeEntityTagAssignment(tagToDelete.id, userA.id, {
                entityId: crypto.randomUUID()
            });
            // 1 assignment on the tag to keep
            const assignmentOnKept = makeEntityTagAssignment(tagToKeep.id, userB.id);
            await tx
                .insert(rEntityTag)
                .values([assignmentOnDeleted1, assignmentOnDeleted2, assignmentOnKept]);

            // Act
            await tx.delete(tags).where(eq(tags.id, tagToDelete.id));

            // Assert — deleted tag's assignments gone
            const deletedAssignments = await tx
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, tagToDelete.id));
            expect(deletedAssignments).toHaveLength(0);

            // Assert — surviving tag and its assignment intact
            const keptTag = await tx.select().from(tags).where(eq(tags.id, tagToKeep.id));
            expect(keptTag).toHaveLength(1);

            const keptAssignments = await tx
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, tagToKeep.id));
            expect(keptAssignments).toHaveLength(1);
        });
    });

    it('deleting an INTERNAL tag removes all r_entity_tag rows referencing that tag', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const userA = makeUser();
            await tx.insert(users).values(userA);

            const internalTag = makeInternalTag();
            await tx.insert(tags).values(internalTag);

            const a1 = makeEntityTagAssignment(internalTag.id, userA.id);
            const a2 = makeEntityTagAssignment(internalTag.id, userA.id, {
                entityId: crypto.randomUUID()
            });
            await tx.insert(rEntityTag).values([a1, a2]);

            // Act
            await tx.delete(tags).where(eq(tags.id, internalTag.id));

            // Assert
            const remaining = await tx
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, internalTag.id));
            expect(remaining).toHaveLength(0);

            const tagGone = await tx.select().from(tags).where(eq(tags.id, internalTag.id));
            expect(tagGone).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// AC-F11 (PostTag subsystem): r_post_post_tag cascade
// ---------------------------------------------------------------------------

describe('AC-F11 — PostTag hard-delete cascades to r_post_post_tag rows', () => {
    it('deleting a PostTag removes all r_post_post_tag rows referencing that PostTag', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange — author + 2 posts + 1 PostTag + 2 assignments
            const author = makeUser();
            await tx.insert(users).values(author);

            const post1 = makePost(author.id);
            const post2 = makePost(author.id);
            await tx.insert(posts).values([post1, post2]);

            const postTag = makePostTag();
            await tx.insert(postTags).values(postTag);

            await tx.insert(rPostPostTag).values([
                { postId: post1.id, postTagId: postTag.id },
                { postId: post2.id, postTagId: postTag.id }
            ]);

            // Verify 2 assignments exist
            const before = await tx
                .select()
                .from(rPostPostTag)
                .where(eq(rPostPostTag.postTagId, postTag.id));
            expect(before).toHaveLength(2);

            // Act — hard delete the PostTag
            await tx.delete(postTags).where(eq(postTags.id, postTag.id));

            // Assert — PostTag gone
            const tagAfter = await tx.select().from(postTags).where(eq(postTags.id, postTag.id));
            expect(tagAfter).toHaveLength(0);

            // Assert — both r_post_post_tag rows cascade-deleted
            const assignmentsAfter = await tx
                .select()
                .from(rPostPostTag)
                .where(eq(rPostPostTag.postTagId, postTag.id));
            expect(assignmentsAfter).toHaveLength(0);
        });
    });

    it('deleting a post removes its r_post_post_tag rows but leaves the PostTag', async () => {
        // Uses withCleanSlate + hardDeletePostBypassingTrigger because the
        // delete_entity_bookmarks trigger also fires on posts with the same
        // enum-vs-text bug. FK cascades on r_post_post_tag.postId still work.
        await withCleanSlate(async (db) => {
            // Arrange
            const author = makeUser();
            await db.insert(users).values(author);

            const post1 = makePost(author.id);
            const post2 = makePost(author.id);
            await db.insert(posts).values([post1, post2]);

            const postTag = makePostTag();
            await db.insert(postTags).values(postTag);

            await db.insert(rPostPostTag).values([
                { postId: post1.id, postTagId: postTag.id },
                { postId: post2.id, postTagId: postTag.id }
            ]);

            // Act — hard delete one post (bypasses buggy trigger, FK cascade fires normally)
            await hardDeletePostBypassingTrigger(post1.id);

            // Assert — post1's assignment gone (postId FK CASCADE)
            const post1Assignments = await db
                .select()
                .from(rPostPostTag)
                .where(
                    and(eq(rPostPostTag.postId, post1.id), eq(rPostPostTag.postTagId, postTag.id))
                );
            expect(post1Assignments).toHaveLength(0);

            // Assert — post2's assignment still exists
            const post2Assignments = await db
                .select()
                .from(rPostPostTag)
                .where(
                    and(eq(rPostPostTag.postId, post2.id), eq(rPostPostTag.postTagId, postTag.id))
                );
            expect(post2Assignments).toHaveLength(1);

            // Assert — PostTag itself not affected
            const tagStillExists = await db
                .select()
                .from(postTags)
                .where(eq(postTags.id, postTag.id));
            expect(tagStillExists).toHaveLength(1);
        });
    });
});

// ===========================================================================
// AC-F12: User delete cascade
//
// NOTE: These tests use withCleanSlate + hardDeleteUserBypassingTrigger.
// See the top-of-file comment and hardDeleteUserBypassingTrigger() JSDoc for
// the rationale (pre-existing delete_entity_bookmarks trigger bug).
// ===========================================================================

describe('AC-F12 — user hard-delete cascades to USER tags and all assignments', () => {
    /**
     * Scenario A: User owns USER tags and is also the assigner.
     *
     * Delete path:
     *   user deleted
     *     → tags.ownerId CASCADE → USER tags owned by user are deleted
     *       → r_entity_tag.tagId CASCADE → assignments for those tags deleted
     *     → r_entity_tag.assignedById CASCADE → any remaining assignments
     *       where user was assignedById are also deleted
     */
    it('Scenario A — user delete removes owned USER tags and all their assignments', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const userA = makeUser();
            await db.insert(users).values(userA);

            const userTagT1 = makeUserTag(userA.id);
            await db.insert(tags).values(userTagT1);

            // 2 assignments of T1 on different entities, both assigned by A
            const assignmentX = makeEntityTagAssignment(userTagT1.id, userA.id);
            const assignmentY = makeEntityTagAssignment(userTagT1.id, userA.id, {
                entityId: crypto.randomUUID()
            });
            await db.insert(rEntityTag).values([assignmentX, assignmentY]);

            // Verify baseline state
            const tagsBefore = await db.select().from(tags).where(eq(tags.id, userTagT1.id));
            expect(tagsBefore).toHaveLength(1);

            const assignmentsBefore = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, userTagT1.id));
            expect(assignmentsBefore).toHaveLength(2);

            // Act — hard delete user A (bypasses the trigger bug)
            await hardDeleteUserBypassingTrigger(userA.id);

            // Assert 1 — USER tag T1 is gone (ownerId FK CASCADE)
            const tagsAfter = await db.select().from(tags).where(eq(tags.id, userTagT1.id));
            expect(tagsAfter).toHaveLength(0);

            // Assert 2 — assignments for T1 are gone (tagId FK CASCADE after tag deleted)
            const tagAssignmentsAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, userTagT1.id));
            expect(tagAssignmentsAfter).toHaveLength(0);

            // Assert 3 — no assignments remain where assignedById was user A
            const byAssignerAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userA.id));
            expect(byAssignerAfter).toHaveLength(0);
        });
    });

    /**
     * Scenario B: User assigns SYSTEM tags but does not own them (ownerId = NULL).
     *
     * After deleting user B:
     *   - SYSTEM tag S survives (ownerId = NULL — not owned by B)
     *   - Assignments where assignedById = B.id are deleted (assignedById FK CASCADE)
     */
    it('Scenario B — user delete removes only their assignments; SYSTEM tag survives', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const userB = makeUser();
            await db.insert(users).values(userB);

            const systemTagS = makeSystemTag();
            await db.insert(tags).values(systemTagS);

            const assignment = makeEntityTagAssignment(systemTagS.id, userB.id);
            await db.insert(rEntityTag).values(assignment);

            // Verify baseline
            const tagBefore = await db.select().from(tags).where(eq(tags.id, systemTagS.id));
            expect(tagBefore).toHaveLength(1);

            const assignmentBefore = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userB.id));
            expect(assignmentBefore).toHaveLength(1);

            // Act — hard delete user B
            await hardDeleteUserBypassingTrigger(userB.id);

            // Assert 1 — SYSTEM tag S still exists (ownerId was NULL, not B)
            const tagAfter = await db.select().from(tags).where(eq(tags.id, systemTagS.id));
            expect(tagAfter).toHaveLength(1);
            expect(tagAfter[0]?.ownerId).toBeNull();

            // Assert 2 — assignment where assignedById = B is removed (assignedById FK CASCADE)
            const assignmentAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userB.id));
            expect(assignmentAfter).toHaveLength(0);

            // Assert 3 — SYSTEM tag has no remaining assignments from B
            const tagAssignmentsAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTagS.id));
            expect(tagAssignmentsAfter).toHaveLength(0);
        });
    });

    /**
     * Scenario B (INTERNAL variant): Same logic applies for INTERNAL tags.
     */
    it('Scenario B (INTERNAL) — deleting user removes their assignments; INTERNAL tag survives', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const userB = makeUser();
            await db.insert(users).values(userB);

            const internalTag = makeInternalTag();
            await db.insert(tags).values(internalTag);

            const assignment = makeEntityTagAssignment(internalTag.id, userB.id);
            await db.insert(rEntityTag).values(assignment);

            // Act
            await hardDeleteUserBypassingTrigger(userB.id);

            // Assert — INTERNAL tag survives
            const tagAfter = await db.select().from(tags).where(eq(tags.id, internalTag.id));
            expect(tagAfter).toHaveLength(1);

            // Assert — assignment is gone (assignedById FK CASCADE)
            const assignmentAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userB.id));
            expect(assignmentAfter).toHaveLength(0);
        });
    });

    /**
     * Scenario C: Two users independently assign the same SYSTEM tag to the
     * same entity. Deleting one user removes only that user's assignment row.
     */
    it('Scenario C — deleting one of two users on same SYSTEM tag leaves the other row intact', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const userA = makeUser();
            const userB = makeUser();
            await db.insert(users).values([userA, userB]);

            const systemTagS = makeSystemTag();
            await db.insert(tags).values(systemTagS);

            // Same entity, same tag — two rows with different assignedById (AC-004 pattern)
            const sharedEntityId = crypto.randomUUID();
            const assignmentByA = makeEntityTagAssignment(systemTagS.id, userA.id, {
                entityId: sharedEntityId
            });
            const assignmentByB = makeEntityTagAssignment(systemTagS.id, userB.id, {
                entityId: sharedEntityId
            });
            await db.insert(rEntityTag).values([assignmentByA, assignmentByB]);

            // Verify 2 assignments exist
            const before = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTagS.id));
            expect(before).toHaveLength(2);

            // Act — delete user A only
            await hardDeleteUserBypassingTrigger(userA.id);

            // Assert — exactly 1 assignment remains (B's row)
            const after = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTagS.id));
            expect(after).toHaveLength(1);
            expect(after[0]?.assignedById).toBe(userB.id);

            // Assert — SYSTEM tag still exists
            const tagAfter = await db.select().from(tags).where(eq(tags.id, systemTagS.id));
            expect(tagAfter).toHaveLength(1);

            // Assert — user A has no remaining assignments
            const aAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userA.id));
            expect(aAfter).toHaveLength(0);
        });
    });

    /**
     * Scenario D: Mixed — user owns a USER tag AND independently assigns a
     * SYSTEM tag on a different entity. Both cascade paths fire on delete.
     *
     * After deleting the user:
     *   - USER tag gone (ownerId FK CASCADE)
     *   - USER tag assignments gone (tagId FK CASCADE chained from ownerId)
     *   - SYSTEM tag assignments where assignedById = user gone (assignedById FK CASCADE)
     *   - SYSTEM tag itself survives (ownerId was NULL)
     */
    it('Scenario D — user with mixed USER-tag ownership and SYSTEM-tag assignments', async () => {
        await withCleanSlate(async (db) => {
            // Arrange
            const userA = makeUser();
            await db.insert(users).values(userA);

            // USER tag owned by A
            const userTagT1 = makeUserTag(userA.id);
            await db.insert(tags).values(userTagT1);

            // SYSTEM tag owned by nobody
            const systemTagS = makeSystemTag();
            await db.insert(tags).values(systemTagS);

            // A assigns their USER tag to entity X
            const assignUserTagToX = makeEntityTagAssignment(userTagT1.id, userA.id);
            // A assigns SYSTEM tag to entity Y (different entity)
            const assignSystemTagToY = makeEntityTagAssignment(systemTagS.id, userA.id, {
                entityId: crypto.randomUUID()
            });
            await db.insert(rEntityTag).values([assignUserTagToX, assignSystemTagToY]);

            // Verify baseline — 2 assignments total for user A
            const allBefore = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userA.id));
            expect(allBefore).toHaveLength(2);

            // Act — delete user A
            await hardDeleteUserBypassingTrigger(userA.id);

            // Assert — USER tag gone (ownerId FK CASCADE)
            const userTagAfter = await db.select().from(tags).where(eq(tags.id, userTagT1.id));
            expect(userTagAfter).toHaveLength(0);

            // Assert — SYSTEM tag survives (ownerId was NULL)
            const systemTagAfter = await db.select().from(tags).where(eq(tags.id, systemTagS.id));
            expect(systemTagAfter).toHaveLength(1);

            // Assert — all assignments by A are gone (both cascade paths)
            const assignmentsAfter = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.assignedById, userA.id));
            expect(assignmentsAfter).toHaveLength(0);

            // Defensive: SYSTEM tag has no leftover assignment rows for its tagId
            const systemTagAssignments = await db
                .select()
                .from(rEntityTag)
                .where(eq(rEntityTag.tagId, systemTagS.id));
            expect(systemTagAssignments).toHaveLength(0);
        });
    });
});
