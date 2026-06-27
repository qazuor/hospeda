/**
 * Seeder for accommodation external reputation rows (SPEC-237 T-014).
 *
 * Upserts cached reputation data (ratings, review counts, and — for Google —
 * review snippets) that simulate what the background fetcher would produce.
 * Timestamps are set to ~now so the TTL check does not immediately strip
 * snippet data on the public detail page.
 *
 * Run order: AFTER accommodationExternalListings seed (FK dependency on
 * `accommodation_external_reputation.listing_id`).
 *
 * @module example/accommodationExternalReputation.seed
 */

import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import type { ExternalReviewSnippet } from '@repo/schemas';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Definition of a single external reputation row to seed.
 *
 * `accommodationSlug` and `platform` are used to locate the corresponding
 * listing row whose `id` is required as the FK `listing_id`.
 *
 * @internal
 */
interface ExternalReputationDefinition {
    /** Stable slug of the target accommodation. */
    readonly accommodationSlug: string;
    /** Platform matching the corresponding listing row. */
    readonly platform: 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER';
    /** Overall numeric rating (platform-specific scale). */
    readonly rating: number;
    /** Total number of reviews as returned by the platform. */
    readonly reviewsCount: number;
    /** Deep link to the reviews section on the external platform. */
    readonly deepLink: string;
    /** Fetch outcome (always 'ok' for seed data). */
    readonly fetchStatus: 'ok';
    /**
     * Review snippets — populated for Google (platform supports it);
     * null for Booking.com (aggregate-only, legal model).
     */
    readonly snippets: readonly ExternalReviewSnippet[] | null;
}

/**
 * Example external reputation definitions for the dev environment.
 *
 * The GOOGLE row includes synthetic review snippets to demonstrate the
 * full snippet rendering pipeline in the UI. The BOOKING row is
 * aggregate-only (snippets = null) matching the legal model for that
 * platform.
 *
 * @internal
 */
const REPUTATION_DEFINITIONS: ReadonlyArray<ExternalReputationDefinition> = [
    {
        accommodationSlug: 'hotel-mirador-soleado-hotel',
        platform: 'GOOGLE',
        rating: 4.6,
        reviewsCount: 312,
        deepLink: 'https://maps.google.com/?cid=1234567890123456789#reviews',
        fetchStatus: 'ok',
        snippets: [
            {
                author: 'Laura Fernández',
                text: 'Excelente atención y ubicación inmejorable en Colón. Las habitaciones son amplias y muy limpias. El desayuno buffet sorprendió gratamente. Volveremos sin dudas.',
                rating: 5,
                timeIso: '2025-10-15T09:32:00Z',
                authorUrl: 'https://www.google.com/maps/contrib/100000000000000001',
                profilePhoto: 'https://lh3.googleusercontent.com/a/seed-laura-fernandez',
                relativeTime: 'hace 2 meses'
            },
            {
                author: 'Martín Sánchez',
                text: 'Muy buen hotel para visitar las Termas de Colón. El personal es muy amable. La piscina en el rooftop es el punto fuerte. Recomendado para familias.',
                rating: 4,
                timeIso: '2025-09-28T14:10:00Z',
                authorUrl: 'https://www.google.com/maps/contrib/100000000000000002',
                profilePhoto: 'https://lh3.googleusercontent.com/a/seed-martin-sanchez',
                relativeTime: 'hace 3 meses'
            },
            {
                author: 'Valeria Gómez',
                text: 'Muy buena relación precio/calidad. Habitación limpia, cómoda y con buena vista. El único detalle fue el ruido del tráfico por la noche, pero en general todo muy bien.',
                rating: 4,
                timeIso: '2025-08-05T18:47:00Z',
                authorUrl: 'https://www.google.com/maps/contrib/100000000000000003',
                profilePhoto: 'https://lh3.googleusercontent.com/a/seed-valeria-gomez',
                relativeTime: 'hace 4 meses'
            }
        ]
    },
    {
        accommodationSlug: 'hotel-mirador-soleado-hotel',
        platform: 'BOOKING',
        rating: 8.4,
        reviewsCount: 187,
        deepLink: 'https://www.booking.com/hotel/ar/mirador-soleado-colon.html#tab-reviews',
        fetchStatus: 'ok',
        snippets: null
    }
] as const;

/**
 * Minimal port for {@link AccommodationModel} operations used by this seeder.
 *
 * @internal
 */
export interface AccommodationModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal port for {@link AccommodationExternalListingModel} operations.
 *
 * @internal
 */
