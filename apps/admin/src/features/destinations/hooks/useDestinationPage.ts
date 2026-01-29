import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { createDestinationConsolidatedConfig } from '../config';
import { useDestinationQuery, useUpdateDestinationMutation } from './useDestinationQuery';

/**
 * Hook for managing destination entity pages
 * Centralizes all destination-specific logic in one place
 */
export const useDestinationPage = (entityId: string) => {
    const navigate = useNavigate();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = useDestinationQuery(entityId);
    const updateMutation = useUpdateDestinationMutation(entityId);

    // Consolidated configuration
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createDestinationConsolidatedConfig();

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
            view: [PermissionEnum.DESTINATION_VIEW_ALL],
            edit: [PermissionEnum.DESTINATION_UPDATE],
            create: [PermissionEnum.DESTINATION_CREATE],
            delete: [PermissionEnum.DESTINATION_DELETE]
        }),
        []
    );

    // User permissions (hardcoded for now, can be made dynamic)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.DESTINATION_VIEW_ALL,
            PermissionEnum.DESTINATION_UPDATE,
            PermissionEnum.DESTINATION_CREATE,
            PermissionEnum.DESTINATION_DELETE,
            PermissionEnum.DESTINATION_FEATURED_TOGGLE,
            PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
            PermissionEnum.DESTINATION_GALLERY_MANAGE,
            PermissionEnum.DESTINATION_SLUG_MANAGE,
            PermissionEnum.DESTINATION_TAGS_MANAGE,
            PermissionEnum.DESTINATION_REVIEW_MODERATE,
            PermissionEnum.DESTINATION_ATTRACTION_MANAGE
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
    const goToList = () => navigate({ to: '/destinations' });
    const goToView = () => navigate({ to: `/destinations/${entityId}` });
    const goToEdit = () => navigate({ to: `/destinations/${entityId}/edit` });

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
        entityType: 'destination',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
