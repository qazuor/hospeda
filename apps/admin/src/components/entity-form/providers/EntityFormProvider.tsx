import { useTranslations } from '@repo/i18n';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import {
    EntityFormContext,
    type EntityFormContextValue,
    type EntityFormProviderProps
} from '../context/EntityFormContext';
import { AutosaveStrategyEnum, FormModeEnum } from '../enums/form-config.enums';

/**
 * Entity form provider component that manages form state and actions
 */
export const EntityFormProvider: React.FC<EntityFormProviderProps> = ({
    config,
    initialValues = {},
    userPermissions,
    mode = FormModeEnum.EDIT,
    autosave = {
        strategy: AutosaveStrategyEnum.MANUAL,
        interval: 30000, // 30 seconds
        enabled: false
    },
    onSave,
    onSaveAndPublish,
    onDiscard,
    onFieldChange,
    onFieldBlur,
    onFieldFocus,
    children
}) => {
    const { t } = useTranslations();
    // Form state
    const [formMode, setFormMode] = React.useState<FormModeEnum>(mode);
    const [isLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [activeSectionId, setActiveSectionId] = React.useState<string | undefined>(
        config.sections[0]?.id
    );
    const [dirtyFields, setDirtyFields] = React.useState<Record<string, boolean>>({});
    const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

    // Debug logging (temporarily disabled)
    // adminLogger.log(
    //     `[EntityFormProvider] Initialization: hasInitialValues=${!!initialValues}, initialValues=${initialValues ? Object.keys(initialValues).join(',') : 'undefined'}`
    // );

    // TanStack Form instance
    const form = useForm({
        defaultValues: initialValues || {},
        onSubmit: async ({ value }) => {
            setIsSaving(true);
            try {
                await onSave?.(value);
                // Reset dirty state after successful save
                setDirtyFields({});
            } catch (error) {
                console.error('Form save error:', error);
                // TODO [415e697e-d781-4607-aaee-c4ac33a1274d]: Handle save errors properly
            } finally {
                setIsSaving(false);
            }
        }
    });

    // Autosave timer ref
    const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Form actions
    const setFieldValue = React.useCallback(
        (fieldId: string, value: unknown) => {
            form.setFieldValue(fieldId, value);

            // Mark field as dirty
            setDirtyFields((prev) => ({ ...prev, [fieldId]: true }));

            // Call external callback
            onFieldChange?.(fieldId, value);

            // Handle autosave
            if (autosave.enabled && autosave.strategy === AutosaveStrategyEnum.FIELD) {
                if (autosaveTimerRef.current) {
                    clearTimeout(autosaveTimerRef.current);
                }
                autosaveTimerRef.current = setTimeout(() => {
                    handleSave();
                }, autosave.interval);
            }
        },
        [form, onFieldChange, autosave]
    );

    const handleFieldBlur = React.useCallback(
        (fieldId: string) => {
            // Validate field on blur
            validateField(fieldId);

            // Call external callback
            onFieldBlur?.(fieldId);

            // Handle autosave
            if (autosave.enabled && autosave.strategy === AutosaveStrategyEnum.FIELD) {
                handleSave();
            }
        },
        [onFieldBlur, autosave]
    );

    const handleFieldFocus = React.useCallback(
        (fieldId: string) => {
            // Clear field error on focus
            setErrors((prev) => ({ ...prev, [fieldId]: undefined }));

            // Call external callback
            onFieldFocus?.(fieldId);
        },
        [onFieldFocus]
    );

    const setMode = React.useCallback((newMode: FormModeEnum) => {
        setFormMode(newMode);
    }, []);

    const setActiveSection = React.useCallback((sectionId: string) => {
        setActiveSectionId(sectionId);
    }, []);

    const validateForm = React.useCallback(async (): Promise<
        Record<string, string | undefined>
    > => {
        try {
            const formErrors: Record<string, string | undefined> = {};
            const values = form.state.values as Record<string, unknown>;

            // Validate all fields in all sections
            for (const section of config.sections) {
                for (const field of section.fields) {
                    const value = values[field.id];

                    // Check required fields
                    if (field.required) {
                        if (value === undefined || value === null || value === '') {
                            formErrors[field.id] = t('error.field.required', {
                                field: field.label
                            });
                        }
                    }

                    // Additional field-specific validations can be added here
                    // TODO [971163d7-f8f9-415f-ba4a-7012f596e75e]: Implement Zod schema validation for more complex rules
                }
            }

            return formErrors;
        } catch (error) {
            console.error('Form validation error:', error);
            return {};
        }
    }, [form.state.values, config.sections, t]);

    const handleSave = React.useCallback(async () => {
        setIsSaving(true);
        try {
            // Validate form before saving
            const formErrors = await validateForm();
            const hasErrors = Object.values(formErrors).some((error) => Boolean(error));

            if (hasErrors) {
                // Don't save if there are validation errors
                setErrors(formErrors);
                throw new Error(t('error.form.validation-failed'));
            }

            const values = form.state.values as Record<string, unknown>;
            await onSave?.(values);
            // Reset dirty state after successful save
            setDirtyFields({});
            setErrors({});
        } catch (error) {
            console.error('Form save error:', error);
            // Re-throw error so it can be handled by the calling component
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [form, onSave, validateForm, t]);

    const handleSaveAndPublish = React.useCallback(async () => {
        setIsSaving(true);
        try {
            const values = form.state.values as Record<string, unknown>;
            await onSaveAndPublish?.(values);
            // Reset dirty state after successful save
            setDirtyFields({});
            setErrors({});
        } catch (error) {
            console.error('Form save and publish error:', error);
            // TODO [f6fb8c53-c85b-4320-824e-bd228ed129a0]: Handle save errors properly
        } finally {
            setIsSaving(false);
        }
    }, [form, onSaveAndPublish]);

    const handleDiscard = React.useCallback(() => {
        form.reset();
        setDirtyFields({});
        setErrors({});
        onDiscard?.();
    }, [form, onDiscard]);

    const handleReset = React.useCallback(() => {
        form.reset();
        setDirtyFields({});
        setErrors({});
    }, [form]);

    const validateField = React.useCallback(
        async (fieldId: string): Promise<string | undefined> => {
            try {
                // TODO [40021f50-1cb5-4311-b52c-4826d308538f]: Implement field validation using Zod schemas
                // This would extract the field schema from the main entity schema
                // and validate the current field value

                // For now, return undefined (no error)
                const error = undefined;
                setErrors((prev) => ({ ...prev, [fieldId]: error }));
                return error;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Validation error';
                setErrors((prev) => ({ ...prev, [fieldId]: errorMessage }));
                return errorMessage;
            }
        },
        []
    );

    const isFieldDirty = React.useCallback(
        (fieldId: string): boolean => {
            return Boolean(dirtyFields[fieldId]);
        },
        [dirtyFields]
    );

    const isSectionDirty = React.useCallback(
        (sectionId: string): boolean => {
            const section = config.sections.find((s) => s.id === sectionId);
            if (!section) return false;

            return section.fields.some((field) => dirtyFields[field.id]);
        },
        [config.sections, dirtyFields]
    );

    const hasUnsavedChanges = React.useCallback((): boolean => {
        return Object.values(dirtyFields).some(Boolean);
    }, [dirtyFields]);

    // Cleanup autosave timer on unmount
    React.useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, []);

    // Debug form state (temporarily disabled)
    // adminLogger.log(
    //     `[EntityFormProvider] Form state: hasFormState=${!!form.state}, formStateValues=${form.state?.values ? Object.keys(form.state.values).join(',') : 'undefined'}`
    // );

    // Context value
    const contextValue: EntityFormContextValue = React.useMemo(
        () => ({
            // State
            config,
            values: form.state.values as Record<string, unknown>,
            errors,
            dirtyFields,
            mode: formMode,
            isLoading,
            isSaving,
            userPermissions,
            activeSectionId,
            autosave,
            form,

            // Actions
            setFieldValue,
            handleFieldBlur,
            handleFieldFocus,
            setMode,
            setActiveSection,
            save: handleSave,
            saveAndPublish: handleSaveAndPublish,
            discard: handleDiscard,
            reset: handleReset,
            validateField,
            validateForm,
            isFieldDirty,
            isSectionDirty,
            hasUnsavedChanges,
            setErrors
        }),
        [
            config,
            form,
            errors,
            dirtyFields,
            formMode,
            isLoading,
            isSaving,
            userPermissions,
            activeSectionId,
            autosave,
            setFieldValue,
            handleFieldBlur,
            handleFieldFocus,
            setMode,
            setActiveSection,
            handleSave,
            handleSaveAndPublish,
            handleDiscard,
            handleReset,
            validateField,
            validateForm,
            isFieldDirty,
            isSectionDirty,
            hasUnsavedChanges
        ]
    );

    return <EntityFormContext.Provider value={contextValue}>{children}</EntityFormContext.Provider>;
};
