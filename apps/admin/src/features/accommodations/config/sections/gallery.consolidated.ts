import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { EntitlementKey } from '@repo/billing';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Gallery de accommodation.
 *
 * SPEC-204 (P2): `media.featuredImage` (IMAGE) and `media.gallery` (GALLERY)
 * field declarations have been REMOVED from this section. Both are now managed
 * via the dedicated GalleryManager sub-tab (`/accommodations/:id/gallery`) which
 * operates on the relational `accommodation_media` table.
 *
 * This section is now VIDEOS ONLY:
 *   media.videos → array<{ url, caption, description, moderationState }>
 *
 * `media.videos` is wired via the `VIDEO_GALLERY` field (URL + caption +
 * description per entry). Gated by `EntitlementKey.CAN_EMBED_VIDEO` — for
 * unlocked hosts the quality-score `video-gallery` signal flips from
 * "pending" to "done" once at least one entry is added.
 */
export const createGalleryConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    return {
        id: 'gallery',
        title: 'Galería Multimedia',
        description: 'Videos del alojamiento',
        layout: LayoutTypeEnum.GALLERY,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
        },
        fields: [
            // Video gallery — gated by CAN_EMBED_VIDEO. Quality-score signal
            // `video-gallery` (in features/accommodations/config/score-signals)
            // reads this field and flips to "done" once the host adds at least
            // one URL. Persists to `media.videos[]` (VideoSchema in
            // @repo/schemas/common/media.schema).
            {
                id: 'media.videos',
                type: FieldTypeEnum.VIDEO_GALLERY,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Galería de Videos',
                description:
                    'Sumá videos de YouTube o Vimeo para enriquecer la ficha del alojamiento',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                entitlementKey: EntitlementKey.CAN_EMBED_VIDEO,
                typeConfig: {
                    type: 'VIDEO_GALLERY'
                }
            }
        ]
    };
};
