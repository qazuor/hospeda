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
import { createAccommodationConsolidatedConfig } from '@/features/accommodations/config';
import { useCreateAccommodationMutation } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useIntelligentNavigation, useLazySections } from '@/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { createErrorComponent, createPendingComponent } from '@/lib/factories';
import { useAccommodationTypeOptions } from '@/lib/utils/enum-to-options.utils';
import { adminLogger } from '@/utils/logger';
import { LimitGate } from '@qazuor/qzpay-react';
import { AccommodationTypeEnum, PermissionEnum } from '@repo/schemas';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Suspense, useMemo, useState } from 'react';

export const Route = createFileRoute('/_authed/accommodations/new')({
    component: AccommodationCreatePage,
    errorComponent: createErrorComponent('Accommodation'),
    pendingComponent: createPendingComponent()
});

function AccommodationCreatePage() {
    const navigate = useNavigate();
    const { t } = useTranslations();
    const { addToast } = useToast();
    const createMutation = useCreateAccommodationMutation();
    const accommodationTypeOptions = useAccommodationTypeOptions(AccommodationTypeEnum);

    // Form state
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Get consolidated config and filter for create mode
    const { sections, entityConfig } = useMemo(() => {
        const consolidatedConfig = createAccommodationConsolidatedConfig(
            t,
            accommodationTypeOptions
        );
        const createSections = filterSectionsByMode(consolidatedConfig.sections, 'create');

        return {
            sections: createSections,
            entityConfig: {
                id: 'accommodation-new',
                entityType: 'accommodation',
                title: t('admin-entities.entities.accommodation.singular'),
                description: t('admin-entities.entities.accommodation.description'),
                entityName: consolidatedConfig.metadata?.entityName || 'Accommodation',
                entityNamePlural: consolidatedConfig.metadata?.entityNamePlural || 'Accommodations',
                sections: createSections,
                viewSections: [],
                editSections: createSections,
                routes: {
                    base: '/accommodations',
                    view: '/accommodations/$id',
                    edit: '/accommodations/$id/edit',
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
    }, [t, accommodationTypeOptions]);

    // User permissions (hardcoded for now)
    const userPermissions = useMemo(
        () => [
            PermissionEnum.ACCOMMODATION_VIEW_ALL,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY,
            PermissionEnum.ACCOMMODATION_CREATE,
            PermissionEnum.ACCOMMODATION_DELETE_ANY,
            PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
            PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
            PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
            PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
            PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
            PermissionEnum.ACCOMMODATION_PUBLISH,
            PermissionEnum.ACCOMMODATION_SLUG_MANAGE,
            PermissionEnum.ACCOMMODATION_TAGS_MANAGE
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
            adminLogger.debug('[AccommodationCreate] Saving values', values);

            const result = await createMutation.mutateAsync(values);

            addToast({
                title: t('admin-entities.messages.created'),
                message: t('admin-entities.entities.accommodation.singular'),
                variant: 'success'
            });

            const newId = (result as { id: string }).id;
            navigate({ to: `/accommodations/${newId}` });
        } catch (error) {
            adminLogger.error('Failed to create accommodation', error);

            let errorMessage = t('admin-entities.messages.error.create');
            const fieldErrors: Record<string, string> = {};

            if (error instanceof Error) {
                errorMessage = error.message;

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
                title: t('admin-entities.messages.error.create'),
                message: errorMessage,
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        navigate({ to: '/accommodations' });
    };

    return (
        <div className="space-y-6">
            <LimitGate
                limitKey="max_accommodations"
                fallback={
                    <Card>
                        <CardContent className="py-8">
                            <div className="mx-auto max-w-md space-y-4 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                                    <Icon
                                        name="alertTriangle"
                                        className="h-8 w-8 text-amber-600"
                                    />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-amber-900 text-lg">
                                        Límite de alojamientos alcanzado
                                    </h3>
                                    <p className="mt-2 text-amber-800 text-sm">
                                        Has alcanzado el límite máximo de alojamientos permitidos en
                                        tu plan actual. Actualiza tu plan para crear más
                                        alojamientos.
                                    </p>
                                </div>
                                <div className="flex justify-center gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={handleCancel}
                                    >
                                        Volver
                                    </Button>
                                    <Button onClick={() => navigate({ to: '/billing/plans' })}>
                                        Ver planes
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                }
            >
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl">
                                    {t('admin-entities.list.new')}{' '}
                                    {t('admin-entities.entities.accommodation.singular')}
                                </CardTitle>
                                <p className="text-gray-600">
                                    {t('admin-entities.entities.accommodation.description')}
                                </p>
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
                                    {t('admin-entities.actions.cancel')}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <EntityErrorBoundary>
                            <Suspense
                                fallback={
                                    <div className="flex items-center justify-center p-8">
                                        <div className="h-6 w-6 animate-spin rounded-full border-blue-600 border-b-2" />
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
                                                            (
                                                                section: SectionConfig,
                                                                index: number
                                                            ) => {
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
                                                            {t('admin-entities.actions.cancel')}
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
                                                                ? t(
                                                                      'admin-entities.messages.saving'
                                                                  )
                                                                : t(
                                                                      'admin-entities.actions.create'
                                                                  )}
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
            </LimitGate>
        </div>
    );
}
