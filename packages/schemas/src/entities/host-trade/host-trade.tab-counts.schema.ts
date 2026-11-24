import { z } from 'zod';

/**
 * The count pills of the provider's own `/mi-cuenta/proveedor` tabs, in ONE
 * read (owner decision 22, Mi cuenta UI epic). It replaces the two one-row
 * list reads the page made on every tab.
 *
 * Each count is `null` when its own read failed: a failed count is simply not
 * shown and never blocks the page, so one broken source does not hide the
 * other.
 */
export const HostTradeProviderTabCountsSchema = z.object({
    /** PENDING usages a HOST declared on this provider: the provider's inbox. */
    pendingUsages: z.number().int().min(0).nullable(),
    /** Published reviews of the provider's own listing. */
    reviews: z.number().int().min(0).nullable()
});

/** See {@link HostTradeProviderTabCountsSchema}. */
export type HostTradeProviderTabCounts = z.infer<typeof HostTradeProviderTabCountsSchema>;
