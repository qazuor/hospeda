import { useTranslations } from '@repo/i18n';
import { AccommodationTypeEnum, PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import { useAccommodationQuery, useUpdateAccommodationMutation } from './useAccommodationQuery';

// ✅ NUEVAS IMPORTACIONES PARA CONFIGURACIÓN CONSOLIDADA
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { createAccommodationConsolidatedConfig } from '../config';

/**
 * Hook for managing accommodation entity pages
 * Centralizes all accommodation-specific logic in one place
 */
export const useAccommodationPage = (entityId: string) => {
    const navigate = useNavigate();
    const { t } = useTranslations();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Use hooks directly at the top level
    const query = useAccommodationQuery(entityId);
    const updateMutation = useUpdateAccommodationMutation(entityId);
    const accommodationTypeOptions = useAccommodationTypeOptions(AccommodationTypeEnum);

    // ✅ CONFIGURACIÓN CONSOLIDADA
    const entityConfig = useMemo(() => {
        const consolidatedConfig = createAccommodationConsolidatedConfig(
            t,
            accommodationTypeOptions
        );

        const viewSections = filterSectionsByMode(consolidatedConfig.sections, 'view');
        const editSections = filterSectionsByMode(consolidatedConfig.sections, 'edit');

        return {
            viewSections,
            editSections,
            metadata: consolidatedConfig.metadata
        };
    }, [accommodationTypeOptions, t]);

    // Permissions configuration - static
    const permissions = useMemo(
        () => ({
            view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
            edit: [PermissionEnum.ACCOMMODATION_UPDATE_ANY],
            create: [PermissionEnum.ACCOMMODATION_CREATE],
            delete: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        }),
        []
    );

    // User permissions (hardcoded for now, can be made dynamic)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
            PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
            PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
            PermissionEnum.ACCOMMODATION_STATES_EDIT,
            PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            // ✅ Permisos adicionales para secciones faltantes
            PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
            PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
            PermissionEnum.ACCOMMODATION_PUBLISH,
            PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
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
    const goToList = () => navigate({ to: '/accommodations' });
    const goToView = () => navigate({ to: `/accommodations/${entityId}` });
    const goToEdit = () => navigate({ to: `/accommodations/${entityId}/edit` });

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
        entityType: 'accommodation',
        entityId,

        // Navigation
        goToList,
        goToView,
        goToEdit
    };

    return hookReturn;
};
