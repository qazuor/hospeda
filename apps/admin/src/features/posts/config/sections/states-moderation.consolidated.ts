import { PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Publication dates for a post.
 *
 * This section used to also carry visibility / lifecycleState / moderationState.
 * HOS-374 §7.6.4 moved those onto dedicated endpoints, so they can no longer be
 * form fields — `EntityPageBase` builds one PATCH body out of the editable
 * sections, and the API no longer accepts them there. They are displayed on the
 * view page by `createContentStatesViewSection` and edited by
 * `ContentStatePanel`.
 */
export const createStatesModerationConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'states-moderation',
    title: 'Publicación',
    description: 'Fechas de publicación y expiración',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.POST_VIEW_ALL],
        edit: [PermissionEnum.POST_UPDATE]
    },
    fields: [
        {
            id: 'publishedAt',
            type: FieldTypeEnum.DATE,
            required: false,
            modes: ['view', 'edit'],
            label: 'Fecha de Publicación',
            description: 'Fecha de publicación del artículo',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_PUBLISH_TOGGLE]
            },
            typeConfig: {
                type: 'DATE',
                showTime: true
            }
        },
        {
            id: 'expiresAt',
            type: FieldTypeEnum.DATE,
            required: false,
            modes: ['view', 'edit'],
            label: 'Fecha de Expiración',
            description: 'Fecha en que el artículo expira (opcional)',
            permissions: {
                view: [PermissionEnum.POST_VIEW_ALL],
                edit: [PermissionEnum.POST_UPDATE]
            },
            typeConfig: {
                type: 'DATE',
                showTime: true
            }
        }
    ]
});
