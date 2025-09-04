import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import type { PermissionEnum } from '@repo/types';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

/**
 * Generic entity configuration interface for useEntityPage
 */
export interface EntityPageConfig {
    /** Entity sections for view mode */
    viewSections: Array<(() => SectionConfig) | SectionConfig>;
    /** Entity sections for edit mode */
    editSections: Array<(() => SectionConfig) | SectionConfig>;
    /** Entity metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Generic entity query hook interface
 */
export interface EntityQueryHook<T = Record<string, unknown>> {
    /** Query function that returns entity data */
    useQuery: (id: string) => {
        data: T | undefined;
        isLoading: boolean;
        error: Error | null;
    };
    /** Mutation function for updating entity */
    useMutation: (id: string) => {
        mutateAsync: (data: Partial<T>) => Promise<T>;
        isPending: boolean;
    };
}

/**
 * Generic entity permissions interface
 */
export interface EntityPermissions {
    /** Permissions required for viewing */
    view: PermissionEnum[];
    /** Permissions required for editing */
    edit: PermissionEnum[];
    /** Permissions required for creating */
    create?: PermissionEnum[];
    /** Permissions required for deleting */
    delete?: PermissionEnum[];
}

/**
 * Hook configuration for useEntityPage
 */
export interface UseEntityPageConfig<T = Record<string, unknown>> {
    /** Entity type identifier */
    entityType: string;
    /** Entity ID */
    entityId: string;
    /** Entity configuration */
    entityConfig: EntityPageConfig;
    /** Entity query hook */
    queryHook: EntityQueryHook<T>;
    /** Entity permissions */
    permissions: EntityPermissions;
    /** User's actual permissions */
    userPermissions: PermissionEnum[];
}

/**
 * Generic hook for managing entity pages (view and edit)
 * Centralizes common logic between both modes
 */
export const useEntityPage = <T = Record<string, unknown>>(config: UseEntityPageConfig<T>) => {
    const navigate = useNavigate();

    // State for mode (view/edit)
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeSection, setActiveSection] = useState<string>();

    // Extract configuration
    const { entityType, entityId, entityConfig, queryHook, permissions, userPermissions } = config;

    // Use the provided query hook
    const { data: entity, isLoading, error } = queryHook.useQuery(entityId);
    const updateMutation = queryHook.useMutation(entityId);

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
    const goToList = () => navigate({ to: `/${entityType}s` });
    const goToView = () => navigate({ to: `/${entityType}s/${entityId}` });

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
        entity,
        isLoading,
        error,

        // Configuration
        entityConfig,
        sections: getSections(),

        // Permissions
        userPermissions,
        canView,
        canEdit,

        // Mutations
        updateMutation,

        // Utilities
        entityType,
        entityId,

        // Navigation
        goToList,
        goToView
    };
};
