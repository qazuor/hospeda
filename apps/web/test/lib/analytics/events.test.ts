/**
 * @file events.test.ts
 * @description Catalog-shape regression test for the explicit PostHog event
 * names exported by `src/lib/analytics/events.ts` (SPEC-140).
 *
 * These tests guard the public contract of the event catalog: the 5
 * acceptance-criteria events must stay present + use the agreed snake_case
 * naming convention so downstream PostHog dashboards keep matching.
 */

import { WebEvents } from '@/lib/analytics/events';
import { describe, expect, it } from 'vitest';

describe('WebEvents catalog (SPEC-140 acceptance)', () => {
    it('should include the SPEC-140 events, the SPEC-191 contribution events, the SPEC-159 entity-view events, and the SPEC-258 import events', () => {
        // Assert
        expect(WebEvents).toEqual({
            AccommodationSearched: 'accommodation_searched',
            AccommodationViewed: 'accommodation_viewed',
            SignupCompleted: 'signup_completed',
            BookingInitiated: 'booking_initiated',
            NewsletterSubscribed: 'newsletter_subscribed',
            ContributionBannerClicked: 'contribution_banner_clicked',
            ContributionReportSubmitted: 'contribution_report_submitted',
            ContributionPhotoSubmitted: 'contribution_photo_submitted',
            ContributionEditorSubmitted: 'contribution_editor_submitted',
            PostViewed: 'post_viewed',
            EventViewed: 'event_viewed',
            AiSearchSubmitted: 'ai_search_submitted',
            AiSearchIntentApplied: 'ai_search_intent_applied',
            AiSearchFallbackKeyword: 'ai_search_fallback_keyword',
            AiSearchLoginPrompted: 'ai_search_login_prompted',
            PropertyImportAttempted: 'property_import_attempted',
            PropertyImportSucceeded: 'property_import_succeeded',
            PropertyImportFailed: 'property_import_failed'
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

    it('event names should be unique across the catalog', () => {
        // Arrange
        const values = Object.values(WebEvents);
        const unique = new Set(values);

        // Assert
        expect(unique.size).toBe(values.length);
    });
});
