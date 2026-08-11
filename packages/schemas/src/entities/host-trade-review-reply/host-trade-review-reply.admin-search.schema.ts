import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';

/**
 * HostTradeReviewReplyAdminSearchSchema — filters for
 * `GET /admin/host-trades/replies` (HOS-376 §7.5).
 *
 * This queue is the PRIORITY one, not the review queue: a PENDING review is
 * already published, while a PENDING reply is a provider waiting to be allowed
 * to answer a complaint. `moderationState` is the filter it is built on, and it
 * stays a SEPARATE field from the base schema's `status` — the two are
 * independent axes, so collapsing them would make "everything awaiting review"
 * unexpressible.
 */
export const HostTradeReviewReplyAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by the review being answered. */
    reviewId: z.string().uuid().optional(),

    /** Filter by the provider who wrote the reply. */
    authorUserId: z.string().uuid().optional(),

    /** The moderation queue's filter. */
    moderationState: ModerationStatusEnumSchema.optional()
});

/** Inferred type for {@link HostTradeReviewReplyAdminSearchSchema}. */
export type HostTradeReviewReplyAdminSearch = z.infer<typeof HostTradeReviewReplyAdminSearchSchema>;
