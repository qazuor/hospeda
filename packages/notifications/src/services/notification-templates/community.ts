/**
 * Template selectors of the community notification types.
 *
 * Covers: Alliance, host-trade, partner, listing, calendar and promotion notifications.
 *
 * Moved verbatim out of `NotificationService.selectTemplate` (HOS-2519 D6), so
 * the production send and the admin email preview map a payload to the same
 * component with the same props. A type with a template but no selector here
 * renders nothing and the email is silently never sent.
 *
 * @module services/notification-templates/community
 */

import {
    AccommodationCalendarFeedBroken,
    AllianceClaimInvite,
    AllianceLeadDecision,
    HostTradeRevoked,
    ListingLocationExceptionDecision,
    PartnerMentionsLogged,
    PartnerRevoked,
    ReplyModerated,
    ReviewReceived,
    UsageConfirmationReminder,
    UsageConfirmationRequest,
    UsageConfirmed,
    UsageRejected,
    VipPromotionsPaused,
    VipPromotionsWeeklyDigest
} from '../../templates/index.js';
import { formatDate } from '../../templates/utils/index.js';
import type {
    AccommodationCalendarFeedBrokenPayload,
    AllianceClaimInvitePayload,
    AllianceLeadDecisionPayload,
    HostTradeReplyModeratedPayload,
    HostTradeReviewReceivedPayload,
    HostTradeRevokedPayload,
    HostTradeUsageConfirmationReminderPayload,
    HostTradeUsageConfirmationRequestPayload,
    HostTradeUsageConfirmedPayload,
    HostTradeUsageRejectedPayload,
    ListingLocationExceptionDecisionPayload,
    PartnerMentionsLoggedPayload,
    PartnerRevokedPayload,
    VipPromotionsPausedPayload,
    VipPromotionsWeeklyDigestPayload
} from '../../types/notification.types.js';
import type { NotificationTemplateSelectors } from './types.js';

/** Selectors of the community notification types. */
export const COMMUNITY_NOTIFICATION_TEMPLATES: NotificationTemplateSelectors = {
    alliance_claim_invite: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AllianceClaimInvitePayload;
        return AllianceClaimInvite({
            recipientName,
            programLabel: p.programLabel,
            claimUrl: p.claimUrl,
            expiresAtLabel: formatDate({ dateString: p.expiresAt })
        });
    },
    alliance_lead_decision: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AllianceLeadDecisionPayload;
        return AllianceLeadDecision({
            recipientName,
            programLabel: p.programLabel,
            outcome: p.outcome
        });
    },
    host_trade_usage_confirmation_request: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeUsageConfirmationRequestPayload;
        return UsageConfirmationRequest({
            recipientName,
            counterpartName: p.counterpartName,
            servicedAtLabel: formatDate({ dateString: p.servicedAt }),
            expiresAtLabel: formatDate({ dateString: p.expiresAt }),
            actionUrl: p.actionUrl
        });
    },
    host_trade_usage_confirmation_reminder: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeUsageConfirmationReminderPayload;
        return UsageConfirmationReminder({
            recipientName,
            counterpartName: p.counterpartName,
            expiresAtLabel: formatDate({ dateString: p.expiresAt }),
            actionUrl: p.actionUrl
        });
    },
    host_trade_usage_confirmed: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeUsageConfirmedPayload;
        return UsageConfirmed({
            recipientName,
            counterpartName: p.counterpartName,
            canReview: p.canReview,
            reviewUrl: p.reviewUrl
        });
    },
    host_trade_usage_rejected: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeUsageRejectedPayload;
        return UsageRejected({
            recipientName,
            counterpartName: p.counterpartName,
            note: p.note
        });
    },
    host_trade_review_received: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeReviewReceivedPayload;
        return ReviewReceived({
            recipientName,
            listingName: p.listingName,
            overallRating: p.overallRating,
            respectedBenefit: p.respectedBenefit,
            actionUrl: p.actionUrl
        });
    },
    host_trade_reply_moderated: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeReplyModeratedPayload;
        return ReplyModerated({
            recipientName,
            outcome: p.outcome,
            reason: p.reason,
            actionUrl: p.actionUrl
        });
    },
    host_trade_revoked: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as HostTradeRevokedPayload;
        return HostTradeRevoked({
            recipientName,
            listingName: p.listingName,
            reason: p.reason
        });
    },
    partner_revoked: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as PartnerRevokedPayload;
        return PartnerRevoked({
            recipientName,
            partnerName: p.partnerName,
            reason: p.reason
        });
    },
    partner_mentions_logged: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as PartnerMentionsLoggedPayload;
        return PartnerMentionsLogged({
            recipientName,
            partnerName: p.partnerName,
            mentionedAtLabel: p.mentionedAtLabel,
            mentions: p.mentions
        });
    },
    listing_location_exception_approved: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as ListingLocationExceptionDecisionPayload;
        return ListingLocationExceptionDecision({
            recipientName,
            locale: p.locale,
            approved: payload.type === 'listing_location_exception_approved',
            listingName: p.listingName,
            decisionReason: p.decisionReason,
            editorUrl: p.editorUrl
        });
    },
    listing_location_exception_rejected: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as ListingLocationExceptionDecisionPayload;
        return ListingLocationExceptionDecision({
            recipientName,
            locale: p.locale,
            approved: payload.type === 'listing_location_exception_approved',
            listingName: p.listingName,
            decisionReason: p.decisionReason,
            editorUrl: p.editorUrl
        });
    },
    accommodation_calendar_feed_broken: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as AccommodationCalendarFeedBrokenPayload;
        return AccommodationCalendarFeedBroken({
            recipientName,
            accommodationName: p.accommodationName,
            providerLabel: p.providerLabel,
            reconnectUrl: p.reconnectUrl
        });
    },
    vip_promotions_weekly_digest: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as VipPromotionsWeeklyDigestPayload;
        return VipPromotionsWeeklyDigest({
            recipientName,
            locale: p.locale,
            promotions: p.promotions,
            moreCount: p.moreCount,
            promotionsUrl: p.promotionsUrl,
            preferencesUrl: p.preferencesUrl
        });
    },
    vip_promotions_paused: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as VipPromotionsPausedPayload;
        return VipPromotionsPaused({
            recipientName,
            locale: p.locale,
            promotionTitles: p.promotionTitles,
            promotionsUrl: p.promotionsUrl
        });
    }
};
