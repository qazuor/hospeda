/**
 * Shared edge-cache revalidation for commerce listings (HOS-389 §4).
 *
 * `BaseCommerceListingService` already owned this logic as a private method,
 * reachable only from create/update. The gallery mutations live in standalone
 * modules (`gastronomy.media.ts`, `experience.media.ts`) that receive a model
 * rather than the service, so they could not call it — which is why a photo
 * change never purged the public page.
 *
 * The mechanism moves here so BOTH callers share ONE implementation. Copying it
 * into the two media modules would have produced three copies of a best-effort
 * side effect, which is exactly how the halves drift apart: one gets a fix the
 * others never see.
 *
 * @module services/commerce/commerce-revalidation
 */

import { DestinationModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { LifecycleStatusEnum, VisibilityEnum } from '@repo/schemas';
import { getRevalidationService } from '../../revalidation/revalidation-init.js';

/** Logger for the media entry point, which has no service instance to borrow one from. */
const mediaRevalidationLogger = createLogger('commerce-media-revalidation');

/** The commerce entity types that have a cached public detail page. */
export type CommerceRevalidationEntityType = 'gastronomy' | 'experience';

/**
 * The listing fields a purge needs. Typed structurally rather than against a
 * concrete entity so both the service (generic over `TEntity`) and the media
 * modules can pass what they already hold.
 */
export interface RevalidatableCommerceListing {
    readonly id: string;
    readonly slug: string;
    readonly destinationId?: string | null;
    readonly lifecycleState?: string | null;
    readonly visibility?: string | null;
}

/** Minimal logger surface — avoids importing the service's own logger type. */
interface RevalidationLogger {
    warn(context: Record<string, unknown>, message: string): void;
}

/**
 * Whether a listing is visible to the public, and therefore worth purging.
 *
 * Reads the two fields as strings because `CommerceListingEntity` types them as
 * `string | null`, and compares against the enums rather than string literals so
 * a renamed enum value is a compile error rather than a silent always-false.
 *
 * @param entity - The listing to test.
 * @returns `true` when the listing has a public page.
 */
export function isCommerceListingPubliclyVisible(entity: RevalidatableCommerceListing): boolean {
    return (
        entity.lifecycleState === LifecycleStatusEnum.ACTIVE &&
        entity.visibility === VisibilityEnum.PUBLIC
    );
}

/**
 * Schedules a cache purge for one commerce listing.
 *
 * Two rules, both inherited from the accommodation side:
 *
 * 1. **Only when publicly visible.** A DRAFT or PRIVATE listing has no public
 *    footprint, so purging its (nonexistent) pages is waste, and produced
 *    spurious 404s in production under HOS-203.
 * 2. **Never blocking.** A Cloudflare outage must not fail the write that
 *    triggered it — including a photo upload.
 *
 * The parent destination is resolved to a slug because the destination detail
 * page surfaces its commerce listings, so it goes stale too. Resolution failure
 * degrades to purging the listing's own tags rather than throwing: a partial
 * purge beats a failed write.
 *
 * @param entityType - `'gastronomy'` or `'experience'`.
 * @param entity - The listing as it stands after the write.
 * @param resolveDestinationSlug - Resolver for the parent destination's slug.
 * @param logger - Where a scheduling failure is reported.
 */
export async function scheduleCommerceListingRevalidation({
    entityType,
    entity,
    resolveDestinationSlug,
    logger
}: {
    readonly entityType: CommerceRevalidationEntityType;
    readonly entity: RevalidatableCommerceListing;
    readonly resolveDestinationSlug: (destinationId: string) => Promise<string | undefined>;
    readonly logger: RevalidationLogger;
}): Promise<void> {
    if (!isCommerceListingPubliclyVisible(entity)) return;

    try {
        const destinationSlug = entity.destinationId
            ? await resolveDestinationSlug(entity.destinationId)
            : undefined;

        getRevalidationService()?.scheduleRevalidation({
            entityType,
            id: entity.id,
            slug: entity.slug,
            destinationSlug
        });
    } catch (error) {
        logger.warn({ error, entityType }, 'Revalidation scheduling failed (non-blocking)');
    }
}

// ---------------------------------------------------------------------------
// Media-path entry point
// ---------------------------------------------------------------------------

/**
 * Purges a commerce listing after one of its gallery mutations (HOS-389 §4).
 *
 * The gallery functions are standalone modules that hold a model, not the
 * service, so they cannot reach `_scheduleListingRevalidation`. This is their
 * door into the same mechanism — one implementation, two entry points.
 *
 * It resolves the destination slug itself through a `DestinationModel`, since
 * the media modules have no such dependency of their own; a lookup failure
 * degrades to purging the listing's own tags rather than throwing, matching
 * every other revalidation path.
 *
 * @param entityType - `'gastronomy'` or `'experience'`.
 * @param listing - The listing whose gallery just changed.
 */
export async function scheduleCommerceMediaRevalidation({
    entityType,
    listing
}: {
    readonly entityType: CommerceRevalidationEntityType;
    readonly listing: RevalidatableCommerceListing;
}): Promise<void> {
    await scheduleCommerceListingRevalidation({
        entityType,
        entity: listing,
        resolveDestinationSlug: async (destinationId) => {
            try {
                const destination = await new DestinationModel().findById(destinationId);
                const slug = (destination as { slug?: unknown } | null)?.slug;
                return typeof slug === 'string' && slug.length > 0 ? slug : undefined;
            } catch {
                // Best-effort enrichment: a partial purge beats a failed write.
                return undefined;
            }
        },
        logger: mediaRevalidationLogger
    });
}
