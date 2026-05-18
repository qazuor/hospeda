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
    it('should include all 5 SPEC-140 explicit web events', () => {
        // Assert
        expect(WebEvents).toEqual({
            AccommodationSearched: 'accommodation_searched',
            AccommodationViewed: 'accommodation_viewed',
            SignupCompleted: 'signup_completed',
            BookingInitiated: 'booking_initiated',
            NewsletterSubscribed: 'newsletter_subscribed'
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
