/**
 * @fileoverview
 * Data migration: 0019-purge-seed-example-data
 *
 * HARD-DELETES the fake demo dataset that came from the seed `example` group:
 * the 104 example accommodations, 18 blog `posts` (the content `posts` table,
 * NOT `social_posts`), 24 events, their 5 example event organizers and 5 event
 * locations, the `example` HOST-owner / post-author / event-author users, and
 * every dependent row that hangs off them.
 *
 * PRESERVES (never touched): everything in the seed `required` group, all
 * `destinations`, the ENTIRE `social_posts` graph (social_posts +
 * targets/media/hashtags/campaigns/batches/audiences/footers/hashtag_sets —
 * it references users only via SET-NULL audit columns and has no FK to
 * posts/events/accommodations at all), the commerce listings
 * (gastronomies/experiences, owned by dedicated COMMERCE_OWNER `@local.test`
 * users — NOT the fake hosts), partners, host_trades, tags, and every real
 * user / real signup.
 *
 * ## How the fake set is identified (precise, never "delete all")
 *
 * - Accommodations, posts, events, event organizers, event locations get
 *   DETERMINISTIC UUIDv5 ids from `deterministicFixtureId({ seedKey })`. This
 *   migration recomputes those exact ids from the SAME `manifest-example.json`
 *   the seed reads (see {@link computeFakeExampleIds}) and deletes ONLY those.
 * - `example` users have NO deterministic id. They are resolved from the DB by
 *   reading the `owner_id` of the fake accommodations and the `author_id` of
 *   the fake posts/events, then INTERSECTED with {@link EXAMPLE_USER_EMAILS}
 *   (the 38 fixture emails). A candidate whose email is not in the allowlist
 *   (a real signup, or an admin/super-admin that somehow owned a fake row) is
 *   NEVER deleted — it is counted and logged instead. This is the defensive
 *   validation: the union of {owners of fake accommodations} ∪ {authors of
 *   fake posts/events}, restricted to known example fixtures.
 *
 * ## Deletion order (FK-safe — derived from the Drizzle schemas)
 *
 * The parent rows are removed with plain Drizzle `DELETE`s (NOT
 * `ctx.helpers.safeDelete`, which refuses any row with ANY inbound reference —
 * even CASCADE ones — so it is only for leaves). Postgres then applies each
 * FK's declared `onDelete` (CASCADE removes children, SET NULL nulls audit
 * refs). Every FK that is `restrict` — or the pathological `NOT NULL` +
 * `set null` shape, which ERRORS on delete because it cannot null a NOT NULL
 * column — must be cleared FIRST. The order below does exactly that:
 *
 *   1. Polymorphic / no-FK rows (`entity_views`, `entity_comments`,
 *      `r_entity_tag`, `user_bookmarks.entity_id`): no DB FK → they would
 *      orphan. Deleted explicitly for the fake entity ids (and fake user ids
 *      for USER-typed bookmarks).
 *   2. `conversations` for the fake accommodations: `conversations.accommodation_id`
 *      is ON DELETE RESTRICT, so conversations (and their CASCADE children —
 *      messages, access tokens, notification schedules) must go BEFORE the
 *      accommodations.
 *   3. Reviews authored by the fake users: `accommodation_reviews.user_id`,
 *      `destination_reviews.user_id`, `gastronomy_reviews.user_id`,
 *      `experience_reviews.user_id` are all `NOT NULL` + `set null` (a delete
 *      of the referenced user ERRORS). Deleted by `user_id` BEFORE the users.
 *   4. `owner_promotions` owned by the fake users: `owner_id` is RESTRICT.
 *   5. The parent content: `posts` (CASCADEs post_sponsorships / r_post_post_tag),
 *      `events`, `event_organizers`, `event_locations`, then `accommodations`
 *      (CASCADEs media/faqs/reviews/amenity+feature joins/occupancy/
 *      calendar-sync/ia-data/external-listings/reputation/price-alerts/
 *      featured-grants). `posts.author_id` / `events.author_id` /
 *      `accommodations.owner_id` are RESTRICT → removing these rows clears the
 *      last blocking user references.
 *   6. The users, one per savepoint. After steps 1-5 every KNOWN blocking
 *      reference is gone, and the remaining inbound FKs are CASCADE
 *      (sessions/accounts/identities/push-tokens/permissions/search-history/
 *      bookmarks/collections/price-alerts/newsletter/ai-conversations/
 *      r_entity_tag.assigned_by) or SET NULL (audit columns everywhere,
 *      conversations.user_id, messages.user_id, entity_comments.author_id,
 *      review moderators, ...). Each delete runs inside a nested transaction
 *      (Postgres SAVEPOINT); if an UNFORESEEN blocking FK still references the
 *      user, only that user's delete rolls back and it is skipped + logged —
 *      the rest of the purge still commits (belt-and-suspenders against a FK
 *      not covered above; expected count is zero).
 *
 * ## Idempotency
 *
 * The whole migration runs in one runner-managed transaction (atomic: a throw
 * rolls everything back, no partial batch, no ledger row). Re-running after a
 * successful apply is a no-op via the ledger. Even run directly against an
 * already-purged DB it is safe: the recomputed fake ids match no rows, the
 * owner/author resolution yields no users, and every `DELETE ... WHERE ... IN
 * ()` is skipped, so all counts come back zero.
 *
 * ## `destructive` flag
 *
 * `true` — this is a bulk hard delete. The runner's production gate therefore
 * requires the explicit opt-in (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` /
 * `--allow-destructive`) before it runs in production.
 *
 * ## Known, intentional side effect (denormalized counters)
 *
 * Reviews authored by the fake users are deleted from PRESERVED parents
 * (`destinations`, `gastronomies`). Their denormalized `reviews_count` /
 * `average_rating` columns are NOT recomputed here (out of this purge's
 * scope, and rating math is error-prone). They drift slightly high until a
 * reconcile pass runs. Reviews on the deleted accommodations cascade away with
 * the accommodation, so no accommodation drift exists.
 */
