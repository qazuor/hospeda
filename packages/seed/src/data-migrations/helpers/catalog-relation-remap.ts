/**
 * @fileoverview
 * Moves every relation row that points at one catalog row (an amenity or a
 * feature) onto another catalog row, across the three verticals that link the
 * catalog: accommodations, venues and experiences (HOS-2059).
 *
 * Used by data-migrations that retire a catalog row (a duplicate merged into a
 * survivor, or an item that changes table, e.g. an amenity that becomes a
 * feature). The contract a caller relies on:
 *
 * - **No owner loses the item.** After the move, every owner (accommodation,
 *   venue, experience) that linked the source links the target. This is
 *   VERIFIED, not assumed: the helper re-counts the owners on the target and
 *   throws when one is missing, so the migration's transaction rolls back
 *   instead of being ledgered with a silent loss.
 * - **An owner that already links the target keeps its own row.** The insert
 *   is `ON CONFLICT DO NOTHING`, so the survivor's existing attributes (scope,
 *   availability, cost) are never overwritten. Those rows are reported as
 *   `collapsed`.
 * - **Attributes travel when the two rows are of the same kind.** An
 *   amenity-to-amenity move keeps `isOptional`, `additionalCost`,
 *   `additionalCostPercent`, `scope` and `availability` (the caller may force
 *   `scope`, e.g. the shared kitchen becoming the kitchen with
 *   `scope = shared`). A feature-to-feature move keeps the host's rewritten
 *   name and comments. A move ACROSS kinds cannot carry them, because the two
 *   relation tables have different columns; every such row that carried a
 *   non-default value is counted in `attributesDropped` so the loss is
 *   visible in the migration log rather than silent.
 *
 * @module data-migrations/helpers/catalog-relation-remap
 */
import {
    and,
    count,
    type DrizzleClient,
    eq,
    inArray,
    rAccommodationAmenity,
    rAccommodationFeature,
    rExperienceAmenity,
    rExperienceFeature,
    rVenueAmenity,
    rVenueFeature
} from '@repo/db';
import type { AmenityScopeEnum, PriceType } from '@repo/schemas';

/** The two catalog tables. */
export type CatalogKind = 'amenity' | 'feature';

/** The verticals whose relation tables link the catalog. */
export type CatalogVertical = 'accommodation' | 'venue' | 'experience';

/** All verticals, in the order the helper processes them. */
export const CATALOG_VERTICALS: readonly CatalogVertical[] = [
    'accommodation',
    'venue',
    'experience'
] as const;

/** One owner's link to an amenity, with the attributes only accommodations carry. */
interface AmenityLink {
    readonly ownerId: string;
    readonly isOptional: boolean;
    readonly additionalCost: PriceType | null;
    readonly additionalCostPercent: number | null;
    /** An `AmenityScopeEnum` value; the Drizzle enum column infers `string`. */
    readonly scope: string | null;
    /** An `AmenityAvailabilityEnum` value; the Drizzle enum column infers `string`. */
    readonly availability: string | null;
}

/** One owner's link to a feature, with the host's notes. */
interface FeatureLink {
    readonly ownerId: string;
    readonly hostReWriteName: string | null;
    readonly comments: string | null;
}

/** Read/insert/delete/count over one relation table, keyed by catalog row id. */
interface RelationAdapter<L> {
    readonly read: (db: DrizzleClient, catalogId: string) => Promise<readonly L[]>;
    readonly insert: (db: DrizzleClient, catalogId: string, links: readonly L[]) => Promise<number>;
    readonly remove: (db: DrizzleClient, catalogId: string) => Promise<number>;
    readonly countOwners: (
        db: DrizzleClient,
        catalogId: string,
        ownerIds: readonly string[]
    ) => Promise<number>;
}

/** An empty amenity link for an owner whose source carried no amenity attributes. */
const bareAmenityLink = (ownerId: string): AmenityLink => ({
    ownerId,
    isOptional: false,
    additionalCost: null,
    additionalCostPercent: null,
    scope: null,
    availability: null
});

