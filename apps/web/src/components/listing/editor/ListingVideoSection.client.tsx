/**
 * @file ListingVideoSection.client.tsx
 * @description Venue adapter of the shared video widget, mounted on the
 * "Fotos" page of the venue editor (HOS-2258).
 *
 * The venue PATCH takes a top-level `videos` (the venue has no `media` input)
 * and the server rejects it with 403 `ENTITLEMENT_REQUIRED` when the owner's
 * plan lacks `can_embed_video`, storing nothing. The page only mounts this
 * island while the catalog trait is `available`; the 403 is the backstop.
 */

import { useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import type { SupportedLocale } from '@/lib/i18n';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import type { VideoEntry, VideoPayload, VideoSaveResult } from './use-video-section';
import { VideoSection } from './VideoSection.client';

/** Most linked videos a venue may carry; mirrors `LISTING_VIDEOS_MAX` in `@repo/schemas`. */
const MAX_VIDEOS = 6;

/** Props for ListingVideoSection. */
export interface ListingVideoSectionProps {
    readonly locale: SupportedLocale;
    readonly vertical: keyof typeof LISTING_VERTICAL_FORM_CONFIG;
    readonly listingId: string;
    readonly initialVideos: readonly VideoEntry[];
}

/** Video widget of the venue editor. */
export function ListingVideoSection({
    locale,
    vertical,
    listingId,
    initialVideos
}: ListingVideoSectionProps) {
    const { patchPath } = LISTING_VERTICAL_FORM_CONFIG[vertical];
    const save = useCallback(
        async (videos: readonly VideoPayload[]): Promise<VideoSaveResult> => {
            const result = await apiClient.patch<unknown>({
                path: patchPath(listingId),
                body: { videos }
            });
            return result.ok ? { ok: true } : { ok: false, status: result.error?.status };
        },
        [listingId, patchPath]
    );

    return (
        <VideoSection
            locale={locale}
            initialVideos={initialVideos}
            save={save}
            copyScope="listing"
            maxVideos={MAX_VIDEOS}
        />
    );
}
