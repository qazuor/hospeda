import { randomUUID } from 'node:crypto';
import {
    ListingPurgedEventSchema,
    type VerticalsForBilling
} from '@repo/billing-verticals-contract';
import { addonInstances, addonVersions, and, eq, getDb, inArray } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import { type CancelPurgedListingAddonPorts, cancelPurgedListingAddon } from './addon-instance-a6';

const logger = createLogger('listing-purged-addons');
const inputSchema = z.object({ listingId: z.uuid() });

/** Ports shared by the committed push and the A6 act. */
export type ListingPurgedAddonsPorts = CancelPurgedListingAddonPorts;

/** Re-read the listing, then cancel each live addon belonging to that listing independently. */
export async function cancelAddonsOfPurgedListing(
    input: { readonly listingId: string },
    ports: ListingPurgedAddonsPorts
): Promise<
    | { readonly outcome: 'DISCARDED' }
    | {
          readonly examined: number;
          readonly cancelled: number;
          readonly discarded: number;
          readonly failed: number;
      }
> {
    inputSchema.parse(input);
    if (!(await ports.listingPurged(input)).purged) return { outcome: 'DISCARDED' };
    const rows = await getDb()
        .select({ id: addonInstances.id })
        .from(addonInstances)
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .where(
            and(
                eq(addonInstances.targetId, input.listingId),
                eq(addonVersions.scopeType, 'LISTING'),
                inArray(addonInstances.status, ['ACTIVE', 'PENDING_AUTHORIZATION'])
            )
        )
        .orderBy(addonInstances.id);
    let cancelled = 0;
    let discarded = 0;
    let failed = 0;
    for (const row of rows) {
        try {
            const result = await cancelPurgedListingAddon(
                { instanceId: row.id, correlationId: randomUUID() },
                ports
            );
            if (result.outcome === 'CANCELLED') cancelled++;
            else discarded++;
        } catch (error) {
            failed++;
            logger.error(
                { error, instanceId: row.id, listingId: input.listingId },
                'A6 push cancellation failed'
            );
        }
    }
    return { examined: rows.length, cancelled, discarded, failed };
}

/** Subscribe to committed listing purges; listener failures never break the publisher. */
export function subscribeListingPurgedAddons(
    source: Pick<VerticalsForBilling, 'onListingPurged'>,
    ports: ListingPurgedAddonsPorts
): () => void {
    return source.onListingPurged(async (event) => {
        try {
            const { listingId } = ListingPurgedEventSchema.parse(event);
            await cancelAddonsOfPurgedListing({ listingId }, ports);
        } catch (error) {
            logger.error({ error }, 'Listing purged addon listener failed');
        }
    });
}
