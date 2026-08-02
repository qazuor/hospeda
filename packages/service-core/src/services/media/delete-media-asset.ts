/**
 * @file delete-media-asset.ts
 * @description Shared "delete the Cloudinary binary before dropping the DB row"
 * step used by every vertical's `removeMedia` operation (HOS-372).
 *
 * ## Why this exists
 *
 * Before HOS-372, removing a photo deleted only the DB row. Every `removeMedia`
 * path in the codebase carried the comment "Does NOT touch Cloudinary — deleting
 * the binary is a separate concern orchestrated by the caller", but no caller
 * ever orchestrated it:
 *
 *   - `PhotoSection.client.tsx` (accommodations) never called any delete endpoint.
 *   - `MediaField.tsx` (commerce) did call `protectedMediaApi.deleteMedia`, but
 *     `media/protected/delete-entity` rejects `gastronomy`/`experience` with HTTP
 *     400, so the call could never succeed.
 *   - The `media-orphan-cleanup` cron only wipes the `hospeda/preview/` and
 *     `hospeda/test/` prefixes, and short-circuits entirely when
 *     `NODE_ENV === 'production'`.
 *
 * The result was that deleting a photo orphaned its Cloudinary asset — billed
 * forever, referenced by nothing, swept by nothing.
 *
 * ## Ordering contract: binary first, row second
 *
 * This step runs AFTER authorization and row resolution, but BEFORE the DB
 * transaction that soft-deletes the row. That ordering is deliberate:
 *
 *   - Running it after authorization means an actor cannot destroy another
 *     owner's binary by guessing media ids — the caller has already proven the
 *     row belongs to an entity it may edit.
 *   - Running it before the DB write means a Cloudinary failure aborts the whole
 *     operation with the row still intact, so the user can retry. An orphan
 *     becomes impossible by construction rather than merely unlikely.
 *
 * The accepted trade-off (owner decision, HOS-372): if Cloudinary succeeds and
 * the subsequent DB write fails, a row survives pointing at a deleted binary —
 * a visibly broken image the user can clear by deleting again. That is preferred
 * over a silent, invisible, permanently-billed orphan.
 *
 * This also matches the transaction convention documented in this package's
 * CLAUDE.md: external API calls stay OUTSIDE the transaction callback, because
 * they cannot be rolled back.
 *
 * @module services/media/delete-media-asset
 */

import { extractPublicId } from '@repo/media';
import type { ImageProvider } from '@repo/media/server';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../types';

/**
 * Minimal shape this step needs from a media row.
 *
 * Every vertical's media table (`accommodation_media`, `gastronomy_media`,
 * `experience_media`) satisfies this: a required `url` and a nullable
 * `publicId`. Typing the input structurally rather than against a concrete row
 * type keeps one implementation serving all three tables.
 */
export interface DeletableMediaRow {
    /** Absolute asset URL. Required on every media row. */
    readonly url: string;
    /** Cloudinary public id, when the row recorded one. */
    readonly publicId?: string | null;
}

/** Outcome of an attempted asset deletion. */
export type DeleteMediaAssetOutcome =
    /** The binary was deleted, or was already gone (both are success). */
    | 'deleted'
    /** No provider configured — nothing was attempted. */
    | 'skipped-no-provider'
    /** The row carries no resolvable Cloudinary public id (e.g. an external URL). */
    | 'skipped-not-cloudinary';

/** Logger surface this step needs. Matches the services' injected logger. */
interface MinimalLogger {
    warn(obj: Record<string, unknown>, msg: string): void;
}

/**
 * Resolve the Cloudinary public id for a media row.
 *
 * Prefers the stored `publicId` column and falls back to parsing the URL, which
 * covers rows written before the column existed. Returns `null` for URLs that
 * are not Cloudinary-hosted at all (seed fixtures pointing at external CDNs),
 * which is not an error — there is simply nothing for us to delete.
 *
 * @param row - The media row being removed.
 * @returns The public id, or `null` when none can be resolved.
 */
export function resolveDeletablePublicId(row: DeletableMediaRow): string | null {
    const stored = row.publicId?.trim();
    if (stored) return stored;
    return extractPublicId(row.url);
}

/**
 * Delete a media row's underlying Cloudinary binary, throwing if the provider
 * fails so the caller aborts before touching the database.
 *
 * Deliberately tolerant in two cases that are NOT failures:
 *
 *   - **No provider configured.** Local dev and test runs without Cloudinary
 *     credentials must still be able to remove photos. Returns
 *     `'skipped-no-provider'`.
 *   - **No resolvable public id.** A row whose URL points at an external host
 *     (seeded fixtures) has no binary of ours to delete. Returns
 *     `'skipped-not-cloudinary'`.
 *
 * An asset that is already absent is treated as success: `provider.delete` is
 * idempotent and reports that via `wasPresent: false`. The goal is "the binary
 * is gone", and it already is.
 *
 * @param params.provider - Image provider, or `null` when not configured.
 * @param params.row - The media row about to be removed.
 * @param params.logger - Optional logger for skip diagnostics.
 * @returns The outcome, for callers that want to log or assert on it.
 * @throws {ServiceError} `INTERNAL_ERROR` when the provider itself fails — the
 *   caller MUST let this propagate so the DB row survives and the user can retry.
 */
export async function deleteMediaAssetOrThrow(params: {
    readonly provider: ImageProvider | null;
    readonly row: DeletableMediaRow;
    readonly logger?: MinimalLogger;
}): Promise<DeleteMediaAssetOutcome> {
    const { provider, row, logger } = params;

    if (!provider) {
        logger?.warn(
            { url: row.url },
            '[media] Skipping Cloudinary delete: no media provider configured'
        );
        return 'skipped-no-provider';
    }

    const publicId = resolveDeletablePublicId(row);
    if (!publicId) {
        logger?.warn(
            { url: row.url },
            '[media] Skipping Cloudinary delete: no public id resolvable from row'
        );
        return 'skipped-not-cloudinary';
    }

    try {
        // `wasPresent: false` means the asset was already gone, which satisfies
        // the goal just as well as deleting it now.
        await provider.delete({ publicId });
        return 'deleted';
    } catch (err) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            `Failed to delete media asset from storage: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
}
