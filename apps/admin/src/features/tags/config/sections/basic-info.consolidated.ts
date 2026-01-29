import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum, TagColorEnum } from '@repo/schemas';

/**
 * Basic Info section configuration for Tag entity
 * Contains: name, slug, color, icon, notes
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos principales de la etiqueta',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.TAG_CREATE],
        edit: [PermissionEnum.TAG_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre de la etiqueta',
            placeholder: 'Ej: Playa, Montaña, Familiar',
            permissions: {
                view: [PermissionEnum.TAG_CREATE],
                edit: [PermissionEnum.TAG_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 2
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Slug',
            description: 'Identificador único para URLs',
            placeholder: 'playa',
            permissions: {
                view: [PermissionEnum.TAG_CREATE],
                edit: [PermissionEnum.TAG_UPDATE]
            },
            typeConfig: {
                maxLength: 50,
                minLength: 1
            }
        },
        {
            id: 'color',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Color',
            description: 'Color visual de la etiqueta',
            permissions: {
                view: [PermissionEnum.TAG_CREATE],
                edit: [PermissionEnum.TAG_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: TagColorEnum.RED, label: 'Rojo' },
                    { value: TagColorEnum.BLUE, label: 'Azul' },
                    { value: TagColorEnum.GREEN, label: 'Verde' },
                    { value: TagColorEnum.YELLOW, label: 'Amarillo' },
                    { value: TagColorEnum.ORANGE, label: 'Naranja' },
                    { value: TagColorEnum.PURPLE, label: 'Púrpura' },
                    { value: TagColorEnum.PINK, label: 'Rosa' },
                    { value: TagColorEnum.CYAN, label: 'Cian' },
                    { value: TagColorEnum.GREY, label: 'Gris' },
                    { value: TagColorEnum.LIGHT_BLUE, label: 'Azul Claro' },
                    { value: TagColorEnum.LIGHT_GREEN, label: 'Verde Claro' }
                ]
            }
        },
        {
            id: 'icon',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Icono',
            description: 'Nombre del icono (opcional)',
            placeholder: 'beach',
            permissions: {
                view: [PermissionEnum.TAG_CREATE],
                edit: [PermissionEnum.TAG_UPDATE]
            },
            typeConfig: {
                maxLength: 100,
                minLength: 2
            }
        },
        {
            id: 'notes',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Notas',
            description: 'Notas internas sobre la etiqueta',
            placeholder: 'Notas adicionales para uso interno',
            permissions: {
                view: [PermissionEnum.TAG_CREATE],
                edit: [PermissionEnum.TAG_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 300,
                minLength: 5
            }
        }
    ]
});
