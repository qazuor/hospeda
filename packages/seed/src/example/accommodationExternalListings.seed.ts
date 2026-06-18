/**
 * Seeder for accommodation external listing rows (SPEC-237 T-014).
 *
 * Inserts the example external platform links (Google, Booking.com) for the
 * "Mirador Soleado Hotel" accommodation. Also sets the master toggle
 * `accommodations.show_external_reputation = true` on the target so the
 * public detail page can surface the reputation block.
 *
 * Idempotency: each (accommodationId, platform) pair is unique in the DB.
 * Existing rows are skipped via a `findByAccommodation` check.
 *
 * Run order: AFTER accommodations seed (FK dependency).
 *
 * @module example/accommodationExternalListings.seed
 */

import { AccommodationExternalListingModel, AccommodationModel } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Definition of a single external listing to seed.
 * `accommodationSlug` is the stable `slug` column value set on the
 * accommodation row — used for lookup since fixture `id` fields are
 * non-UUID seed identifiers and not the real DB UUID.
 *
 * @internal
 */
interface ExternalListingDefinition {
    /** Stable slug of the target accommodation. */
    readonly accommodationSlug: string;
    /** External platform identifier. */
    readonly platform: 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER';
    /** Full public URL to the listing on the external platform. */
    readonly url: string;
    /** Platform-specific listing identifier (e.g. Google place_id). */
    readonly externalId: string;
    /** When true, the public detail page shows a link to this listing. */
    readonly showLink: boolean;
    /** When true, review snippets fetched from this platform are shown. */
    readonly showReviews: boolean;
}

/**
 * Example external listing definitions for the dev environment.
 *
 * Both rows target "mirador-soleado-hotel-colon" — an active, isFeatured
 * hotel accommodation in Colón with existing reviews, making it a natural
 * showcase for the external reputation feature.
 *
 * @internal
 */
const LISTING_DEFINITIONS: ReadonlyArray<ExternalListingDefinition> = [
    {
        accommodationSlug: 'hotel-mirador-soleado-hotel',
        platform: 'GOOGLE',
        url: 'https://maps.google.com/?cid=1234567890123456789',
        externalId: 'ChIJXyzAbcD1234EFghIJklMNopQRs',
        showLink: true,
        showReviews: true
    },
    {
        accommodationSlug: 'hotel-mirador-soleado-hotel',
        platform: 'BOOKING',
        url: 'https://www.booking.com/hotel/ar/mirador-soleado-colon.html',
        externalId: 'ar.mirador-soleado-colon',
        showLink: true,
        showReviews: true
    }
] as const;

/**
 * Minimal port for {@link AccommodationModel} operations used by this seeder.
 *
 * Accepts a port so unit tests can inject an in-memory stub without a live
 * DB connection.
 *
 * @internal
 */
export interface AccommodationModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    update(
        filter: Partial<Record<string, unknown>>,
        data: Partial<Record<string, unknown>>
    ): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal port for {@link AccommodationExternalListingModel} operations.
 *
 * @internal
 */
export interface ExternalListingModelPort {
    findByAccommodation(accommodationId: string): Promise<Array<Record<string, unknown>>>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Seeds example external listing rows and enables the master reputation
 * toggle for the target accommodations (SPEC-237 T-014).
 *
 * Idempotent: existing (accommodationId, platform) pairs are skipped.
 *
 * Prerequisites:
 *   - Accommodations example seed must have run (FK dependency).
 *
 * @param accommodationModelOverride - Optional model override for tests.
 * @param listingModelOverride - Optional model override for tests.
 * @returns Promise that resolves when all rows have been seeded.
 *
 * @throws {Error} When a database write fails for an unexpected reason.
 *
 * @example
 * ```ts
 * await seedAccommodationExternalListings();
 * // Inserts 2 listing rows and sets show_external_reputation = true
 * // on "mirador-soleado-hotel-colon"
 * ```
 */
export async function seedAccommodationExternalListings(
    accommodationModelOverride?: AccommodationModelPort,
    listingModelOverride?: ExternalListingModelPort
): Promise<void> {
    const separator = '#'.repeat(90);
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING ACCOMMODATION EXTERNAL LISTINGS — T-014 (SPEC-237)`);

    const accommodationModel: AccommodationModelPort =
        accommodationModelOverride ?? new AccommodationModel();
    const listingModel: ExternalListingModelPort =
        listingModelOverride ?? new AccommodationExternalListingModel();

    try {
        let totalCreated = 0;
        let totalSkipped = 0;

        // Track which accommodation slugs have already had their master toggle enabled
        // so we only run the update once per unique slug.
        const toggledSlugs = new Set<string>();

        for (const def of LISTING_DEFINITIONS) {
            // Resolve slug → real DB UUID.
            // We look up by `slug` because the fixture `id` field is a non-UUID
            // seed identifier, not the real UUID stored in `accommodations.id`.
            const accommodationRecord = await accommodationModel.findOne({
                slug: def.accommodationSlug
            });

            if (!accommodationRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} Accommodation (slug: "${def.accommodationSlug}") not found, skipping ${def.platform} listing`
                );
                continue;
            }

            const accommodationId = accommodationRecord.id as string;

            // Enable the master toggle once per accommodation.
            if (!toggledSlugs.has(def.accommodationSlug)) {
                await accommodationModel.update(
                    { id: accommodationId },
                    { showExternalReputation: true }
                );
                logger.info(
                    `${STATUS_ICONS.Success} Set show_external_reputation = true for "${def.accommodationSlug}"`
                );
                toggledSlugs.add(def.accommodationSlug);
            }

            // Idempotency: check existing listings for this accommodation.
            const existingListings = await listingModel.findByAccommodation(accommodationId);
            const alreadyExists = existingListings.some(
                (row) => (row.platform as string) === def.platform
            );

            if (alreadyExists) {
                logger.info(
                    `${STATUS_ICONS.Skip} External listing (${def.platform}) already exists for "${def.accommodationSlug}", skipping`
                );
                totalSkipped++;
                continue;
            }

            await listingModel.create({
                accommodationId,
                platform: def.platform,
                url: def.url,
                externalId: def.externalId,
                showLink: def.showLink,
                showReviews: def.showReviews,
                verified: false
            });

            logger.info(
                `${STATUS_ICONS.Success} Created ${def.platform} listing for "${def.accommodationSlug}"`
            );
            totalCreated++;
        }

        logger.info(
            `${STATUS_ICONS.Success} Accommodation external listings T-014 done — created: ${totalCreated}, skipped: ${totalSkipped}`
        );
        summaryTracker.trackSuccess('Accommodation External Listings T-014');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
            `${STATUS_ICONS.Error} Failed to seed accommodation external listings (T-014): ${message}`
        );
        summaryTracker.trackError(
            'Accommodation External Listings T-014',
            'accommodation-external-listings-t014',
            message
        );
        throw error;
    }
}
