import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { createEventConsolidatedConfig } from '../config';
import { useEventQuery, useUpdateEventMutation } from './useEventQuery';

/**
 * Hook for managing event entity pages
 * Centralizes all event-specific logic in one place
 */
export const useEventPage = (entityId: string) => {
    const navigate = useNavigate();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = useEventQuery(entityId);
    const updateMutation = useUpdateEventMutation(entityId);

    // Consolidated configuration
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createEventConsolidatedConfig();

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
            view: [PermissionEnum.EVENT_VIEW_ALL],
            edit: [PermissionEnum.EVENT_UPDATE],
            create: [PermissionEnum.EVENT_CREATE],
            delete: [PermissionEnum.EVENT_DELETE]
        }),
        []
    );

    // Real permissions from AuthContext
    const userPermissions = useUserPermissions();

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
    const goToList = () => navigate({ to: '/events' });
    const goToView = () => navigate({ to: `/events/${entityId}` });
    const goToEdit = () => navigate({ to: `/events/${entityId}/edit` });

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
        entityType: 'event',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
