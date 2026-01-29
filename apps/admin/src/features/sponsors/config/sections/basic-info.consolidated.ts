import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { ClientTypeEnum, PermissionEnum } from '@repo/schemas';

/**
 * Basic Info section configuration for Sponsor entity
 * Contains: name, type, description, logo
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos principales del patrocinador',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.POST_SPONSOR_VIEW],
        edit: [PermissionEnum.POST_SPONSOR_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del patrocinador o empresa',
            placeholder: 'Ej: Turismo Argentina S.A.',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 3
            }
        },
        {
            id: 'type',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Tipo',
            description: 'Tipo de cliente/patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: ClientTypeEnum.POST_SPONSOR, label: 'Patrocinador de Posts' },
                    { value: ClientTypeEnum.ADVERTISER, label: 'Anunciante' },
                    { value: ClientTypeEnum.HOST, label: 'Anfitrión' }
                ]
            }
        },
        {
            id: 'description',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Descripción',
            description: 'Descripción del patrocinador',
            placeholder: 'Describe la actividad y objetivos del patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {
                minRows: 3,
                maxLength: 500,
                minLength: 10
            }
        },
        {
            id: 'logo',
            type: FieldTypeEnum.IMAGE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Logo',
            description: 'Logo o imagen del patrocinador',
            permissions: {
                view: [PermissionEnum.POST_SPONSOR_VIEW],
                edit: [PermissionEnum.POST_SPONSOR_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
