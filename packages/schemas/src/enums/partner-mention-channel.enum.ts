/**
 * Channels through which the Hospeda team manually promotes a partner (HOS-377).
 *
 * Each value names a place where a promotion action actually happened, so the
 * partner can be shown a verifiable log of it. Deliberately a CLOSED list rather
 * than free text: with free text "Instagram", "IG" and "instagram" are three
 * distinct channels and nothing groups, counts, or gets an icon. Adding a channel
 * later is a one-value addition here plus a matching pg enum value.
 *
 * These are promotion channels, NOT the social-automation publishing targets —
 * see {@link SocialPlatformEnum}, which is a different list for a different
 * pipeline (Make.com dispatch) and must not be conflated with this one.
 *
 * @module partner-mention-channel.enum
 */

/**
 * Every channel a partner mention can be logged against.
 *
 * @example
 * ```ts
 * import { PartnerMentionChannelEnum } from '@repo/schemas';
 *
 * const channel: PartnerMentionChannelEnum = PartnerMentionChannelEnum.INSTAGRAM;
 * ```
 */
export enum PartnerMentionChannelEnum {
    /** Instagram post, reel or story mentioning the partner. */
    INSTAGRAM = 'INSTAGRAM',

    /** Facebook post mentioning the partner. */
    FACEBOOK = 'FACEBOOK',

    /**
     * X / Twitter post mentioning the partner.
     *
     * Named `TWITTER` on the owner's explicit instruction, diverging from
     * {@link SocialPlatformEnum}'s `X`. The two enums are independent lists and
     * do not need to agree; do not "align" them without asking, and map the icon
     * by this value rather than assuming the social-automation naming.
     */
    TWITTER = 'TWITTER',

    /** YouTube video or community post mentioning the partner. */
    YOUTUBE = 'YOUTUBE',

    /** TikTok video mentioning the partner. */
    TIKTOK = 'TIKTOK',

    /** Inclusion in a Hospeda email newsletter. */
    NEWSLETTER = 'NEWSLETTER',

    /**
     * WhatsApp broadcast or campaign.
     *
     * The one social-ish channel with no public permalink, which is why the
     * mention URL is optional for it (HOS-377 OQ-3) rather than globally required.
     */
    WHATSAPP = 'WHATSAPP',

    /**
     * Anything not covered above.
     *
     * The escape hatch that keeps an unanticipated channel from blocking an admin
     * mid-campaign. Like {@link WHATSAPP}, it does not require a URL, since there
     * is no way to know whether the unnamed channel produces one.
     */
    OTHER = 'OTHER'
}
