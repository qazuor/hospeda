import { useCallback, useMemo } from 'react';
import { useEntityFormContext } from '../context/EntityFormContext';
import type { FieldConfig } from '../types/field-config.types';

/**
 * Optimized hook for accessing entity form context
 * Provides memoized selectors to prevent unnecessary re-renders
 */
export const useOptimizedEntityForm = () => {
    const context = useEntityFormContext();

    // Memoized selectors for specific parts of the context
    const formState = useMemo(
        () => ({
            values: context.values,
            errors: context.errors,
            isLoading: context.isLoading,
            isSaving: context.isSaving,
            hasUnsavedChanges: context.hasUnsavedChanges()
        }),
        [
            context.values,
            context.errors,
            context.isLoading,
            context.isSaving,
            context.hasUnsavedChanges
        ]
    );

    const formActions = useMemo(
        () => ({
            setFieldValue: context.setFieldValue,
            save: context.save,
            discard: context.discard,
            reset: context.reset,
            validateField: context.validateField,
            validateForm: context.validateForm
        }),
        [
            context.setFieldValue,
            context.save,
            context.discard,
            context.reset,
            context.validateField,
            context.validateForm
        ]
    );

    const permissions = useMemo(
        () => ({
            userPermissions: context.userPermissions,
            mode: context.mode
        }),
        [context.userPermissions, context.mode]
    );

    const navigation = useMemo(
        () => ({
            activeSectionId: context.activeSectionId,
            setActiveSection: context.setActiveSection,
            setMode: context.setMode
        }),
        [context.activeSectionId, context.setActiveSection, context.setMode]
    );

    // Optimized field value getter
    const getFieldValue = useCallback(
        (fieldId: string) => {
            return context.values[fieldId];
        },
        [context.values]
    );

    // Optimized field error getter
    const getFieldError = useCallback(
        (fieldId: string) => {
            return context.errors[fieldId];
        },
        [context.errors]
    );

    // Optimized field dirty checker
    const isFieldDirty = useCallback(
        (fieldId: string) => {
            return context.isFieldDirty(fieldId);
        },
        [context.isFieldDirty]
    );

    // Optimized permission checker for fields
    const canEditField = useCallback(
        (field: FieldConfig) => {
            if (context.mode === 'view') return false;
            if (!field.permissions?.edit) return true;
            return field.permissions.edit.some((permission) =>
                context.userPermissions.includes(permission)
            );
        },
        [context.mode, context.userPermissions]
    );

    const canViewField = useCallback(
        (field: FieldConfig) => {
            if (!field.permissions?.view) return true;
            return field.permissions.view.some((permission) =>
                context.userPermissions.includes(permission)
            );
        },
        [context.userPermissions]
    );

    return {
        // Memoized state groups
        formState,
        formActions,
        permissions,
        navigation,

        // Optimized getters
        getFieldValue,
        getFieldError,
        isFieldDirty,
        canEditField,
        canViewField,

        // Full context for cases where optimization isn't needed
        fullContext: context
    };
};

/**
 * Hook for accessing only form values (most commonly used)
 * Highly optimized for components that only need values
 */
export const useFormValues = () => {
    const context = useEntityFormContext();
    return useMemo(() => context.values, [context.values]);
};

/**
 * Hook for accessing only form errors
 * Optimized for error display components
 */
export const useFormErrors = () => {
    const context = useEntityFormContext();
    return useMemo(() => context.errors, [context.errors]);
};

/**
 * Hook for accessing only form actions
 * Optimized for action components (buttons, etc.)
 */
export const useFormActions = () => {
    const context = useEntityFormContext();
    return useMemo(
        () => ({
            save: context.save,
            discard: context.discard,
            reset: context.reset,
            setFieldValue: context.setFieldValue
        }),
        [context.save, context.discard, context.reset, context.setFieldValue]
    );
};
