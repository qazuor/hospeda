/**
 * Single source of truth for the external-reputation adapter credentials.
 *
 * The `AccommodationExternalReputationService` builds one adapter per platform
 * (Google / Booking / Airbnb) from a `ReputationAdapterCredentials` object. Every
 * call site that fetches reputation data (the manual owner refresh route and the
 * weekly cron) MUST pass the full credential set, otherwise:
 *   - a missing `googlePlacesApiKey` → Google returns empty (no rating/snippets);
 *   - a missing `apifyToken` / `apifyBookingActor` → Booking loses its Apify
 *     fallback (only the direct JSON-LD path works);
 *   - a missing `apifyToken` / `apifyAirbnbActor` → Airbnb returns empty (it has
 *     no non-Apify path at all).
 *
 * Read-only routes (public GET, admin disable) never trigger a fetch, but they
 * use the same helper so the wiring stays consistent in one place.
 *
 * @module utils/reputation-credentials
 */

import type { ReputationAdapterCredentials } from '@repo/service-core';
import { env } from './env';

/**
 * Builds the full reputation adapter credential set from validated env vars.
 *
 * @returns The credentials forwarded to every reputation adapter.
 */
export function getReputationAdapterCredentials(): ReputationAdapterCredentials {
    return {
        googlePlacesApiKey: env.HOSPEDA_GOOGLE_PLACES_API_KEY,
        apifyToken: env.HOSPEDA_APIFY_TOKEN,
        apifyBookingActor: env.HOSPEDA_APIFY_BOOKING_ACTOR,
        apifyAirbnbActor: env.HOSPEDA_APIFY_AIRBNB_ACTOR
    };
}
