/**
 * Tests for getReputationAdapterCredentials (SPEC-237 staging smoke).
 *
 * Regression: the reputation refresh route + the weekly cron originally passed
 * only `googlePlacesApiKey` (the cron passed nothing at all), so the Booking
 * Apify fallback and the Airbnb adapter never received their credentials and
 * silently returned no data. The helper is the single source of truth that
 * forwards the FULL credential set; this test pins that it includes the Apify
 * token + both actor slugs, not just the Google key.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_GOOGLE_PLACES_API_KEY: 'AIza-test-key',
        HOSPEDA_APIFY_TOKEN: 'apify_api_test_token',
        HOSPEDA_APIFY_BOOKING_ACTOR: 'voyager/booking-scraper',
        HOSPEDA_APIFY_AIRBNB_ACTOR: 'tri_angle/airbnb-scraper'
    }
}));

import { getReputationAdapterCredentials } from '../../src/utils/reputation-credentials';

describe('getReputationAdapterCredentials', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the full credential set (Google key + Apify token + both actor slugs)', () => {
        const creds = getReputationAdapterCredentials();

        expect(creds).toEqual({
            googlePlacesApiKey: 'AIza-test-key',
            apifyToken: 'apify_api_test_token',
            apifyBookingActor: 'voyager/booking-scraper',
            apifyAirbnbActor: 'tri_angle/airbnb-scraper'
        });
    });

    it('includes the Apify fields so Booking fallback and Airbnb are not silently disabled', () => {
        const creds = getReputationAdapterCredentials();

        // The original bug: these three were absent → Airbnb always empty and
        // Booking limited to its no-Apify primary path.
        expect(creds.apifyToken).toBeDefined();
        expect(creds.apifyBookingActor).toBeDefined();
        expect(creds.apifyAirbnbActor).toBeDefined();
    });
});
