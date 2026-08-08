import { z } from 'zod';
import { requiresMentionUrl } from '../../enums/partner-mention-channel.schema.js';
import { partnerMentionSchema } from './partner-mention.schema.js';

/**
 * One channel within a mention submission (HOS-377 §6).
 *
 * Picked from the entity rather than re-declared, so the channel list and the URL
 * format stay defined in exactly one place.
 *
 * Carries the per-channel URL rule (AC-8, closes OQ-3): required for every channel
 * that produces a public permalink, optional for `WHATSAPP` — a broadcast to a list
 * has no public URL — and `OTHER`, which is unknown by construction. The rule lives
 * here rather than in a DB CHECK because a constraint encoding it would have to be
 * rewritten every time a channel is added; `requiresMentionUrl` owns the decision and
 * a partition test in the enum suite fails when a new channel skips it.
 *
 * The error is attached to the `url` path so the admin form can surface it on the
 * offending channel's own field rather than at the top of the form — with N channels
 * selected there are N URL inputs, and a form-level error would not say which one.
 */
export const partnerMentionEntrySchema = partnerMentionSchema
    .pick({ channel: true, url: true })
    .superRefine((entry, ctx) => {
        if (!requiresMentionUrl({ channel: entry.channel })) return;
        if (entry.url) return;

        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'zodError.partnerMention.url.requiredForChannel'
        });
    });

export type PartnerMentionEntry = z.infer<typeof partnerMentionEntrySchema>;

/**
 * Body of `POST /admin/partners/{partnerId}/mentions` — one submission, N rows.
 *
 * A campaign usually runs across several networks at once and the admin logs all of
 * them in one go, so this takes an ARRAY of entries and the service writes one row
 * per entry inside a single transaction. The date and the internal note are shared
 * by the whole submission; only the channel and its link vary per entry.
 *
 * ## `batchId` is absent on purpose
 *
 * It is generated server-side inside the creating transaction and is deliberately
 * not part of this shape. Zod strips unknown keys, so a client that sends one gets
 * it dropped before the service ever sees it — but that guarantee only holds if the
 * service inserts from the PARSED output. Building an insert from the raw body
 * instead would let a caller file one partner's mention into another partner's
 * batch, and the partner-facing view groups by exactly that column (R-5).
 *
 * `partnerId` is likewise absent: it comes from the URL path, which is the
 * authoritative one. Accepting it in the body would create a second, disagreeing
 * source for who the mention belongs to.
 */
export const createPartnerMentionBatchSchema = z.object({
    /** When the promotion happened — shared by every entry in the submission. */
    mentionedAt: partnerMentionSchema.shape.mentionedAt,
    /** Admin-only context for the whole submission. Never shown to the partner. */
    internalNote: partnerMentionSchema.shape.internalNote,
    /**
     * One entry per channel. At least one — an empty submission is a no-op that
     * would otherwise create a batch with nothing in it.
     */
    entries: z
        .array(partnerMentionEntrySchema)
        .min(1, { message: 'zodError.partnerMention.entries.empty' })
});

export type CreatePartnerMentionBatch = z.infer<typeof createPartnerMentionBatchSchema>;
