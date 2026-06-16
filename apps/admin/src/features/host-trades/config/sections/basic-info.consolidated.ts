import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';
import { HostTradeCategoryEnum, PermissionEnum } from '@repo/schemas';

/**
 * Consolidated field configuration for the basic-info section of a host-trade entry.
 *
 * Covers create / edit / view modes.
 * `destinationId` uses the built-in DESTINATION_SELECT field type which renders
 * the shared `DestinationSelect` component and fetches options from
 * `/api/v1/admin/destinations/options`.
 */
export const createBasicInfoConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'basic-info',
    title: 'Información Básica',
    description: 'Datos principales del oficio / proveedor de servicios',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
        edit: [PermissionEnum.HOST_TRADE_UPDATE]
    },
    fields: [
        {
            id: 'name',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Nombre',
            description: 'Nombre del proveedor o negocio',
            placeholder: 'Ingresá el nombre del oficio',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                maxLength: 255,
                minLength: 1
            }
        },
        {
            id: 'slug',
            type: FieldTypeEnum.TEXT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'URL Amigable',
            description:
                'Slug para identificar el oficio. Se genera automáticamente desde el nombre',
            placeholder: 'nombre-del-oficio',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                maxLength: 255,
                minLength: 1,
                pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
            }
        },
        {
            id: 'category',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Categoría',
            description: 'Tipo de servicio que ofrece el proveedor',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                options: Object.values(HostTradeCategoryEnum).map((value) => ({
                    value,
                    label: value
                }))
            }
        },
        {
            id: 'contact',
            type: FieldTypeEnum.TEXT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Contacto',
            description: 'Número de teléfono o enlace de WhatsApp del proveedor',
            placeholder: '+54 9 3442 123456',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                maxLength: 255,
                minLength: 1
            }
        },
        {
            id: 'benefit',
            type: FieldTypeEnum.TEXTAREA,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Beneficio',
            description:
                'Descripción del beneficio o condición especial para anfitriones de Hospeda',
            placeholder: 'Ej: 10 % de descuento presentando la app',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 500,
                minLength: 1
            }
        },
        {
            id: 'destinationId',
            type: FieldTypeEnum.DESTINATION_SELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Destino',
            description: 'Destino al que pertenece este proveedor de servicios',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'is24h',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Disponible 24h',
            description: 'Marcar si el proveedor está disponible las 24 horas',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'scheduleText',
            type: FieldTypeEnum.TEXTAREA,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Horario',
            description: 'Horario de atención cuando no está disponible 24h',
            placeholder: 'Lunes a Viernes 8:00–18:00',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                minRows: 2,
                maxLength: 255
            }
        },
        {
            id: 'isActive',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit'],
            label: 'Activo',
            description: 'Controla si el oficio es visible para los anfitriones',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {}
        }
    ]
});
