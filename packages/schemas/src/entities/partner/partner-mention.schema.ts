import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    PartnerIdSchema,
    PartnerMentionBatchIdSchema,
    PartnerMentionIdSchema
} from '../../common/id.schema.js';
import { PartnerMentionChannelEnumSchema } from '../../enums/partner-mention-channel.schema.js';

/**
 * One logged manual promotion action for a partner (HOS-377).
 *
 * Mirrors the `partner_mentions` row. This is the ENTITY shape — the read model
 * every consumer sees. The write-side rules that depend on relationships between
 * fields (notably "url is required unless the channel is WHATSAPP or OTHER") live
 * on the create/update schemas, deliberately NOT here.
 *
 * That separation is load-bearing rather than stylistic: attaching a `.refine()`
 * to this object would make it un-sliceable, and `.pick()` / `.omit()` /
 * `.partial()` on it are exactly how the create, update and partner-facing
 * schemas are derived. Keep this a plain `z.object`.
 */
export const partnerMentionSchema = z.object({
    id: PartnerMentionIdSchema,
    /** The partner this mention promoted. */
    partnerId: PartnerIdSchema,
    /** Where it happened, from the closed channel list. */
    channel: PartnerMentionChannelEnumSchema,
    /**
     * Groups the rows written by one admin submission — a campaign run across
     * several networks. Null when the mention was logged on its own.
     *
     * Present on the read model because the partner-facing view groups by it, but
     * never accepted on a write: the server generates it inside the transaction.
     */
    batchId: PartnerMentionBatchIdSchema.nullish(),
    /**
     * When the promotion actually happened.
     *
     * Distinct from {@link BaseAuditFields.createdAt}, which is when an admin got
     * around to logging it. The partner-facing log is ordered by THIS field, so a
     * mention entered a week late still appears on the date it really happened.
     */
    mentionedAt: z.coerce.date({
        message: 'zodError.partnerMention.mentionedAt.required'
    }),
    /**
     * Link to the publication, so the partner can verify it.
     *
     * Nullish on the entity because `WHATSAPP` broadcasts and `OTHER` have no
     * public permalink. Whether a given row is ALLOWED to omit it is a per-channel
     * question answered on the write schemas via `requiresMentionUrl`.
     */
    url: z
        .string()
        .url({ message: 'zodError.partnerMention.url.invalid' })
        .max(2048, { message: 'zodError.partnerMention.url.tooLong' })
        .nullish(),
    /**
     * Admin-only context. Never rendered to the partner and stripped from every
     * partner-facing response payload, not merely hidden in the UI.
     */
    internalNote: z
        .string()
        .max(2000, { message: 'zodError.partnerMention.internalNote.tooLong' })
        .nullish(),
    ...BaseAuditFields
});

export type PartnerMention = z.infer<typeof partnerMentionSchema>;

/**
 * The admin-only columns, as an `.omit()` mask.
 *
 * Applied to build the partner-facing shape so that "what the partner must not
 * see" is stated once, in one place, instead of being re-listed at each endpoint
 * that happens to return a mention.
 */
export const PARTNER_MENTION_ADMIN_ONLY_MASK = {
    internalNote: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    deletedAt: true
} as const;

/**
 * What a partner is allowed to see of their own mention log.
 *
 * Derived from the entity by removing {@link PARTNER_MENTION_ADMIN_ONLY_MASK}
 * rather than re-declared, so a column added to the entity cannot silently reach
 * the partner-facing payload without someone deciding which side it belongs on.
 */
export const partnerMentionPublicSchema = partnerMentionSchema.omit(
    PARTNER_MENTION_ADMIN_ONLY_MASK
);

export type PartnerMentionPublic = z.infer<typeof partnerMentionPublicSchema>;
