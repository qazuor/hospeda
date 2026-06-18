/**
 * DB query helpers for the refresh-external-reputation cron job (SPEC-237 T-011).
 *
 * Separated into their own module so unit tests can mock these independently
 * from the job handler, without hitting a real database.
 *
 * @module cron/jobs/refresh-external-reputation.queries
 */

import {
    accommodationExternalListings,
    accommodationExternalReputation,
    and,
    eq,
    getDb,
    isNull,
    or
} from '@repo/db';

// ---------------------------------------------------------------------------
// getEnabledAccommodationIds
// ---------------------------------------------------------------------------

/**
 * Returns an array of unique `accommodationId` values from
 * `accommodation_external_listings` where at least one listing has
 * (`showReviews=true` OR `showLink=true`) AND `deletedAt IS NULL`.
 *
 * Uses the Drizzle query builder (no raw SQL).
 *
 * @returns Array of unique accommodationId strings, may be empty.
 */
export async function getEnabledAccommodationIds(): Promise<string[]> {
    const db = getDb();
    const rows = await db
        .selectDistinct({ accommodationId: accommodationExternalListings.accommodationId })
        .from(accommodationExternalListings)
        .where(
            and(
                isNull(accommodationExternalListings.deletedAt),
                or(
                    eq(accommodationExternalListings.showReviews, true),
                    eq(accommodationExternalListings.showLink, true)
                )
            )
        );

    return rows.map((r) => r.accommodationId);
}

// ---------------------------------------------------------------------------
// getGoogleSnippetTimestamps
// ---------------------------------------------------------------------------

/**
 * Returns a map from `accommodationId` to the most recent `snippetsFetchedAt`
 * for the GOOGLE platform reputation row.
 *
 * Accommodations with no Google reputation row are absent from the map
 * (equivalent to `null` — never fetched).
 *
 * @returns Map of accommodationId → Date (snippetsFetchedAt) or undefined.
 */
export async function getGoogleSnippetTimestamps(): Promise<Map<string, Date | null>> {
    const db = getDb();
    const rows = await db
        .select({
            accommodationId: accommodationExternalReputation.accommodationId,
            snippetsFetchedAt: accommodationExternalReputation.snippetsFetchedAt
        })
        .from(accommodationExternalReputation)
        .where(eq(accommodationExternalReputation.platform, 'GOOGLE'));

    const map = new Map<string, Date | null>();
    for (const row of rows) {
        const existing = map.get(row.accommodationId);
        const rawTs = row.snippetsFetchedAt;
        const incoming = rawTs ? (rawTs instanceof Date ? rawTs : new Date(rawTs)) : null;

        if (map.has(row.accommodationId)) {
            // Keep the most recent timestamp when there are multiple rows.
            // existing is Date | null here (never undefined — map.has() guard above)
            const existingTs = existing ?? null;
            if (incoming !== null && (existingTs === null || incoming > existingTs)) {
                map.set(row.accommodationId, incoming);
            }
        } else {
            map.set(row.accommodationId, incoming);
        }
    }
    return map;
}
