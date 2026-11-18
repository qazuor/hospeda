/**
 * @file VideoSection.client.tsx
 * @description Accommodation adapter of the shared video widget
 * (`listing/editor/VideoSection.client.tsx`), mounted on the accommodation
 * editor's "Fotos" page (G7 smoke, H-121).
 *
 * The accommodation PATCH carries videos nested under `media` (HOS-372's
 * `HttpMediaUpdateSchema`), which is the only thing this adapter adds.
 *
 * `CAN_EMBED_VIDEO` protects linked video embeds on the server's public read
 * path: the entitlement filter strips `videos` and `media.videos` for plans
 * without the grant. All accommodation plans currently receive the grant.
 */

import { useCallback } from 'react';
import type { VideoPayload, VideoSaveResult } from '@/components/listing/editor/use-video-section';
import { VideoSection as SharedVideoSection } from '@/components/listing/editor/VideoSection.client';
import type { AccommodationVideoEntry } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';

/** Props for VideoSection. */
export interface VideoSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialVideos: readonly AccommodationVideoEntry[];
}

/** Video widget of the accommodation editor. */
export function VideoSection({ locale, accommodationId, initialVideos }: VideoSectionProps) {
    const save = useCallback(
        async (videos: readonly VideoPayload[]): Promise<VideoSaveResult> => {
            const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
            const result = await accommodationEditApi.update({
                id: accommodationId,
                data: { media: { videos: videos.map((video) => ({ ...video })) } }
            });
            return result.ok ? { ok: true } : { ok: false, status: result.error?.status };
        },
        [accommodationId]
    );

    return (
        <SharedVideoSection
            locale={locale}
            initialVideos={initialVideos}
            save={save}
            copyScope="accommodation"
        />
    );
}
