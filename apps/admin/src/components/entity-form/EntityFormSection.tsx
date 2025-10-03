import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import {
    CheckboxField,
    CurrencyField,
    // Specific entity select fields
    DestinationSelectField,
    EntitySelectField,
    GalleryField,
    ImageField,
    RichTextField,
    SelectField,
    SwitchField,
    TextField,
    TextareaField,
    UserSelectField
} from '@/components/entity-form/fields';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type { GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { ImageValue } from '@/components/entity-form/fields/ImageField';
import { GridLayout } from '@/components/entity-form/layouts';
import type { SelectFieldConfig } from '@/components/entity-form/types/field-config.types';
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
    errors: Record<string, string | undefined>;
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
const EntityFormSectionComponent = React.forwardRef<HTMLDivElement, EntityFormSectionProps>(
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

        // Check visibility conditions
        const isVisible = React.useMemo(() => {
            if (!config.visibleIf) return hasViewPermission;

            // TODO [e2824288-7f11-4f84-b9f0-0ee7d88ef893]: Implement predicate evaluation
            // For now, just check permissions
            return hasViewPermission;
        }, [config.visibleIf, hasViewPermission]);

        // Filter visible and accessible fields
        const visibleFields = React.useMemo(() => {
            const filtered = config.fields.filter((field) => {
                // Check field permissions
                if (field.permissions?.view && field.permissions.view.length > 0) {
                    const hasFieldPermission = field.permissions.view.some((permission) =>
                        userPermissions.includes(permission)
                    );
                    if (!hasFieldPermission) return false;
                }

                // TODO [7fe8e310-9114-451f-96d2-7ed25397fdb1]: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });

            return filtered;
        }, [config.fields, userPermissions]);

        // Dynamic import of field components based on type
        const renderField = (field: SectionConfig['fields'][0]) => {
            const fieldValue = values[field.id];
            const fieldError = errors[field.id];
            const hasError = Boolean(fieldError);

            // Field props for dynamic field component loading
            const fieldProps = {
                config: field,
                value: fieldValue,
                onChange: (value: unknown) => onFieldChange(field.id, value),
                onBlur: () => onFieldBlur(field.id),
                hasError,
                errorMessage: fieldError,
                disabled: disabled, // Use section disabled state
                required: field.required,
                className: field.className
            };

            // Dynamic field component loading based on field.type
            const renderFieldComponent = () => {
                switch (field.type) {
                    case FieldTypeEnum.TEXT:
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.TEXTAREA:
                        return (
                            <TextareaField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.SELECT:
                        return (
                            <SelectField
                                {...fieldProps}
                                value={fieldValue as string}
                                options={
                                    field.type === FieldTypeEnum.SELECT
                                        ? (field.typeConfig as SelectFieldConfig)?.options || []
                                        : []
                                }
                            />
                        );

                    case FieldTypeEnum.ENTITY_SELECT:
                        return (
                            <EntitySelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    // Specific entity select fields with encapsulated logic
                    case FieldTypeEnum.DESTINATION_SELECT:
                        return (
                            <DestinationSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.USER_SELECT:
                        return (
                            <UserSelectField
                                {...fieldProps}
                                value={fieldValue as string | string[]}
                            />
                        );

                    case FieldTypeEnum.CURRENCY:
                        return (
                            <CurrencyField
                                {...fieldProps}
                                value={fieldValue as CurrencyValue}
                            />
                        );

                    case FieldTypeEnum.RICH_TEXT:
                        return (
                            <RichTextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.IMAGE:
                        return (
                            <ImageField
                                {...fieldProps}
                                value={fieldValue as ImageValue}
                            />
                        );

                    case FieldTypeEnum.GALLERY:
                        return (
                            <GalleryField
                                {...fieldProps}
                                value={fieldValue as GalleryImage[]}
                            />
                        );

                    case FieldTypeEnum.CHECKBOX:
                        return (
                            <CheckboxField
                                {...fieldProps}
                                value={fieldValue as boolean}
                            />
                        );

                    case FieldTypeEnum.SWITCH:
                        return (
                            <SwitchField
                                {...fieldProps}
                                value={fieldValue as boolean}
                            />
                        );

                    case FieldTypeEnum.NUMBER:
                        // Use TextField for numbers for now
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.DATE:
                        // Use TextField for dates for now
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    case FieldTypeEnum.TIME:
                        // Use TextField for time for now
                        return (
                            <TextField
                                {...fieldProps}
                                value={fieldValue as string}
                            />
                        );

                    default:
                        // Fallback for unknown field types
                        return (
                            <div className="space-y-2 border border-gray-300 p-4">
                                <div className="font-medium text-sm">{field.id}</div>
                                <div className="text-muted-foreground text-xs">
                                    Unknown field type: {field.type}
                                </div>
                            </div>
                        );
                }
            };

            return <div key={field.id}>{renderFieldComponent()}</div>;
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
                    // TODO [54a1a7d4-641b-4745-b780-2997eec523e6]: Implement tabs layout for nested sections
                    return <div className="space-y-4">{visibleFields.map(renderField)}</div>;

                // case 'ACCORDION':
                //     // TODO: Implement accordion layout for nested sections
                //     return <div className="space-y-4">{visibleFields.map(renderField)}</div>;

                default:
                    return <div className="space-y-4">{visibleFields.map(renderField)}</div>;
            }
        };

        // console.log('🔍 [EntityFormSection] isVisible:', isVisible);
        // console.log('🔍 [EntityFormSection] hasViewPermission:', hasViewPermission);
        // console.log('🔍 [EntityFormSection] visibleFields.length:', visibleFields.length);

        if (!isVisible) {
            // console.log('🔍 [EntityFormSection] Section not visible, returning null');
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

EntityFormSectionComponent.displayName = 'EntityFormSection';

/**
 * Memoized EntityFormSection component
 * Only re-renders when props actually change
 */
export const EntityFormSection = React.memo(EntityFormSectionComponent, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
        prevProps.config.id === nextProps.config.id &&
        prevProps.disabled === nextProps.disabled &&
        prevProps.className === nextProps.className &&
        // Deep comparison for values and errors would be expensive
        // Let React handle these with shallow comparison
        prevProps.values === nextProps.values &&
        prevProps.errors === nextProps.errors &&
        prevProps.onFieldChange === nextProps.onFieldChange &&
        prevProps.onFieldBlur === nextProps.onFieldBlur &&
        prevProps.userPermissions === nextProps.userPermissions &&
        prevProps.currentUser === nextProps.currentUser &&
        prevProps.entityData === nextProps.entityData
    );
});
