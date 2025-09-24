import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';
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
    // TODO [6965f540-f3b4-4126-97f6-e1d5fa0ed557]: Opciones para el tipo de imagen (para uso futuro)
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

    // TODO [017a3993-7e6b-40af-9a8b-53b58097de08]: Opciones para el tipo de video (para uso futuro)
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
            {
                id: 'mainImage',
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
                    maxSize: 5242880, // 5MB en bytes
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    aspectRatio: '16:9', // Ratio recomendado
                    quality: 0.85
                }
            },
            // Galería de imágenes
            {
                id: 'images',
                type: FieldTypeEnum.GALLERY,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Galería de Imágenes',
                description: 'Colección de imágenes del alojamiento (máximo 20)',
                placeholder: 'Arrastra imágenes aquí o haz clic para seleccionar...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_GALLERY_MANAGE]
                },
                typeConfig: {
                    type: 'GALLERY',
                    maxImages: 20,
                    maxSize: 5242880, // 5MB por imagen
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
            // Videos
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
            // Tipo de videos
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
