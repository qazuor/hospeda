/**
 * @file useGastronomyPage.ts
 * Page-orchestrator hook for the gastronomy view and edit pages.
 *
 * Centralises data loading, mode switching, and navigation so route components
 * stay thin.  Mirrors the `useHostTradePage` pattern adapted for the full
 * commerce entity scope (COMMERCE_* permissions).
 */

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { createGastronomyConsolidatedConfig } from '../config/gastronomy-consolidated.config';
import { useGastronomyQuery, useUpdateGastronomyMutation } from './useGastronomyQuery';

/**
 * Centralised hook for the gastronomy view/edit pages.
 *
 * Provides:
 *   - `entity` / `isLoading` / `error` from the detail query
 *   - `mode` toggle (view ↔ edit)
 *   - `sections` filtered for the current mode
 *   - `userPermissions` / `canView` / `canEdit`
 *   - `updateMutation` for the edit form
 *   - Navigation helpers (`goToList`, `goToView`, `goToEdit`)
 *
 * @param entityId - UUID of the gastronomy listing being displayed
 * @returns Page state and helpers for view/edit routes
 */
export const useGastronomyPage = (entityId: string) => {
    const navigate = useNavigate();
    const { t } = useTranslations();

    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    const query = useGastronomyQuery(entityId);
    const updateMutationResult = useUpdateGastronomyMutation();

    const entityConfig = useMemo(() => {
        const consolidatedConfig = createGastronomyConsolidatedConfig(t);
        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');
        return { viewSections, editSections, metadata: consolidatedConfig.metadata };
    }, [t]);

    const permissions = useMemo(
        () => ({
            view: [PermissionEnum.COMMERCE_VIEW_ALL],
            edit: [PermissionEnum.COMMERCE_EDIT_ALL],
            create: [PermissionEnum.COMMERCE_CREATE],
            delete: [PermissionEnum.COMMERCE_DELETE]
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

    const goToList = () => navigate({ to: '/gastronomies' });
    const goToView = () => navigate({ to: '/gastronomies/$id', params: { id: entityId } });
    const goToEdit = () =>
        navigate({ to: '/gastronomies/$id/edit' as never, params: { id: entityId } as never });

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
            // TYPE-WORKAROUND: the commerce factory's useUpdate() mutateAsync
            // expects `{ id, data }` structurally, but EntityPageBase expects
            // `(values: Record<string, unknown>) => Promise<unknown>`.
            // At runtime the entity form always passes `{ id, data }` — the
            // cast is safe; brand mismatch only.
            mutateAsync: updateMutationResult.mutateAsync as unknown as (
                values: Record<string, unknown>
            ) => Promise<unknown>,
            isLoading: updateMutationResult.isPending
        },

        entityType: 'gastronomy',
        entityId,

        goToList,
        goToView,
        goToEdit
    };
};
