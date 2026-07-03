/**
 * Apify run-status to ImportFailureCode mapping (HOS-50 / SPEC-277 R3)
 *
 * Maps a terminal {@link ApifyRunStatus} to the matching {@link ImportFailureCode}
 * for the async import path's status-poll handler.
 *
 * **No native "blocked" signal**: unlike the sync path (`runApifyActor`),
 * which infers `source_blocked` from an HTTP 429 on the initial request,
 * Apify's run-status API has no equivalent for a mid-run block (e.g. the
 * actor hitting a captcha). A `FAILED`/`ABORTED` run is therefore mapped to
 * the more generic `provider_error` — never `source_blocked` — and the async
 * path's R2 fallback trigger (a later task) is widened to also fire on
 * `provider_error` to avoid silently skipping fallback on a mid-run block.
 * A start-time HTTP 429 on `startApifyRun` still maps to `source_blocked`
 * directly, independent of this helper.
 *
 * @module services/accommodation-import/adapters/apify-run-status-mapping
 */

import type { ImportFailureCode } from '@repo/schemas';
import type { ApifyRunStatus } from './apify-client';

/**
 * Maps a terminal Apify run status to an {@link ImportFailureCode}.
 *
 * Returns `null` for non-terminal (`READY`, `RUNNING`) or successful
 * (`SUCCEEDED`) statuses — callers should only invoke this once a poll has
 * determined the run ended in `FAILED`, `TIMED-OUT`, or `ABORTED`.
 *
 * @param status - The Apify run status to classify.
 * @returns The matching `ImportFailureCode`, or `null` when `status` is not
 *   a failure.
 *
 * @example
 * ```ts
 * mapApifyRunStatusToFailureCode('TIMED-OUT'); // 'timeout'
 * mapApifyRunStatusToFailureCode('FAILED');    // 'provider_error'
 * mapApifyRunStatusToFailureCode('RUNNING');   // null
 * ```
 */
export function mapApifyRunStatusToFailureCode(status: ApifyRunStatus): ImportFailureCode | null {
    switch (status) {
        case 'TIMED-OUT':
            return 'timeout';
        case 'FAILED':
        case 'ABORTED':
            return 'provider_error';
        default:
            return null;
    }
}
