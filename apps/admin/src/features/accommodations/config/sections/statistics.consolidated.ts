import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { useTranslations } from '@repo/i18n';
import { PermissionEnum } from '@repo/types';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección Statistics de accommodation
 *
 * @param _t - Función de traducción (no usada por ahora)
 * @returns Configuración consolidada de la sección statistics
 */
export const createStatisticsConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    return {
        id: 'statistics',
        title: 'Estadísticas y Métricas',
        description: 'Métricas de rendimiento y estadísticas del alojamiento',
        layout: LayoutTypeEnum.GRID,
        modes: ['view'], // Solo visible en modo view (solo lectura, no editable)
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [] // No editable
        },
        fields: [
            // Métricas de visualización
            {
                id: 'totalViews',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Total de Visualizaciones',
                description: 'Número total de veces que se ha visto el alojamiento',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            {
                id: 'monthlyViews',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Visualizaciones del Mes',
                description: 'Visualizaciones en el mes actual',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            // Métricas de reservas
            {
                id: 'totalBookings',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Total de Reservas',
                description: 'Número total de reservas realizadas',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            {
                id: 'completedBookings',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Reservas Completadas',
                description: 'Número de reservas completadas exitosamente',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            {
                id: 'cancelledBookings',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Reservas Canceladas',
                description: 'Número de reservas canceladas',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            // Métricas de rating y reviews
            {
                id: 'averageRating',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Calificación Promedio',
                description: 'Calificación promedio basada en reviews',
                placeholder: '0.0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    max: 5,
                    step: 0.1
                }
            },
            {
                id: 'totalReviews',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Total de Reviews',
                description: 'Número total de reviews recibidas',
                placeholder: '0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 1
                }
            },
            // Métricas financieras
            {
                id: 'totalRevenue',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Ingresos Totales',
                description: 'Ingresos totales generados (en moneda local)',
                placeholder: '0.00',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 0.01
                }
            },
            {
                id: 'monthlyRevenue',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Ingresos del Mes',
                description: 'Ingresos del mes actual',
                placeholder: '0.00',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    step: 0.01
                }
            },
            // Métricas de ocupación
            {
                id: 'occupancyRate',
                type: FieldTypeEnum.NUMBER,
                required: false,
                modes: ['view'],
                label: 'Tasa de Ocupación (%)',
                description: 'Porcentaje de ocupación promedio',
                placeholder: '0.0',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {
                    min: 0,
                    max: 100,
                    step: 0.1
                }
            },
            // Fechas importantes
            {
                id: 'lastBookingDate',
                type: FieldTypeEnum.TEXT, // TODO: Cambiar a DATE cuando esté disponible
                required: false,
                modes: ['view'],
                label: 'Última Reserva',
                description: 'Fecha de la última reserva realizada',
                placeholder: '2024-01-15',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {}
            },
            {
                id: 'lastReviewDate',
                type: FieldTypeEnum.TEXT, // TODO: Cambiar a DATE cuando esté disponible
                required: false,
                modes: ['view'],
                label: 'Última Review',
                description: 'Fecha de la última review recibida',
                placeholder: '2024-01-10',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: []
                },
                typeConfig: {}
            }
        ]
    };
};
