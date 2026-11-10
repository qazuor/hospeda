/**
 * @file useVenuePage.ts
 * Page-orchestrator hook for the venue view and edit pages.
 *
 * Centralises data loading, mode switching, and navigation so route components
 * stay thin.  Mirrors the `useHostTradePage` pattern adapted for the full
 * listing entity scope (LISTING_* permissions).
 */

import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { createVenueConsolidatedConfig } from '../config/venue-consolidated.config';
import { useChangeVenueBusinessLinesMutation } from './useChangeVenueBusinessLinesMutation';
import { useUpdateVenueMutation, useVenueQuery } from './useVenueQuery';

/**
 * Centralised hook for the venue view/edit pages.
 *
 * Provides:
 *   - `entity` / `isLoading` / `error` from the detail query
 *   - `mode` toggle (view ↔ edit)
 *   - `sections` filtered for the current mode
 *   - `userPermissions` / `canView` / `canEdit`
 *   - `updateMutation` for the edit form
 *   - Navigation helpers (`goToList`, `goToView`, `goToEdit`)
 *
 * @param entityId - UUID of the venue listing being displayed
 * @returns Page state and helpers for view/edit routes
 */
export const useVenuePage = (entityId: string) => {
    const navigate = useNavigate();
    const { t } = useTranslations();

    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    const query = useVenueQuery(entityId);
    const updateMutationResult = useUpdateVenueMutation();
    const changeBusinessLinesMutation = useChangeVenueBusinessLinesMutation();
    const { user } = useAuthContext();

    const entityConfig = useMemo(() => {
        const consolidatedConfig = createVenueConsolidatedConfig(t);
        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');
        return { viewSections, editSections, metadata: consolidatedConfig.metadata };
    }, [t]);

    const permissions = useMemo(
        () => ({
            // HOS-1077 dual-read: these arrays are evaluated with `.some(...)`,
            // so naming both families IS the dual-read — no new mechanism.
            // Release 2 drops the LISTING_* entries.
            view: [PermissionEnum.VENUE_VIEW_ALL],
            edit: [PermissionEnum.VENUE_EDIT_ALL],
            create: [PermissionEnum.VENUE_CREATE],
            delete: [PermissionEnum.VENUE_DELETE]
        }),
        []
    );

    const userPermissions = useUserPermissions();

    const canView = useMemo(
        () => permissions.view.some((p) => userPermissions.includes(p)),
        [permissions, userPermissions]
    );

    const canEdit = useMemo(
        () => permissions.edit.some((p) => userPermissions.includes(p)),
        [permissions, userPermissions]
    );

    const switchToView = () => setMode('view');
    const switchToEdit = () => setMode('edit');

    const goToList = () => navigate({ to: '/venues' });
    const goToView = () => navigate({ to: '/venues/$id', params: { id: entityId } });
    const goToEdit = () =>
        navigate({ to: '/venues/$id/edit' as never, params: { id: entityId } as never });

    const getSections = (): SectionConfig[] =>
        mode === 'view' ? entityConfig.viewSections : entityConfig.editSections;

    return {
        mode,
        setMode,
        switchToView,
        switchToEdit,
        activeSection,
        setActiveSection,

        entity: query.data,
        isLoading: query.isLoading,
        error: query.error,

        entityConfig,
        sections: getSections(),

        userPermissions,
        canView,
        canEdit,

        updateMutation: {
            // EntityPageBase.handleSave calls mutateAsync with the FLAT form
            // payload (the field values), but the listing factory's useUpdate()
            // mutationFn expects `{ id, data }`. Bind the entity id here and wrap
            // the payload — mirrors the host-trade `useUpdate*(id)` pattern.
            // (Calling it directly silently no-ops: id/data come through
            // undefined, the PATCH never fires, and the save looks dead.)
            //
            // HOS-1875: on a foreign venue the general update is action 15 and
            // rejects `businessLines`. The classification travels FIRST through
            // the dedicated ACC:27 route — before the rest of the payload,
            // because a content field of a section the new line brings (e.g.
            // `nightInfo` on adding `nightlife`) would otherwise answer 409
            // `SECTION_ABSENT` against the old selection. An own venue keeps the
            // single general update: the dedicated route refuses the owner.
            mutateAsync: async (values: Record<string, unknown>) => {
                const ownerId = query.data?.ownerId ?? null;
                const isForeign = Boolean(user?.id && ownerId && ownerId !== user.id);
                const { businessLines, ...rest } = values;
                if (isForeign && businessLines !== undefined) {
                    await changeBusinessLinesMutation.mutateAsync({
                        id: entityId,
                        businessLines: businessLines as readonly string[]
                    });
                    if (!Object.values(rest).some((value) => value !== undefined)) return;
                    return updateMutationResult.mutateAsync({
                        id: entityId,
                        data: rest as Parameters<typeof updateMutationResult.mutateAsync>[0]['data']
                    });
                }
                return updateMutationResult.mutateAsync({
                    id: entityId,
                    data: values as Parameters<typeof updateMutationResult.mutateAsync>[0]['data']
                });
            },
            isLoading: updateMutationResult.isPending || changeBusinessLinesMutation.isPending
        },

        entityType: 'venue',
        entityId,

        goToList,
        goToView,
        goToEdit
    };
};
