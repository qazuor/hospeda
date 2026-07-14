import { PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the Curation section of point of interest.
 *
 * HOS-138 editorial-curation fields, new for the v2 model (no attractions
 * equivalent): `verified` is operator-toggleable, `verifiedAt` is a
 * read-only timestamp set server-side, `source`/`notes` are free-text
 * provenance/curator fields.
 */
export const createCurationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'curation',
    title: 'Curación',
    description: 'Verificación editorial y procedencia del dato',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
        edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
    },
    fields: [
        {
            id: 'verified',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Verificado',
            description: 'Marcar cuando un curador confirmó la exactitud de este punto de interés',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'verifiedAt',
            type: FieldTypeEnum.DATE,
            required: false,
            readonly: true,
            modes: ['view'],
            label: 'Verificado el',
            description: 'Fecha de la última verificación (se establece automáticamente)',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: []
            },
            typeConfig: {
                type: 'DATE',
                showTime: true
            }
        },
        {
            id: 'source',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Fuente',
            description: 'Procedencia del dato, ej: "chatgpt-dataset-2026-07"',
            placeholder: 'chatgpt-dataset-2026-07',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                maxLength: 200
            }
        },
        {
            id: 'notes',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit'],
            label: 'Notas',
            description: 'Notas internas del curador',
            placeholder: 'Notas de curación',
            permissions: {
                view: [PermissionEnum.POINT_OF_INTEREST_VIEW],
                edit: [PermissionEnum.POINT_OF_INTEREST_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 1000
            }
        }
    ]
});
