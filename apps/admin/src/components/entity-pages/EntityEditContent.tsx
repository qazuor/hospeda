import { EntityFormSection, useEntityForm } from '@/components/entity-form';
import { SmartBreadcrumbs, SmartNavigation } from '@/components/entity-form/navigation';
import { LazySectionWrapper } from '@/components/entity-form/sections/LazySectionWrapper';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { Button } from '@/components/ui-wrapped/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { env } from '@/env';
import { useIntelligentNavigation, useLazySections } from '@/hooks';
import { adminLogger } from '@/utils/logger';
import { resolveValidationMessage, useTranslations } from '@repo/i18n';
import type { ZodSchema } from 'zod';

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
    /** Optional Zod schema for form validation */
    zodSchema?: ZodSchema;
}

/**
 * Component for rendering entity content in edit mode
 * Renders sections using EntityFormSection components with form handling
 */
export const EntityEditContent = ({
    renderSection,
    className,
    zodSchema: _zodSchema
}: EntityEditContentProps) => {
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

    const sections = getEditableSections();

    // Use intelligent navigation for smart UX in EDIT mode
    const {
        activeSection,
        sectionProgress,
        overallProgress,
        navigateToSection,
        scrollToFirstError
    } = useIntelligentNavigation(sections, values || {}, errors || {}, userPermissions, {
        autoScrollToErrors: true, // Very useful in edit mode
        autoAdvanceOnComplete: false, // Don't auto-advance while editing
        scrollOffset: 100
    });

    // Lazy loading disabled: the LazySectionWrapper has race conditions with
    // dual IntersectionObservers that cause sections to be permanently stuck on
    // "Loading section..." for entities with 4+ sections (BUG-008/BUG-001).
    // EntityCreateContent already has this disabled. Re-enable only after fixing
    // the LazySectionWrapper implementation.
    const { shouldLazyLoad, getMetrics } = useLazySections(sections, {
        enabled: false,
        preloadCount: 1,
        alwaysLoad: ['basic-info']
    });

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
            adminLogger.error('Failed to save entity', error);

            // Extract more detailed error message and field-specific errors
            let errorMessage = t('error.form.unexpected-error');
            const fieldErrors: Record<string, string> = {};

            const tAny = t as (key: string, params?: Record<string, unknown>) => string;

            if (error instanceof Error) {
                errorMessage = resolveValidationMessage({ key: error.message, t: tAny });

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
                                    fieldErrors[fieldName] = resolveValidationMessage({
                                        key: zodError.message as string,
                                        t: tAny
                                    });
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
                        errorMessage = resolveValidationMessage({
                            key: apiError.body.error.message,
                            t: tAny
                        });
                    }
                }
            }

            // Set field-specific errors in the form context
            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
                // Auto-scroll to first error after setting errors
                setTimeout(() => scrollToFirstError(), 100);
            }

            addToast({
                title: t('error.form.save-failed'),
                message: errorMessage,
                variant: 'error'
            });
        }
    };

    return (
        <div className={`space-y-6 ${className || ''}`}>
            {/* Smart Breadcrumbs */}
            <div className="sticky top-0 z-20 border-border border-b bg-background pb-4">
                <SmartBreadcrumbs
                    sections={sectionProgress}
                    activeSectionId={activeSection}
                    onSectionSelect={navigateToSection}
                    showIcons
                    showProgress
                    maxVisible={5}
                />
            </div>

            {/* Main content with navigation sidebar */}
            <div className="flex gap-6">
                {/* Navigation Sidebar */}
                <div className="w-80 flex-shrink-0">
                    <SmartNavigation
                        sections={sectionProgress}
                        overallProgress={overallProgress}
                        activeSectionId={activeSection}
                        onSectionSelect={navigateToSection}
                        onScrollToErrors={scrollToFirstError}
                        sticky
                        showProgress
                        showDetails
                    />
                </div>

                {/* Content Area */}
                <div className="min-w-0 flex-1">
                    {/* Performance metrics (development only - hidden by default) */}
                    {import.meta.env.DEV && env.VITE_DEBUG_LAZY_SECTIONS && (
                        <div className="mb-4 rounded bg-primary/5 p-2 text-primary text-xs">
                            Lazy Loading: {getMetrics().loadedCount}/{getMetrics().totalSections}{' '}
                            sections loaded
                        </div>
                    )}

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSave();
                        }}
                    >
                        <div className="space-y-8">
                            {sections.map((section, index) => {
                                // Use custom render function if provided
                                if (renderSection) {
                                    return renderSection(section, index);
                                }

                                // Determine if this section should be lazy loaded
                                const isLazy = shouldLazyLoad(section.id);

                                // Default rendering with lazy loading wrapper
                                const sectionContent = (
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

                                if (isLazy) {
                                    return (
                                        <LazySectionWrapper
                                            key={section.id || `section-${index}`}
                                            sectionId={section.id}
                                            preloadAdjacent={true}
                                            rootMargin="100px"
                                            threshold={0.1}
                                            className="min-h-[200px]"
                                        >
                                            {sectionContent}
                                        </LazySectionWrapper>
                                    );
                                }

                                return sectionContent;
                            })}
                        </div>

                        <div className="mt-6 flex justify-end gap-3 border-t pt-6">
                            <Button
                                type="submit"
                                disabled={isSaving || !overallProgress.readyForSubmission}
                                className={overallProgress.readyForSubmission ? '' : 'opacity-50'}
                            >
                                {isSaving ? t('error.form.saving') : t('error.form.save-changes')}
                                {!overallProgress.readyForSubmission && (
                                    <span className="ml-2 text-xs">
                                        ({overallProgress.completionPercentage}%)
                                    </span>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
