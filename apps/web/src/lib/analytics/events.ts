/**
 * @file events.ts
 * @description Backward-compatible web event aliases backed by the shared
 * `@repo/analytics` catalog.
 */

import { AnalyticsEvents } from '@repo/analytics';

/**
 * Compatibility facade for existing web call sites.
 * Prefer importing `AnalyticsEvents` directly in new code.
 */
export const WebEvents = {
    DestinationViewed: AnalyticsEvents.destinationViewed,
    AccommodationSearched: AnalyticsEvents.searchPerformed,
    AccommodationViewed: AnalyticsEvents.accommodationViewed,
    SignupCompleted: AnalyticsEvents.signUpCompleted,
    BookingInitiated: AnalyticsEvents.contactOwnerStarted,
    BookingRequestSent: AnalyticsEvents.contactOwnerCompleted,
    NewsletterSubscribed: AnalyticsEvents.newsletterSubscribed,
    ContributionBannerClicked: AnalyticsEvents.contributionBannerClicked,
    ContributionReportSubmitted: AnalyticsEvents.contributionReportSubmitted,
    ContributionPhotoSubmitted: AnalyticsEvents.contributionPhotoSubmitted,
    ContributionEditorSubmitted: AnalyticsEvents.contributionEditorSubmitted,
    PostViewed: AnalyticsEvents.postViewed,
    EventViewed: AnalyticsEvents.eventViewed,
    AiSearchSubmitted: AnalyticsEvents.aiSearchPerformed,
    AiSearchIntentApplied: AnalyticsEvents.aiSearchIntentApplied,
    AiSearchFallbackKeyword: AnalyticsEvents.aiSearchFallbackKeyword,
    AiSearchLoginPrompted: AnalyticsEvents.aiSearchLoginPrompted,
    PropertyImportAttempted: AnalyticsEvents.accommodationImportStarted,
    PropertyImportSucceeded: AnalyticsEvents.accommodationImportCompleted,
    PropertyImportFailed: AnalyticsEvents.accommodationImportFailed,
    FavoriteToggledAdd: AnalyticsEvents.favoriteAdded,
    FavoriteToggledRemove: AnalyticsEvents.favoriteRemoved,
    ReviewSubmitted: AnalyticsEvents.reviewSubmitted,
    ConversationDuplicate: AnalyticsEvents.contactOwnerFailed,
    ConversationRateLimited: AnalyticsEvents.contactOwnerFailed
} as const;

export type WebEventName = (typeof WebEvents)[keyof typeof WebEvents];
