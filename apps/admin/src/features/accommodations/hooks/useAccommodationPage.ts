import { useTranslations } from '@repo/i18n';
import { AccommodationTypeEnum, PermissionEnum } from '@repo/types';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import {
    EntityTypeEnum,
    FieldTypeEnum,
    LayoutTypeEnum
} from '@/components/entity-form/enums/form-config.enums';
import type { EntitySelectFieldConfig } from '@/components/entity-form/types/field-config.types';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import {
    loadAllDestinations,
    loadDestinationsByIds,
    loadUsersByIds,
    searchDestinations,
    searchUsers
} from '../utils/entity-api.utils';
import { useAccommodationQuery, useUpdateAccommodationMutation } from './useAccommodationQuery';

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

    // Entity configuration - completely static, no hooks or external dependencies
    const entityConfig = useMemo(() => {
        // Basic static section for testing
        const basicSection = {
            id: 'basic-info',
            title: t('fields.accommodation.sections.basicInfo.title'),
            description: t('fields.accommodation.sections.basicInfo.description'),
            layout: LayoutTypeEnum.GRID,
            permissions: {
                view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
            },
            fields: [
                {
                    id: 'name',
                    type: FieldTypeEnum.TEXT,
                    required: true,
                    label: t('fields.accommodation.name.label'),
                    description: t('fields.accommodation.name.description'),
                    placeholder: t('fields.accommodation.name.placeholder'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                    },
                    typeConfig: {}
                },
                {
                    id: 'description',
                    type: FieldTypeEnum.TEXTAREA,
                    required: true,
                    label: t('fields.accommodation.description.label'),
                    description: t('fields.accommodation.description.description'),
                    placeholder: t('fields.accommodation.description.placeholder'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                    },
                    typeConfig: {
                        minRows: 4,
                        maxLength: 1000
                    }
                },
                {
                    id: 'type',
                    type: FieldTypeEnum.SELECT,
                    required: true,
                    label: t('fields.accommodation.type.label'),
                    description: t('fields.accommodation.type.description'),
                    placeholder: t('fields.accommodation.type.placeholder'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                    },
                    typeConfig: {
                        options: accommodationTypeOptions
                    }
                },
                {
                    id: 'isFeatured',
                    type: FieldTypeEnum.SWITCH,
                    required: false,
                    label: t('fields.accommodation.isFeatured.label'),
                    description: t('fields.accommodation.isFeatured.description'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                    },
                    typeConfig: {}
                },
                {
                    id: 'destinationId',
                    type: FieldTypeEnum.ENTITY_SELECT,
                    required: true,
                    label: t('fields.accommodation.destinationId.label'),
                    description: t('fields.accommodation.destinationId.description'),
                    placeholder: t('fields.accommodation.destinationId.placeholder'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT]
                    },
                    typeConfig: {
                        entityType: EntityTypeEnum.DESTINATION,
                        searchFn: searchDestinations,
                        loadByIdsFn: loadDestinationsByIds,
                        loadAllFn: loadAllDestinations,
                        searchMode: 'client',
                        minSearchLength: 1,
                        showAllWhenEmpty: true
                    } satisfies EntitySelectFieldConfig
                },
                {
                    id: 'ownerId',
                    type: FieldTypeEnum.ENTITY_SELECT,
                    required: true,
                    label: t('fields.accommodation.ownerId.label'),
                    description: t('fields.accommodation.ownerId.description'),
                    placeholder: t('fields.accommodation.ownerId.placeholder'),
                    permissions: {
                        view: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
                        edit: [PermissionEnum.ACCOMMODATION_UPDATE_ANY] // Solo admin puede cambiar owner
                    },
                    typeConfig: {
                        entityType: EntityTypeEnum.USER,
                        searchFn: searchUsers,
                        loadByIdsFn: loadUsersByIds,
                        searchMode: 'server',
                        minSearchLength: 2,
                        searchDebounceMs: 300
                    } satisfies EntitySelectFieldConfig
                }
            ]
        };

        return {
            viewSections: [basicSection],
            editSections: [basicSection],
            metadata: {
                title: 'Accommodation',
                description: 'Manage accommodation details',
                entityName: 'Accommodation',
                entityNamePlural: 'Accommodations'
            }
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
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
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
    const getSections = () => {
        return mode === 'view' ? entityConfig.viewSections : entityConfig.editSections;
    };

    return {
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
};
