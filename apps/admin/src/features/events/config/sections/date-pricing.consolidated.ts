import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Date & Pricing section of event
 */
export const createDatePricingConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'date-pricing',
    title: 'Fecha y Precios',
    description: 'Configuración de fechas y precios del evento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit', 'create'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL],
        edit: [PermissionEnum.EVENT_UPDATE]
    },
    fields: [
        {
            id: 'date.start',
            type: FieldTypeEnum.DATE,
            required: true,
            modes: ['view', 'edit', 'create'],
            label: 'Fecha de Inicio',
            description: 'Fecha y hora de inicio del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                type: 'DATE',
                showTime: true,
                minDate: 'today'
            }
        },
        {
            id: 'date.end',
            type: FieldTypeEnum.DATE,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Fecha de Fin',
            description: 'Fecha y hora de fin del evento (opcional)',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                type: 'DATE',
                showTime: true
            }
        },
        {
            id: 'date.isAllDay',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Todo el Día',
            description: 'El evento dura todo el día',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'pricing.isFree',
            type: FieldTypeEnum.SWITCH,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Evento Gratuito',
            description: 'El evento es gratuito',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {}
        },
        {
            id: 'pricing.price',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Precio',
            description: 'Precio del evento (si no es gratuito)',
            placeholder: '0',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                type: 'NUMBER',
                min: 0,
                step: 100
            }
        },
        {
            id: 'pricing.currency',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit', 'create'],
            label: 'Moneda',
            description: 'Moneda del precio',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL],
                edit: [PermissionEnum.EVENT_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: 'ARS', label: 'Peso Argentino (ARS)' },
                    { value: 'USD', label: 'Dólar Estadounidense (USD)' }
                ]
            }
        }
    ]
});
