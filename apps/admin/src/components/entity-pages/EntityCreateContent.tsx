import { EntityFormProvider, EntityFormSection, FormModeEnum } from '@/components/entity-form';
import { SmartBreadcrumbs, SmartNavigation } from '@/components/entity-form/navigation';
import { LazySectionWrapper } from '@/components/entity-form/sections/LazySectionWrapper';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { unflattenValues } from '@/components/entity-form/utils/unflatten-values.utils';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { useToast } from '@/components/ui/ToastProvider';
import { env } from '@/env';
import type { ConsolidatedSectionConfig } from '@/features/accommodations/types/consolidated-config.types';
import { useIntelligentNavigation, useLazySections } from '@/hooks';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { parseApiValidationErrors } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import { useTranslations } from '@repo/i18n';
import { LoaderIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { Suspense, useMemo, useState } from 'react';
import type { ZodSchema } from 'zod';

/**
 * Configuration for an entity create page
 */
export interface EntityCreateConfig {
    /** Unique entity type identifier */
    readonly entityType: string;
    /** Display title for the create page */
    readonly title: string;
    /** Description shown under the title */
    readonly description: string;
    /** Human-readable entity name (singular) */
    readonly entityName: string;
    /** Human-readable entity name (plural) */
    readonly entityNamePlural: string;
    /** Base route path for the entity (e.g., '/destinations') */
    readonly basePath: string;
    /** Label for the submit button */
    readonly submitLabel: string;
    /** Label shown while saving */
    readonly savingLabel: string;
    /** Toast title on success */
    readonly successToastTitle: string;
    /** Toast message on success */
    readonly successToastMessage: string;
    /** Toast title on error */
    readonly errorToastTitle: string;
    /** Fallback error message */
    readonly errorMessage: string;
}

/**
 * Props for EntityCreateContent component
 */
export interface EntityCreateContentProps {
    /** Entity create configuration */
    readonly config: EntityCreateConfig;
    /** Function that creates the consolidated config (sections, metadata, etc.) */
    readonly createConsolidatedConfig: () => {
        sections: ConsolidatedSectionConfig[] | SectionConfig[];
        metadata?: Record<string, unknown>;
    };
    /** Mutation function to create the entity */
    readonly createMutation: {
        mutateAsync: (values: Record<string, unknown>) => Promise<unknown>;
        isPending: boolean;
    };
    /** Navigate function for routing */
    readonly onNavigate: (path: string) => void;
    /** Dependencies for config memoization */
    readonly configDeps?: readonly unknown[];
    /** Optional wrapper around the form content (e.g., LimitGate) */
    readonly formWrapper?: (children: React.ReactNode) => React.ReactNode;
    /** Optional Zod schema for client-side validation before submission */
    readonly zodSchema?: ZodSchema;
}

/**
 * Shared component for entity creation pages.
 * Encapsulates all common logic: form state, navigation, lazy loading,
 * error handling, and UI layout.
 */
export function EntityCreateContent({
    config,
    createConsolidatedConfig,
    createMutation,
    onNavigate,
    configDeps = [],
    formWrapper,
    zodSchema
}: EntityCreateContentProps) {
    const { addToast } = useToast();
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;

    // Form state
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Get consolidated config and filter for create mode
    const { sections, entityConfig } = useMemo(() => {
        const consolidatedConfig = createConsolidatedConfig();
        const createSections = filterSectionsByMode(
            consolidatedConfig.sections as ConsolidatedSectionConfig[],
            'create'
        );

        return {
            sections: createSections,
            entityConfig: {
                id: `${config.entityType}-new`,
                entityType: config.entityType,
                title: config.title,
                description: config.description,
                entityName:
                    (consolidatedConfig.metadata?.entityName as string) || config.entityName,
                entityNamePlural:
                    (consolidatedConfig.metadata?.entityNamePlural as string) ||
                    config.entityNamePlural,
                sections: createSections,
                viewSections: [],
                editSections: createSections,
                routes: {
                    base: config.basePath,
                    view: `${config.basePath}/$id`,
                    edit: `${config.basePath}/$id/edit`,
                    sections: {},
                    editSections: {}
                },
                permissions: {
                    view: ['view'],
                    edit: ['edit'],
                    create: ['create'],
                    delete: ['delete']
                }
            }
        };
    }, [config, createConsolidatedConfig, ...configDeps]);

    // Permissions, navigation, and lazy loading
    const userPermissions = useUserPermissions();

    const {
        activeSection,
        sectionProgress,
        overallProgress,
        navigateToSection,
        scrollToFirstError
    } = useIntelligentNavigation(sections, values, errors, userPermissions, {
        autoScrollToErrors: true,
        autoAdvanceOnComplete: false,
        scrollOffset: 100
    });

    const { shouldLazyLoad, getMetrics } = useLazySections(sections, {
        enabled: false,
        preloadCount: 1,
        alwaysLoad: ['basic-info']
    });

    /** Handle field value changes and clear field errors */
    const handleFieldChange = (fieldId: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [fieldId]: value }));
        if (errors[fieldId]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    /** Handle form submission */
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = unflattenValues(values);
            adminLogger.debug(`[${config.entityType}Create] Saving values`, payload);
            const result = await createMutation.mutateAsync(payload);

            addToast({
                title: config.successToastTitle,
                message: config.successToastMessage,
                variant: 'success'
            });

            const newId = (result as { id: string }).id;
            onNavigate(`${config.basePath}/${newId}`);
        } catch (error) {
            adminLogger.error(`Failed to create ${config.entityType}`, error);

            let toastMessage = config.errorMessage;

            // Parse the standardized API validation error envelope (GAP-040)
            const apiBody = (error as { body?: unknown }).body;
            const fieldErrors = parseApiValidationErrors({ error: apiBody, t: tAny });

            if (Object.keys(fieldErrors).length === 0 && error instanceof Error) {
                toastMessage = error.message;
            }

            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
                setTimeout(() => scrollToFirstError(), 100);
            }

            addToast({
                title: config.errorToastTitle,
                message: toastMessage,
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        onNavigate(config.basePath);
    };

    /** Render sections with lazy loading */
    const renderSections = () =>
        sections.map((section: SectionConfig, index: number) => {
            const isLazy = shouldLazyLoad(section.id);
            const sectionContent = (
                <EntityFormSection
                    key={section.id || `section-${index}`}
                    config={section}
                    values={values}
                    errors={errors}
                    onFieldChange={handleFieldChange}
                    onFieldBlur={(fieldId) => {
                        adminLogger.log('Field blurred:', fieldId);
                    }}
                    disabled={isSaving}
                    entityData={values}
                    userPermissions={userPermissions as unknown as string[]}
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
        });

    const formContent = (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">{config.title}</CardTitle>
                            <p className="text-muted-foreground">{config.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                            >
                                <Icon
                                    name="close"
                                    className="mr-2 h-4 w-4"
                                />
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <EntityErrorBoundary>
                        <Suspense
                            fallback={
                                <div className="flex items-center justify-center p-8">
                                    <LoaderIcon className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            }
                        >
                            <EntityFormProvider
                                config={entityConfig}
                                mode={FormModeEnum.CREATE}
                                initialValues={{}}
                                userPermissions={userPermissions as PermissionEnum[]}
                                onSave={handleSave}
                                zodSchema={zodSchema}
                            >
                                <div className="space-y-6">
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
                                            {import.meta.env.DEV &&
                                                env.VITE_DEBUG_LAZY_SECTIONS && (
                                                    <div className="mb-4 rounded bg-primary/5 p-2 text-primary text-xs">
                                                        Lazy Loading: {getMetrics().loadedCount}/
                                                        {getMetrics().totalSections} sections loaded
                                                    </div>
                                                )}

                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleSave();
                                                }}
                                            >
                                                <div className="space-y-8">{renderSections()}</div>

                                                <div className="mt-6 flex justify-end gap-3 border-t pt-6">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={handleCancel}
                                                        disabled={isSaving}
                                                    >
                                                        Cancelar
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        disabled={
                                                            isSaving ||
                                                            !overallProgress.readyForSubmission
                                                        }
                                                        className={
                                                            overallProgress.readyForSubmission
                                                                ? ''
                                                                : 'opacity-50'
                                                        }
                                                    >
                                                        {isSaving
                                                            ? config.savingLabel
                                                            : config.submitLabel}
                                                        {!overallProgress.readyForSubmission && (
                                                            <span className="ml-2 text-xs">
                                                                (
                                                                {
                                                                    overallProgress.completionPercentage
                                                                }
                                                                %)
                                                            </span>
                                                        )}
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </EntityFormProvider>
                        </Suspense>
                    </EntityErrorBoundary>
                </CardContent>
            </Card>
        </div>
    );

    return formWrapper ? formWrapper(formContent) : formContent;
}
