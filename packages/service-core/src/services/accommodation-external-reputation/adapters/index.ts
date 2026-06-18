/**
 * Reputation adapter registry (SPEC-237 T-006)
 *
 * Exports the adapter types, all platform-specific adapters, and a factory
 * function that maps an {@link ExternalPlatformEnum} value to the correct
 * {@link ReputationAdapter} implementation.
 *
 * @module services/accommodation-external-reputation/adapters
 */

import { ExternalPlatformEnum } from '@repo/schemas';
import type { ReputationAdapter } from './adapter.types.js';
import { AirbnbReputationAdapter } from './airbnb-reputation.adapter.js';
import { BookingReputationAdapter } from './booking-reputation.adapter.js';
import { GenericReputationAdapter } from './generic-reputation.adapter.js';
import { GoogleReputationAdapter } from './google-reputation.adapter.js';

// Re-export types and all adapters for consumers that need them directly.
export type { ReputationAdapter, ReputationFetchResult } from './adapter.types.js';
export { emptyReputationResult } from './adapter.types.js';
export { GoogleReputationAdapter } from './google-reputation.adapter.js';
export type { GoogleReputationCredentials } from './google-reputation.adapter.js';
export { BookingReputationAdapter } from './booking-reputation.adapter.js';
export type { BookingReputationCredentials } from './booking-reputation.adapter.js';
export { AirbnbReputationAdapter } from './airbnb-reputation.adapter.js';
export type { AirbnbReputationCredentials } from './airbnb-reputation.adapter.js';
export { GenericReputationAdapter } from './generic-reputation.adapter.js';
export { parseAggregateRatingFromPage } from './generic-reputation.adapter.js';

// ---------------------------------------------------------------------------
// Credentials container
// ---------------------------------------------------------------------------

/**
 * Aggregate credentials object passed to {@link getReputationAdapter}.
 *
 * The factory selects which sub-set of credentials to forward to each adapter.
 */
export interface ReputationAdapterCredentials {
    /** Google Places API key — required for {@link GoogleReputationAdapter}. */
    readonly googlePlacesApiKey?: string;
    /** Apify API token — required for Booking and Airbnb fallback paths. */
    readonly apifyToken?: string;
    /** Apify actor slug for Booking.com (e.g. `apify/booking-scraper`). */
    readonly apifyBookingActor?: string;
    /** Apify actor slug for Airbnb (e.g. `dtrungtin/airbnb-scraper`). */
    readonly apifyAirbnbActor?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate {@link ReputationAdapter} for the given platform.
 *
 * | Platform | Adapter | snippets |
 * |----------|---------|----------|
 * | GOOGLE   | {@link GoogleReputationAdapter} | Populated (up to 5) |
 * | BOOKING  | {@link BookingReputationAdapter} | Always `null` (AC-7.1) |
 * | AIRBNB   | {@link AirbnbReputationAdapter} | Always `null` (AC-7.1) |
 * | OTHER    | {@link GenericReputationAdapter} | Always `null` (AC-7.1) |
 *
 * @param platform - The external platform to get an adapter for.
 * @param credentials - Credentials forwarded to the adapter.
 * @returns The matching {@link ReputationAdapter} instance.
 *
 * @example
 * ```ts
 * const adapter = getReputationAdapter(ExternalPlatformEnum.GOOGLE, {
 *   googlePlacesApiKey: 'AIza...',
 * });
 * const result = await adapter.fetch(listing);
 * ```
 */
export function getReputationAdapter(
    platform: ExternalPlatformEnum,
    credentials: ReputationAdapterCredentials = {}
): ReputationAdapter {
    switch (platform) {
        case ExternalPlatformEnum.GOOGLE:
            return new GoogleReputationAdapter({
                googlePlacesApiKey: credentials.googlePlacesApiKey ?? ''
            });

        case ExternalPlatformEnum.BOOKING:
            return new BookingReputationAdapter({
                apifyToken: credentials.apifyToken,
                apifyBookingActor: credentials.apifyBookingActor
            });

        case ExternalPlatformEnum.AIRBNB:
            return new AirbnbReputationAdapter({
                apifyToken: credentials.apifyToken,
                apifyAirbnbActor: credentials.apifyAirbnbActor
            });

        case ExternalPlatformEnum.OTHER:
            return new GenericReputationAdapter();
    }
}
