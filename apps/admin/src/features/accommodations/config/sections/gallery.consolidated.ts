import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { DEFAULT_MEDIA_MAX_SIZE_BYTES } from '@/lib/constants';
import { EntitlementKey, LimitKey } from '@repo/billing';
import type { useTranslations } from '@repo/i18n';
import { ENTITY_GALLERY_CAPS, PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Gallery de accommodation
 *
 * @param _t - Función de traducción (no usada por ahora)
 * @returns Configuración consolidada de la sección gallery
 */
export const createGalleryConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    // TODO: Opciones para el tipo de imagen (para uso futuro)
    // const imageTypeOptions: SelectOption[] = [
    //     { value: 'main', label: 'Imagen Principal' },
    //     { value: 'exterior', label: 'Vista Exterior' },
    //     { value: 'interior', label: 'Vista Interior' },
    //     { value: 'room', label: 'Habitación' },
    //     { value: 'bathroom', label: 'Baño' },
    //     { value: 'kitchen', label: 'Cocina' },
    //     { value: 'amenity', label: 'Amenity' },
    //     { value: 'common_area', label: 'Área Común' },
    //     { value: 'view', label: 'Vista desde el Alojamiento' },
    //     { value: 'other', label: 'Otro' }
    // ];

    // TODO: Opciones para el tipo de video (para uso futuro)
    // const videoTypeOptions: SelectOption[] = [
    //     { value: 'tour', label: 'Tour Virtual' },
    //     { value: 'promotional', label: 'Video Promocional' },
    //     { value: 'testimonial', label: 'Testimonio' },
    //     { value: 'amenity_showcase', label: 'Showcase de Amenities' },
    //     { value: 'location', label: 'Ubicación y Entorno' },
    //     { value: 'other', label: 'Otro' }
    // ];

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
            {
                id: 'media.gallery',
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
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
                typeConfig: {
                    type: 'GALLERY',
                    maxImages: ENTITY_GALLERY_CAPS.accommodation,
                    maxSize: DEFAULT_MEDIA_MAX_SIZE_BYTES,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    sortable: true
                }
            },
            // Categorización de imágenes
            {
                id: 'imageCategories',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['edit', 'create'], // Solo en edición
                label: 'Categorías de Imágenes',
                description: 'Asigna categorías a cada imagen para mejor organización',
                placeholder: '{"image1.jpg": "exterior", "image2.jpg": "room"}',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {}
            },
            // Videos - T-G-006: Gate video upload (premium feature)
            {
                id: 'videos',
                type: FieldTypeEnum.FILE,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Videos',
                description: 'Videos del alojamiento (máximo 3 videos)',
                placeholder: 'Selecciona videos...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                entitlementKey: EntitlementKey.CAN_EMBED_VIDEO, // Requires premium plan
                typeConfig: {}
            },
            // URLs de videos externos (YouTube, Vimeo, etc.)
            {
                id: 'externalVideoUrls',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Videos Externos',
                description: 'URLs de videos en YouTube, Vimeo u otras plataformas',
                placeholder: '["https://youtube.com/watch?v=...", "https://vimeo.com/..."]',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {}
            },
            // Tipo de videos - T-G-006: Gate video types (premium feature)
            {
                id: 'videoTypes',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['edit', 'create'], // Solo en edición
                label: 'Tipos de Videos',
                description: 'Categoriza cada video según su propósito',
                placeholder: '{"video1.mp4": "tour", "https://youtube.com/...": "promotional"}',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                entitlementKey: EntitlementKey.CAN_EMBED_VIDEO, // Requires premium plan
                typeConfig: {}
            },
            // Tour virtual 360°
            {
                id: 'virtualTourUrl',
                type: FieldTypeEnum.URL,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Tour Virtual 360°',
                description: 'URL del tour virtual interactivo (Matterport, etc.)',
                placeholder: 'https://my.matterport.com/show/?m=...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {}
            },
            // Documentos adicionales (planos, certificados, etc.)
            {
                id: 'documents',
                type: FieldTypeEnum.FILE,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Documentos',
                description: 'Planos, certificados, folletos u otros documentos',
                placeholder: 'Selecciona documentos...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {}
            },
            // Configuración de galería
            {
                id: 'gallerySettings',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['edit', 'create'], // Solo en edición
                label: 'Configuración de Galería',
                description: 'Configuraciones adicionales para la presentación de la galería',
                placeholder: '{"showCaptions": true, "autoplay": false, "transitionSpeed": 500}',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {}
            },
            // Metadatos de imágenes (EXIF, geolocalización, etc.)
            {
                id: 'imageMetadata',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['view'], // Solo lectura - se genera automáticamente
                label: 'Metadatos de Imágenes',
                description: 'Información técnica extraída automáticamente de las imágenes',
                placeholder: 'Se genera automáticamente...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {}
            }
        ]
    };
};
