import type { PermissionEnum } from '@repo/types';
import * as React from 'react';
import type { EntityConfig } from '../../entity-form/types/entity-config.types';

/**
 * Display modes for entity view
 */
export type ViewDisplayMode = 'card' | 'list' | 'compact' | 'detailed';

/**
 * Entity view context state interface
 */
export interface EntityViewState {
    /** Entity configuration */
    config: EntityConfig;
    /** Current entity values */
    values: Record<string, unknown>;
    /** User permissions for access control */
    userPermissions: PermissionEnum[];
    /** Current display mode */
    displayMode: ViewDisplayMode;
    /** Whether to show empty fields */
    showEmptyFields: boolean;
    /** Whether to show edit controls (edit-in-place) */
    showEditControls: boolean;
    /** Current active section ID */
    activeSectionId?: string;
    /** Whether view is in loading state */
    isLoading: boolean;
    /** Function to get URL for entity links */
    getLinkUrl?: (id: string, entityType: string) => string;
}

/**
 * Entity view context actions interface
 */
export interface EntityViewActions {
    /** Set display mode */
    setDisplayMode: (mode: ViewDisplayMode) => void;
    /** Toggle showing empty fields */
    toggleShowEmptyFields: () => void;
    /** Toggle showing edit controls */
    toggleShowEditControls: () => void;
    /** Set active section */
    setActiveSection: (sectionId: string) => void;
    /** Handle field edit (edit-in-place) */
    handleFieldEdit: (fieldId: string) => void;
    /** Handle entity link click */
    handleEntityLink: (id: string, entityType: string) => void;
    /** Refresh entity data */
    refresh: () => Promise<void>;
}

/**
 * Entity view context interface combining state and actions
 */
export interface EntityViewContextValue extends EntityViewState, EntityViewActions {}

/**
 * Entity view context
 */
export const EntityViewContext = React.createContext<EntityViewContextValue | null>(null);

/**
 * Hook to access entity view context
 * @throws Error if used outside EntityViewProvider
 */
export const useEntityViewContext = (): EntityViewContextValue => {
    const context = React.useContext(EntityViewContext);

    if (!context) {
        throw new Error('useEntityViewContext must be used within an EntityViewProvider');
    }

    return context;
};

/**
 * Props for EntityViewProvider component
 */
export interface EntityViewProviderProps {
    /** Entity configuration */
    config: EntityConfig;
    /** Entity values to display */
    values: Record<string, unknown>;
    /** User permissions */
    userPermissions: PermissionEnum[];
    /** Initial display mode */
    displayMode?: ViewDisplayMode;
    /** Whether to show empty fields initially */
    showEmptyFields?: boolean;
    /** Whether to show edit controls initially */
    showEditControls?: boolean;
    /** Whether view is in loading state */
    isLoading?: boolean;
    /** Function to get URL for entity links */
    getLinkUrl?: (id: string, entityType: string) => string;
    /** Callback when field edit is requested */
    onFieldEdit?: (fieldId: string) => void;
    /** Callback when entity link is clicked */
    onEntityLink?: (id: string, entityType: string) => void;
    /** Callback to refresh entity data */
    onRefresh?: () => Promise<void>;
    /** Children components */
    children: React.ReactNode;
}
