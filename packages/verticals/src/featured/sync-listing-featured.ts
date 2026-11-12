import { EntitlementKeyEnum } from '@repo/schemas';
import type { PublicationVertical } from '../publication/publication-types';
import type { ListingFeaturedPorts, ListingFeaturedSyncResult } from './listing-featured-types';

type AddonVersionEffects = Awaited<
    ReturnType<NonNullable<ListingFeaturedPorts['reader']['findAddonVersionEffects']>>
>;

/**
 * Writes the featured flag of an owner's listings in one vertical from billing's
 * coverage (HOS-1718; owner PM-609 and CL).
 *
 * A listing is featured while billing emits a live `ADDON` source with scope
 * `LISTING` targeting it whose anchored addon version grants `featured_listing`.
 * Billing already drops an expired `FIXED_DAYS` instance and stops emitting a
 * cancelled, expired or orphaned one, so this function never reads a clock.
 *
 * Coverage is read inside the `(user, vertical)` lock. Writes use compare-and-set,
 * and only changed rows are revalidated after the transaction commits. If
 * revalidation fails, it is not retried because the compare-and-set sees no
 * change on the next sync; the cache stays stale until its TTL expires.
 *
 * @repo/verticals never reads addon instances; it receives coverage by contract
 * and the version's effects through the catalog reader port.
 */
export async function syncListingFeatured(args: {
    readonly ports: ListingFeaturedPorts;
    readonly userId: string;
    readonly vertical: PublicationVertical;
}): Promise<ListingFeaturedSyncResult> {
    const changed = await args.ports.unitOfWork.runLocked(
        { userId: args.userId, vertical: args.vertical },
        async (tx) => {
            const coverage = await args.ports.billing.coverage({
                userId: args.userId,
                vertical: args.vertical
            });
            const boosted = new Set<string>();
            const effectsByVersion = new Map<string, AddonVersionEffects>();
            for (const source of coverage.sources) {
                if (
                    source.type !== 'ADDON' ||
                    source.scope !== 'LISTING' ||
                    source.target === null ||
                    source.reference.kind !== 'ADDON_VERSION'
                )
                    continue;
                const readEffects = args.ports.reader.findAddonVersionEffects;
                if (!readEffects)
                    throw new Error('syncListingFeatured needs findAddonVersionEffects');
                const id = source.reference.addonVersionId;
                let effects = effectsByVersion.get(id);
                if (!effects) {
                    effects = await readEffects({ id });
                    effectsByVersion.set(id, effects);
                }
                if (
                    effects.entitlements.some(
                        (entitlement) => entitlement.key === EntitlementKeyEnum.FEATURED_LISTING
                    )
                )
                    boosted.add(source.target);
            }
            const rows = await tx.listOwnerListings({
                vertical: args.vertical,
                ownerId: args.userId
            });
            const featuredOn: string[] = [];
            const featuredOff: string[] = [];
            for (const row of rows) {
                const want = boosted.has(row.id);
                if (want === row.featured) continue;
                const didChange = await tx.setFeatured({
                    vertical: args.vertical,
                    listingId: row.id,
                    from: row.featured,
                    to: want
                });
                if (!didChange) continue;
                (want ? featuredOn : featuredOff).push(row.id);
            }
            return { featuredOn, featuredOff };
        }
    );
    const listingIds = [...changed.featuredOn, ...changed.featuredOff];
    if (listingIds.length > 0)
        await args.ports.afterCommit.revalidate({ vertical: args.vertical, listingIds });
    return changed;
}
