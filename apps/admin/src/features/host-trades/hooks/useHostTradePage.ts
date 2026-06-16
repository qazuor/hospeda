import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { createHostTradeConsolidatedConfig } from '../config/host-trade-consolidated.config';
import { useHostTradeQuery, useUpdateHostTradeMutation } from './useHostTradeQuery';

/**
 * Hook that centralises all data-loading and navigation logic for the
 * host-trade view and edit pages.
 *
 * @param entityId - The UUID of the host-trade entry being displayed.
 */
export const useHostTradePage = (entityId: string) => {
    const navigate = useNavigate();
    const { t } = useTranslations();

    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    const query = useHostTradeQuery(entityId);
    const updateMutation = useUpdateHostTradeMutation(entityId);

    const entityConfig = useMemo(() => {
        const consolidatedConfig = createHostTradeConsolidatedConfig(t);
        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');
        return { viewSections, editSections, metadata: consolidatedConfig.metadata };
    }, [t]);

    const permissions = useMemo(
        () => ({
            view: [PermissionEnum.HOST_TRADE_VIEW, PermissionEnum.HOST_TRADE_VIEW_ALL],
            edit: [PermissionEnum.HOST_TRADE_UPDATE],
            create: [PermissionEnum.HOST_TRADE_CREATE],
            delete: [PermissionEnum.HOST_TRADE_DELETE]
        }),
        []
    );

    const userPermissions = useUserPermissions();

    const canView = useMemo(
        () => permissions.view.some((p) => userPermissions.includes(p)),
        [permissions.view, userPermissions]
    );

    const canEdit = useMemo(
        () => permissions.edit.some((p) => userPermissions.includes(p)),
        [permissions.edit, userPermissions]
    );

    const switchToView = () => setMode('view');
    const switchToEdit = () => setMode('edit');

    const goToList = () => navigate({ to: '/platform/host-trades' });
    const goToView = () => navigate({ to: `/platform/host-trades/${entityId}` });
    const goToEdit = () => navigate({ to: `/platform/host-trades/${entityId}/edit` });

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
            mutateAsync: updateMutation.mutateAsync,
            isLoading: updateMutation.isPending
        },

        entityType: 'hostTrade',
        entityId,

        goToList,
        goToView,
        goToEdit
    };
};
