import { EntitlementKeyEnum } from '@repo/schemas';
import { resolveEffectiveSet } from '../effective-set/resolve-effective-set';
import type { PublicationVertical } from '../publication/publication-types';
import type { ListingFeaturedPorts, ListingFeaturedSyncResult } from './listing-featured-types';

type AddonVersionEffects = Awaited<
    ReturnType<NonNullable<ListingFeaturedPorts['reader']['findAddonVersionEffects']>>
>;

/**
 * Writes the featured flag of an owner's listings in one vertical from billing's
 * coverage (HOS-1718; owner PM-609 and CL).
 *
 * A listing is featured when a non-TRIAL source in the owner's effective set grants `featured_listing`,
 * or a live `LISTING` add-on with that effect targets it.
 * Billing already drops an expired `FIXED_DAYS` instance and stops emitting a
 * cancelled, expired or orphaned one, so this function never reads a clock.
 *
 * Coverage is read inside the `(user, vertical)` lock. Writes use compare-and-set,
 * and only changed rows are revalidated after the transaction commits. If
 * revalidation fails, it is not retried because the compare-and-set sees no
 * change on the next sync; the cache stays stale until its TTL expires.
 *
 * PM-627: trial entitlements still apply generally, but TRIAL alone never features listings.
 * @repo/verticals never reads addon instances; it receives coverage by contract
 * and plan/add-on effects through the catalog reader port.
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
            const effective = await resolveEffectiveSet({
                reader: args.ports.reader,
                // PM-627 excludes TRIAL as a source only for listing featuring.
                billing: {
                    coverage: async () => ({
                        ...coverage,
                        sources: coverage.sources.filter((source) => source.type !== 'TRIAL')
                    })
                },
                trials: args.ports.trials,
                userId: args.userId,
                vertical: args.vertical
            });
            const planFeatured = effective.entries.some(
                (entry) => entry.key === EntitlementKeyEnum.FEATURED_LISTING && entry.value > 0
            );
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
                if (!args.ports.reader.findAddonVersionEffects)
                    throw new Error('syncListingFeatured needs findAddonVersionEffects');
                const id = source.reference.addonVersionId;
                let effects = effectsByVersion.get(id);
                if (!effects) {
                    effects = await args.ports.reader.findAddonVersionEffects({ id });
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
                const want = planFeatured || boosted.has(row.id);
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