import {
    accommodationReviews,
    accommodations,
    conversations,
    destinationReviews,
    entityComments,
    entityViews,
    eq,
    eventLocations,
    eventOrganizers,
    events,
    experienceReviews,
    gastronomyReviews,
    inArray,
    ownerPromotions,
    posts,
    rEntityTag,
    userBookmarks,
    users
} from '@repo/db';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { logger } from '../utils/logger.js';
import { computeFakeExampleIds, EXAMPLE_USER_EMAILS } from './purge-seed-example-data.helpers.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0023-purge-seed-example-data',
    // 'required' (NOT 'example'): the prod gate refuses example-group
    // migrations in production unconditionally, and this purge must be able to
    // run there behind the destructive opt-in.
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/** De-duplicates while preserving insertion order. */
const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/**
 * Deletes every row of `table` whose `column` is in `ids` and returns how many
 * rows were removed. A no-op returning 0 when `ids` is empty (keeps re-runs and
 * empty sets from emitting a `WHERE ... IN ()`).
 */
async function deleteWhereIn(params: {
    readonly db: SeedMigrationCtx['db'];
    readonly table: PgTable;
    readonly column: PgColumn;
    readonly ids: readonly string[];
}): Promise<number> {
    const { db, table, column, ids } = params;
    if (ids.length === 0) {
        return 0;
    }
    const deleted = await db
        .delete(table)
        .where(inArray(column, [...ids]))
        .returning({ deletedId: column });
    return deleted.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const { db } = ctx;

    // ── Step 0: recompute the deterministic ids of the fake content ──────────
    const { accommodationIds, postIds, eventIds, eventOrganizerIds, eventLocationIds } =
        computeFakeExampleIds();

    // Polymorphic tables key rows by a bare `entity_id` (uuid, globally unique
    // across entity types), so matching by id alone — without the entity_type
    // discriminator — is exact and cannot collide.
    const contentIds = unique([...accommodationIds, ...postIds, ...eventIds]);

    // ── Step 1: resolve the fake user set from the DB, guarded by allowlist ──
    // Owners of the fake accommodations ∪ authors of the fake posts/events.
    const ownerRows =
        accommodationIds.length > 0
            ? await db
                  .select({ userId: accommodations.ownerId })
                  .from(accommodations)
                  .where(inArray(accommodations.id, [...accommodationIds]))
            : [];
    const postAuthorRows =
        postIds.length > 0
            ? await db
                  .select({ userId: posts.authorId })
                  .from(posts)
                  .where(inArray(posts.id, [...postIds]))
            : [];
    const eventAuthorRows =
        eventIds.length > 0
            ? await db
                  .select({ userId: events.authorId })
                  .from(events)
                  .where(inArray(events.id, [...eventIds]))
            : [];

    const candidateUserIds = unique(
        [...ownerRows, ...postAuthorRows, ...eventAuthorRows]
            .map((row) => row.userId)
            .filter((id): id is string => typeof id === 'string')
    );

    const candidateUsers =
        candidateUserIds.length > 0
            ? await db
                  .select({ id: users.id, email: users.email })
                  .from(users)
                  .where(inArray(users.id, candidateUserIds))
            : [];

    const allowedEmails = new Set(EXAMPLE_USER_EMAILS.map((email) => email.toLowerCase()));
    const fakeUserIds: string[] = [];
    let usersCandidatesNotInAllowlist = 0;
    for (const user of candidateUsers) {
        if (user.email && allowedEmails.has(user.email.toLowerCase())) {
            fakeUserIds.push(user.id);
        } else {
            usersCandidatesNotInAllowlist += 1;
            logger.warn(
                `purge: candidate user ${user.id} (email=${user.email ?? 'null'}) owns/authored fake content but is NOT in the example allowlist — leaving it untouched.`
            );
        }
    }

    // ── Step 2: polymorphic / no-FK orphan cleanup ──────────────────────────
    // None of these cascade when the referenced entity/user is deleted.
    const entityViewsDeleted = await deleteWhereIn({
        db,
        table: entityViews,
        column: entityViews.entityId,
        ids: contentIds
    });
    const entityCommentsDeleted = await deleteWhereIn({
        db,
        table: entityComments,
        column: entityComments.entityId,
        ids: contentIds
    });
    const entityTagsDeleted = await deleteWhereIn({
        db,
        table: rEntityTag,
        column: rEntityTag.entityId,
        ids: contentIds
    });
    // Bookmarks pointing at fake accommodations/posts/events (polymorphic
    // entity_id, no FK) PLUS admin-created bookmarks pointing at a fake USER
    // (entity_type USER). Bookmarks OWNED by a fake user cascade later via
    // user_bookmarks.user_id → users (CASCADE); these are the inbound ones.
    const userBookmarksDeleted = await deleteWhereIn({
        db,
        table: userBookmarks,
        column: userBookmarks.entityId,
        ids: unique([...contentIds, ...fakeUserIds])
    });

    // ── Step 3: conversations for fake accommodations (RESTRICT blocker) ─────
    // conversations.accommodation_id is ON DELETE RESTRICT; deleting the
    // conversation CASCADEs its messages, access tokens and notification
    // schedules. conversations.user_id is SET NULL, so this does not depend on
    // the fake-user resolution.
    const conversationsDeleted = await deleteWhereIn({
        db,
        table: conversations,
        column: conversations.accommodationId,
        ids: accommodationIds
    });

    // ── Step 4: reviews authored by the fake users (NOT NULL + set null) ─────
    // These four FKs are NOT NULL with onDelete 'set null' — a user delete
    // ERRORS on them, so they must be removed by user_id first. (Reviews on the
    // fake accommodations also cascade in step 5; deleting by user_id here also
    // clears reviews the fake users left on PRESERVED destinations/gastronomies.)
    const accommodationReviewsDeleted = await deleteWhereIn({
        db,
        table: accommodationReviews,
        column: accommodationReviews.userId,
        ids: fakeUserIds
    });
    const destinationReviewsDeleted = await deleteWhereIn({
        db,
        table: destinationReviews,
        column: destinationReviews.userId,
        ids: fakeUserIds
    });
    const gastronomyReviewsDeleted = await deleteWhereIn({
        db,
        table: gastronomyReviews,
        column: gastronomyReviews.userId,
        ids: fakeUserIds
    });
    const experienceReviewsDeleted = await deleteWhereIn({
        db,
        table: experienceReviews,
        column: experienceReviews.userId,
        ids: fakeUserIds
    });

    // ── Step 5a: owner promotions owned by fake users (RESTRICT on owner_id) ─
    const ownerPromotionsDeleted = await deleteWhereIn({
        db,
        table: ownerPromotions,
        column: ownerPromotions.ownerId,
        ids: fakeUserIds
    });

    // ── Step 5b: the parent content entities ─────────────────────────────────
    // posts / events / accommodations hold the RESTRICT author_id / owner_id
    // refs to users; removing them clears the last blocking user references.
    // event_organizers / event_locations are referenced by events.organizer_id
    // / location_id with SET NULL, so deleting them after the events is clean.
    // Each accommodation delete CASCADEs all of its child tables.
    const postsDeleted = await deleteWhereIn({
        db,
        table: posts,
        column: posts.id,
        ids: postIds
    });
    const eventsDeleted = await deleteWhereIn({
        db,
        table: events,
        column: events.id,
        ids: eventIds
    });
    const eventOrganizersDeleted = await deleteWhereIn({
        db,
        table: eventOrganizers,
        column: eventOrganizers.id,
        ids: eventOrganizerIds
    });
    const eventLocationsDeleted = await deleteWhereIn({
        db,
        table: eventLocations,
        column: eventLocations.id,
        ids: eventLocationIds
    });
    const accommodationsDeleted = await deleteWhereIn({
        db,
        table: accommodations,
        column: accommodations.id,
        ids: accommodationIds
    });

    // ── Step 6: delete the fake users, one SAVEPOINT each ────────────────────
    // All KNOWN blocking references were cleared above; the remaining inbound
    // FKs are CASCADE or SET NULL and resolve automatically. The per-user
    // nested transaction isolates any UNFORESEEN blocker so it skips that one
    // user instead of aborting the whole purge (expected skip count: 0).
    let usersDeleted = 0;
    const usersSkipped: string[] = [];
    for (const userId of fakeUserIds) {
        try {
            await db.transaction(async (tx) => {
                await tx.delete(users).where(eq(users.id, userId));
            });
            usersDeleted += 1;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            usersSkipped.push(userId);
            logger.warn(
                `purge: could NOT delete example user ${userId} — a reference still blocks it: ${message}`
            );
        }
    }

    const counts: Record<string, number> = {
        accommodationsDeleted,
        postsDeleted,
        eventsDeleted,
        eventOrganizersDeleted,
        eventLocationsDeleted,
        conversationsDeleted,
        ownerPromotionsDeleted,
        accommodationReviewsDeleted,
        destinationReviewsDeleted,
        gastronomyReviewsDeleted,
        experienceReviewsDeleted,
        entityViewsDeleted,
        entityCommentsDeleted,
        entityTagsDeleted,
        userBookmarksDeleted,
        usersResolvedCandidates: candidateUsers.length,
        usersDeleted,
        usersSkippedBlocked: usersSkipped.length,
        usersCandidatesNotInAllowlist
    };

    return {
        summary:
            `Purged example data: ${accommodationsDeleted} accommodations, ${postsDeleted} posts, ` +
            `${eventsDeleted} events, ${eventOrganizersDeleted} organizers, ${eventLocationsDeleted} locations, ` +
            `${usersDeleted} users (${usersSkipped.length} skipped, ${usersCandidatesNotInAllowlist} not in allowlist).`,
        counts
    };
}
