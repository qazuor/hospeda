import { EntityFormSection, useEntityForm } from '@/components/entity-form';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { Button } from '@/components/ui-wrapped/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { adminLogger } from '@/utils/logger';
import { useTranslations } from '@repo/i18n';

/**
 * Props for EntityEditContent component
 */
export interface EntityEditContentProps {
    /** Entity type */
    entityType: string;
    /** Custom render function for sections */
    renderSection?: (section: SectionConfig, index: number) => React.ReactNode;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Component for rendering entity content in edit mode
 * Renders sections using EntityFormSection components with form handling
 */
export const EntityEditContent = ({ renderSection, className }: EntityEditContentProps) => {
    const {
        values,
        errors,
        userPermissions,
        getEditableSections,
        save,
        isSaving,
        setFieldValue,
        setErrors
    } = useEntityForm();
    const { addToast } = useToast();
    const { t } = useTranslations();

    // Debug logging (temporarily disabled)
    // adminLogger.log(
    //     `[EntityEditContent] Context values: hasValues=${!!values}, values=${values ? Object.keys(values).join(',') : 'undefined'}, hasErrors=${!!errors}, errors=${errors ? Object.keys(errors).join(',') : 'undefined'}`
    // );

    const handleSave = async () => {
        try {
            await save();

            addToast({
                title: t('error.form.save-success'),
                message: t('error.form.save-success-message'),
                variant: 'success'
            });
        } catch (error) {
            console.error('Failed to save entity:', error);

            // Extract more detailed error message and field-specific errors
            let errorMessage = t('error.form.unexpected-error');
            const fieldErrors: Record<string, string> = {};

            if (error instanceof Error) {
                errorMessage = error.message;

                // If it's an API error with Zod validation errors
                const apiError = error as Error & {
                    body?: {
                        success?: boolean;
                        error?: {
                            name?: string;
                            message?: string;
                        };
                    };
                };

                if (apiError.body?.error?.message) {
                    try {
                        // Try to parse Zod error message (it's a JSON string)
                        const zodErrors = JSON.parse(apiError.body.error.message);

                        if (Array.isArray(zodErrors)) {
                            // Extract field-specific errors
                            for (const zodError of zodErrors) {
                                if (zodError.path && zodError.path.length > 0) {
                                    const fieldName = zodError.path[0];
                                    fieldErrors[fieldName] = zodError.message;
                                }
                            }

                            // Create a more user-friendly toast message
                            const fieldCount = Object.keys(fieldErrors).length;
                            if (fieldCount > 0) {
                                if (fieldCount === 1) {
                                    errorMessage = t('error.form.validation-failed-field');
                                } else {
                                    errorMessage = t('error.form.validation-failed-fields-plural', {
                                        count: fieldCount
                                    });
                                }
                            }
                        }
                    } catch {
                        // If parsing fails, use the raw message
                        errorMessage = apiError.body.error.message;
                    }
                }
            }

            // Set field-specific errors in the form context
            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
            }

            addToast({
                title: t('error.form.save-failed'),
                message: errorMessage,
                variant: 'error'
            });
        }
    };

    const sections = getEditableSections();

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleSave();
            }}
            className={className}
        >
            <div className="space-y-6">
                {sections.map((section, index) => {
                    // Use custom render function if provided
                    if (renderSection) {
                        return renderSection(section, index);
                    }

                    // Default rendering
                    return (
                        <EntityFormSection
                            key={section.id || `section-${index}`}
                            config={section}
                            values={values}
                            errors={errors}
                            onFieldChange={setFieldValue}
                            onFieldBlur={(fieldId) => {
                                adminLogger.log('Field blurred:', fieldId);
                            }}
                            disabled={isSaving}
                            entityData={values}
                            userPermissions={userPermissions}
                        />
                    );
                })}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-6">
                <Button
                    type="submit"
                    disabled={isSaving}
                >
                    {isSaving ? t('error.form.saving') : t('error.form.save-changes')}
                </Button>
            </div>
        </form>
    );
};
