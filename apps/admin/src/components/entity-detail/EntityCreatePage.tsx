import { DestinationSelect, OwnerSelect } from '@/components/selects';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { useEntityCreate } from './hooks/useEntityCreate';
import { type EntityDetailConfig, type FieldConfig, FieldType } from './types';

type EntityCreatePageProps<TData, TCreateData> = {
    readonly config: EntityDetailConfig<TData, TCreateData>;
    readonly defaultValues?: Partial<TCreateData>;
};

/**
 * Format error message based on environment
 */
const formatErrorMessage = (error: unknown): { title: string; message: string } => {
    const isDev = import.meta.env.DEV;

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

        return {
            title: 'Development Error',
            message: devMessage
        };
    }

    // In production, show user-friendly messages
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
                message: 'Unable to create item. Please check your connection and try again.'
            };
        }
    }

    return {
        title: 'Error',
        message: 'An unexpected error occurred while creating the item. Please try again later.'
    };
};

/**
 * Generic entity create page component using TanStack Form with optimistic updates
 */
export const EntityCreatePage = <TData, TCreateData>({
    config,
    defaultValues = {}
}: EntityCreatePageProps<TData, TCreateData>) => {
    const { addToast } = useToast();

    const { create, isCreating, createError } = useEntityCreate({
        config,
        onSuccess: (_data) => {
            addToast({
                variant: 'success',
                title: 'Success',
                message: `${config.displayName} created successfully!`
            });
        },
        onError: (error) => {
            const { title, message } = formatErrorMessage(error);
            addToast({
                variant: 'error',
                title,
                message,
                durationMs: 8000
            });
        }
    });

    // Initialize TanStack Form
    const form = useForm({
        defaultValues: defaultValues as TCreateData,
        onSubmit: async ({ value }) => {
            // Filter data to only include editable fields
            const editableFieldNames = config.fields.map((field) => field.name);

            // Exclude fields that don't exist in the database schema
            const excludedFields = ['id', 'createdAt', 'updatedAt', 'isActive', 'isPublished'];

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

            // Remove any remaining problematic fields
            const finalData = { ...filteredData };
            for (const field of excludedFields) {
                if (field in finalData) {
                    delete finalData[field];
                }
            }

            await create(finalData as TCreateData);
        }
    });

    const sections = [...config.sections].sort((a, b) => a.order - b.order);

    const renderFormField = (field: FieldConfig) => {
        const fieldName = field.name;

        switch (field.type) {
            case FieldType.TEXT:
                return (
                    <form.Field
                        key={field.name}
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={String(fieldApi.name)}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <input
                                    id={String(fieldApi.name)}
                                    type="text"
                                    value={String(fieldApi.state.value || '')}
                                    onBlur={fieldApi.handleBlur}
                                    // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                    onChange={(e) => fieldApi.handleChange(e.target.value as any)}
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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={String(fieldApi.name)}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <textarea
                                    id={String(fieldApi.name)}
                                    rows={4}
                                    value={String(fieldApi.state.value || '')}
                                    onBlur={fieldApi.handleBlur}
                                    // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                    onChange={(e) => fieldApi.handleChange(e.target.value as any)}
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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={String(fieldApi.name)}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <select
                                    id={String(fieldApi.name)}
                                    value={String(fieldApi.state.value || '')}
                                    onBlur={fieldApi.handleBlur}
                                    // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                    onChange={(e) => fieldApi.handleChange(e.target.value as any)}
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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        id={String(fieldApi.name)}
                                        type="checkbox"
                                        checked={Boolean(fieldApi.state.value)}
                                        onBlur={fieldApi.handleBlur}
                                        onChange={(e) =>
                                            // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                            fieldApi.handleChange(e.target.checked as any)
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label
                                        htmlFor={String(fieldApi.name)}
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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={String(fieldApi.name)}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>

                                {/* Render specific select component based on field name */}
                                {field.name === 'ownerId' && (
                                    <OwnerSelect
                                        value={String(fieldApi.state.value || '')}
                                        onValueChange={(value) =>
                                            // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                            fieldApi.handleChange(value as any)
                                        }
                                        disabled={false}
                                        required={field.required}
                                        error={fieldApi.state.meta.errors?.[0]?.toString()}
                                    />
                                )}

                                {field.name === 'destinationId' && (
                                    <DestinationSelect
                                        value={String(fieldApi.state.value || '')}
                                        onValueChange={(value) =>
                                            // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                            fieldApi.handleChange(value as any)
                                        }
                                        disabled={false}
                                        required={field.required}
                                        error={fieldApi.state.meta.errors?.[0]?.toString()}
                                    />
                                )}

                                {/* Fallback for other relation fields */}
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
                        // biome-ignore lint/suspicious/noExplicitAny: TanStack Form requires any for dynamic field names
                        name={fieldName as any}
                    >
                        {(fieldApi) => (
                            <div>
                                <label
                                    htmlFor={String(fieldApi.name)}
                                    className="mb-1 block font-medium text-gray-700 text-sm"
                                >
                                    {field.label}
                                    {field.required && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                <input
                                    id={String(fieldApi.name)}
                                    type="text"
                                    value={String(fieldApi.state.value || '')}
                                    onBlur={fieldApi.handleBlur}
                                    // biome-ignore lint/suspicious/noExplicitAny: TanStack Form handleChange requires any
                                    onChange={(e) => fieldApi.handleChange(e.target.value as any)}
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
                            <Link to={config.basePath}>← Back to {config.pluralDisplayName}</Link>
                        </Button>
                    )}
                    <h1 className="font-bold text-2xl">Create {config.displayName}</h1>
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
                        disabled={isCreating}
                    >
                        <Link to={config.basePath}>Cancel</Link>
                    </Button>

                    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                        {([canSubmit, isSubmitting]) => (
                            <Button
                                type="submit"
                                disabled={!canSubmit || isSubmitting || isCreating}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSubmitting || isCreating ? (
                                    <>
                                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    `Create ${config.displayName}`
                                )}
                            </Button>
                        )}
                    </form.Subscribe>
                </div>
            </form>

            {/* Show error if any */}
            {createError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-4">
                    <p className="text-red-800 text-sm">
                        {createError.message || 'An error occurred while creating the item.'}
                    </p>
                </div>
            )}
        </div>
    );
};
