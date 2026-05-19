import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Relations section of event
 */
export const createRelationsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'relations',
    title: 'Ubicación y Organizador',
    description: 'Relaciones con ubicación y organizador del evento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'locationId',
            type: FieldTypeEnum.EVENT_LOCATION_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Ubicación',
            description: 'Lugar donde se realiza el evento',
            placeholder: 'Selecciona una ubicación',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                clearable: true
            }
        },
        {
            id: 'organizerId',
            type: FieldTypeEnum.EVENT_ORGANIZER_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Organizador',
            description: 'Organizador responsable del evento',
            placeholder: 'Selecciona un organizador',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_ORGANIZER_MANAGE]
            },
            typeConfig: {
                searchMode: 'server',
                minCharToSearch: 2,
                searchDebounce: 300,
                clearable: true
            }
        },
        {
            id: 'destinationId',
            type: FieldTypeEnum.DESTINATION_SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Destino',
            description: 'Destino turístico asociado al evento',
            placeholder: 'Selecciona un destino',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                searchMode: 'client',
                minCharToSearch: 1,
                showAvatar: false,
                clearable: true
            }
        }
    ]
});