export interface ExternalListingModelPort {
    findByAccommodation(accommodationId: string): Promise<Array<Record<string, unknown>>>;
}

/**
 * Minimal port for {@link AccommodationExternalReputationModel} operations.
 *
 * @internal
 */
export interface ExternalReputationModelPort {
    upsertReputation(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Seeds example external reputation rows for the dev environment (SPEC-237 T-014).
 *
 * Uses `upsertReputation` so it is safe to re-run. Timestamps are set to the
 * current time so the Google snippet TTL (default 30 days) does not strip
 * snippet data immediately after seeding.
 *
 * Prerequisites:
 *   - `seedAccommodationExternalListings` must have run first (creates the
 *     listing rows whose UUIDs are required as the FK `listing_id`).
 *
 * @param accommodationModelOverride - Optional model override for tests.
 * @param listingModelOverride - Optional model override for tests.
 * @param reputationModelOverride - Optional model override for tests.
 * @returns Promise that resolves when all reputation rows have been upserted.
 *
 * @throws {Error} When a required listing row is missing or a DB write fails.
 *
 * @example
 * ```ts
 * await seedAccommodationExternalReputation();
 * // Upserts 2 reputation rows: GOOGLE (with 3 snippets) + BOOKING (aggregate-only)
 * ```
 */
export async function seedAccommodationExternalReputation(
    accommodationModelOverride?: AccommodationModelPort,
    listingModelOverride?: ExternalListingModelPort,
    reputationModelOverride?: ExternalReputationModelPort
): Promise<void> {
    const separator = '#'.repeat(90);
    logger.info(`${separator}`);
    logger.info(
        `${STATUS_ICONS.Seed}  SEEDING ACCOMMODATION EXTERNAL REPUTATION — T-014 (SPEC-237)`
    );

    const accommodationModel: AccommodationModelPort =
        accommodationModelOverride ?? new AccommodationModel();
    const listingModel: ExternalListingModelPort =
        listingModelOverride ?? new AccommodationExternalListingModel();
    const reputationModel: ExternalReputationModelPort =
        reputationModelOverride ?? new AccommodationExternalReputationModel();

    try {
        let totalUpserted = 0;
        let totalFailed = 0;

        // Use a single timestamp for all rows so freshness checks are consistent.
        const now = new Date();

        for (const def of REPUTATION_DEFINITIONS) {
            // Resolve accommodation slug → real DB UUID.
            const accommodationRecord = await accommodationModel.findOne({
                slug: def.accommodationSlug
            });

            if (!accommodationRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} Accommodation (slug: "${def.accommodationSlug}") not found, skipping ${def.platform} reputation`
                );
                totalFailed++;
                continue;
            }

            const accommodationId = accommodationRecord.id as string;

            // Resolve the corresponding listing row to get its UUID (FK listing_id).
            const listings = await listingModel.findByAccommodation(accommodationId);
            const matchingListing = listings.find(
                (row) => (row.platform as string) === def.platform
            );

            if (!matchingListing) {
                logger.info(
                    `${STATUS_ICONS.Warning} Listing for platform ${def.platform} not found on "${def.accommodationSlug}", skipping reputation row — run seedAccommodationExternalListings first`
                );
                totalFailed++;
                continue;
            }

            const listingId = matchingListing.id as string;

            await reputationModel.upsertReputation({
                accommodationId,
                platform: def.platform,
                listingId,
                rating: def.rating,
                reviewsCount: def.reviewsCount,
                deepLink: def.deepLink,
                snippets: def.snippets ? [...def.snippets] : null,
                snippetsFetchedAt: def.snippets !== null ? now : null,
                aggregateFetchedAt: now,
                fetchStatus: def.fetchStatus,
                fetchMessage: null
            });

            logger.info(
                `${STATUS_ICONS.Success} Upserted ${def.platform} reputation for "${def.accommodationSlug}" (rating: ${def.rating}, reviews: ${def.reviewsCount}, snippets: ${def.snippets?.length ?? 0})`
            );
            totalUpserted++;
        }

        logger.info(
            `${STATUS_ICONS.Success} Accommodation external reputation T-014 done — upserted: ${totalUpserted}, failed: ${totalFailed}`
        );
        summaryTracker.trackSuccess('Accommodation External Reputation T-014');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            `${STATUS_ICONS.Error} Failed to seed accommodation external reputation (T-014): ${message}`
        );
        summaryTracker.trackError(
            'Accommodation External Reputation T-014',
            'accommodation-external-reputation-t014',
            message
        );
        throw error;
    }
}
