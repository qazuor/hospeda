import { z } from 'zod';
import { requiresMentionUrl } from '../../enums/partner-mention-channel.schema.js';
import { partnerMentionSchema } from './partner-mention.schema.js';

/**
 * Correct ONE already-logged mention (HOS-377, closes OQ-6).
 *
 * These rows are typed in by a human at the moment they perform the action, so a
 * wrong date or a link pasted from the wrong tab is a matter of when, not if.
 * That is why this table is editable at all, unlike `social_publish_logs`, which
 * records a machine and therefore never mistypes.
 *
 * `partnerId` and `batchId` are NOT editable. Moving a mention to another partner
 * or into another batch is not a correction, it is a different row: the first
 * would silently transfer one partner's proof of service to another, and the
 * second would regroup a campaign that already went out in an email.
 *
 * ## Changing the channel drags the URL with it
 *
 * A patch that switches the channel to one requiring a permalink must carry the
 * URL in the same request, even though every field here is otherwise optional.
 * Two reasons, and the second is the one that matters:
 *
 * 1. Domain-wise, "this was Facebook, not Instagram" almost always means the
 *    stored link is wrong too — it points at the network being corrected away
 *    from.
 * 2. The schema sees only the patch, never the stored row. Allowing a bare
 *    `{ channel: 'INSTAGRAM' }` would let a `WHATSAPP` row with no URL become an
 *    `INSTAGRAM` row with no URL, quietly breaking AC-8 on a record that already
 *    passed validation on the way in.
 *
 * The mirror case — `{ url: null }` with no channel — is NOT expressible here,
 * because whether that is legal depends on the stored channel. The service
 * re-validates the MERGED row for exactly that gap; this schema is the first
 * gate, not the only one.
 */
export const updatePartnerMentionSchema = partnerMentionSchema
    .pick({
        channel: true,
        mentionedAt: true,
        url: true,
        internalNote: true
    })
    .partial()
    .superRefine((patch, ctx) => {
        if (patch.channel === undefined) return;
        if (!requiresMentionUrl({ channel: patch.channel })) return;
        if (patch.url) return;

        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['url'],
            message: 'zodError.partnerMention.url.requiredForChannel'
        });
    });

export type UpdatePartnerMention = z.infer<typeof updatePartnerMentionSchema>;
