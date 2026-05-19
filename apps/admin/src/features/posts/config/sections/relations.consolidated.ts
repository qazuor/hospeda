import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Relations section of post
 */
export const createRelationsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'relations',
    title: 'Relaciones',
    description: 'Entidades relacionadas con el artículo',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: [PermissionEnum.POST_UPDATE]
    },
    fields: [
        {
            id: 'authorId',
            type: FieldTypeEnum.USER_SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Autor',
            description: 'Autor del artículo',
            placeholder: 'Selecciona un autor',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                showAvatar: true,
                clearable: true
            }
        },
        {
            id: 'relatedDestinationId',
            type: FieldTypeEnum.DESTINATION_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Destino Relacionado',
            description: 'Destino turístico relacionado',
            placeholder: 'Selecciona un destino',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                searchMode: 'client',
                minCharToSearch: 1,
                showAvatar: false,
                clearable: true
            }
        },
        {
            id: 'relatedAccommodationId',
            type: FieldTypeEnum.ACCOMMODATION_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Alojamiento Relacionado',
            description: 'Alojamiento relacionado',
            placeholder: 'Selecciona un alojamiento',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                clearable: true
            }
        },
        {
            id: 'relatedEventId',
            type: FieldTypeEnum.EVENT_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Evento Relacionado',
            description: 'Evento relacionado',
            placeholder: 'Selecciona un evento',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                clearable: true
            }
        },
        {
            id: 'sponsorshipId',
            type: FieldTypeEnum.POST_SPONSORSHIP_SELECT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Patrocinio',
            description: 'Contrato de patrocinio asociado',
            placeholder: 'Selecciona un patrocinio',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_SPONSORSHIP_MANAGE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                clearable: true
            }
        }
    ]
});
