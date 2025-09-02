import { EntityFormProvider, EntityViewSection, FormModeEnum } from '@/components/entity-form';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { createAccommodationEntityConfig } from '@/features/accommodations/config/accommodation.config';
import { useAccommodationQuery } from '@/features/accommodations/hooks/useAccommodationQuery';
import { PermissionEnum } from '@repo/types';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { Suspense } from 'react';

/**
 * Accommodation View Page Component
 */
function AccommodationViewPage() {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
    const { id } = useParams({ from: '/_authed/accommodations/$id' as any });
    const navigate = useNavigate();
    const entityConfig = createAccommodationEntityConfig();

    const { data: accommodation, isLoading, error } = useAccommodationQuery(id);

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
                    <p className="mt-2 text-gray-600 text-sm">Loading accommodation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        throw error;
    }

    if (!accommodation) {
        throw new Error('Accommodation not found');
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    VIEW PAGE
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">{accommodation.name}</CardTitle>
                            <p className="text-gray-600">View accommodation details</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.history.back()}
                            >
                                <Icon
                                    name="arrow-left"
                                    className="mr-2 h-4 w-4"
                                />
                                Back
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    navigate({ to: `/accommodations/${id}/edit` });
                                }}
                            >
                                <Icon
                                    name="edit"
                                    className="mr-2 h-4 w-4"
                                />
                                Edit
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
                                mode={FormModeEnum.VIEW}
                                initialValues={accommodation}
                                userPermissions={[
                                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                                    PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
                                    PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
                                    PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
                                    PermissionEnum.ACCOMMODATION_STATES_EDIT,
                                    PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE
                                ]}
                            >
                                <div className="space-y-6">
                                    {entityConfig.viewSections.map((sectionFn, index) => {
                                        const section =
                                            typeof sectionFn === 'function'
                                                ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic section configuration
                                                  (sectionFn as any)()
                                                : sectionFn;

                                        return (
                                            <EntityViewSection
                                                key={section.id || `section-${index}`}
                                                config={section}
                                                values={accommodation}
                                                mode="detailed"
                                                entityData={accommodation}
                                                userPermissions={[
                                                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                                                    PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
                                                    PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
                                                    PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
                                                    PermissionEnum.ACCOMMODATION_STATES_EDIT,
                                                    PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE
                                                ]}
                                            />
                                        );
                                    })}
                                </div>
                            </EntityFormProvider>
                        </Suspense>
                    </EntityErrorBoundary>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Accommodation View Route Configuration
 */
// biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
export const Route = createFileRoute('/_authed/accommodations/$id' as any)({
    component: AccommodationViewPage,
    loader: async ({ params }: { params: { id: string } }) => {
        // Pre-load accommodation data
        // This will be handled by React Query in the component
        return { accommodationId: params.id };
    },
    errorComponent: ({ error }) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
            <div className="text-center">
                <h2 className="font-semibold text-2xl text-gray-900">
                    Error Loading Accommodation
                </h2>
                <p className="mt-2 text-gray-600">
                    {error.message || 'An unexpected error occurred'}
                </p>
            </div>
            <Button
                variant="outline"
                onClick={() => window.history.back()}
            >
                <Icon
                    name="arrow-left"
                    className="mr-2 h-4 w-4"
                />
                Go Back
            </Button>
        </div>
    ),
    pendingComponent: () => (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
        </div>
    )
});
