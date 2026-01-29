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
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Ubicación',
            description: 'Lugar donde se realiza el evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona una ubicación'
            }
        },
        {
            id: 'organizerId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Organizador',
            description: 'Organizador responsable del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_ORGANIZER_MANAGE]
            },
            typeConfig: {
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un organizador'
            }
        },
        {
            id: 'destinationId',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Destino',
            description: 'Destino turístico asociado al evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                // Options will be loaded dynamically
                options: [],
                placeholder: 'Selecciona un destino'
            }
        }
    ]
});
