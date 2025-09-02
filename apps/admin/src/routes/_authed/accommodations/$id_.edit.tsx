import { EntityFormProvider, EntityFormSection, FormModeEnum } from '@/components/entity-form';
import { EntityErrorBoundary } from '@/components/error-boundaries';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui-wrapped/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-wrapped/Card';
import { useToast } from '@/components/ui/ToastProvider';
import { createAccommodationEntityConfig } from '@/features/accommodations/config/accommodation.config';
import {
    useAccommodationQuery,
    useUpdateAccommodationMutation
} from '@/features/accommodations/hooks/useAccommodationQuery';
import { AccommodationEditSchema } from '@/features/accommodations/schemas/accommodation-client.schema';
import type { AccommodationFormData } from '@/features/accommodations/types/accommodation-form.types';
import { adminLogger } from '@/utils/logger';
import { PermissionEnum } from '@repo/types';
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import React, { Suspense } from 'react';

/**
 * Accommodation Edit Page Component
 */
function AccommodationEditPage() {
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
    const { id } = useParams({ from: '/_authed/accommodations/$id_/edit' as any });
    const navigate = useNavigate();

    // ✅ Call createAccommodationEntityConfig directly
    // The infinite loop will be prevented by fixing EntitySelectField dependencies
    const entityConfig = createAccommodationEntityConfig();

    const { data: accommodation, isLoading, error } = useAccommodationQuery(id);

    // Toast notifications
    const { addToast } = useToast();

    // Local form state
    const [formValues, setFormValues] = React.useState<Record<string, unknown>>({});

    // Initialize form values when accommodation data loads
    React.useEffect(() => {
        if (accommodation) {
            // Convert string boolean values to actual booleans for switch fields
            const processedData = { ...accommodation };

            // Convert isFeatured from string to boolean if needed
            if (typeof processedData.isFeatured === 'string') {
                processedData.isFeatured =
                    processedData.isFeatured === 'true' || processedData.isFeatured === '1';
            }

            setFormValues(processedData);
        }
    }, [accommodation]);

    const updateMutation = useUpdateAccommodationMutation(id);

    // Form validation
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

    const validateForm = (): { isValid: boolean; errors: Record<string, string> } => {
        const errors: Record<string, string> = {};

        try {
            // Use Zod schema for validation (edit-specific schema)
            const result = AccommodationEditSchema.safeParse(formValues);

            if (!result.success) {
                // Convert Zod errors to our error format
                for (const error of result.error.errors) {
                    const fieldPath = error.path.join('.');
                    errors[fieldPath] = error.message;
                }
            }

            setFormErrors(errors);
            return {
                isValid: Object.keys(errors).length === 0,
                errors
            };
        } catch (error) {
            console.error('Validation error:', error);
            errors._form = 'Validation failed';
            setFormErrors(errors);
            return {
                isValid: false,
                errors
            };
        }
    };

    const handleSave = async () => {
        try {
            // Validate form before saving
            const validationResult = validateForm();
            if (!validationResult.isValid) {
                const errorFields = Object.keys(validationResult.errors);
                const errorMessagesByField = errorFields.map(
                    (field) => `${field}: ${validationResult.errors[field]}`
                );

                addToast({
                    title: 'Validation Error',
                    message: `Please fix the following errors: ${errorMessagesByField.join('\n')}`,
                    variant: 'error'
                });
                return; // Stop if validation fails
            }

            // Clean null values before sending to API (convert null to undefined for optional fields)
            const cleanedFormValues = Object.fromEntries(
                Object.entries(formValues).filter(([_, value]) => value !== null)
            );

            await updateMutation.mutateAsync(cleanedFormValues as unknown as AccommodationFormData);

            // Show success message
            addToast({
                title: 'Success',
                message: 'Accommodation saved successfully!',
                variant: 'success'
            });

            // Navigate back to view mode
            adminLogger.log(
                { id, path: `/accommodations/${id}` },
                'Navigating back to view after save'
            );
            navigate({ to: `/accommodations/${id}` });
        } catch (error) {
            console.error('Failed to save accommodation:', error);

            // Extract detailed error message from API response
            let errorMessage = 'An unexpected error occurred while saving.';

            if (error instanceof Error) {
                // Check if it's a fetchApi error with body containing API response
                const apiError = error as Error & {
                    body?: { success: false; error: { message: string; name?: string } };
                };

                if (apiError.body?.error?.message) {
                    // Parse Zod error message if it's a validation error
                    if (apiError.body.error.name === 'ZodError') {
                        try {
                            const zodErrors = JSON.parse(apiError.body.error.message);
                            const errorDetails = zodErrors
                                .map(
                                    (err: { path: (string | number)[]; message: string }) =>
                                        `${err.path.join('.')}: ${err.message}`
                                )
                                .join('\n');
                            errorMessage = `Validation Error:\n${errorDetails}`;
                        } catch {
                            // If parsing fails, use the raw message
                            errorMessage = `Validation Error: ${apiError.body.error.message}`;
                        }
                    } else {
                        // Other API errors
                        errorMessage = apiError.body.error.message;
                    }
                } else {
                    // Fallback to basic error message
                    errorMessage = error.message;
                }
            }

            addToast({
                title: 'Save Failed',
                message: errorMessage,
                variant: 'error'
            });
        }
    };

    const handleCancel = () => {
        navigate({ to: `/accommodations/${id}` });
    };

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
                    EDIT PAGE
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">
                                Edit {accommodation?.name || 'Accommodation'}
                            </CardTitle>
                            <p className="text-gray-600">Modify accommodation details</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate({ to: `/accommodations/${id}` })}
                            >
                                <Icon
                                    name="eye"
                                    className="mr-2 h-4 w-4"
                                />
                                View
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                            >
                                <Icon
                                    name="close"
                                    className="mr-2 h-4 w-4"
                                />
                                Cancel
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
                                mode={FormModeEnum.EDIT}
                                initialValues={accommodation}
                                userPermissions={[
                                    PermissionEnum.ACCOMMODATION_VIEW_ALL,
                                    PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
                                    PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
                                    PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
                                    PermissionEnum.ACCOMMODATION_STATES_EDIT,
                                    PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE
                                ]}
                                onSave={handleSave}
                            >
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSave();
                                    }}
                                >
                                    <div className="space-y-6">
                                        {entityConfig.editSections.map((sectionFn, index) => {
                                            const section =
                                                typeof sectionFn === 'function'
                                                    ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic section configuration
                                                      (sectionFn as any)()
                                                    : sectionFn;

                                            return (
                                                <EntityFormSection
                                                    key={section.id || `section-${index}`}
                                                    config={section}
                                                    values={formValues}
                                                    errors={formErrors}
                                                    onFieldChange={(fieldId, value) => {
                                                        // Avoid unnecessary updates if value hasn't changed
                                                        if (formValues[fieldId] === value) {
                                                            return;
                                                        }

                                                        // Prevent resetting to empty values unless it's intentional
                                                        if (
                                                            value === '' &&
                                                            formValues[fieldId] &&
                                                            formValues[fieldId] !== ''
                                                        ) {
                                                            return;
                                                        }

                                                        // Clear field error when user starts typing
                                                        if (formErrors[fieldId]) {
                                                            const newErrors = { ...formErrors };
                                                            delete newErrors[fieldId];
                                                            setFormErrors(newErrors);
                                                        }

                                                        setFormValues((prev) => ({
                                                            ...prev,
                                                            [fieldId]: value
                                                        }));
                                                    }}
                                                    onFieldBlur={(fieldId) => {
                                                        // Handle field blur
                                                        adminLogger.log('Field blurred:', fieldId);
                                                    }}
                                                    disabled={updateMutation.isPending}
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

                                    <div className="mt-6 flex justify-end gap-3 border-t pt-6">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleCancel}
                                            disabled={updateMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={updateMutation.isPending}
                                        >
                                            {updateMutation.isPending
                                                ? 'Saving...'
                                                : 'Save Changes'}
                                        </Button>
                                    </div>
                                </form>
                            </EntityFormProvider>
                        </Suspense>
                    </EntityErrorBoundary>
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Accommodation Edit Route Configuration
 */
// biome-ignore lint/suspicious/noExplicitAny: TanStack Router type constraint workaround
export const Route = createFileRoute('/_authed/accommodations/$id_/edit' as any)({
    component: AccommodationEditPage,
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
            <div className="flex items-center gap-3">
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
        </div>
    ),
    pendingComponent: () => (
        <div className="flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
        </div>
    )
});
