import { EntityFormProvider, EntityFormSection, FormModeEnum } from '@/components/entity-form';
import { SmartBreadcrumbs, SmartNavigation } from '@/components/entity-form/navigation';
import { LazySectionWrapper } from '@/components/entity-form/sections/LazySectionWrapper';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { filterSectionsByMode } from '@/components/entity-form/utils/section-filter.utils';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { useToast } from '@/components/ui/ToastProvider';
import { createEventOrganizerConsolidatedConfig } from '@/features/event-organizers/config';
import { useCreateEventOrganizerMutation } from '@/features/event-organizers/hooks/useEventOrganizerQuery';
import { useIntelligentNavigation, useLazySections } from '@/hooks';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { adminLogger } from '@/utils/logger';
import { LoaderIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Suspense, useMemo, useState } from 'react';

export const Route = createFileRoute('/_authed/events/organizers/new')({
    component: EventOrganizerCreatePage,
    errorComponent: createErrorComponent('EventOrganizer'),
    pendingComponent: createPendingComponent()
});

function EventOrganizerCreatePage() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const createMutation = useCreateEventOrganizerMutation();

    // Form state
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Get consolidated config and filter for create mode
    const { sections, entityConfig } = useMemo(() => {
        const consolidatedConfig = createEventOrganizerConsolidatedConfig();
        const createSections = filterSectionsByMode(consolidatedConfig.sections, 'create');

        return {
            sections: createSections,
            entityConfig: {
                id: 'event-organizer-new',
                entityType: 'event-organizer',
                title: 'Crear Organizador de Eventos',
                description: 'Crear un nuevo organizador de eventos',
                entityName: consolidatedConfig.metadata?.entityName || 'Organizador de Eventos',
                entityNamePlural:
                    consolidatedConfig.metadata?.entityNamePlural || 'Organizadores de Eventos',
                sections: createSections,
                viewSections: [],
                editSections: createSections,
                routes: {
                    base: '/events/organizers',
                    view: '/events/organizers/$id',
                    edit: '/events/organizers/$id/edit',
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
    }, []);

    // User permissions (hardcoded for now)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.EVENT_ORGANIZER_VIEW,
            PermissionEnum.EVENT_ORGANIZER_UPDATE,
            PermissionEnum.EVENT_ORGANIZER_CREATE,
            PermissionEnum.EVENT_ORGANIZER_DELETE,
            PermissionEnum.EVENT_ORGANIZER_MANAGE
        ],
        []
    );

    // Intelligent navigation
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

    // Lazy sections
    const { shouldLazyLoad, getMetrics } = useLazySections(sections, {
        enabled: true,
        preloadCount: 1,
        alwaysLoad: ['basic-info']
    });

    const handleFieldChange = (fieldId: string, value: unknown) => {
        setValues((prev) => ({
            ...prev,
            [fieldId]: value
        }));
        // Clear error for this field
        if (errors[fieldId]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            adminLogger.debug('[EventOrganizerCreate] Saving values', values);

            const result = await createMutation.mutateAsync(values);

            addToast({
                title: 'Organizador creado',
                message: 'El organizador de eventos se ha creado exitosamente',
                variant: 'success'
            });

            // Navigate to the new event organizer's view page
            const newId = (result as { id: string }).id;
            navigate({ to: `/events/organizers/${newId}` });
        } catch (error) {
            adminLogger.error('Failed to create event organizer', error);

            let errorMessage = 'Error inesperado al crear el organizador';
            const fieldErrors: Record<string, string> = {};

            if (error instanceof Error) {
                errorMessage = error.message;

                // Try to parse validation errors
                try {
                    const zodErrors = JSON.parse(error.message);
                    if (Array.isArray(zodErrors)) {
                        for (const zodError of zodErrors) {
                            if (zodError.path?.length > 0) {
                                fieldErrors[zodError.path[0]] = zodError.message;
                            }
                        }
                    }
                } catch {
                    // Not a JSON error, use as-is
                }
            }

            if (Object.keys(fieldErrors).length > 0) {
                setErrors(fieldErrors);
                setTimeout(() => scrollToFirstError(), 100);
            }

            addToast({
                title: 'Error al crear',
                message: errorMessage,
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate({ to: '/events/organizers' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">Crear Organizador de Eventos</CardTitle>
                            <p className="text-gray-600">Crear un nuevo organizador de eventos</p>
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
                                    <LoaderIcon className="h-6 w-6 animate-spin text-blue-600" />
                                </div>
                            }
                        >
                            <EntityFormProvider
                                config={entityConfig}
                                mode={FormModeEnum.CREATE}
                                initialValues={{}}
                                userPermissions={userPermissions}
                                onSave={handleSave}
                            >
                                <div className="space-y-6">
                                    {/* Smart Breadcrumbs */}
                                    <div className="sticky top-0 z-20 border-gray-200 border-b bg-white pb-4">
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
                                            {/* Performance metrics (development only) */}
                                            {process.env.NODE_ENV === 'development' && (
                                                <div className="mb-4 rounded bg-blue-50 p-2 text-blue-800 text-xs">
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
                                                <div className="space-y-8">
                                                    {sections.map(
                                                        (section: SectionConfig, index: number) => {
                                                            const isLazy = shouldLazyLoad(
                                                                section.id
                                                            );

                                                            const sectionContent = (
                                                                <EntityFormSection
                                                                    key={
                                                                        section.id ||
                                                                        `section-${index}`
                                                                    }
                                                                    config={section}
                                                                    values={values}
                                                                    errors={errors}
                                                                    onFieldChange={
                                                                        handleFieldChange
                                                                    }
                                                                    onFieldBlur={(fieldId) => {
                                                                        adminLogger.log(
                                                                            'Field blurred:',
                                                                            fieldId
                                                                        );
                                                                    }}
                                                                    disabled={isSaving}
                                                                    entityData={values}
                                                                    userPermissions={
                                                                        userPermissions
                                                                    }
                                                                />
                                                            );

                                                            if (isLazy) {
                                                                return (
                                                                    <LazySectionWrapper
                                                                        key={
                                                                            section.id ||
                                                                            `section-${index}`
                                                                        }
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
                                                        }
                                                    )}
                                                </div>

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
                                                            ? 'Creando...'
                                                            : 'Crear Organizador'}
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
}
