import type { PermissionEnum } from '@repo/types';
import type { ReactFormApi } from '@tanstack/react-form';
import * as React from 'react';
import type { AutosaveStrategyEnum, FormModeEnum } from '../enums/form-config.enums';
import type { EntityConfig } from '../types/entity-config.types';

/**
 * Entity form context state interface
 */
export interface EntityFormState {
    /** Entity configuration */
    config: EntityConfig;
    /** Current form values */
    values: Record<string, unknown>;
    /** Form validation errors */
    errors: Record<string, string | undefined>;
    /** Dirty state per section */
    dirtyFields: Record<string, boolean>;
    /** Current form mode */
    mode: FormModeEnum;
    /** Whether form is in loading state */
    isLoading: boolean;
    /** Whether form is saving */
    isSaving: boolean;
    /** User permissions for access control */
    userPermissions: PermissionEnum[];
    /** Current active section ID */
    activeSectionId?: string;
    /** Autosave configuration */
    autosave?: {
        strategy: AutosaveStrategyEnum;
        interval: number;
        enabled: boolean;
    };
}

/**
 * Entity form context actions interface
 */
export interface EntityFormActions {
    /** Update field value */
    setFieldValue: (fieldId: string, value: unknown) => void;
    /** Handle field blur event */
    handleFieldBlur: (fieldId: string) => void;
    /** Handle field focus event */
    handleFieldFocus: (fieldId: string) => void;
    /** Set form mode */
    setMode: (mode: FormModeEnum) => void;
    /** Set active section */
    setActiveSection: (sectionId: string) => void;
    /** Save form data */
    save: () => Promise<void>;
    /** Save and publish form data */
    saveAndPublish: () => Promise<void>;
    /** Discard form changes */
    discard: () => void;
    /** Reset form to initial values */
    reset: () => void;
    /** Validate specific field */
    validateField: (fieldId: string) => Promise<string | undefined>;
    /** Validate entire form */
    validateForm: () => Promise<Record<string, string | undefined>>;
    /** Check if field is dirty */
    isFieldDirty: (fieldId: string) => boolean;
    /** Check if section is dirty */
    isSectionDirty: (sectionId: string) => boolean;
    /** Check if form has unsaved changes */
    hasUnsavedChanges: () => boolean;
    /** Set field errors */
    setErrors: (errors: Record<string, string | undefined>) => void;
}

/**
 * Entity form context interface combining state and actions
 */
export interface EntityFormContextValue extends EntityFormState, EntityFormActions {
    /** TanStack Form instance */
    form: ReactFormApi<Record<string, unknown>>;
}

/**
 * Entity form context
 */
export const EntityFormContext = React.createContext<EntityFormContextValue | null>(null);

/**
 * Hook to access entity form context
 * @throws Error if used outside EntityFormProvider
 */
export const useEntityFormContext = (): EntityFormContextValue => {
    const context = React.useContext(EntityFormContext);

    if (!context) {
        throw new Error('useEntityFormContext must be used within an EntityFormProvider');
    }

    return context;
};

/**
 * Props for EntityFormProvider component
 */
export interface EntityFormProviderProps {
    /** Entity configuration */
    config: EntityConfig;
    /** Initial form values */
    initialValues?: Record<string, unknown>;
    /** User permissions */
    userPermissions: PermissionEnum[];
    /** Initial form mode */
    mode?: FormModeEnum;
    /** Autosave configuration */
    autosave?: EntityFormState['autosave'];
    /** Callback when form is saved */
    onSave?: (values: Record<string, unknown>) => Promise<void>;
    /** Callback when form is saved and published */
    onSaveAndPublish?: (values: Record<string, unknown>) => Promise<void>;
    /** Callback when form changes are discarded */
    onDiscard?: () => void;
    /** Callback when field value changes */
    onFieldChange?: (fieldId: string, value: unknown) => void;
    /** Callback when field is blurred */
    onFieldBlur?: (fieldId: string) => void;
    /** Callback when field is focused */
    onFieldFocus?: (fieldId: string) => void;
    /** Children components */
    children: React.ReactNode;
}
