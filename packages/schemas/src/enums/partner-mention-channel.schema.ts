import { z } from 'zod';
import { PartnerMentionChannelEnum } from './partner-mention-channel.enum.js';

/**
 * Zod schema for {@link PartnerMentionChannelEnum} validation.
 * Accepts every PartnerMentionChannelEnum value (derived automatically via z.nativeEnum).
 */
export const PartnerMentionChannelEnumSchema = z.nativeEnum(PartnerMentionChannelEnum, {
    error: () => ({ message: 'zodError.enums.partnerMentionChannel.invalid' })
});

/** TypeScript type inferred from {@link PartnerMentionChannelEnumSchema}. */
export type PartnerMentionChannel = z.infer<typeof PartnerMentionChannelEnumSchema>;

/**
 * Channels whose mentions must carry a URL (HOS-377 OQ-3 / AC-8).
 *
 * Every channel here produces a public permalink the partner can open to verify
 * the mention actually happened — which is the entire point of the log. The two
 * absentees are deliberate, not an oversight: a WhatsApp broadcast to a list has
 * no public URL, and `OTHER` is unknown by construction.
 *
 * Consumed by the batch-create schema's per-entry refinement. Kept beside the enum
 * so adding a channel forces a decision about its URL requirement in the same file.
 */
export const PARTNER_MENTION_CHANNELS_REQUIRING_URL = [
    PartnerMentionChannelEnum.INSTAGRAM,
    PartnerMentionChannelEnum.FACEBOOK,
    PartnerMentionChannelEnum.TWITTER,
    PartnerMentionChannelEnum.YOUTUBE,
    PartnerMentionChannelEnum.TIKTOK,
    PartnerMentionChannelEnum.NEWSLETTER
] as const;

/**
 * Type guard for {@link PARTNER_MENTION_CHANNELS_REQUIRING_URL}.
 *
 * @param params - Receives the channel to check.
 * @returns `true` when a mention on this channel must carry a URL.
 */
export const requiresMentionUrl = ({
    channel
}: {
    readonly channel: PartnerMentionChannel;
}): boolean =>
    (PARTNER_MENTION_CHANNELS_REQUIRING_URL as readonly PartnerMentionChannel[]).includes(channel);
