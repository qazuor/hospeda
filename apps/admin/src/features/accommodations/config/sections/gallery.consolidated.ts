import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { DEFAULT_MEDIA_MAX_SIZE_BYTES } from '@/lib/constants';
import { LimitKey } from '@repo/billing';
import type { useTranslations } from '@repo/i18n';
import { ENTITY_GALLERY_CAPS, PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Gallery de accommodation.
 *
 * Section config kept tight to what the backend actually persists in
 * `BaseMediaFields` (`@repo/schemas/common/media.schema`):
 *   media.featuredImage  → { url, caption, description, moderationState }
 *   media.gallery        → array<same image shape>
 *   media.videos         → array<{ url, caption, description, moderationState }>
 *
 * Earlier this section also declared `imageCategories`, `videos` (FILE),
 * `externalVideoUrls`, `videoTypes`, `virtualTourUrl`, `documents`,
 * `gallerySettings`, and `imageMetadata`. NONE of those map to backend
 * fields — Zod strips them from PATCH bodies — so they were placeholder UI
 * that did nothing on save. Removed during the view/edit redesign.
 *
 * A proper video-gallery field for `media.videos` (URL + caption/description
 * per item, mirroring the image gallery) is tracked as a follow-up spec.
 */
export const createGalleryConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    return {
        id: 'gallery',
        title: 'Galería Multimedia',
        description: 'Imágenes, videos y contenido multimedia del alojamiento',
        layout: LayoutTypeEnum.GALLERY, // Layout especial para galería
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
        },
        fields: [
            // Imagen principal
            //
            // SPEC-143 Block 1: the field id MUST be the dot-notation path
            // into the entity (`media.featuredImage`), not a flat key like
            // `mainImage`. EntityPageBase's `prepareFormValues` /
            // `unflattenValues` use the id as a JSON pointer to (a) hydrate
            // the form from `accommodation.media.featuredImage` on load and
            // (b) emit `{ media: { featuredImage: ... } }` in the PATCH body
            // on save. Using a flat `mainImage` key here means the form never
            // sees the existing photo and the PATCH body never carries the
            // new upload; the API's Zod schema then strips `mainImage` as an
            // unknown root key. Verified locally via Chrome devtools: GET
            // returns `media.featuredImage`, form shows empty, PATCH body has
            // neither `media` nor `mainImage`.
            {
                id: 'media.featuredImage',
                type: FieldTypeEnum.IMAGE,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Imagen Principal',
                description: 'Imagen principal que representa el alojamiento',
                placeholder: 'Selecciona la imagen principal...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {
                    type: 'IMAGE',
                    maxSize: DEFAULT_MEDIA_MAX_SIZE_BYTES,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    aspectRatio: '16:9', // Ratio recomendado
                    quality: 0.85
                }
            },
            // Galería de imágenes
            //
            // SPEC-143 Finding #13 (resolved): the original `limitKey` was
            // removed because the upstream `LimitGate` from `@qazuor/qzpay-react`
            // read `customerId` from `QZPayContext.customer`, which was never
            // set in the admin app — so the gate always fired with 0/N photos
            // uploaded (false-positive block). PR #1239 / Finding #15 added
            // server-side `enforcePhotoLimit` in `POST /api/v1/admin/media/upload`
            // as the primary guard.
            //
            // SPEC-143 followup (fix/SPEC-143-followup-batch-2): `PlanLimitGate`
            // replaces the broken `LimitGate`. It reads limits from
            // `GET /api/v1/protected/users/me/entitlements` via `useMyEntitlements`
            // (no QZPayContext needed) and compares them against the current
            // gallery array length from the live form values. The `limitKey` is
            // re-enabled here so the UI shows a proactive cap warning before
            // the user reaches the server-side 403. The API guard remains as
            // the authoritative source of truth; the UI gate is an ergonomic
            // early signal.
            //
            // SPEC-143 Block 1: field id MUST be `media.gallery` (dot-notation
            // path), not `images`. Same root cause as `media.featuredImage`
            // above — see that field's comment for the full explanation. The
            // `galleryFieldHandlers` map key in `$id_.edit.tsx` and `new.tsx`
            // must match this id so the upload handler is wired correctly.
            // Re-enabled in Phase 4-B: EntityFormSection no longer wraps the
            // field in PlanLimitGate (which used to hide it at the cap). It
            // now renders a LimitProgressIndicator above the field for HOST
            // users only — staff (admin/superadmin) is bypassed via
            // useShouldShowEntitlementGates, so the false-positive that
            // disabled this previously is gone. Server-side enforcePhotoLimit
            // on POST /api/v1/admin/media/upload remains authoritative.
            {
                id: 'media.gallery',
                type: FieldTypeEnum.GALLERY,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Galería de Imágenes',
                description: `Colección de imágenes del alojamiento (máximo ${ENTITY_GALLERY_CAPS.accommodation})`,
                placeholder: 'Arrastra imágenes aquí o haz clic para seleccionar...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                typeConfig: {
                    type: 'GALLERY',
                    maxImages: ENTITY_GALLERY_CAPS.accommodation,
                    maxSize: DEFAULT_MEDIA_MAX_SIZE_BYTES,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    sortable: true
                }
            }
        ]
    };
};
