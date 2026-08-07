/**
 * @fileoverview
 * Data migration: 0035-hos-374-approve-existing-posts-events
 *
 * Marks every existing post and event `moderationState = 'APPROVED'`, so that
 * the publication gate HOS-374 is about to introduce does not hide content that
 * is live today.
 *
 * ## Background
 *
 * `posts.moderation_state` and `events.moderation_state` are
 * `NOT NULL DEFAULT 'PENDING'` and, as of this migration, gate nothing: no read
 * path, no permission check and no query consults either column
 * (`checkCanViewPost` / `checkCanViewEvent` look only at `visibility`). Content
 * created through the HTTP layer is written `PENDING` unconditionally by
 * `httpToDomainPostCreate` / `httpToDomainEventCreate`, and the example seeders
 * never set the column at all, so it falls to the `PENDING` default.
 *
 * HOS-374 makes `moderationState = 'APPROVED'` a requirement for public
 * visibility. Applied to the data as it stands, that would hide **every post
 * and event whose state was never explicitly set** — which is all of them except
 * the editorial blog posts written by `0025-seed-real-blog-posts`, the one place
 * that does set `APPROVED` explicitly.
 *
 * ## Why this ships BEFORE the gate, in its own release
 *
 * Bundling the backfill with the gate would leave a window: the new code is live
 * from the moment the container starts, while data-migrations run as a separate
 * step. In that window every affected post and event is invisible to the public.
 *
 * Running the backfill first is safe precisely because the column is inert
 * today — flipping `PENDING` to `APPROVED` changes no behavior whatsoever until
 * the gate lands. So this migration is a no-op in production terms, and by the
 * time the gate ships the data already satisfies it.
 *
 * ## Scope
 *
 * Only rows that are **not soft-deleted** and are still `PENDING` are touched.
 *
 * - A `REJECTED` row is left alone: someone made that call deliberately, and
 *   silently approving it would override a human decision.
 * - A soft-deleted row is left alone: it is not public either way, and
 *   approving it would misrepresent it if it is ever restored.
 * - `visibility` and `lifecycleState` are not touched at all. This migration
 *   grandfathers the moderation verdict only; a post that is `PRIVATE` today
 *   stays `PRIVATE`.
 *
 * ## Idempotency
 *
 * Re-running is a no-op: after the first pass no non-deleted row matches
 * `PENDING` any more. Rows that later enter `PENDING` through the normal
 * authoring flow are intentionally NOT re-approved — that is the gate doing its
 * job, and re-running this migration must never launder them.
 *
 * ## Dual-write note
 *
 * No baseline fixture changes accompany this migration, by design. The example
 * post/event seeders do not write `moderationState` at all, and must keep not
 * writing it: their rows are demo content whose correct born state, once the
 * gate exists, is the `PENDING` default. This migration grandfathers rows that
 * predate the gate; it is not a new convention for seed data.
 *
 * ## `destructive` flag decision
 *
 * `false`. It writes one enum column on rows that are already public, preserves
 * every explicit human decision (`REJECTED`), deletes nothing, and is reversible
 * by writing `PENDING` back.
 */
import { and, eq, events, isNull, posts } from '@repo/db';
import { ModerationStatusEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0035-hos-374-approve-existing-posts-events',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const approvedPosts = await ctx.db
        .update(posts)
        .set({
            moderationState: ModerationStatusEnum.APPROVED,
            updatedAt: new Date()
        })
        .where(
            and(eq(posts.moderationState, ModerationStatusEnum.PENDING), isNull(posts.deletedAt))
        )
        .returning({ slug: posts.slug });

    const approvedEvents = await ctx.db
        .update(events)
        .set({
            moderationState: ModerationStatusEnum.APPROVED,
            updatedAt: new Date()
        })
        .where(
            and(eq(events.moderationState, ModerationStatusEnum.PENDING), isNull(events.deletedAt))
        )
        .returning({ slug: events.slug });

    return {
        summary: `Grandfathered ${approvedPosts.length} post(s) and ${approvedEvents.length} event(s) to APPROVED ahead of the HOS-374 publication gate. REJECTED and soft-deleted rows left untouched.`,
        counts: {
            postsApproved: approvedPosts.length,
            eventsApproved: approvedEvents.length
        }
    };
}
