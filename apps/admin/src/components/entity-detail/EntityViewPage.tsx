import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangleIcon, EditIcon, LoaderIcon } from '@repo/icons';
import { Link, useParams } from '@tanstack/react-router';
import { useEntityDetail } from './hooks/useEntityDetail';
import { useRelationResolver } from './hooks/useRelationResolver';
import { type EntityDetailConfig, type FieldConfig, FieldType } from './types';

type EntityViewPageProps<TData, TEditData> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
};

/**
 * Generic entity view page component
 */
export const EntityViewPage = <TData, TEditData>({
    config
}: EntityViewPageProps<TData, TEditData>) => {
    const params = useParams({ strict: false });
    const entityId = (params as Record<string, unknown>).id;

    const { data, isLoading, error } = useEntityDetail({
        config,
        id: entityId as string
    });

    // Resolve relation field names
    const { resolvedRelations, isLoading: isResolvingRelations } = useRelationResolver({
        data: data || {},
        fields: [...config.fields]
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

    const renderFieldValue = (field: FieldConfig, value: unknown) => {
        if (value === null || value === undefined || value === '') {
            return <span className="text-gray-400 italic">Not set</span>;
        }

        switch (field.type) {
            case FieldType.BOOLEAN:
                return (
                    <Badge variant={value ? 'default' : 'secondary'}>
                        {value ? '✓' : '✗'}
                        {value ? 'Yes' : 'No'}
                    </Badge>
                );

            case FieldType.DATE:
                return (
                    <span className="text-sm">
                        {new Date(value as string).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </span>
                );

            case FieldType.EMAIL:
                return (
                    <a
                        href={`mailto:${value}`}
                        className="text-blue-600 underline hover:text-blue-800"
                    >
                        {String(value)}
                    </a>
                );

            case FieldType.FILE:
                if (typeof value === 'string' && value.startsWith('http')) {
                    return (
                        <img
                            src={value}
                            alt={field.label}
                            className="h-20 w-20 rounded border object-cover"
                        />
                    );
                }
                return <span className="text-sm">{String(value)}</span>;

            case FieldType.MULTISELECT:
                if (Array.isArray(value)) {
                    return (
                        <div className="flex flex-wrap gap-1">
                            {value.map((item, idx) => (
                                <Badge
                                    key={`${field.name}-${String(item)}-${idx}`}
                                    variant="outline"
                                >
                                    {String(item)}
                                </Badge>
                            ))}
                        </div>
                    );
                }
                return <span className="text-sm">{String(value)}</span>;

            case FieldType.NUMBER:
                return (
                    <span className="font-mono text-sm">
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                    </span>
                );

            case FieldType.RELATION: {
                // Check if we have a resolved relation name
                const resolvedRelation = resolvedRelations[field.name];
                if (resolvedRelation) {
                    return <span className="text-sm">{resolvedRelation.name}</span>;
                }

                // Fallback to original logic for object values
                if (typeof value === 'object' && value !== null) {
                    const relationValue = value as Record<string, unknown>;
                    const displayField = field.relationConfig?.displayField || 'name';
                    return (
                        <span className="text-sm">
                            {String(relationValue[displayField] || relationValue.id || 'Unknown')}
                        </span>
                    );
                }

                // Show loading state if we're still resolving relations
                if (isResolvingRelations && typeof value === 'string') {
                    return (
                        <div className="flex items-center space-x-2">
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                            <span className="text-gray-400 text-sm">Loading...</span>
                        </div>
                    );
                }

                // If we have a string ID but couldn't resolve it, show a more friendly format
                if (typeof value === 'string' && value) {
                    return (
                        <span className="text-sm">
                            {field.label} ID: {value}
                        </span>
                    );
                }

                return <span className="text-sm">{String(value)}</span>;
            }

            default:
                return <span className="text-sm">{String(value)}</span>;
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
                            <Link to={config.basePath}>← Back</Link>
                        </Button>
                    )}
                    <h1 className="font-bold text-2xl">
                        {String(
                            (data as Record<string, unknown>).name ||
                                (data as Record<string, unknown>).title ||
                                'Untitled'
                        )}
                    </h1>
                </div>

                <div className="flex items-center space-x-2">
                    {config.permissions?.canEdit && config.layoutConfig.showEditButton && (
                        <Button asChild>
                            <Link
                                to={config.editPath}
                                params={{ slug: entityId as string }}
                            >
                                <EditIcon className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Sections */}
            {sections.map((section) => {
                const sectionFields = config.fields
                    .filter((field) => field.section === section.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));

                if (sectionFields.length === 0) return null;

                return (
                    <Card key={section.id}>
                        <CardHeader>
                            <CardTitle className="flex items-center">{section.title}</CardTitle>
                            {section.description && (
                                <p className="text-gray-600 text-sm">{section.description}</p>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {sectionFields.map((field) => (
                                    <div
                                        key={field.name}
                                        className={`space-y-2 ${
                                            field.colSpan === 2 || field.type === FieldType.TEXTAREA
                                                ? 'md:col-span-2'
                                                : ''
                                        }`}
                                    >
                                        <div className="font-medium text-gray-700 text-sm">
                                            {field.label}
                                            {field.required && (
                                                <span className="ml-1 text-red-500">*</span>
                                            )}
                                        </div>
                                        <div>
                                            {renderFieldValue(
                                                field,
                                                (data as Record<string, unknown>)[field.name]
                                            )}
                                        </div>
                                        {field.description && (
                                            <p className="text-gray-500 text-xs">
                                                {field.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
};
