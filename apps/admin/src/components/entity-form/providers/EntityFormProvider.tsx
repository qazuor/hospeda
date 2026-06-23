import { adminLogger } from '@/utils/logger';
import { useTranslations } from '@repo/i18n';
import { useForm, useStore } from '@tanstack/react-form';
import * as React from 'react';
import { validateFieldWithZod, validateFormWithZod } from '../../../lib/validation/validate-form';
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
    zodSchema,
    children
}) => {
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;
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
                adminLogger.error('Form save error', error);
            } finally {
                setIsSaving(false);
            }
        }
    });

    // Reactive form values.
    //
    // TanStack Form does NOT re-render consumers when the store mutates unless
    // they subscribe to it (see TanStack Form "Reactivity" docs). Reading
    // `form.state.values` directly inside the context value is a non-reactive
    // SNAPSHOT: an external `form.setFieldValue` (e.g. the AI post-generate
    // panel applying a draft) updates the store but does NOT re-render this
    // provider, so the controlled inputs keep showing the stale value.
    //
    // Subscribing here via `useStore` makes `values` track every store write —
    // external programmatic writes AND user typing — without relying on the
    // incidental `setDirtyFields` re-render that previously masked the gap.
    //
    // TYPE-WORKAROUND: `ReactFormApi` (the public `form` type) does not expose
    // `.store` even though the runtime `FormApi` from `useForm` always has it.
    // Same cast pattern used in PostQualityScore / AccommodationQualityScore.
    type FormStore = Parameters<typeof useStore>[0];
    type FormStoreState = { readonly values: Record<string, unknown> };
    const formStore = (form as unknown as { readonly store: FormStore }).store;
    const values = useStore(formStore, (state) => (state as FormStoreState).values);

    // Autosave timer ref
    const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Form actions
    //
    // `setFieldValue` is the single programmatic write path into the form (used
    // e.g. by the AI post-generate panel via `useEntityFormContext`). It always
    // writes the TanStack store AND notifies the optional `onFieldChange`
    // callback. This callback matters for CREATE flows: `EntityCreatePageBase`
    // keeps its own local `values` state as the submit source of truth and its
    // sections do NOT route typing through this `setFieldValue`. Without the
    // callback, a programmatic write would update the (unread-in-create) store
    // but never the local `values`, leaving inputs empty. The create page wires
    // `onFieldChange` to its `handleFieldChange` so programmatic writes land in
    // local state too. Normal typing in create does NOT pass through here (the
    // input's onChange calls the section's `onFieldChange` directly), so there
    // is no double-fire.
    const setFieldValue = React.useCallback(
        (fieldId: string, value: unknown) => {
            form.setFieldValue(fieldId, value);

            // Mark field as dirty
            setDirtyFields((prev) => ({ ...prev, [fieldId]: true }));

            // Notify external callback (e.g. create page's local-state sync)
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
            const values = form.state.values as Record<string, unknown>;

            if (zodSchema) {
                return validateFormWithZod({ schema: zodSchema, data: values, t: tAny });
            }

            // Fallback: required-field check when no Zod schema is provided
            const formErrors: Record<string, string | undefined> = {};
            for (const section of config.sections) {
                for (const field of section.fields) {
                    const value = values[field.id];
                    if (field.required) {
                        if (value === undefined || value === null || value === '') {
                            formErrors[field.id] = t('error.field.required', {
                                field: field.label
                            });
                        }
                    }
                }
            }
            return formErrors;
        } catch (error) {
            adminLogger.error('Form validation error', error);
            return {};
        }
    }, [form.state.values, config.sections, t, tAny, zodSchema]);

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
            adminLogger.error('Form save error', error);
            // Re-throw error so it can be handled by the calling component
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [form, onSave, validateForm, t]);

    const handleSaveAndPublish = React.useCallback(async () => {
        setIsSaving(true);
        try {
            // Validate form before saving and publishing
            const formErrors = await validateForm();
            const hasErrors = Object.values(formErrors).some((error) => Boolean(error));

            if (hasErrors) {
                setErrors(formErrors);
                throw new Error(t('error.form.validation-failed'));
            }

            const values = form.state.values as Record<string, unknown>;
            await onSaveAndPublish?.(values);
            // Reset dirty state after successful save
            setDirtyFields({});
            setErrors({});
        } catch (error) {
            adminLogger.error('Form save and publish error', error);
            // Re-throw error so it can be handled by the calling component
            throw error;
        } finally {
            setIsSaving(false);
        }
    }, [form, onSaveAndPublish, validateForm, t]);

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
                const values = form.state.values as Record<string, unknown>;
                const error = zodSchema
                    ? validateFieldWithZod({ schema: zodSchema, data: values, fieldId, t: tAny })
                    : undefined;
                setErrors((prev) => ({ ...prev, [fieldId]: error }));
                return error;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Validation error';
                setErrors((prev) => ({ ...prev, [fieldId]: errorMessage }));
                return errorMessage;
            }
        },
        [form.state.values, zodSchema, tAny]
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
            values,
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
            values,
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
