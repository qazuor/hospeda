import { GridLayout } from '@/components/entity-form/layouts';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { cn } from '@/lib/utils';
import { Edit, Eye } from 'lucide-react';
import * as React from 'react';

/**
 * Props for EntityViewSection component
 */
export interface EntityViewSectionProps {
    /** Section configuration */
    config: SectionConfig;
    /** Entity values */
    values: Record<string, unknown>;
    /** Additional CSS classes */
    className?: string;
    /** User permissions for permission checking */
    userPermissions?: string[];
    /** Current user for predicate evaluation */
    currentUser?: unknown;
    /** Entity data for predicate evaluation */
    entityData?: Record<string, unknown>;
    /** Whether to show edit-in-place controls */
    showEditControls?: boolean;
    /** Edit handler for edit-in-place */
    onEditField?: (fieldId: string) => void;
    /** Whether to show empty fields */
    showEmptyFields?: boolean;
    /** View mode */
    mode?: 'card' | 'list' | 'compact';
}

/**
 * EntityViewSection component for rendering view sections
 * Handles section layout, permissions, and field display
 */
export const EntityViewSection = React.forwardRef<HTMLDivElement, EntityViewSectionProps>(
    (
        {
            config,
            values,
            className,
            userPermissions = [],
            currentUser,
            entityData,
            showEditControls = false,
            onEditField,
            showEmptyFields = false,
            mode = 'card',
            ...props
        },
        ref
    ) => {
        // Use title and description directly from config (they are i18n keys)
        const title = config.title;
        const description = config.description;

        // Check section permissions
        const hasViewPermission = React.useMemo(() => {
            if (!config.permissions?.view || config.permissions.view.length === 0) return true;
            return config.permissions.view.some((permission) =>
                userPermissions.includes(permission)
            );
        }, [config.permissions, userPermissions]);

        const hasEditPermission = React.useMemo(() => {
            if (!config.permissions?.edit || config.permissions.edit.length === 0) return false;
            return config.permissions.edit.some((permission) =>
                userPermissions.includes(permission)
            );
        }, [config.permissions, userPermissions]);

        // Check visibility conditions
        const isVisible = React.useMemo(() => {
            if (!config.visibleIf) return hasViewPermission;

            // TODO [983f0e48-fd2b-416c-beb7-9ce0c18842bc]: Implement predicate evaluation
            // For now, just check permissions
            return hasViewPermission;
        }, [config.visibleIf, hasViewPermission]);

        // Filter visible and accessible fields
        const visibleFields = React.useMemo(() => {
            return config.fields.filter((field) => {
                // Check field permissions
                if (field.permissions?.view && field.permissions.view.length > 0) {
                    const hasFieldPermission = field.permissions.view.some((permission) =>
                        userPermissions.includes(permission)
                    );
                    if (!hasFieldPermission) return false;
                }

                // Check if field has value or if we should show empty fields
                const fieldValue = values[field.id];
                const hasValue =
                    fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

                if (!hasValue && !showEmptyFields) return false;

                // TODO [9583bd8d-bfd3-428f-a99a-3ec2f527021b]: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });
        }, [config.fields, userPermissions, values, showEmptyFields]);

        // Dynamic import of view field components based on type
        const renderViewField = (field: SectionConfig['fields'][0]) => {
            const fieldValue = values[field.id];

            // Check if field is editable for edit-in-place
            const isFieldEditable = React.useMemo(() => {
                if (field.readonly) return false;
                if (!hasEditPermission) return false;

                if (field.permissions?.edit && field.permissions.edit.length > 0) {
                    return field.permissions.edit.some((permission) =>
                        userPermissions.includes(permission)
                    );
                }

                return true;
            }, [field.readonly, field.permissions, userPermissions]);

            // Field props for future use when implementing dynamic field loading
            // const fieldProps = {
            //     config: field,
            //     value: fieldValue,
            //     className: field.className,
            //     showLabel: mode !== 'compact',
            //     showDescription: mode === 'card',
            // };

            // TODO [c532dbba-373a-4c14-88a7-c98ab79f46e5]: Dynamic view field component loading based on field.type
            // For now, return a placeholder
            return (
                <div
                    key={field.id}
                    className={cn(
                        'space-y-1',
                        mode === 'card' && 'rounded-lg border p-3',
                        mode === 'list' && 'border-b py-2 last:border-b-0',
                        mode === 'compact' && 'flex items-center justify-between'
                    )}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <div className="font-medium text-muted-foreground text-sm">
                                {field.id}
                            </div>
                            <div className="text-sm">
                                {String(fieldValue) || (
                                    <span className="text-muted-foreground italic">No value</span>
                                )}
                            </div>
                            <div className="text-muted-foreground text-xs">Type: {field.type}</div>
                        </div>

                        {/* Edit Controls */}
                        {showEditControls && isFieldEditable && onEditField && (
                            <button
                                type="button"
                                onClick={() => onEditField(field.id)}
                                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                                title="Edit field"
                            >
                                <Edit className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            );
        };

        // Render section content based on layout
        const renderSectionContent = () => {
            if (!config.layout) {
                // Default: simple vertical layout
                return (
                    <div
                        className={cn(
                            mode === 'card' && 'space-y-4',
                            mode === 'list' && 'divide-y',
                            mode === 'compact' && 'space-y-2'
                        )}
                    >
                        {visibleFields.map(renderViewField)}
                    </div>
                );
            }

            switch (config.layout) {
                case 'GRID':
                    return (
                        <GridLayout
                            columns={2}
                            gap="md"
                            responsive={{ sm: 1, md: 2 }}
                        >
                            {visibleFields.map(renderViewField)}
                        </GridLayout>
                    );

                case 'TABS':
                    // TODO [248435e3-6f78-44e7-b6a8-b3dfbc2aca50]: Implement tabs layout for nested sections
                    return <div className="space-y-4">{visibleFields.map(renderViewField)}</div>;

                // case 'ACCORDION':
                //     // TODO: Implement accordion layout for nested sections
                //     return <div className="space-y-4">{visibleFields.map(renderViewField)}</div>;

                default:
                    return <div className="space-y-4">{visibleFields.map(renderViewField)}</div>;
            }
        };

        if (!isVisible) {
            return null;
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'space-y-4',
                    mode === 'card' && 'rounded-lg border bg-card p-6',
                    mode === 'list' && 'rounded-lg border bg-card p-4',
                    mode === 'compact' && 'space-y-2',
                    className
                )}
                {...props}
            >
                {/* Section Header */}
                {(title || description) && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            {title && (
                                <h3
                                    className={cn(
                                        'font-semibold leading-none tracking-tight',
                                        mode === 'card' && 'text-lg',
                                        mode === 'list' && 'text-base',
                                        mode === 'compact' && 'text-sm'
                                    )}
                                >
                                    {title}
                                </h3>
                            )}

                            {/* Section Actions */}
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                                {hasEditPermission && showEditControls && (
                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>
                        </div>

                        {description && mode !== 'compact' && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                    </div>
                )}

                {/* Section Content */}
                <div className={config.className}>{renderSectionContent()}</div>

                {/* Section Footer Info */}
                {visibleFields.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        {showEmptyFields
                            ? 'No accessible fields in this section'
                            : 'No data to display in this section'}
                    </div>
                )}

                {/* Section Stats */}
                {mode === 'card' && visibleFields.length > 0 && (
                    <div className="border-t pt-2 text-muted-foreground text-xs">
                        {visibleFields.length} field{visibleFields.length !== 1 ? 's' : ''}{' '}
                        displayed
                        {hasEditPermission && ' • Editable'}
                    </div>
                )}
            </div>
        );
    }
);

EntityViewSection.displayName = 'EntityViewSection';
