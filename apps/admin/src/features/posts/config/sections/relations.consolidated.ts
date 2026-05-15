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
        // TODO(SPEC-117 D-RELATIONS.1 follow-up): build AccommodationSelectField + switch
        // FieldTypeEnum.ACCOMMODATION_SELECT here. Current FieldTypeEnum.SELECT with empty
        // options renders an empty listbox — optional field, non-blocking, but unusable.
        {
            id: 'relatedAccommodationId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Alojamiento Relacionado',
            description: 'Alojamiento relacionado',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                options: [],
                placeholder: 'Selecciona un alojamiento'
            }
        },
        // TODO(SPEC-117 D-RELATIONS.1 follow-up): build EventSelectField + switch
        // FieldTypeEnum.EVENT_SELECT here.
        {
            id: 'relatedEventId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Evento Relacionado',
            description: 'Evento relacionado',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                options: [],
                placeholder: 'Selecciona un evento'
            }
        },
        // TODO(SPEC-117 D-RELATIONS.1 follow-up): build SponsorshipSelectField.
        {
            id: 'sponsorshipId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Patrocinio',
            description: 'Contrato de patrocinio asociado',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_SPONSORSHIP_MANAGE]
            },
            typeConfig: {
                options: [],
                placeholder: 'Selecciona un patrocinio'
            }
        }
    ]
});
