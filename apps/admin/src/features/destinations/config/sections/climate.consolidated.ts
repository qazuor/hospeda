import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Month options for the recommended-months range selects.
 *
 * Values are the locale-independent `ClimateMonthEnum` keys; labels are the
 * Spanish admin display names (admin section labels are ES, per this file's
 * existing convention). The web frontend localizes month names from these keys.
 */
const MONTH_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'jan', label: 'Enero' },
    { value: 'feb', label: 'Febrero' },
    { value: 'mar', label: 'Marzo' },
    { value: 'apr', label: 'Abril' },
    { value: 'may', label: 'Mayo' },
    { value: 'jun', label: 'Junio' },
    { value: 'jul', label: 'Julio' },
    { value: 'aug', label: 'Agosto' },
    { value: 'sep', label: 'Septiembre' },
    { value: 'oct', label: 'Octubre' },
    { value: 'nov', label: 'Noviembre' },
    { value: 'dec', label: 'Diciembre' }
];

/**
 * Consolidated configuration for the Climate section of destination.
 *
 * Allows admins to set the seasonal climate data that the web frontend renders.
 * Persists to the `climate` JSONB column on the `destinations` table via the
 * standard destination update flow.
 *
 * Field mapping mirrors `DestinationClimateSchema` from `@repo/schemas`:
 *   - bestSeason   → SELECT (ClimateSeasonEnum values)
 *   - bestMonths   → SELECT pair from/to (ClimateMonthEnum values, optional)
 *   - seasons.*    → NUMBER groups per season (avgTempMinC, avgTempMaxC, rainfallMm)
 *   - note         → I18N_TEXT (optional localized note, es/en/pt)
 */
export const createClimateConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'climate',
    title: 'Clima',
    description: 'Información climática estacional del destino',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.DESTINATION_VIEW_ALL],
        edit: [PermissionEnum.DESTINATION_UPDATE]
    },
    fields: [
        // ---- General ----
        {
            id: 'climate.bestSeason',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Mejor estación para visitar',
            description: 'Estación del año más recomendada para visitar el destino',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                options: [
                    { value: 'spring', label: 'Primavera' },
                    { value: 'summer', label: 'Verano' },
                    { value: 'autumn', label: 'Otoño' },
                    { value: 'winter', label: 'Invierno' }
                ]
            }
        },
        {
            id: 'climate.bestMonths.from',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Mejores meses: desde',
            description: 'Mes inicial del rango recomendado para visitar',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                options: [...MONTH_OPTIONS]
            }
        },
        {
            id: 'climate.bestMonths.to',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Mejores meses: hasta',
            description: 'Mes final del rango recomendado para visitar',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                options: [...MONTH_OPTIONS]
            }
        },

        // ---- Primavera (spring) ----
        {
            id: 'climate.seasons.spring.avgTempMinC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Primavera: Temp. mínima (°C)',
            description: 'Temperatura mínima promedio en primavera (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.spring.avgTempMaxC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Primavera: Temp. máxima (°C)',
            description: 'Temperatura máxima promedio en primavera (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.spring.rainfallMm',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Primavera: Lluvia promedio (mm)',
            description: 'Precipitación media mensual en primavera (mm, entero, opcional)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: 0,
                max: 20000,
                step: 1
            }
        },

        // ---- Verano (summer) ----
        {
            id: 'climate.seasons.summer.avgTempMinC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Verano: Temp. mínima (°C)',
            description: 'Temperatura mínima promedio en verano (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.summer.avgTempMaxC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Verano: Temp. máxima (°C)',
            description: 'Temperatura máxima promedio en verano (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.summer.rainfallMm',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Verano: Lluvia promedio (mm)',
            description: 'Precipitación media mensual en verano (mm, entero, opcional)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: 0,
                max: 20000,
                step: 1
            }
        },

        // ---- Otoño (autumn) ----
        {
            id: 'climate.seasons.autumn.avgTempMinC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Otoño: Temp. mínima (°C)',
            description: 'Temperatura mínima promedio en otoño (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.autumn.avgTempMaxC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Otoño: Temp. máxima (°C)',
            description: 'Temperatura máxima promedio en otoño (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.autumn.rainfallMm',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Otoño: Lluvia promedio (mm)',
            description: 'Precipitación media mensual en otoño (mm, entero, opcional)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: 0,
                max: 20000,
                step: 1
            }
        },

        // ---- Invierno (winter) ----
        {
            id: 'climate.seasons.winter.avgTempMinC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Invierno: Temp. mínima (°C)',
            description: 'Temperatura mínima promedio en invierno (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.winter.avgTempMaxC',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Invierno: Temp. máxima (°C)',
            description: 'Temperatura máxima promedio en invierno (°C, entero)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: -60,
                max: 60,
                step: 1
            }
        },
        {
            id: 'climate.seasons.winter.rainfallMm',
            type: FieldTypeEnum.NUMBER,
            required: false,
            modes: ['view', 'edit'],
            label: 'Invierno: Lluvia promedio (mm)',
            description: 'Precipitación media mensual en invierno (mm, entero, opcional)',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                min: 0,
                max: 20000,
                step: 1
            }
        },

        // ---- Nota localizada ----
        {
            id: 'climate.note',
            type: FieldTypeEnum.I18N_TEXT,
            required: false,
            modes: ['view', 'edit'],
            label: 'Nota climática',
            description:
                'Nota libre sobre el clima del destino (se muestra en la web en el idioma del usuario)',
            placeholder: 'Ej: El verano es húmedo y caluroso, ideal para visitar la costa...',
            permissions: {
                view: [PermissionEnum.DESTINATION_VIEW_ALL],
                edit: [PermissionEnum.DESTINATION_UPDATE]
            },
            typeConfig: {
                maxLength: 500
            }
        }
    ]
});
