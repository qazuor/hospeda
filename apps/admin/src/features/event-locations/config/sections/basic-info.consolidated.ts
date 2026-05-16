import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Basic Info section of event location
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Detalles principales de la ubicación',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_LOCATION_VIEW],
        edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
    },
    fields: [
        {
            id: 'placeName',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre del Lugar',
            description: 'Nombre identificador de la ubicación',
            placeholder: 'Ej: Centro Cultural, Estadio Municipal',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description: 'URL amigable para la ubicación',
            placeholder: 'centro-cultural-municipal',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        // Required by the EventLocation create schema. Without this field
        // POST /admin/event-locations rejected with VALIDATION_ERROR on
        // destinationId (SPEC-117 D-4.1).
        {
            id: 'destinationId',
            type: FieldTypeEnum.DESTINATION_SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Destino',
            description: 'Destino turístico donde se ubica este lugar',
            placeholder: 'Selecciona un destino',
            permissions: {
                view: [PermissionEnum.EVENT_LOCATION_VIEW],
                edit: [PermissionEnum.EVENT_LOCATION_UPDATE]
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
