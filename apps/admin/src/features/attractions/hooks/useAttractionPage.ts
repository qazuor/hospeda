import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { createAttractionConsolidatedConfig } from '../config';
import { useAttractionQuery, useUpdateAttractionMutation } from './useAttractionQuery';

/**
 * Hook for managing attraction entity pages
 * Centralizes all attraction-specific logic in one place
 */
export const useAttractionPage = (entityId: string) => {
    const navigate = useNavigate();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = useAttractionQuery(entityId);
    const updateMutation = useUpdateAttractionMutation(entityId);

    // Consolidated configuration
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createAttractionConsolidatedConfig();

        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');

        return {
            viewSections,
            editSections,
            metadata: consolidatedConfig.metadata
        };
    }, []);

    // Permissions configuration - static
    const permissions = useMemo(
        () => ({
            view: [PermissionEnum.ATTRACTION_VIEW],
            edit: [PermissionEnum.ATTRACTION_UPDATE],
            create: [PermissionEnum.ATTRACTION_CREATE],
            delete: [PermissionEnum.ATTRACTION_DELETE]
        }),
        []
    );

    // User permissions (hardcoded for now, can be made dynamic)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.ATTRACTION_VIEW,
            PermissionEnum.ATTRACTION_UPDATE,
            PermissionEnum.ATTRACTION_CREATE,
            PermissionEnum.ATTRACTION_DELETE
        ],
        []
    );

    // Check permissions for current mode
    const canView = useMemo(() => {
        return permissions.view.some((permission) => userPermissions.includes(permission));
    }, [permissions.view, userPermissions]);

    const canEdit = useMemo(() => {
        return permissions.edit.some((permission) => userPermissions.includes(permission));
    }, [permissions.edit, userPermissions]);

    // Mode switching
    const switchToView = () => setMode('view');
    const switchToEdit = () => setMode('edit');

    // Navigation
    const goToList = () => navigate({ to: '/attractions' });
    const goToView = () => navigate({ to: `/attractions/${entityId}` });
    const goToEdit = () => navigate({ to: `/attractions/${entityId}/edit` });

    // Get sections based on current mode
    const getSections = (): SectionConfig[] => {
        return mode === 'view' ? entityConfig.viewSections : entityConfig.editSections;
    };

    const hookReturn = {
        // State
        mode,
        setMode,
        switchToView,
        switchToEdit,
        activeSection,
        setActiveSection,

        // Data
        entity: query.data,
        isLoading: query.isLoading,
        error: query.error,

        // Configuration
        entityConfig,
        sections: getSections(),

        // Permissions
        userPermissions,
        canView,
        canEdit,

        // Mutations
        updateMutation: {
            mutateAsync: updateMutation.mutateAsync,
            isLoading: updateMutation.isPending
        },

        // Utilities
        entityType: 'attraction',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