/** An empty feature link for an owner whose source carried no feature notes. */
const bareFeatureLink = (ownerId: string): FeatureLink => ({
    ownerId,
    hostReWriteName: null,
    comments: null
});

/** Number of rows in a `count()` select result. */
const firstCount = (rows: readonly { readonly value: number }[]): number => rows[0]?.value ?? 0;

const accommodationAmenity: RelationAdapter<AmenityLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rAccommodationAmenity)
            .where(eq(rAccommodationAmenity.amenityId, catalogId));
        return rows.map((row) => ({
            ownerId: row.accommodationId,
            isOptional: row.isOptional,
            additionalCost: row.additionalCost ?? null,
            additionalCostPercent: row.additionalCostPercent ?? null,
            scope: row.scope ?? null,
            availability: row.availability ?? null
        }));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rAccommodationAmenity)
            .values(
                links.map((link) => ({
                    ...link,
                    accommodationId: link.ownerId,
                    amenityId: catalogId
                }))
            )
            .onConflictDoNothing()
            .returning({ ownerId: rAccommodationAmenity.accommodationId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rAccommodationAmenity)
            .where(eq(rAccommodationAmenity.amenityId, catalogId))
            .returning({ ownerId: rAccommodationAmenity.accommodationId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rAccommodationAmenity)
                      .where(
                          and(
                              eq(rAccommodationAmenity.amenityId, catalogId),
                              inArray(rAccommodationAmenity.accommodationId, [...ownerIds])
                          )
                      )
              )
};

const accommodationFeature: RelationAdapter<FeatureLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rAccommodationFeature)
            .where(eq(rAccommodationFeature.featureId, catalogId));
        return rows.map((row) => ({
            ownerId: row.accommodationId,
            hostReWriteName: row.hostReWriteName ?? null,
            comments: row.comments ?? null
        }));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rAccommodationFeature)
            .values(
                links.map((link) => ({
                    accommodationId: link.ownerId,
                    featureId: catalogId,
                    hostReWriteName: link.hostReWriteName,
                    comments: link.comments
                }))
            )
            .onConflictDoNothing()
            .returning({ ownerId: rAccommodationFeature.accommodationId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rAccommodationFeature)
            .where(eq(rAccommodationFeature.featureId, catalogId))
            .returning({ ownerId: rAccommodationFeature.accommodationId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rAccommodationFeature)
                      .where(
                          and(
                              eq(rAccommodationFeature.featureId, catalogId),
                              inArray(rAccommodationFeature.accommodationId, [...ownerIds])
                          )
                      )
              )
};

const venueAmenity: RelationAdapter<AmenityLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rVenueAmenity)
            .where(eq(rVenueAmenity.amenityId, catalogId));
        return rows.map((row) => bareAmenityLink(row.venueId));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rVenueAmenity)
            .values(links.map((link) => ({ venueId: link.ownerId, amenityId: catalogId })))
            .onConflictDoNothing()
            .returning({ ownerId: rVenueAmenity.venueId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rVenueAmenity)
            .where(eq(rVenueAmenity.amenityId, catalogId))
            .returning({ ownerId: rVenueAmenity.venueId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rVenueAmenity)
                      .where(
                          and(
                              eq(rVenueAmenity.amenityId, catalogId),
                              inArray(rVenueAmenity.venueId, [...ownerIds])
                          )
                      )
              )
};

const venueFeature: RelationAdapter<FeatureLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rVenueFeature)
            .where(eq(rVenueFeature.featureId, catalogId));
        return rows.map((row) => ({
            ownerId: row.venueId,
            hostReWriteName: row.hostReWriteName ?? null,
            comments: row.comments ?? null
        }));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rVenueFeature)
            .values(
                links.map((link) => ({
                    venueId: link.ownerId,
                    featureId: catalogId,
                    hostReWriteName: link.hostReWriteName,
                    comments: link.comments
                }))
            )
            .onConflictDoNothing()
            .returning({ ownerId: rVenueFeature.venueId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rVenueFeature)
            .where(eq(rVenueFeature.featureId, catalogId))
            .returning({ ownerId: rVenueFeature.venueId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rVenueFeature)
                      .where(
                          and(
                              eq(rVenueFeature.featureId, catalogId),
                              inArray(rVenueFeature.venueId, [...ownerIds])
                          )
                      )
              )
};

