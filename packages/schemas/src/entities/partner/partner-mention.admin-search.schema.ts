// biome-ignore lint/style/useImportType: z is used in z.infer() for type inference
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { PartnerMentionBatchIdSchema } from '../../common/id.schema.js';
import { PartnerMentionChannelEnumSchema } from '../../enums/partner-mention-channel.schema.js';

/**
 * Admin list filters for one partner's mention log (HOS-377).
 *
 * Extends {@link AdminSearchBaseSchema}, so it inherits `page`/`pageSize` — never
 * `limit`, which `createAdminListRoute` rejects along with any other undeclared
 * parameter. That rejection is the reason every filter the UI intends to send has
 * to be declared here: an undeclared one is dropped, and a dropped filter returns
 * an unfiltered list that looks like a legitimate answer.
 *
 * `partnerId` is deliberately absent — it comes from the URL path
 * (`/admin/partners/{partnerId}/mentions`), which is the authoritative scope. A
 * body or query copy of it could disagree with the path, and whichever one lost
 * would be a cross-partner read.
 */
export const adminSearchPartnerMentionSchema = AdminSearchBaseSchema.extend({
    /** Narrow to a single channel — the "show me only the Instagram ones" view. */
    channel: PartnerMentionChannelEnumSchema.optional(),
    /** Pull back exactly the rows written by one submission. */
    batchId: PartnerMentionBatchIdSchema.optional(),
    /**
     * Range over `mentioned_at` — when the promotion HAPPENED.
     *
     * Distinct from the inherited `createdAfter`/`createdBefore`, which range over
     * `created_at`, when an admin logged it. Both are legitimate questions and they
     * give different answers for anything entered after the fact, so the log offers
     * both rather than collapsing them.
     */
    mentionedAfter: z.coerce.date().optional(),
    mentionedBefore: z.coerce.date().optional()
});

export type AdminSearchPartnerMention = z.infer<typeof adminSearchPartnerMentionSchema>;
