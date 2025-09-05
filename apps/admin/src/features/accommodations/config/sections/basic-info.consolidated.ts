import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/types';
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
        {
            id: 'description',
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
                minRows: 4,
                maxLength: 2000
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
                clearable: true
            }
        }
    ]
});
