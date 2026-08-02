/**
 * @file events.test.ts
 * @description Catalog-shape regression test for the explicit PostHog event
 * names exported by `src/lib/analytics/events.ts` (SPEC-140).
 *
 * These tests guard the public contract of the event catalog: the 5
 * acceptance-criteria events must stay present + use the agreed snake_case
 * naming convention so downstream PostHog dashboards keep matching.
 */

import { describe, expect, it } from 'vitest';
import { WebEvents } from '@/lib/analytics/events';

describe('WebEvents catalog (SPEC-140 acceptance)', () => {
    it('should expose the shared business-event aliases used by the web app', () => {
        // Assert
        expect(WebEvents).toEqual({
            DestinationViewed: 'destination_viewed',
            AccommodationSearched: 'search_performed',
            AccommodationViewed: 'accommodation_viewed',
            SignupCompleted: 'sign_up_completed',
            BookingInitiated: 'contact_owner_started',
            BookingRequestSent: 'contact_owner_completed',
            NewsletterSubscribed: 'newsletter_subscribed',
            ContributionBannerClicked: 'contribution_banner_clicked',
            ContributionReportSubmitted: 'contribution_report_submitted',
            ContributionPhotoSubmitted: 'contribution_photo_submitted',
            ContributionEditorSubmitted: 'contribution_editor_submitted',
            PostViewed: 'post_viewed',
            EventViewed: 'event_viewed',
            AiSearchSubmitted: 'ai_search_performed',
            AiSearchIntentApplied: 'ai_search_intent_applied',
            AiSearchFallbackKeyword: 'ai_search_fallback_keyword',
            AiSearchLoginPrompted: 'ai_search_login_prompted',
            PropertyImportAttempted: 'accommodation_import_started',
            PropertyImportSucceeded: 'accommodation_import_completed',
            PropertyImportFailed: 'accommodation_import_failed',
            FavoriteToggledAdd: 'favorite_added',
            FavoriteToggledRemove: 'favorite_removed',
            ReviewSubmitted: 'review_submitted',
            ConversationDuplicate: 'contact_owner_failed',
            ConversationRateLimited: 'contact_owner_failed'
        });
    });

    it('every event name should follow the snake_case convention', () => {
        // Arrange
        const snakeCase = /^[a-z][a-z0-9_]*$/;

        // Act / Assert
        for (const name of Object.values(WebEvents)) {
            expect(name, `${name} should be snake_case`).toMatch(snakeCase);
        }
    });

    it('every alias should point at a non-empty shared event name', () => {
        for (const [alias, value] of Object.entries(WebEvents)) {
            expect(value, `${alias} should map to a shared analytics event`).not.toHaveLength(0);
        }
    });
});
