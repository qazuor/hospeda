/**
 * @file commerceSections.ts
 * Builder functions for the SHARED commerce consolidated section configs.
 *
 * These sections are reused verbatim by every concrete commerce entity
 * (gastronomy via SPEC-240, experiences later) — they contain ZERO entity-
 * specific fields or values.
 *
 * Two sections are exported:
 *
 *   - `createCommerceIdentitySection()` — admin-only core fields:
 *       name, slug, summary, description, richDescription,
 *       destinationId, ownerId, isFeatured,
 *       lifecycleStatus, moderationStatus, moderationNotes, rejectionReason.
 *
 *   - `createCommerceOperationalSection()` — owner-editable operational fields:
 *       contactInfo (phone, email, website, whatsapp),
 *       socialNetworks (facebook, instagram, twitter),
 *       media (featuredImage, gallery, videos),
 *       openingHours (scheduleText),
 *       richDescription (already in identity; NOT duplicated here),
 *       amenities, features.
 *
 * Permissions use the generic COMMERCE_* enum values from @repo/schemas so
 * that both admin (COMMERCE_EDIT_ALL) and owner-scoped edits
 * (COMMERCE_EDIT_OWN — single permission, SPEC-253 D2=b) are correctly gated.
 *
 * Field types are taken from the real `FieldTypeEnum`.  If a needed type
 * (e.g. a structured opening-hours editor) does not yet exist, the closest
 * available type is used with a `// TODO(SPEC-239)` comment.
 */

