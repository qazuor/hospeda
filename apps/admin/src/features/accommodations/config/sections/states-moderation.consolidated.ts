import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import type { useTranslations } from '@repo/i18n';
import { LifecycleStatusEnum, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import type { ConsolidatedSectionConfig } from '../../types/consolidated-config.types';

/**
 * Configuración consolidada para la sección States & Moderation de accommodation
 *
 * @param _t - Función de traducción (no usada por ahora)
 * @returns Configuración consolidada de la sección states-moderation
 */
export const createStatesModerationConsolidatedSection = (
    _t: ReturnType<typeof useTranslations>['t']
): ConsolidatedSectionConfig => {
    // Opciones para el estado del ciclo de vida
    const lifecycleStatusOptions: SelectOption[] = [
        { value: LifecycleStatusEnum.DRAFT, label: 'Borrador' },
        { value: LifecycleStatusEnum.ACTIVE, label: 'Activo' },
        { value: LifecycleStatusEnum.ARCHIVED, label: 'Archivado' }
    ];

    // Opciones para el estado de moderación
    const moderationStatusOptions: SelectOption[] = [
        { value: ModerationStatusEnum.PENDING, label: 'Pendiente' },
        { value: ModerationStatusEnum.APPROVED, label: 'Aprobado' },
        { value: ModerationStatusEnum.REJECTED, label: 'Rechazado' }
    ];

    return {
        id: 'states-moderation',
        title: 'Estados y Moderación',
        description: 'Gestión de estados y proceso de moderación del alojamiento',
        layout: LayoutTypeEnum.GRID,
        modes: ['view', 'edit'], // No visible en create (se setean valores por defecto)
        permissions: {
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_PUBLISH] // Solo usuarios con permisos de publicación
        },
        fields: [
            {
                id: 'lifecycleStatus',
                type: FieldTypeEnum.SELECT,
                required: true,
                modes: ['view', 'edit'],
                label: 'Estado del Ciclo de Vida',
                description: 'Estado actual en el ciclo de vida del alojamiento',
                placeholder: 'Seleccionar estado...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_PUBLISH]
                },
                typeConfig: {
                    options: lifecycleStatusOptions
                }
            },
            {
                id: 'moderationStatus',
                type: FieldTypeEnum.SELECT,
                required: true,
                modes: ['view', 'edit'],
                label: 'Estado de Moderación',
                description: 'Estado del proceso de moderación',
                placeholder: 'Seleccionar estado...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
                },
                typeConfig: {
                    options: moderationStatusOptions
                }
            },
            {
                id: 'isPublished',
                type: FieldTypeEnum.SWITCH,
                required: false,
                modes: ['view', 'edit'],
                label: 'Publicado',
                description: 'Indica si el alojamiento está visible públicamente',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_PUBLISH]
                },
                typeConfig: {}
            },
            {
                id: 'publishedAt',
                type: FieldTypeEnum.TEXT, // TODO: Cambiar a DATE cuando esté disponible
                required: false,
                modes: ['view'], // Solo lectura
                label: 'Fecha de Publicación',
                description: 'Fecha y hora en que fue publicado',
                placeholder: '2024-01-15 10:30:00',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [] // No editable
                },
                typeConfig: {}
            },
            {
                id: 'moderationNotes',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit'],
                label: 'Notas de Moderación',
                description: 'Comentarios del proceso de moderación',
                placeholder: 'Agregar comentarios sobre el proceso de moderación...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
                },
                typeConfig: {
                    minRows: 3,
                    maxLength: 1000
                }
            },
            {
                id: 'rejectionReason',
                type: FieldTypeEnum.TEXTAREA,
                required: false,
                modes: ['view', 'edit'],
                label: 'Motivo de Rechazo',
                description: 'Razón específica del rechazo (si aplica)',
                placeholder: 'Especificar el motivo del rechazo...',
                permissions: {
                    view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                    edit: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
                },
                typeConfig: {
                    minRows: 2,
                    maxLength: 500
                }
            }
        ]
    };
};
