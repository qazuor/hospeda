import {
    FieldTypeEnum,
    LayoutTypeEnum,
    RichTextFeatureEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { EntitlementKey } from '@repo/billing';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Basic Info de accommodation
 *
 * @param t - Función de traducción
 * @param accommodationTypeOptions - Opciones para el select de tipo de accommodation
 * @returns Configuración consolidada de la sección basic-info
 */
export const createBasicInfoConsolidatedSection = (
    t: ReturnType<typeof useTranslations>['t'],
    accommodationTypeOptions: SelectOption[]
): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: t('fields.accommodation.sections.basicInfo.title'),
    description: t('fields.accommodation.sections.basicInfo.description'),
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'], // Visible en todos los modos
    permissions: {
        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'], // Visible en todos los modos
            label: t('fields.accommodation.name.label'),
            description: t('fields.accommodation.name.description'),
            placeholder: t('fields.accommodation.name.placeholder'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            typeConfig: {}
        },
        // Required by AccommodationSchema (10-300 chars). Add Spanish strings
        // inline until fields.accommodation.summary.* keys ship (SPEC-117 D-ACCOM.1).
        {
            id: 'summary',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Resumen',
            description: 'Descripción breve del alojamiento (10-300 caracteres)',
            placeholder: 'Una frase atractiva para tarjetas y resultados de búsqueda...',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 300
            }
        },
        {
            id: 'description',
            // SPEC-187 FR-2: plain text (TEXTAREA). The previous RICH_TEXT
            // assignment is reverted because accommodation.description is
            // semantically a short summary, not formatted content. The
            // premium rich variant lives on `richDescription` (Phase 2 flips
            // that entry to RICH_TEXT and renders via `renderRich`).
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: t('fields.accommodation.description.label'),
            description: t('fields.accommodation.description.description'),
            placeholder: t('fields.accommodation.description.placeholder'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            typeConfig: {
                maxLength: 2000
            }
        },
        // T-G-007: Rich description field (premium feature, gated).
        // SPEC-187 FR-5: declare the toolbar matrix here while the field is
        // still TEXTAREA. Phase 2 flips the type to RICH_TEXT and the
        // description web render uses presence-based rule (P2-T9).
        {
            id: 'richDescription',
            type: FieldTypeEnum.TEXTAREA, // Phase 2 flips to RICH_TEXT
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción Enriquecida (Premium)',
            description: 'Descripción con formato avanzado, imágenes y estilos personalizados',
            placeholder: 'Agrega una descripción rica con formato HTML...',
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            entitlementKey: EntitlementKey.CAN_USE_RICH_DESCRIPTION, // T-G-007: Gate rich description
            typeConfig: {
                minRows: 6,
                maxLength: 5000,
                // SPEC-187 FR-5 matrix: full toolbar set MINUS LINK.
                // Accommodations intentionally cannot link out from the
                // rich description (editorial policy, see ADR-032).
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
        {
            id: 'type',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: t('fields.accommodation.type.label'),
            description: t('fields.accommodation.type.description'),
            placeholder: t('fields.accommodation.type.placeholder'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            typeConfig: {
                options: accommodationTypeOptions
            }
        },
        {
            id: 'isFeatured',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'], // No visible en create (se setea por defecto)
            label: t('fields.accommodation.isFeatured.label'),
            description: t('fields.accommodation.isFeatured.description'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE]
            },
            entitlementKey: EntitlementKey.FEATURED_LISTING, // T-G-009: Gate featured listing toggle
            typeConfig: {}
        },
        {
            id: 'destinationId',
            type: FieldTypeEnum.DESTINATION_SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: t('fields.accommodation.destinationId.label'),
            description: t('fields.accommodation.destinationId.description'),
            placeholder: t('fields.accommodation.destinationId.placeholder'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
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
            required: true,
            modes: ['view', 'edit', 'create'],
            label: t('fields.accommodation.ownerId.label'),
            description: t('fields.accommodation.ownerId.description'),
            placeholder: t('fields.accommodation.ownerId.placeholder'),
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] // Solo admin puede cambiar owner
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                showAvatar: true,
                clearable: true,
                // Re-enabled after PR #1313 shipped the backend `?roles=` filter.
                // SPEC-154 walkthrough commit 73e0dd945 dropped it as a temp-fix
                // because the API rejected `?roles=HOST` with "Invalid pagination
                // parameters"; that gap is now fixed and the picker filters to
                // HOST users (the only role that can own an accommodation).
                roleFilter: [RoleEnum.HOST]
            }
        }
    ]
});