import {
    FieldTypeEnum,
    LayoutTypeEnum,
    RichTextFeatureEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';
import { LifecycleStatusEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Lifecycle status options shared across commerce entities.
 * Values mirror `LifecycleStatusEnum` from @repo/schemas.
 */
const LIFECYCLE_OPTIONS = [
    { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
    { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
    { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
] as const;

/**
 * Moderation status options shared across commerce entities.
 * Values mirror `ModerationStatusEnum` from @repo/schemas.
 */
const MODERATION_OPTIONS = [
    { value: ModerationStatusEnum.PENDING, label: 'Pendiente' },
    { value: ModerationStatusEnum.APPROVED, label: 'Aprobado' },
    { value: ModerationStatusEnum.REJECTED, label: 'Rechazado' }
] as const;

// ---------------------------------------------------------------------------
// Identity section
// ---------------------------------------------------------------------------

/**
 * Returns the SHARED admin-identity section for any commerce listing.
 *
 * Contains: name, slug, summary, description, richDescription, destinationId,
 * ownerId, isFeatured, lifecycleStatus, moderationStatus, moderationNotes,
 * rejectionReason.
 *
 * Visible in all three modes (`view`, `edit`, `create`), except state/
 * moderation fields which are view/edit-only (defaults are set by the backend
 * on creation).
 *
 * Permissions: COMMERCE_VIEW_ALL to view; COMMERCE_EDIT_ALL to edit admin-only
 * fields.
 *
 * @returns A `ConsolidatedSectionConfig` for the commerce identity section.
 */
export function createCommerceIdentitySection(): ConsolidatedSectionConfig {
    return {
        id: 'commerce-identity',
        title: 'Identidad',
        description: 'Datos de identidad del comercio / listado',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            edit: [PermissionEnum.COMMERCE_EDIT_ALL]
        },
        fields: [
            // ------------------------------------------------------------------
            // Core text identity
            // ------------------------------------------------------------------
            {
                id: 'name',
                type: FieldTypeEnum.TEXT,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Nombre',
                description: 'Nombre del comercio o listado (2–100 caracteres)',
                placeholder: 'Ingresá el nombre del comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    minLength: 2,
                    maxLength: 100
                }
            },
            {
                id: 'slug',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'URL Amigable (slug)',
                description: 'Identificador en la URL — se genera automáticamente desde el nombre',
                placeholder: 'nombre-del-comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    minLength: 2,
                    maxLength: 100,
                    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
                }
            },
            {
                id: 'summary',
                type: FieldTypeEnum.TEXTAREA,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Resumen',
                description:
                    'Descripción breve para tarjetas y resultados de búsqueda (10–300 caracteres)',
                placeholder: 'Una frase atractiva que describa el comercio…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    minRows: 2,
                    minLength: 10,
                    maxLength: 300
                }
            },
            {
                id: 'description',
                type: FieldTypeEnum.TEXTAREA,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Descripción',
                description: 'Descripción completa del comercio (20–2000 caracteres)',
                placeholder: 'Describí el comercio en detalle…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    minRows: 4,
                    minLength: 20,
                    maxLength: 2000
                }
            },
            {
                id: 'richDescription',
                type: FieldTypeEnum.RICH_TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Descripción Enriquecida',
                description: 'Descripción con formato avanzado (hasta 5000 caracteres)',
                placeholder: 'Agrega una descripción rica con formato…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN]
                },
                typeConfig: {
                    type: 'RICH_TEXT',
                    maxLength: 5000,
                    allowedFeatures: [
                        RichTextFeatureEnum.BOLD,
                        RichTextFeatureEnum.ITALIC,
                        RichTextFeatureEnum.UNDERLINE,
                        RichTextFeatureEnum.LIST,
                        RichTextFeatureEnum.ORDERED_LIST,
                        RichTextFeatureEnum.HEADING,
                        RichTextFeatureEnum.QUOTE
                    ]
                }
            },

            // ------------------------------------------------------------------
            // Relationships
            // ------------------------------------------------------------------
            {
                id: 'destinationId',
                type: FieldTypeEnum.DESTINATION_SELECT,
                required: true,
                modes: ['view', 'edit', 'create'],
                label: 'Destino',
                description: 'Destino al que pertenece este comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    searchMode: 'client',
                    minCharToSearch: 1,
                    showAvatar: false,
                    clearable: true
                }
            },
            {
                id: 'ownerId',
                type: FieldTypeEnum.USER_SELECT,
                required: false,
                modes: ['view', 'edit'],
                label: 'Propietario',
                description: 'Usuario que administra este comercio (solo admin puede cambiar)',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    searchMode: 'server',
                    minCharToSearch: 2,
                    searchDebounce: 300,
                    showAvatar: true,
                    clearable: true
                }
            },

            // ------------------------------------------------------------------
            // Featured toggle (admin-only)
            // ------------------------------------------------------------------
            {
                id: 'isFeatured',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit'],
                label: 'Destacado',
                description: 'Indica si el comercio aparece en los listados destacados',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {}
            },

            // ------------------------------------------------------------------
            // Lifecycle & visibility (view/edit only — backend sets defaults on create)
            // ------------------------------------------------------------------
            {
                id: 'lifecycleStatus',
                type: FieldTypeEnum.SELECT,
                required: false,
                modes: ['view', 'edit'],
                label: 'Estado del Ciclo de Vida',
                description: 'Estado actual en el ciclo de vida del comercio',
                placeholder: 'Seleccionar estado…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: LIFECYCLE_OPTIONS is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: LIFECYCLE_OPTIONS as unknown as { value: string; label: string }[]
                }
            },
            {
                id: 'moderationStatus',
                type: FieldTypeEnum.SELECT,
                required: false,
                modes: ['view', 'edit'],
                label: 'Estado de Moderación',
                description: 'Estado del proceso de moderación',
                placeholder: 'Seleccionar estado…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_MODERATE_REVIEW]
                },
                typeConfig: {
                    // TYPE-WORKAROUND: MODERATION_OPTIONS is a readonly tuple; SelectFieldConfig expects a mutable array.
                    options: MODERATION_OPTIONS as unknown as { value: string; label: string }[]
                }
            },
            {
                id: 'moderationNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit'],
                label: 'Notas de Moderación',
                description: 'Comentarios del proceso de moderación (solo admin)',
                placeholder: 'Agregar notas sobre la moderación…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_MODERATE_REVIEW]
                },
                typeConfig: {
                    minRows: 2,
                    maxLength: 1000
                }
            },
            {
                id: 'rejectionReason',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit'],
                label: 'Motivo de Rechazo',
                description: 'Razón del rechazo (si aplica)',
                placeholder: 'Especificar el motivo…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_MODERATE_REVIEW]
                },
                typeConfig: {
                    minRows: 2,
                    maxLength: 500
                }
            }
        ]
    };
}

// ---------------------------------------------------------------------------
// Operational section
// ---------------------------------------------------------------------------

/**
 * Returns the SHARED operational section for any commerce listing.
 *
 * Contains owner-editable fields:
 *   - Contact info: phone, email, website, whatsapp.
 *   - Social networks: facebook, instagram, twitter.
 *   - Media: featuredImage (IMAGE), gallery (GALLERY), videos (VIDEO_GALLERY).
 *   - Opening hours: scheduleText (TEXTAREA — no structured type exists yet).
 *   - Amenities: AMENITY_SELECT (multi-select).
 *   - Features: FEATURE_SELECT (multi-select).
 *
 * Permissions: COMMERCE_VIEW_ALL to view; COMMERCE_EDIT_OWN (owner) or
 * COMMERCE_EDIT_ALL (admin) to edit (SPEC-253 D2=b: per-section perms removed).
 *
 * @returns A `ConsolidatedSectionConfig` for the commerce operational section.
 */
