import { z } from 'zod';

/** A live add-on instance that will be left behind when its listing is purged. */
export const ListingLostAddonSchema = z.object({
    /** Stable identity of the acquired add-on instance. */
    addonInstanceId: z.string().uuid(),
    /** Current catalog display name of the add-on. */
    name: z.string().min(1),
    /** Billing cadence kind for the current product. */
    chargeKind: z.enum(['UNA_VEZ', 'PERIODICO']),
    /** Recurring cadence, or null for a one-time product. */
    cycle: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).nullable(),
    /** Current product price in minor units (centavos). */
    price: z.number().int().positive(),
    /** Currency of the current product. */
    currency: z.literal('ARS'),
    /** Current live status of the acquired add-on. */
    status: z.enum(['PENDING_AUTHORIZATION', 'ACTIVE']),
    /** End of the acquired add-on term, if one is known. */
    endsAt: z.string().datetime({ offset: true }).nullable()
});

/** Read-only preview of the add-ons a listing owner loses when purging it. */
export const ListingPurgePreviewResponseSchema = z.object({
    /** Live listing-scoped add-ons left behind by the purge. */
    lostAddons: z.array(ListingLostAddonSchema)
});

/** One add-on instance included in a listing purge preview. */
export type ListingLostAddon = z.infer<typeof ListingLostAddonSchema>;

/** Response returned by the listing purge preview endpoint. */
export type ListingPurgePreviewResponse = z.infer<typeof ListingPurgePreviewResponseSchema>;
