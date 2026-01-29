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
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Autor',
            description: 'Autor del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un autor'
            }
        },
        {
            id: 'relatedDestinationId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Destino Relacionado',
            description: 'Destino turístico relacionado',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un destino'
            }
        },
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
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un alojamiento'
            }
        },
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
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un evento'
            }
        },
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
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un patrocinio'
            }
        }
    ]
});
