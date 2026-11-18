import { HOST_TRADE_MAX_CATEGORIES, PermissionEnum } from '@repo/schemas';
import {
    EntityTypeEnum,
    FieldTypeEnum,
    LayoutTypeEnum
} from '@/components/entity-form/enums/form-config.enums';
import {
    loadAllHostTradeCategories,
    loadHostTradeCategoriesByIds
} from '@/components/entity-form/fields/entity-selects/utils';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';

/** A provider needs at least one category. */
const HOST_TRADE_MIN_CATEGORIES = 1;

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
            id: 'categoryIds',
            type: FieldTypeEnum.ENTITY_MULTISELECT,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Categorías',
            description: 'Rubros que ofrece el proveedor (de 1 a 10)',
            placeholder: 'Elegí una o más categorías',
            permissions: {
                view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
                edit: [PermissionEnum.HOST_TRADE_UPDATE]
            },
            typeConfig: {
                // Options come from the ADMIN catalog (HOS-919): active rows are
                // offered, and a category the provider already has stays
                // resolvable even when inactive.
                entityType: EntityTypeEnum.HOST_TRADE_CATEGORY,
                searchFn: async () => [],
                loadByIdsFn: loadHostTradeCategoriesByIds,
                loadAllFn: loadAllHostTradeCategories,
                multiple: true,
                searchable: true,
                clearable: true,
                searchMode: 'client',
                showAllWhenEmpty: true,
                minItems: HOST_TRADE_MIN_CATEGORIES,
                maxItems: HOST_TRADE_MAX_CATEGORIES
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
