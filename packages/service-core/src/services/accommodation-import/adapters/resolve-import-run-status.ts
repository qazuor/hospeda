/**
 * Async import run-status resolver (HOS-50 / SPEC-277 R3)
 *
 * Polls a single Apify run started by `extractAsync` (T-007/T-008) and turns
 * its current state into the tri-state result the stateless status route
 * needs: still running, settled with a mapped {@link RawExtraction}, or
 * settled with a failure code. The client owns all run identifiers (`runId`,
 * `datasetId`) and echoes them back on every poll — this module holds no
 * server-side state of its own.
 *
 * **Scope (T-005)**: this file currently handles only the non-terminal
 * (`READY`/`RUNNING`) and `SUCCEEDED` branches. `FAILED`/`TIMED-OUT`/`ABORTED`
 * fall through to a placeholder `provider_error` result; T-006 extends the
 * `default` branch below with the real terminal-failure mapping (via
 * `apify-run-status-mapping.ts`) and the R2 fallback trigger.
 *
 * @module services/accommodation-import/adapters/resolve-import-run-status
 */

import type { ImportFailureCode, ImportSource } from '@repo/schemas';
import type { RawExtraction } from '../adapter.types.js';
import { type AirbnbItem, mapItemToRawExtraction } from './airbnb.adapter.js';
import { getApifyDatasetItems, getApifyRunStatus } from './apify-client.js';
import { type BookingItem, mapApifyItemToRawExtraction } from './booking.adapter.js';

/**
 * The subset of {@link ImportSource} that supports the async Apify path.
 * Only Airbnb and Booking (on its Apify-fallback branch) implement
 * `extractAsync` — see `adapter.types.ts`.
 */
export type AsyncExtractionSource = Extract<ImportSource, 'airbnb' | 'booking'>;

/**
 * Input parameters for {@link resolveImportRunStatus}.
 */
export interface ResolveImportRunStatusInput {
    /** Apify API token. */
    readonly token: string;
    /** Apify run id, as returned by `startApifyRun` at extraction start. */
    readonly runId: string;
    /** Apify dataset id, echoed by the client from the initial `202` response. */
    readonly datasetId: string;
    /** Which per-source mapper to use once the run's dataset is fetched. */
    readonly source: AsyncExtractionSource;
}

/**
 * Result of a single {@link resolveImportRunStatus} poll.
 *
 * - `{ settled: false }` — the run is still `READY`/`RUNNING`.
 * - `{ settled: true, raw }` — the run `SUCCEEDED` and yielded a mappable item.
 * - `{ settled: true, failureCode }` — the run reached a terminal failure, or
 *   `SUCCEEDED` with an empty dataset.
 */
export type ResolveImportRunStatusResult =
    | { readonly settled: false }
    | { readonly settled: true; readonly raw: RawExtraction }
    | { readonly settled: true; readonly failureCode: ImportFailureCode };

/**
 * Maps the first Apify dataset item to a {@link RawExtraction} using the same
 * per-source mapper the synchronous adapters already use, keeping a single
 * source of truth for each provider's dataset item shape.
 *
 * @param source - Which provider produced the dataset item.
 * @param item - The first item from the Apify dataset (untyped at this layer).
 * @returns The mapped {@link RawExtraction}.
 */
function mapDatasetItemToRawExtraction(
    source: AsyncExtractionSource,
    item: unknown
): RawExtraction {
    switch (source) {
        case 'airbnb':
            return mapItemToRawExtraction(item as AirbnbItem);
        case 'booking':
            return mapApifyItemToRawExtraction(item as BookingItem);
    }
}

/**
 * Resolves the current state of an in-flight async Apify run.
 *
 * Calls `getApifyRunStatus` and branches on the result:
 * - `null` (status endpoint unreachable) -> `{ settled: true, failureCode: 'provider_error' }`.
 * - `READY`/`RUNNING` -> `{ settled: false }`.
 * - `SUCCEEDED` -> fetches the dataset via `getApifyDatasetItems`; an empty
 *   dataset yields `{ settled: true, failureCode: 'nothing_found' }`, otherwise
 *   the first item is mapped via the matching per-source mapper and returned
 *   as `{ settled: true, raw }`.
 * - `FAILED`/`TIMED-OUT`/`ABORTED` -> `{ settled: true, failureCode: 'provider_error' }`
 *   as a placeholder; T-006 replaces this with the real mapping + R2 fallback.
 *
 * **Never throws** — every branch of `getApifyRunStatus`/`getApifyDatasetItems`
 * already degrades gracefully, and this function does not add any new
 * throwing path on top of them.
 *
 * @param input - Run identifiers, credentials, and the source adapter to use.
 * @returns The current poll result.
 *
 * @example
 * ```ts
 * const result = await resolveImportRunStatus({
 *   token: ctx.credentials.apifyToken,
 *   runId: 'run-abc123',
 *   datasetId: 'dataset-xyz789',
 *   source: 'airbnb',
 * });
 * if (!result.settled) {
 *   // still running — client polls again later
 * }
 * ```
 */
export async function resolveImportRunStatus(
    input: ResolveImportRunStatusInput
): Promise<ResolveImportRunStatusResult> {
    const { token, runId, datasetId, source } = input;

    const statusResult = await getApifyRunStatus({ token, runId });

    if (statusResult === null) {
        return { settled: true, failureCode: 'provider_error' };
    }

    switch (statusResult.status) {
        case 'READY':
        case 'RUNNING':
            return { settled: false };
        case 'SUCCEEDED': {
            const items = await getApifyDatasetItems({ token, datasetId });
            if (items.length === 0) {
                return { settled: true, failureCode: 'nothing_found' };
            }
            const raw = mapDatasetItemToRawExtraction(source, items[0]);
            return { settled: true, raw };
        }
        default:
            // FAILED / TIMED-OUT / ABORTED — placeholder until T-006 extends
            // this branch with the real mapping (apify-run-status-mapping.ts)
            // and the R2 fallback trigger.
            return { settled: true, failureCode: 'provider_error' };
    }
}