const experienceAmenity: RelationAdapter<AmenityLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rExperienceAmenity)
            .where(eq(rExperienceAmenity.amenityId, catalogId));
        return rows.map((row) => bareAmenityLink(row.experienceId));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rExperienceAmenity)
            .values(links.map((link) => ({ experienceId: link.ownerId, amenityId: catalogId })))
            .onConflictDoNothing()
            .returning({ ownerId: rExperienceAmenity.experienceId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rExperienceAmenity)
            .where(eq(rExperienceAmenity.amenityId, catalogId))
            .returning({ ownerId: rExperienceAmenity.experienceId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rExperienceAmenity)
                      .where(
                          and(
                              eq(rExperienceAmenity.amenityId, catalogId),
                              inArray(rExperienceAmenity.experienceId, [...ownerIds])
                          )
                      )
              )
};

const experienceFeature: RelationAdapter<FeatureLink> = {
    read: async (db, catalogId) => {
        const rows = await db
            .select()
            .from(rExperienceFeature)
            .where(eq(rExperienceFeature.featureId, catalogId));
        return rows.map((row) => ({
            ownerId: row.experienceId,
            hostReWriteName: row.hostReWriteName ?? null,
            comments: row.comments ?? null
        }));
    },
    insert: async (db, catalogId, links) => {
        if (links.length === 0) return 0;
        const inserted = await db
            .insert(rExperienceFeature)
            .values(
                links.map((link) => ({
                    experienceId: link.ownerId,
                    featureId: catalogId,
                    hostReWriteName: link.hostReWriteName,
                    comments: link.comments
                }))
            )
            .onConflictDoNothing()
            .returning({ ownerId: rExperienceFeature.experienceId });
        return inserted.length;
    },
    remove: async (db, catalogId) => {
        const removed = await db
            .delete(rExperienceFeature)
            .where(eq(rExperienceFeature.featureId, catalogId))
            .returning({ ownerId: rExperienceFeature.experienceId });
        return removed.length;
    },
    countOwners: async (db, catalogId, ownerIds) =>
        ownerIds.length === 0
            ? 0
            : firstCount(
                  await db
                      .select({ value: count() })
                      .from(rExperienceFeature)
                      .where(
                          and(
                              eq(rExperienceFeature.featureId, catalogId),
                              inArray(rExperienceFeature.experienceId, [...ownerIds])
                          )
                      )
              )
};

/** The amenity and feature relation adapters of one vertical. */
interface VerticalAdapters {
    readonly amenity: RelationAdapter<AmenityLink>;
    readonly feature: RelationAdapter<FeatureLink>;
}

const ADAPTERS: Readonly<Record<CatalogVertical, VerticalAdapters>> = {
    accommodation: { amenity: accommodationAmenity, feature: accommodationFeature },
    venue: { amenity: venueAmenity, feature: venueFeature },
    experience: { amenity: experienceAmenity, feature: experienceFeature }
};

/** One catalog row, identified by its table and id. */
export interface CatalogRowRef {
    readonly kind: CatalogKind;
    readonly id: string;
}

/** What happened to one vertical's relation rows during a remap. */
export interface VerticalRemapCounts {
    /** Relation rows on the SOURCE before the move. */
    readonly sourceBefore: number;
    /** Relation rows on the TARGET before the move. */
    readonly targetBefore: number;
    /** Relation rows on the TARGET after the move. */
    readonly targetAfter: number;
    /** Source rows inserted as new target rows. */
    readonly moved: number;
    /** Source rows whose owner already linked the target (target row kept as-is). */
    readonly collapsed: number;
    /** Cross-kind rows whose non-default attributes could not travel. */
    readonly attributesDropped: number;
}

/** True when an amenity link carries anything beyond a bare "has it". */
const amenityLinkHasAttributes = (link: AmenityLink): boolean =>
    link.isOptional ||
    link.additionalCost !== null ||
    link.additionalCostPercent !== null ||
    link.scope !== null ||
    link.availability !== null;

