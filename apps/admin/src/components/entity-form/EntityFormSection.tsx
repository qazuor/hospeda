import { GridLayout } from '@/components/entity-form/layouts';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for EntityFormSection component
 */
export interface EntityFormSectionProps {
    /** Section configuration */
    config: SectionConfig;
    /** Form values */
    values: Record<string, unknown>;
    /** Form errors */
    errors: Record<string, string>;
    /** Field change handler */
    onFieldChange: (fieldId: string, value: unknown) => void;
    /** Field blur handler */
    onFieldBlur: (fieldId: string) => void;
    /** Whether the section is disabled */
    disabled?: boolean;
    /** Additional CSS classes */
    className?: string;
    /** User permissions for permission checking */
    userPermissions?: string[];
    /** Current user for predicate evaluation */
    currentUser?: unknown;
    /** Entity data for predicate evaluation */
    entityData?: Record<string, unknown>;
}

/**
 * EntityFormSection component for rendering form sections
 * Handles section layout, permissions, and field rendering
 */
export const EntityFormSection = React.forwardRef<HTMLDivElement, EntityFormSectionProps>(
    (
        {
            config,
            values,
            errors,
            onFieldChange,
            onFieldBlur,
            disabled = false,
            className,
            userPermissions = [],
            currentUser,
            entityData,
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

        // Check edit permissions (for future use when implementing dynamic field loading)
        // const hasEditPermission = React.useMemo(() => {
        //     if (!config.permissions?.edit || config.permissions.edit.length === 0) return true;
        //     return config.permissions.edit.some((permission) =>
        //         userPermissions.includes(permission)
        //     );
        // }, [config.permissions, userPermissions]);

        // Check visibility conditions
        const isVisible = React.useMemo(() => {
            if (!config.visibleIf) return hasViewPermission;

            // TODO [62d4323b-9840-4827-8123-87b080c8ec46]: Implement predicate evaluation
            // For now, just check permissions
            return hasViewPermission;
        }, [config.visibleIf, hasViewPermission]);

        // Check if section is editable (for future use when implementing dynamic field loading)
        // const isEditable = React.useMemo(() => {
        //     if (!config.editableIf) return hasEditPermission && !disabled;
        //
        //     // TODO: Implement predicate evaluation
        //     // For now, just check permissions
        //     return hasEditPermission && !disabled;
        // }, [config.editableIf, hasEditPermission, disabled]);

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

                // TODO [d0637b98-27ca-446b-a488-ef33c5450fde]: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });
        }, [config.fields, userPermissions]);

        // Dynamic import of field components based on type
        const renderField = (field: SectionConfig['fields'][0]) => {
            const fieldValue = values[field.id];
            const fieldError = errors[field.id];
            const hasError = Boolean(fieldError);

            // Check if field is editable (for future use when implementing dynamic field loading)
            // const isFieldEditable = React.useMemo(() => {
            //     if (field.readonly) return false;
            //     if (disabled) return false;
            //
            //     if (field.permissions?.edit && field.permissions.edit.length > 0) {
            //         return field.permissions.edit.some((permission) =>
            //             userPermissions.includes(permission)
            //         );
            //     }
            //
            //     return true;
            // }, [field.readonly, field.permissions, disabled, userPermissions]);

            // Field props for future use when implementing dynamic field loading
            // const fieldProps = {
            //     config: field,
            //     value: fieldValue,
            //     onChange: (value: unknown) => onFieldChange(field.id, value),
            //     onBlur: () => onFieldBlur(field.id),
            //     hasError,
            //     errorMessage: fieldError,
            //     disabled: !isFieldEditable,
            //     required: field.required,
            //     className: field.className,
            // };

            // TODO [a35fe14e-e9ca-48cc-b21f-9ba14a4f162e]: Dynamic field component loading based on field.type
            // For now, return a placeholder
            return (
                <div
                    key={field.id}
                    className="space-y-2"
                >
                    <div className="font-medium text-sm">{field.id}</div>
                    <div className="text-muted-foreground text-xs">
                        Type: {field.type} | Value: {String(fieldValue) || 'undefined'}
                    </div>
                    {hasError && <div className="text-destructive text-xs">{fieldError}</div>}
                </div>
            );
        };

        // Render section content based on layout
        const renderSectionContent = () => {
            if (!config.layout) {
                // Default: simple vertical layout
                return <div className="space-y-4">{visibleFields.map(renderField)}</div>;
            }

            switch (config.layout) {
                case 'GRID':
                    return (
                        <GridLayout
                            columns={2}
                            gap="md"
                            responsive={{ sm: 1, md: 2 }}
                        >
                            {visibleFields.map(renderField)}
                        </GridLayout>
                    );

                case 'TABS':
                    // TODO [debb2280-99ad-4c43-8b33-b327f371606c]: Implement tabs layout for nested sections
                    return <div className="space-y-4">{visibleFields.map(renderField)}</div>;

                // case 'ACCORDION':
                //     // TODO: Implement accordion layout for nested sections
                //     return <div className="space-y-4">{visibleFields.map(renderField)}</div>;

                default:
                    return <div className="space-y-4">{visibleFields.map(renderField)}</div>;
            }
        };

        if (!isVisible) {
            return null;
        }

        return (
            <div
                ref={ref}
                className={cn('space-y-4', className)}
                {...props}
            >
                {/* Section Header */}
                {(title || description) && (
                    <div className="space-y-1">
                        {title && (
                            <h3 className="font-semibold text-lg leading-none tracking-tight">
                                {title}
                            </h3>
                        )}
                        {description && (
                            <p className="text-muted-foreground text-sm">{description}</p>
                        )}
                    </div>
                )}

                {/* Section Content */}
                <div className={config.className}>{renderSectionContent()}</div>

                {/* Section Footer Info */}
                {visibleFields.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                        No accessible fields in this section
                    </div>
                )}
            </div>
        );
    }
);

EntityFormSection.displayName = 'EntityFormSection';
