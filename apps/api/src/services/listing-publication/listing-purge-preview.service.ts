import type { ListingPurgePreviewResponse } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { and, asc, eq, inArray } from 'drizzle-orm';

const CYCLES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;

/**
 * Reads the live listing-scoped add-ons that a purge will leave behind.
 * This is a read-only composition of billing's acquired rows and the catalog's
 * anchored policy; it does not authorize or read the listing itself.
 *
 * @param input.ownerId - Authenticated listing owner id.
 * @param input.listingId - Listing id already authorized by the route.
 * @returns Add-ons lost with this listing, in stable acquisition order.
 */
export async function readListingPurgePreview(input: {
    readonly ownerId: string;
    readonly listingId: string;
}): Promise<ListingPurgePreviewResponse> {
    const { getDb, addonInstances, addonProducts, addons, planCatalogModel } = await import(
        '@repo/db'
    );
    const addonPolicy = createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy;
    const rows = await getDb()
        .select({
            addonInstanceId: addonInstances.id,
            addonVersionId: addonInstances.addonVersionId,
            name: addons.name,
            chargeKind: addonProducts.chargeKind,
            cycle: addonProducts.cycle,
            price: addonProducts.price,
            currency: addonProducts.currency,
            status: addonInstances.status,
            endsAt: addonInstances.endsAt,
            createdAt: addonInstances.createdAt
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .innerJoin(addons, eq(addons.id, addonProducts.addonId))
        .where(
            and(
                eq(addonInstances.targetId, input.listingId),
                eq(addonInstances.ownerId, input.ownerId),
                inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE'])
            )
        )
        .orderBy(asc(addonInstances.createdAt), asc(addonInstances.id));

    const lostAddons: ListingPurgePreviewResponse['lostAddons'] = [];
    for (const row of rows) {
        const { scopeType } = await addonPolicy({ addonVersionId: row.addonVersionId });
        let appliesToListing: boolean;
        switch (scopeType) {
            case 'LISTING':
                appliesToListing = true;
                break;
            case 'VERTICAL_SUBSCRIPTION':
            case 'USER':
            case 'GLOBAL':
                appliesToListing = false;
                break;
            default: {
                const exhaustive: never = scopeType;
                throw new Error(`Unknown add-on scope: ${exhaustive}`);
            }
        }
        if (!appliesToListing) continue;

        const cycleIsValid = row.cycle === null || CYCLES.some((cycle) => cycle === row.cycle);
        const cycleMatchesKind =
            (row.chargeKind === 'PERIODICO' && row.cycle !== null) ||
            (row.chargeKind === 'UNA_VEZ' && row.cycle === null);
        if (
            row.currency !== 'ARS' ||
            (row.chargeKind !== 'UNA_VEZ' && row.chargeKind !== 'PERIODICO') ||
            !cycleIsValid ||
            !cycleMatchesKind ||
            row.price <= 0
        ) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Listing purge preview contains inconsistent add-on product data',
                undefined,
                'PURGE_PREVIEW_INCONSISTENT'
            );
        }

        lostAddons.push({
            addonInstanceId: row.addonInstanceId,
            name: row.name,
            chargeKind: row.chargeKind,
            cycle: row.cycle as (typeof CYCLES)[number] | null,
            price: row.price,
            currency: 'ARS',
            status: row.status as 'PENDING_AUTHORIZATION' | 'ACTIVE',
            endsAt: row.endsAt?.toISOString() ?? null
        });
    }

    return { lostAddons };
}