export function createCommerceOperationalSection(): ConsolidatedSectionConfig {
    return {
        id: 'commerce-operational',
        title: 'Información Operacional',
        description: 'Datos de contacto, redes sociales, medios y horarios del comercio',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit', 'create'],
        permissions: {
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            // SPEC-253 D2=b: single COMMERCE_EDIT_OWN replaces per-section perms.
            edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
        },
        fields: [
            // ------------------------------------------------------------------
            // Contact info
            // ------------------------------------------------------------------
            {
                id: 'contactInfo.phone',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Teléfono',
                description: 'Número de teléfono principal',
                placeholder: '+54 11 1234-5678',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 30 }
            },
            {
                id: 'contactInfo.email',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Email',
                description: 'Dirección de correo electrónico',
                placeholder: 'contacto@comercio.com',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 255 }
            },
            {
                id: 'contactInfo.website',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Sitio Web',
                description: 'URL del sitio web oficial',
                placeholder: 'https://www.comercio.com',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 255 }
            },
            {
                id: 'contactInfo.whatsapp',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'WhatsApp',
                description: 'Número de WhatsApp para contacto',
                placeholder: '+54 11 1234-5678',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 30 }
            },

            // ------------------------------------------------------------------
            // Social networks
            // ------------------------------------------------------------------
            {
                id: 'socialNetworks.facebook',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Facebook',
                description: 'URL de la página de Facebook',
                placeholder: 'https://facebook.com/tupagina',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 255 }
            },
            {
                id: 'socialNetworks.instagram',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Instagram',
                description: 'URL del perfil de Instagram',
                placeholder: 'https://instagram.com/tuperfil',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 255 }
            },
            {
                id: 'socialNetworks.twitter',
                type: FieldTypeEnum.TEXT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Twitter / X',
                description: 'URL del perfil de Twitter/X',
                placeholder: 'https://twitter.com/tuperfil',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: { maxLength: 255 }
            },

            // ------------------------------------------------------------------
            // Media
            // ------------------------------------------------------------------
            {
                id: 'media.featuredImage',
                type: FieldTypeEnum.IMAGE,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Imagen Principal',
                description: 'Imagen principal del comercio (recomendado 16:9)',
                placeholder: 'Seleccioná la imagen principal…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    type: 'IMAGE',
                    maxSize: 10_000_000,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    aspectRatio: '16:9',
                    quality: 0.85
                }
            },
            {
                id: 'media.gallery',
                type: FieldTypeEnum.GALLERY,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Galería de Imágenes',
                description: 'Colección de imágenes del comercio',
                placeholder: 'Arrastrá imágenes aquí o hacé clic para seleccionar…',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    type: 'GALLERY',
                    maxImages: 20,
                    maxSize: 10_000_000,
                    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maxWidth: 1920,
                    maxHeight: 1080,
                    sortable: true
                }
            },
            {
                id: 'media.videos',
                type: FieldTypeEnum.VIDEO_GALLERY,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Galería de Videos',
                description: 'Videos de YouTube o Vimeo para el comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    type: 'VIDEO_GALLERY',
                    maxVideos: 5
                }
            },

            // ------------------------------------------------------------------
            // Opening hours
            // `openingHours` is a structured object ({ timezone, days }) edited by
            // the listing owner on the web with a dedicated UI. The admin panel has
            // no structured opening-hours widget yet, so it is shown read-only as
            // formatted JSON (JSON field type) — never TEXTAREA, which fed the raw
            // object to a text renderer and crashed the admin view
            // ("Objects are not valid as a React child").
            // TODO(SPEC-239): replace with a dedicated OPENING_HOURS field type +
            // structured view/edit widget once FieldTypeEnum gains that entry.
            // ------------------------------------------------------------------
            {
                id: 'openingHours',
                type: FieldTypeEnum.JSON,
                required: false,
                modes: ['view'],
                label: 'Horarios de Apertura',
                description: 'Horarios de atención del comercio (gestionados por el dueño)',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL]
                }
            },

            // ------------------------------------------------------------------
            // Amenities & features (multi-select)
            // ------------------------------------------------------------------
            {
                id: 'amenities',
                type: FieldTypeEnum.AMENITY_SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Amenities',
                description: 'Servicios y comodidades del comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    multiple: true,
                    searchMode: 'client',
                    clearable: true
                }
            },
            {
                id: 'features',
                type: FieldTypeEnum.FEATURE_SELECT,
                required: false,
                modes: ['view', 'edit', 'create'],
                label: 'Características',
                description: 'Características destacadas del comercio',
                permissions: {
                    view: [PermissionEnum.COMMERCE_VIEW_ALL],
                    edit: [PermissionEnum.COMMERCE_EDIT_OWN, PermissionEnum.COMMERCE_EDIT_ALL]
                },
                typeConfig: {
                    multiple: true,
                    searchMode: 'client',
                    clearable: true
                }
            }
        ]
    };
}
