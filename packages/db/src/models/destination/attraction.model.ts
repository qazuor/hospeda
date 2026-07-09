import type { Attraction } from '@repo/schemas';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { attractions } from '../../schemas/destination/attraction.dbschema.ts';
import { destinations } from '../../schemas/destination/destination.dbschema.ts';
import { rDestinationAttraction } from '../../schemas/destination/r_destination_attraction.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

export class AttractionModel extends BaseModelImpl<Attraction> {
    protected table = attractions;
    public entityName = 'attractions';

    protected getTableName(): string {
        return 'attractions';
    }

    /**
     * Resolves attraction slugs to the destinations that have them, via
     * `r_destination_attraction` (HOS-111 T-016, G-11 — "una ciudad con
     * carnavales"). No accommodation↔attraction join exists for the MVP
     * (spec §6 Phase 3) — this is a destination-level resolution only,
     * consumed by the search-chat handler to constrain
     * `params.destinationIds` on the accommodation search.
     *
     * Two-step query, mirroring `resolveAmenityIds`/`resolveFeatureIds` in
     * `apps/api`'s search-chat handler and `DestinationModel.findNearby`'s
     * public/active guard convention:
     *
     *   1. `attractions.slug IN (slugs)`, filtered to non-deleted + ACTIVE
     *      rows only.
     *   2. `r_destination_attraction.attractionId IN (matched attraction
     *      ids)`, inner-joined to `destinations` and filtered to
     *      public + active + non-deleted destinations only (never resolves
     *      to a hidden/draft/deleted destination).
     *
     * Returns an empty array (never throws) when `slugs` is empty, when no
     * attraction matches, or when no destination carries a matched
     * attraction — the caller (search-chat handler) treats this as
     * "constraint could not be resolved, skip it" rather than an error.
     *
     * @param slugs - Attraction slug identifiers (e.g. from the curated
     *   NL allowlist). Empty array short-circuits without a DB round-trip.
     * @param tx - Optional transaction client.
     * @returns Promise resolving to a de-duplicated array of destination UUIDs.
     */
    async findDestinationIdsBySlugs(
        slugs: readonly string[],
        tx?: DrizzleClient
    ): Promise<string[]> {
        if (slugs.length === 0) {
            return [];
        }

        try {
            const db = this.getClient(tx);

            const attractionRows = await db
                .select({ id: attractions.id })
                .from(attractions)
                .where(
                    and(
                        inArray(attractions.slug, [...slugs]),
                        isNull(attractions.deletedAt),
                        eq(attractions.lifecycleState, 'ACTIVE')
                    )
                );

            const attractionIds = attractionRows.map((row: { id: string }) => row.id);
            if (attractionIds.length === 0) {
                logQuery(this.entityName, 'findDestinationIdsBySlugs', { slugs }, []);
                return [];
            }

            const relationRows = await db
                .select({ destinationId: rDestinationAttraction.destinationId })
                .from(rDestinationAttraction)
                .innerJoin(destinations, eq(destinations.id, rDestinationAttraction.destinationId))
                .where(
                    and(
                        inArray(rDestinationAttraction.attractionId, attractionIds),
                        isNull(destinations.deletedAt),
                        eq(destinations.visibility, 'PUBLIC'),
                        eq(destinations.lifecycleState, 'ACTIVE')
                    )
                );

            const destinationIds = Array.from(
                new Set(relationRows.map((row: { destinationId: string }) => row.destinationId))
            );
            logQuery(this.entityName, 'findDestinationIdsBySlugs', { slugs }, destinationIds);
            return destinationIds;
        } catch (error) {
            logError(this.entityName, 'findDestinationIdsBySlugs', { slugs }, error as Error);
            throw new DbError(
                this.entityName,
                'findDestinationIdsBySlugs',
                { slugs },
                (error as Error).message
            );
        }
    }
}

/** Singleton instance of AttractionModel for use across the application. */
export const attractionModel = new AttractionModel();