/** True when a feature link carries a host note. */
const featureLinkHasAttributes = (link: FeatureLink): boolean =>
    link.hostReWriteName !== null || link.comments !== null;

/**
 * Moves one vertical's relation rows from `source` to `target`, then deletes
 * the source rows and verifies every owner now links the target.
 *
 * @param input - The transaction-scoped db, the vertical, both catalog rows,
 *   and an optional scope forced onto the moved accommodation-amenity rows.
 * @returns The before/after counts for this vertical.
 * @throws Error when an owner of the source does not link the target after the
 *   move, or when the delete removed a different number of rows than it read.
 */
export async function remapVerticalRelations({
    db,
    vertical,
    source,
    target,
    scope
}: {
    readonly db: DrizzleClient;
    readonly vertical: CatalogVertical;
    readonly source: CatalogRowRef;
    readonly target: CatalogRowRef;
    readonly scope?: `${AmenityScopeEnum}`;
}): Promise<VerticalRemapCounts> {
    const adapters = ADAPTERS[vertical];
    const ownersOf = (links: readonly { readonly ownerId: string }[]): readonly string[] => [
        ...new Set(links.map((link) => link.ownerId))
    ];

    let sourceOwners: readonly string[];
    let attributesDropped = 0;
    let moved: number;
    let targetBefore: number;

    // The four kind combinations, each spelled out so the attribute handling
    // of every one is explicit.
    if (source.kind === 'amenity') {
        const links = await adapters.amenity.read(db, source.id);
        sourceOwners = ownersOf(links);
        if (target.kind === 'amenity') {
            targetBefore = (await adapters.amenity.read(db, target.id)).length;
            moved = await adapters.amenity.insert(
                db,
                target.id,
                links.map((link) => (scope ? { ...link, scope } : link))
            );
        } else {
            targetBefore = (await adapters.feature.read(db, target.id)).length;
            attributesDropped = links.filter(amenityLinkHasAttributes).length;
            moved = await adapters.feature.insert(
                db,
                target.id,
                links.map((link) => bareFeatureLink(link.ownerId))
            );
        }
    } else {
        const links = await adapters.feature.read(db, source.id);
        sourceOwners = ownersOf(links);
        if (target.kind === 'feature') {
            targetBefore = (await adapters.feature.read(db, target.id)).length;
            moved = await adapters.feature.insert(db, target.id, links);
        } else {
            targetBefore = (await adapters.amenity.read(db, target.id)).length;
            attributesDropped = links.filter(featureLinkHasAttributes).length;
            moved = await adapters.amenity.insert(
                db,
                target.id,
                links.map((link) => ({ ...bareAmenityLink(link.ownerId), scope: scope ?? null }))
            );
        }
    }

    const sourceAdapter = source.kind === 'amenity' ? adapters.amenity : adapters.feature;
    const targetAdapter = target.kind === 'amenity' ? adapters.amenity : adapters.feature;

    const removed = await sourceAdapter.remove(db, source.id);
    if (removed !== sourceOwners.length) {
        throw new Error(
            `${vertical}: read ${sourceOwners.length} ${source.kind} relation(s) on ${source.id} but deleted ${removed}`
        );
    }

    const covered = await targetAdapter.countOwners(db, target.id, sourceOwners);
    if (covered !== sourceOwners.length) {
        throw new Error(
            `${vertical}: ${sourceOwners.length - covered} owner(s) of ${source.kind} ${source.id} do not link ${target.kind} ${target.id} after the move`
        );
    }

    const targetAfter = (await targetAdapter.read(db, target.id)).length;
    if (targetAfter !== targetBefore + moved) {
        throw new Error(
            `${vertical}: ${target.kind} ${target.id} has ${targetAfter} relation(s), expected ${targetBefore} + ${moved}`
        );
    }

    return {
        sourceBefore: sourceOwners.length,
        targetBefore,
        targetAfter,
        moved,
        collapsed: sourceOwners.length - moved,
        attributesDropped
    };
}
