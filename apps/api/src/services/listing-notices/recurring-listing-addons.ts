import type { CoverageResponse } from '@repo/billing-verticals-contract';
import { addons, addonVersions, getDb } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';

/** One named recurring add-on version on a listing. */
export interface RecurringListingAddonItem {
    readonly addonVersionId: string;
    readonly name: string;
}

/** Reads catalog names through each immutable add-on version's add-on id. */
export async function readAddonNamesByVersionIds(input: {
    readonly addonVersionIds: readonly string[];
}): Promise<ReadonlyMap<string, string>> {
    if (input.addonVersionIds.length === 0) return new Map();
    const rows = await getDb()
        .select({ addonVersionId: addonVersions.id, name: addons.name })
        .from(addonVersions)
        .innerJoin(addons, eq(addonVersions.addonId, addons.id))
        .where(inArray(addonVersions.id, [...input.addonVersionIds]));
    return new Map(rows.map((row) => [row.addonVersionId, row.name]));
}

/** Lists live recurring add-ons aimed at one listing from the owner's coverage sources. */
export function listRecurringListingAddons(input: {
    readonly coverage: CoverageResponse;
    readonly listingId: string;
    readonly readAddonNames: (input: {
        readonly addonVersionIds: readonly string[];
    }) => ReadonlyMap<string, string>;
}): { readonly items: readonly RecurringListingAddonItem[] } {
    const addonVersionIds = input.coverage.sources
        .filter(
            (source) =>
                source.type === 'ADDON' &&
                source.scope === 'LISTING' &&
                source.target === input.listingId &&
                source.until === 'NO_KNOWN_DATE'
        )
        .map((source) => {
            if (source.reference.kind !== 'ADDON_VERSION')
                throw new Error('An ADDON coverage source must reference an add-on version');
            return source.reference.addonVersionId;
        });
    const names = input.readAddonNames({ addonVersionIds });
    const items = addonVersionIds.map((addonVersionId) => {
        const name = names.get(addonVersionId);
        if (name === undefined)
            throw new Error(`Missing catalog name for add-on version ${addonVersionId}`);
        return { addonVersionId, name };
    });
    items.sort(
        (a, b) => a.name.localeCompare(b.name) || a.addonVersionId.localeCompare(b.addonVersionId)
    );
    return { items };
}

/** Resolves the names required for the selected listings, using the same source predicate. */
export async function readRecurringListingAddonNames(input: {
    readonly coverage: CoverageResponse;
    readonly listingIds: readonly string[];
}): Promise<ReadonlyMap<string, string>> {
    const ids = new Set(
        input.listingIds.flatMap((listingId) =>
            listRecurringListingAddons({
                coverage: input.coverage,
                listingId,
                readAddonNames: ({ addonVersionIds }) =>
                    new Map(addonVersionIds.map((id) => [id, id]))
            }).items.map((item) => item.addonVersionId)
        )
    );
    return readAddonNamesByVersionIds({ addonVersionIds: [...ids] });
}
