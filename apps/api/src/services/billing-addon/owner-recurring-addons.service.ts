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

/**
 * The one query behind both readers below: the actor's live recurring
 * purchases in stable acquisition order, with every column either reader needs.
 */
async function selectOwnerRecurringAddonRows(input: {
    readonly userId: string;
    readonly listingId?: string;
}) {
    const parsed = inputSchema.parse(input);
    return getDb()
        .select({
            addonInstanceId: addonInstances.id,
            slug: addons.slug,
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
            experienceName: experiences.name,
            endsAt: addonInstances.endsAt,
            compatibleVerticals: addonProducts.compatibleVerticals,
            accommodationId: accommodations.id,
            venueId: venues.id,
            experienceId: experiences.id
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
}

/** Reads only the actor's live recurring purchases in stable acquisition order. */
export async function readOwnerRecurringAddons(input: {
    readonly userId: string;
    readonly listingId?: string;
}): Promise<OwnerRecurringAddonsResponse> {
    const rows = await selectOwnerRecurringAddonRows(input);
    return {
        items: rows.map((row) => ({
            addonInstanceId: row.addonInstanceId,
            slug: row.slug,
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

/** One live recurring add-on the owner holds, with the verticals it applies to. */
export interface OwnerAddonHolding {
    /** Stable catalog key; resolves the localized name (`billing.addon.<slug>.name`). */
    readonly slug: string;
    /** Stored catalog name, used only when the slug has no label. */
    readonly name: string;
    /** Instance status. */
    readonly status: 'PENDING_AUTHORIZATION' | 'ACTIVE';
    /**
     * When the instance ends. `null` on a recurring add-on whose end is not
     * written yet (HOS-2116): it renews with the subscription.
     */
    readonly endsAt: Date | null;
    /**
     * Where it applies: the vertical of its target listing, or, for an add-on
     * with no listing target, the verticals its product is compatible with (the
     * same rule billing's coverage source follows, contract §2.7). For a listing
     * add-on whose listing is gone: its product's only compatible vertical, or
     * none when it fits several (never every one of them).
     */
    readonly verticals: readonly string[];
    /**
     * A listing add-on whose listing no longer exists or is no longer the
     * owner's. Still returned: billing cancels it asynchronously and may still
     * charge it, and `/billing-addon/instances` lists it too (`targetName: null`).
     */
    readonly listingGone: boolean;
}

/**
 * The owner's live recurring add-ons for the assistant's `get_my_plan`
 * (HOS-2328): the same read as {@link readOwnerRecurringAddons} (the reader
 * behind `GET /billing-addon/instances`), with the end date and the verticals.
 *
 * @param input.userId - The owner.
 * @returns The holdings, in acquisition order.
 */
export async function readOwnerAddonHoldings(input: {
    readonly userId: string;
}): Promise<readonly OwnerAddonHolding[]> {
    const rows = await selectOwnerRecurringAddonRows({ userId: input.userId });
    return rows.map((row) => {
        const targetVertical = row.accommodationId
            ? 'accommodation'
            : row.venueId
              ? 'venue'
              : row.experienceId
                ? 'experience'
                : null;
        const listingGone = row.scopeType === 'LISTING' && targetVertical === null;
        const verticals = listingGone
            ? row.compatibleVerticals.length === 1
                ? [...row.compatibleVerticals]
                : []
            : row.scopeType === 'LISTING' && targetVertical
              ? [targetVertical]
              : [...row.compatibleVerticals];
        return {
            slug: row.slug,
            name: row.name,
            status: row.status as OwnerAddonHolding['status'],
            endsAt: row.endsAt,
            verticals,
            listingGone
        };
    });
}
