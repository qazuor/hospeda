import { DestinationSelect, OwnerSelect } from '@/components/selects';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/api/client';
import { AlertTriangleIcon, LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { useEntityDetail } from './hooks/useEntityDetail';
import { type EntityDetailConfig, type FieldConfig, FieldType } from './types';

type EntityEditPageProps<TData, TEditData> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
};

/**
 * Generic entity edit page component using TanStack Form
 */
/**
 * Format error message based on environment
 */
const formatErrorMessage = (error: unknown): { title: string; message: string } => {
    const isDev = import.meta.env.DEV;

    // Try to extract API error details
    let apiErrorMessage = '';
    let statusCode = '';

    if (error && typeof error === 'object') {
        const errorObj = error as Record<string, unknown>;

        // Extract status code
        if (errorObj.status) {
            statusCode = errorObj.status.toString();
        }

        // Extract API error message from body
        if (errorObj.body) {
            if (typeof errorObj.body === 'string') {
                apiErrorMessage = errorObj.body;
            } else if (errorObj.body.message) {
                apiErrorMessage = errorObj.body.message;
            } else if (errorObj.body.error) {
                // Handle nested error objects
                if (typeof errorObj.body.error === 'string') {
                    apiErrorMessage = errorObj.body.error;
                } else if (errorObj.body.error.message) {
                    apiErrorMessage = errorObj.body.error.message;
                } else if (errorObj.body.error.details) {
                    apiErrorMessage = errorObj.body.error.details;
                }
            }
        }

        // Fallback to error message
        if (!apiErrorMessage && errorObj.message) {
            apiErrorMessage = errorObj.message;
        }
    }

    if (isDev) {
        // In development, show detailed error information
        let devMessage = '';

        if (error instanceof Error) {
            devMessage = `${error.name}: ${error.message}`;
            if (error.stack) {
                devMessage += `\n\nStack: ${error.stack}`;
            }
        } else {
            devMessage = `Unknown error: ${JSON.stringify(error, null, 2)}`;
        }

        // Add API details if available
        if (apiErrorMessage && apiErrorMessage !== devMessage) {
            devMessage = `API Error: ${apiErrorMessage}\n\n${devMessage}`;
        }
        if (statusCode) {
            devMessage = `Status: ${statusCode}\n${devMessage}`;
        }

        return {
            title: 'Development Error',
            message: devMessage
        };
    }

    // In production, show user-friendly messages

    // If we have a specific API error message, use it (but make it user-friendly)
    if (apiErrorMessage && !apiErrorMessage.includes('Request failed')) {
        // Make generic messages more user-friendly
        if (apiErrorMessage === 'An unexpected error occurred') {
            return {
                title: 'Server Error',
                message:
                    'The server encountered an error while saving your changes. Please try again later or contact support if the problem persists.'
            };
        }

        return {
            title: 'Server Error',
            message: apiErrorMessage
        };
    }

    // Otherwise, categorize by status code
    if (statusCode === '400') {
        return {
            title: 'Invalid Data',
            message: 'The data you submitted is invalid. Please check your inputs and try again.'
        };
    }

    if (statusCode === '401' || statusCode === '403') {
        return {
            title: 'Permission Error',
            message: 'You do not have permission to perform this action.'
        };
    }

    if (statusCode === '404') {
        return {
            title: 'Not Found',
            message: 'The item you are trying to update was not found.'
        };
    }

    if (statusCode === '500') {
        return {
            title: 'Server Error',
            message:
                'The server encountered an error while processing your request. Please try again later.'
        };
    }

    // Fallback error handling
    if (error instanceof Error) {
        if (error.message.includes('ZodError') || error.message.includes('validation')) {
            return {
                title: 'Validation Error',
                message: 'Please check your input data and try again.'
            };
        }

        if (error.message.includes('network') || error.message.includes('fetch')) {
            return {
                title: 'Connection Error',
                message: 'Unable to save changes. Please check your connection and try again.'
            };
        }
    }

    return {
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.'
    };
};

