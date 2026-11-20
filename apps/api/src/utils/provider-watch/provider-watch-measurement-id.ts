/**
 * The measurement ids the provider watch accepts in a path (HOS-2390). They are the catalog's own
 * ids, the same ones `GET /shapes` returns, so a catalog change is followed with no second list.
 *
 * @module utils/provider-watch/provider-watch-measurement-id
 */
import { WATCH_CATALOG } from '@repo/payments';
import { z } from 'zod';

const IDS: ReadonlySet<string> = new Set(WATCH_CATALOG.map((entry) => entry.id));

/** A measurement id of `WATCH_CATALOG`. */
export const ProviderWatchMeasurementIdSchema = z
    .string()
    .refine((id) => IDS.has(id), { message: 'Unknown measurement id' });
