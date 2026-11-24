/**
 * Deletes partner logos a content edit or review left without a reference
 * (owner decision 16, Mi cuenta UI epic).
 *
 * The service names the discarded URLs (`resolveDiscardedPartnerLogoUrls`)
 * from the row before and after its write, so a URL still held by the live or
 * the pending column is never one of them. This module deletes only what is
 * provably ours AND a partner logo of THIS partner: a Hospeda Cloudinary asset
 * under `hospeda/<env>/partners/<partnerId>/logo/`, which is exactly where
 * `POST /partners/mine/logo` uploads. A seeded, external or foreign URL is
 * skipped.
 *
 * It runs after the row is written and never fails the request: the row is the
 * source of truth, and an asset left behind costs storage, not correctness.
 */

import type { ImageProvider } from '@repo/media/server';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { getMediaProvider } from '../media';
import { classifyPartnerRemoteAssets } from './partner-presence-remote-assets';

/** Input of {@link deletePartnerLogoOrphans}. RO-RO. */
export interface DeletePartnerLogoOrphansInput {
    readonly partnerId: string;
    /** The URLs the write discarded. */
    readonly urls: readonly string[];
    /** Injected in tests; defaults to the configured provider. */
    readonly mediaProvider?: Pick<ImageProvider, 'delete'> | null;
    /** Injected in tests; defaults to `HOSPEDA_CLOUDINARY_CLOUD_NAME`. */
    readonly cloudName?: string | null;
}

/** What {@link deletePartnerLogoOrphans} did. */
export interface DeletePartnerLogoOrphansResult {
    readonly deleted: readonly string[];
    readonly skipped: number;
    readonly failed: readonly string[];
}

/**
 * Deletes the discarded logo assets of one partner, best effort.
 *
 * @param input - See {@link DeletePartnerLogoOrphansInput}.
 * @returns Deleted public ids, skipped count and failed public ids.
 */
export async function deletePartnerLogoOrphans({
    partnerId,
    urls,
    mediaProvider,
    cloudName
}: DeletePartnerLogoOrphansInput): Promise<DeletePartnerLogoOrphansResult> {
    if (urls.length === 0) return { deleted: [], skipped: 0, failed: [] };
    const plan = classifyPartnerRemoteAssets({
        urls,
        cloudName: cloudName === undefined ? (env.HOSPEDA_CLOUDINARY_CLOUD_NAME ?? null) : cloudName
    });
    const marker = `/partners/${partnerId}/logo/`;
    const ours = plan.publicIds.filter((publicId) => publicId.includes(marker));
    const skipped = plan.skipped + plan.publicIds.length - ours.length;
    if (ours.length === 0) return { deleted: [], skipped, failed: [] };

    const provider = mediaProvider === undefined ? getMediaProvider() : mediaProvider;
    if (!provider) {
        apiLogger.warn(
            { partnerId, publicIds: ours },
            '[partner-logo] media provider unavailable; orphaned logos left in place'
        );
        return { deleted: [], skipped, failed: ours };
    }

    const deleted: string[] = [];
    const failed: string[] = [];
    for (const publicId of ours) {
        try {
            await provider.delete({ publicId });
            deleted.push(publicId);
        } catch (error) {
            failed.push(publicId);
            apiLogger.warn({ partnerId, publicId, error }, '[partner-logo] orphan deletion failed');
        }
    }
    return { deleted, skipped, failed };
}
