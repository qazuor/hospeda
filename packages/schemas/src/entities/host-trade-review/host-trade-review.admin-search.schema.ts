import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { ModerationStatusEnumSchema } from '../../enums/moderation-status.schema.js';

/**
 * HostTradeReviewAdminSearchSchema — filters for
 * `GET /admin/host-trades/reviews` (HOS-376 §7.5).
 *
 * `moderationState` is the filter the moderation queue is built on, and it is a
 * SEPARATE field from the base schema's `status`, which stays a lifecycle
 * filter. The two are independent axes here — an ACTIVE review can be PENDING —
 * so collapsing them would make "show me everything awaiting review"
 * unexpressible.
 */
export const HostTradeReviewAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by provider. */
    hostTradeId: z.string().uuid().optional(),

    /** Filter by the host who wrote it. */
    hostUserId: z.string().uuid().optional(),

    /** The moderation queue's filter. */
    moderationState: ModerationStatusEnumSchema.optional(),

    /**
     * Filter by the benefit answer.
     *
     * `queryBooleanParam()` rather than `z.coerce.boolean()`, which turns the
     * string "false" into `true` and would silently invert this filter — the
     * one worth reading on its own, since a provider not honouring the benefit
     * is the failure the directory most needs to surface.
     */
    respectedBenefit: queryBooleanParam().describe('Filter by whether the benefit was honoured')
});

/** Inferred type for {@link HostTradeReviewAdminSearchSchema}. */
export type HostTradeReviewAdminSearch = z.infer<typeof HostTradeReviewAdminSearchSchema>;
