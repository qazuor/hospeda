/**
 * Async import run-status resolver (HOS-50 / SPEC-277 R3)
 *
 * Polls a single Apify run started by `extractAsync` (T-007/T-008) and turns
 * its current state into the tri-state result the stateless status route
 * needs: still running, settled with a mapped {@link RawExtraction}, or
 * settled with a failure code. The client owns all run identifiers (`runId`,
 * `datasetId`, `url`) and echoes them back on every poll — this module holds
 * no server-side state of its own.
 *
 * **Terminal-failure branch (T-006)**: `FAILED`/`TIMED-OUT`/`ABORTED` map via
 * {@link mapApifyRunStatusToFailureCode}. When the resulting code is
 * `source_blocked` or `provider_error` — Apify has no native "blocked" run
 * status, so a mid-run block also surfaces as `provider_error` and must still
 * trigger fallback — this module makes one cheap `GenericAdapter` (JSON-LD /
 * OpenGraph) pass against the original URL, reusing the same "useful
 * fallback" acceptance rule as the synchronous R2 fallback in
 * `accommodation-import.service.ts` (`_runFallbackGenericExtract`): at least
 * one of `name` / `summary` / `imageUrls` must be present, or the original
 * failure code is kept. `timeout` never triggers fallback — a run that timed
 * out is not a "blocked" signal.
 *
 * @module services/accommodation-import/adapters/resolve-import-run-status
 */

import type { ImportFailureCode, ImportSource } from '@repo/schemas';
import type { ImportContext, RawExtraction } from '../adapter.types.js';
import { type AirbnbItem, mapItemToRawExtraction } from './airbnb.adapter.js';
import { getApifyDatasetItems, getApifyRunStatus } from './apify-client.js';
import { mapApifyRunStatusToFailureCode } from './apify-run-status-mapping.js';
import { type BookingItem, mapApifyItemToRawExtraction } from './booking.adapter.js';
import { GenericAdapter } from './generic.adapter.js';

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
    /**
     * The original listing URL, echoed by the client from the initial `202`
     * response. Used only by the T-006 R2 fallback to re-fetch the page via
     * `GenericAdapter` when the run ends blocked or errored.
     */
    readonly url: string;
    /** Import context (locale, limits, credentials) passed to the R2 fallback. */
    readonly context: ImportContext;
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
 * Runs a single `GenericAdapter` (JSON-LD / OpenGraph) pass against a URL
 * whose async Apify run ended blocked or errored (HOS-50 T-006, mirrors
 * `AccommodationImportService._runFallbackGenericExtract`).
 *
 * Never throws: any error from `GenericAdapter.extract` degrades to `null`,
 * which the caller treats as "fallback yielded nothing, keep the original
 * failure code".
 *
 * @param url - The original listing URL.
 * @param context - Import context (locale, limits, credentials).
 * @returns The fallback {@link RawExtraction}, or `null` on any failure.
 */
async function runFallbackGenericExtract(
    url: URL,
    context: ImportContext
): Promise<RawExtraction | null> {
    const generic = new GenericAdapter();
    try {
        return await generic.extract(url, context);
    } catch {
        return null;
    }
}

/**
 * Whether a fallback {@link RawExtraction} carries enough content to accept
 * over the original terminal failure — same rule as the synchronous R2
 * fallback: at least one of `name`, `summary`, or a non-empty `imageUrls`.
 *
 * @param fallback - The result of {@link runFallbackGenericExtract}.
 * @returns `true` when the fallback is worth accepting.
 */
function hasUsefulFallback(fallback: RawExtraction | null): boolean {
    return Boolean(
        fallback?.name?.value ||
            fallback?.summary?.value ||
            (fallback?.imageUrls && fallback.imageUrls.length > 0)
    );
}

/**
 * Resolves a terminal Apify run status (`FAILED`/`TIMED-OUT`/`ABORTED`) into
 * a settled poll result, attempting the R2 Generic-adapter fallback when the
 * mapped failure code is `source_blocked` or `provider_error` (HOS-50 T-006).
 *
 * @param status - The terminal run status to classify.
 * @param url - The original listing URL, as a string.
 * @param context - Import context passed to the fallback.
 * @param source - Which platform the run belongs to (kept on a successful fallback).
 * @returns The settled poll result.
 */
async function resolveTerminalFailure(
    status: 'FAILED' | 'TIMED-OUT' | 'ABORTED',
    url: string,
    context: ImportContext,
    source: AsyncExtractionSource
): Promise<ResolveImportRunStatusResult> {
    const failureCode = mapApifyRunStatusToFailureCode(status) ?? 'provider_error';

    if (failureCode !== 'source_blocked' && failureCode !== 'provider_error') {
        // 'timeout' — never triggers the R2 fallback.
        return { settled: true, failureCode };
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        // Should never happen — the API schema already validated `url`.
        return { settled: true, failureCode };
    }

    const fallback = await runFallbackGenericExtract(parsedUrl, context);
    if (hasUsefulFallback(fallback)) {
        // biome-ignore lint/style/noNonNullAssertion: hasUsefulFallback narrows fallback to non-null
        const raw: RawExtraction = { ...fallback!, sourcePlatform: source, failureCode: undefined };
        return { settled: true, raw };
    }

    return { settled: true, failureCode };
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
 * - `FAILED`/`TIMED-OUT`/`ABORTED` -> {@link resolveTerminalFailure}: maps the
 *   status to an `ImportFailureCode` and, for `source_blocked`/`provider_error`,
 *   attempts the R2 Generic-adapter fallback before settling.
 *
 * **Never throws** — every branch of `getApifyRunStatus`/`getApifyDatasetItems`
 * already degrades gracefully, and the R2 fallback degrades to `null` on any
 * error, so this function does not add any new throwing path on top of them.
 *
 * @param input - Run identifiers, the original URL/context, and the source adapter to use.
 * @returns The current poll result.
 *
 * @example
 * ```ts
 * const result = await resolveImportRunStatus({
 *   token: ctx.credentials.apifyToken,
 *   runId: 'run-abc123',
 *   datasetId: 'dataset-xyz789',
 *   source: 'airbnb',
 *   url: 'https://airbnb.com/rooms/12345',
 *   context: ctx,
 * });
 * if (!result.settled) {
 *   // still running — client polls again later
 * }
 * ```
 */
export async function resolveImportRunStatus(
    input: ResolveImportRunStatusInput
): Promise<ResolveImportRunStatusResult> {
    const { token, runId, datasetId, source, url, context } = input;

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
            return resolveTerminalFailure(statusResult.status, url, context, source);
    }
}
