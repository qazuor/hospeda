import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PermissionEnum,
    VisibilityEnum
} from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

// Spanish enum labels (SPEC-117 D-DROPDOWN.1 / D-POSTS.4).
const VISIBILITY_LABELS: Record<string, string> = {
    PUBLIC: 'Público',
    PRIVATE: 'Privado',
    RESTRICTED: 'Restringido',
    HIDDEN: 'Oculto'
};
const LIFECYCLE_LABELS: Record<string, string> = {
    DRAFT: 'Borrador',
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ARCHIVED: 'Archivado',
    DELETED: 'Eliminado'
};
const MODERATION_LABELS: Record<string, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    REJECTED: 'Rechazado',
    UNDER_REVIEW: 'En revisión'
};

/**
 * Read-only display of the three content states on the evento VIEW page.
 *
 * `modes: ['view']` is load-bearing, not cosmetic: `filterSectionsByMode` keeps
 * this section out of `editSections`, and `EntityPageBase` builds its PATCH body
 * by iterating exactly those. HOS-374 §7.6.4 removed these three fields from the
 * generic update payload — each now has its own endpoint and its own permission —
 * so a section that reached the edit form would put them straight back into a
 * payload the API no longer accepts.
 *
 * Editing them lives in `ContentStatePanel` on the edit page, which writes each
 * one immediately through its dedicated endpoint.
 */
export const createContentStatesViewSection = (): ConsolidatedSectionConfig => ({
    id: 'content-states',
    title: 'Estados y Moderación',
    description: 'Visibilidad, ciclo de vida y moderación del evento',
    layout: LayoutTypeEnum.GRID,
    modes: ['view'],
    permissions: {
        view: [PermissionEnum.EVENT_VIEW_ALL]
    },
    fields: [
        {
            id: 'visibility',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view'],
            label: 'Visibilidad',
            description: 'Nivel de visibilidad del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL]
            },
            typeConfig: {
                options: Object.values(VisibilityEnum).map((value) => ({
                    value,
                    label: VISIBILITY_LABELS[value] ?? value
                }))
            }
        },
        {
            id: 'lifecycleState',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view'],
            label: 'Estado del Ciclo de Vida',
            description: 'Estado actual del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL]
            },
            typeConfig: {
                options: Object.values(LifecycleStatusEnum).map((value) => ({
                    value,
                    label: LIFECYCLE_LABELS[value] ?? value
                }))
            }
        },
        {
            id: 'moderationState',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view'],
            label: 'Estado de Moderación',
            description: 'Estado de moderación del evento',
            permissions: {
                view: [PermissionEnum.EVENT_VIEW_ALL]
            },
            typeConfig: {
                options: Object.values(ModerationStatusEnum).map((value) => ({
                    value,
                    label: MODERATION_LABELS[value] ?? value
                }))
            }
        }
    ]
});
