import {
    accommodations,
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    experiences,
    getDb,
    venues
} from '@repo/db';
import { OwnerRecurringAddonsQuerySchema, type OwnerRecurringAddonsResponse } from '@repo/schemas';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

const inputSchema = OwnerRecurringAddonsQuerySchema.extend({ userId: z.uuid() });

/** Reads only the actor's live recurring purchases in stable acquisition order. */
export async function readOwnerRecurringAddons(input: {
    readonly userId: string;
    readonly listingId?: string;
}): Promise<OwnerRecurringAddonsResponse> {
    const parsed = inputSchema.parse(input);
    const rows = await getDb()
        .select({
            addonInstanceId: addonInstances.id,
            name: addons.name,
            chargeKind: addonProducts.chargeKind,
            cycle: addonProducts.cycle,
            price: addonProducts.price,
            currency: addonProducts.currency,
            status: addonInstances.status,
            targetId: addonInstances.targetId,
            scopeType: addonVersions.scopeType,
            accommodationName: accommodations.name,
            venueName: venues.name,
            experienceName: experiences.name
        })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .innerJoin(addons, eq(addons.id, addonVersions.addonId))
        .leftJoin(
            accommodations,
            and(
                eq(accommodations.id, addonInstances.targetId),
                eq(accommodations.ownerId, parsed.userId),
                isNull(accommodations.deletedAt)
            )
        )
        .leftJoin(
            venues,
            and(
                eq(venues.id, addonInstances.targetId),
                eq(venues.ownerId, parsed.userId),
                isNull(venues.deletedAt)
            )
        )
        .leftJoin(
            experiences,
            and(
                eq(experiences.id, addonInstances.targetId),
                eq(experiences.ownerId, parsed.userId),
                isNull(experiences.deletedAt)
            )
        )
        .where(
            and(
                eq(addonInstances.ownerId, parsed.userId),
                eq(addonProducts.chargeKind, 'PERIODICO'),
                inArray(addonInstances.status, ['PENDING_AUTHORIZATION', 'ACTIVE']),
                parsed.listingId ? eq(addonInstances.targetId, parsed.listingId) : undefined
            )
        )
        .orderBy(asc(addonInstances.createdAt), asc(addonInstances.id));

    return {
        items: rows.map((row) => ({
            addonInstanceId: row.addonInstanceId,
            name: row.name,
            chargeKind: 'PERIODICO',
            cycle: row.cycle as 'monthly' | 'quarterly' | 'semiannual' | 'annual',
            price: row.price,
            currency: 'ARS',
            status: row.status as 'PENDING_AUTHORIZATION' | 'ACTIVE',
            targetId: row.targetId,
            targetName:
                row.scopeType === 'LISTING'
                    ? (row.accommodationName ?? row.venueName ?? row.experienceName)
                    : null
        }))
    };
}
