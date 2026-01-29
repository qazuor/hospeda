import { PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { createAmenityConsolidatedConfig } from '../config';
import { useAmenityQuery, useUpdateAmenityMutation } from './useAmenityQuery';

/**
 * Hook for managing amenity entity pages
 * Centralizes all amenity-specific logic in one place
 */
export const useAmenityPage = (entityId: string) => {
    const navigate = useNavigate();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = useAmenityQuery(entityId);
    const updateMutation = useUpdateAmenityMutation(entityId);

    // Consolidated configuration
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createAmenityConsolidatedConfig();

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
            view: [PermissionEnum.AMENITY_CREATE], // No specific VIEW permission, use CREATE as proxy
            edit: [PermissionEnum.AMENITY_UPDATE],
            create: [PermissionEnum.AMENITY_CREATE],
            delete: [PermissionEnum.AMENITY_DELETE]
        }),
        []
    );

    // User permissions (hardcoded for now, can be made dynamic)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.AMENITY_CREATE,
            PermissionEnum.AMENITY_UPDATE,
            PermissionEnum.AMENITY_DELETE
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
    const goToList = () => navigate({ to: '/content/accommodation-amenities' });
    const goToView = () => navigate({ to: `/content/accommodation-amenities/${entityId}` });
    const goToEdit = () => navigate({ to: `/content/accommodation-amenities/${entityId}/edit` });

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
        entityType: 'amenity',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