export const EntityEditPage = <TData, TEditData>({
    config
}: EntityEditPageProps<TData, TEditData>) => {
    const params = useParams({ strict: false });
    const entityId = (params as Record<string, string>).id;
    const { addToast } = useToast();
    const router = useRouter();

    const { data, isLoading, error } = useEntityDetail({
        config,
        id: entityId as string
    });

    const queryClient = useQueryClient();

    // Create our own controlled mutation instead of using useEntityEdit
    const updateMutation = useMutation({
        mutationFn: async (formData: TEditData): Promise<TData> => {
            // Get editable field names from config
            const editableFieldNames = config.fields.map((field) => field.name);

            // Filter out invalid fields before validation
            const filteredData = Object.fromEntries(
                Object.entries(formData as Record<string, unknown>).filter(([key]) => {
                    const isEditable = editableFieldNames.includes(key);
                    const isNotExcluded = !['isActive', 'isPublished'].includes(key);
                    return isEditable && isNotExcluded;
                })
            );

            // Validate data with edit schema
            const validatedData = config.editSchema.parse(filteredData);

            const endpoint = config.updateEndpoint.replace(':id', entityId as string);

            const { data: result } = await fetchApi<TData>({
                path: endpoint,
                method: 'PUT',
                body: validatedData
            });

            return result;
        }
        // NO onSuccess or onError - we'll handle everything manually
    });

    // Initialize TanStack Form
    const form = useForm({
        defaultValues: data as TEditData,
        onSubmit: async ({ value }) => {
            // Filter data to only include editable fields
            const editableFieldNames = config.fields.map((field) => field.name);

            // Also exclude fields that don't exist in the database schema
            const excludedFields = ['isActive', 'isPublished'];

            const filteredData = Object.keys(value as Record<string, unknown>)
                .filter((key) => {
                    const isEditable = editableFieldNames.includes(key);
                    const isNotExcluded = !excludedFields.includes(key);
                    return isEditable && isNotExcluded;
                })
                .reduce(
                    (obj, key) => {
                        obj[key] = (value as Record<string, unknown>)[key];
                        return obj;
                    },
                    {} as Record<string, unknown>
                );

            // Double-check: Remove any remaining problematic fields
            const finalData = { ...filteredData };
            for (const field of excludedFields) {
                if (field in finalData) {
                    delete finalData[field];
                }
            }

            try {
                // Use our controlled mutation
                await updateMutation.mutateAsync(finalData);

                // Invalidate queries manually
                queryClient.invalidateQueries({
                    queryKey: [config.name, 'detail', entityId]
                });
                queryClient.invalidateQueries({
                    queryKey: [config.name, 'list']
                });

                // Show success toast ONLY after successful API response
                addToast({
                    variant: 'success',
                    title: 'Success',
                    message: `${config.displayName} updated successfully!`
                });

                // Navigate back to view mode ONLY after successful update
                router.navigate({
                    to: config.viewPath,
                    params: { id: entityId as string }
                });
            } catch (error) {
                // Format and show error toast ONLY after API error
                const { title, message } = formatErrorMessage(error);
                addToast({
                    variant: 'error',
                    title,
                    message,
                    durationMs: 8000 // Longer duration for errors
                });

                // Re-throw to prevent form from thinking it succeeded
                throw error;
            }
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <LoaderIcon className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading {config.displayName.toLowerCase()}...</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangleIcon className="mb-4 h-12 w-12 text-red-500" />
                <h2 className="mb-2 font-semibold text-lg">
                    Error loading {config.displayName.toLowerCase()}
                </h2>
                <p className="mb-4 text-gray-600">
                    {error?.message || 'The requested item could not be found.'}
                </p>
                <Button
                    asChild
                    variant="outline"
                >
                    <Link to={config.basePath}>← Back to {config.pluralDisplayName}</Link>
                </Button>
            </div>
        );
    }

    const sections = [...config.sections].sort((a, b) => a.order - b.order);

    const renderFormField = (field: FieldConfig) => {
        const fieldName = field.name as keyof TEditData;

        switch (field.type) {
            case FieldType.TEXT:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={fieldApi.name}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <input
                                    id={fieldApi.name}
                                    type="text"
                                    value={fieldApi.state.value || ''}
                                    onBlur={fieldApi.handleBlur}
                                    onChange={(e) => fieldApi.handleChange(e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                                {fieldApi.state.meta.errors && (
                                    <p className="mt-1 text-red-600 text-xs">
                                        {fieldApi.state.meta.errors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );

            case FieldType.TEXTAREA:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={fieldApi.name}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <textarea
                                    id={fieldApi.name}
                                    rows={4}
                                    value={fieldApi.state.value || ''}
                                    onBlur={fieldApi.handleBlur}
                                    onChange={(e) => fieldApi.handleChange(e.target.value)}
                                    placeholder={field.placeholder}
                                    className="resize-vertical w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                                {fieldApi.state.meta.errors && (
                                    <p className="mt-1 text-red-600 text-xs">
                                        {fieldApi.state.meta.errors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );

            case FieldType.SELECT:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={fieldApi.name}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <select
                                    id={fieldApi.name}
                                    value={fieldApi.state.value || ''}
                                    onBlur={fieldApi.handleBlur}
                                    onChange={(e) => fieldApi.handleChange(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select {field.label.toLowerCase()}...</option>
                                    {field.options?.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                                {fieldApi.state.meta.errors && (
                                    <p className="mt-1 text-red-600 text-xs">
                                        {fieldApi.state.meta.errors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );

            case FieldType.BOOLEAN:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        id={fieldApi.name}
                                        type="checkbox"
                                        checked={!!fieldApi.state.value}
                                        onBlur={fieldApi.handleBlur}
                                        onChange={(e) => fieldApi.handleChange(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label
                                        htmlFor={fieldApi.name}
                                        className="text-gray-700 text-sm"
                                    >
                                        {field.label}
                                        {field.required && (
                                            <span className="ml-1 text-red-500">*</span>
                                        )}
                                    </label>
                                </div>
                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                                {fieldApi.state.meta.errors && (
                                    <p className="mt-1 text-red-600 text-xs">
                                        {fieldApi.state.meta.errors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );

            case FieldType.RELATION:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={fieldApi.name}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>

                                {/* Render specific select component based on field name */}
                                {field.name === 'ownerId' && (
                                    <OwnerSelect
                                        value={fieldApi.state.value || ''}
                                        onValueChange={fieldApi.handleChange}
                                        disabled={false}
                                        required={field.required}
                                        error={fieldApi.state.meta.errors?.[0]}
                                    />
                                )}

                                {field.name === 'destinationId' && (
                                    <DestinationSelect
                                        value={fieldApi.state.value || ''}
                                        onValueChange={fieldApi.handleChange}
                                        disabled={false}
                                        required={field.required}
                                        error={fieldApi.state.meta.errors?.[0]}
                                    />
                                )}

                                {/* Fallback for other relation fields - could be extended */}
                                {field.name !== 'ownerId' && field.name !== 'destinationId' && (
                                    <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
                                        <p className="text-gray-500 text-sm">
                                            Relation field "{field.name}" not yet implemented
                                        </p>
                                        <p className="text-gray-400 text-xs">
                                            Endpoint: {field.relationConfig?.endpoint}
                                        </p>
                                    </div>
                                )}

                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );

            default:
                return (
                    <form.Field
                        key={field.name}
                        name={fieldName}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={fieldApi.name}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <input
                                    id={fieldApi.name}
                                    type="text"
                                    value={fieldApi.state.value || ''}
                                    onBlur={fieldApi.handleBlur}
                                    onChange={(e) => fieldApi.handleChange(e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {field.description && (
                                    <p className="mt-1 text-gray-500 text-xs">
                                        {field.description}
                                    </p>
                                )}
                                {fieldApi.state.meta.errors && (
                                    <p className="mt-1 text-red-600 text-xs">
                                        {fieldApi.state.meta.errors.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                    </form.Field>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    {config.layoutConfig.showBackButton && (
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                        >
                            <Link
                                to={config.viewPath}
                                params={{ id: entityId as string }}
                            >
                                ← Back to View
                            </Link>
                        </Button>
                    )}
                    <h1 className="font-bold text-2xl">
                        Edit{' '}
                        {String(
                            (data as Record<string, unknown>).name ||
                                (data as Record<string, unknown>).title ||
                                'Item'
                        )}
                    </h1>
                </div>
            </div>

            {/* TanStack Form */}
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                        await form.handleSubmit();
                    } catch {
                        // Error is already handled in form.onSubmit
                    }
                }}
                className="space-y-6"
            >
                {sections.map((section) => {
                    const sectionFields = config.fields
                        .filter((field) => field.section === section.id)
                        .sort((a, b) => (a.order || 0) - (b.order || 0));

                    if (sectionFields.length === 0) return null;

                    return (
                        <Card key={section.id}>
                            <CardHeader>
                                <CardTitle>{section.title}</CardTitle>
                                {section.description && (
                                    <p className="text-gray-600 text-sm">{section.description}</p>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    {sectionFields.map((field) => (
                                        <div
                                            key={field.name}
                                            className={`${
                                                field.colSpan === 2 ||
                                                field.type === FieldType.TEXTAREA
                                                    ? 'md:col-span-2'
                                                    : ''
                                            }`}
                                        >
                                            {renderFormField(field)}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {/* Form Actions */}
                <div className="flex items-center justify-between border-t pt-6">
                    <Button
                        asChild
                        variant="outline"
                        disabled={updateMutation.isPending}
                    >
                        <Link
                            to={config.viewPath}
                            params={{ id: entityId as string }}
                        >
                            Cancel
                        </Link>
                    </Button>

                    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                        {([canSubmit, isSubmitting]) => (
                            <Button
                                type="submit"
                                disabled={!canSubmit || isSubmitting || updateMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isSubmitting || updateMutation.isPending
                                    ? 'Saving...'
                                    : 'Save Changes'}
                            </Button>
                        )}
                    </form.Subscribe>
                </div>
            </form>
        </div>
    );
};
