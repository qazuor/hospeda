import { useTranslations } from '@repo/i18n';
import { AccommodationTypeEnum, PermissionEnum } from '@repo/schemas';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import type { AccommodationCore } from '../schemas/accommodation-client.schema';
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
    const goToList = () => navigate({ to: '/accommodations' });
    const goToView = () => navigate({ to: `/accommodations/${entityId}` });
    const goToEdit = () => navigate({ to: `/accommodations/${entityId}/edit` });

    // Get sections based on current mode
    const getSections = (): SectionConfig[] => {
        return mode === 'view' ? entityConfig.viewSections : entityConfig.editSections;
    };

    // ----------------------------------------------------------------
    // SPEC-172 PR3: Pre-populate amenityIds / featureIds from relation arrays.
    //
    // The read API response exposes `amenities[{ id, ... }]` and
    // `features[{ id, ... }]` (relation arrays), but the AMENITY_SELECT /
    // FEATURE_SELECT form fields are keyed `amenityIds` / `featureIds`
    // (write-path flat arrays of UUIDs). prepareFormValues reads
    // `entity[field.id]` so it looks for `entity.amenityIds`, which is absent
    // from the read response. We augment the entity here so the chip fields
    // are pre-populated when the form opens.
    // ----------------------------------------------------------------
    const enrichedEntity = useMemo((): AccommodationCore | undefined => {
        if (!query.data) return undefined;
        const raw = query.data as AccommodationCore & {
            amenities?: Array<{ id: string }>;
            features?: Array<{ id: string }>;
            amenityIds?: string[];
            featureIds?: string[];
        };

        // Only derive when the write-path keys are absent (don't override
        // values already present, e.g. after a failed save retry).
        const amenityIds =
            raw.amenityIds ?? (Array.isArray(raw.amenities) ? raw.amenities.map((a) => a.id) : []);
        const featureIds =
            raw.featureIds ?? (Array.isArray(raw.features) ? raw.features.map((f) => f.id) : []);

        return { ...raw, amenityIds, featureIds } as AccommodationCore;
    }, [query.data]);

    const hookReturn = {
        // State
        mode,
        setMode,
        switchToView,
        switchToEdit,
        activeSection,
        setActiveSection,

        // Data
        entity: enrichedEntity,
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
