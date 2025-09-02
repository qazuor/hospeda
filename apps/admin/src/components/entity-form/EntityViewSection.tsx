import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { CurrencyValue } from '@/components/entity-form/fields/CurrencyField';
import type { GalleryImage } from '@/components/entity-form/fields/GalleryField';
import type { ImageValue } from '@/components/entity-form/fields/ImageField';
import { GridLayout } from '@/components/entity-form/layouts';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import {
    BooleanViewField,
    CurrencyViewField,
    EntitySelectViewField,
    GalleryViewField,
    ImageViewField,
    RichTextViewField,
    SelectViewField,
    TextViewField
} from '@/components/entity-form/views';
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
    mode?: 'card' | 'list' | 'compact' | 'detailed';
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
            const result =
                !config.permissions?.view || config.permissions.view.length === 0
                    ? true
                    : config.permissions.view.some((permission) =>
                          userPermissions.includes(permission)
                      );

            // // biome-ignore lint/suspicious/noConsoleLog: Debug logging
            // console.log('🔍 [EntityViewSection] Section permissions check:', {
            //     sectionId: config.id,
            //     requiredPermissions: config.permissions?.view,
            //     userPermissions,
            //     hasViewPermission: result
            // });

            return result;
        }, [config.permissions, userPermissions]);

        const hasEditPermission = React.useMemo(() => {
            if (!config.permissions?.edit || config.permissions.edit.length === 0) return false;
            return config.permissions.edit.some((permission) =>
                userPermissions.includes(permission)
            );
        }, [config.permissions, userPermissions]);

        // Check visibility conditions
        const isVisible = React.useMemo(() => {
            const result = config.visibleIf ? hasViewPermission : hasViewPermission;

            // TODO [983f0e48-fd2b-416c-beb7-9ce0c18842bc]: Implement predicate evaluation
            // For now, just check permissions
            return result;
        }, [config.visibleIf, hasViewPermission]);

        // Filter visible and accessible fields
        const visibleFields = React.useMemo(() => {
            const filtered = config.fields.filter((field) => {
                // Check field permissions
                if (field.permissions?.view && field.permissions.view.length > 0) {
                    const hasFieldPermission = field.permissions.view.some((permission) =>
                        userPermissions.includes(permission)
                    );
                    if (!hasFieldPermission) {
                        // // biome-ignore lint/suspicious/noConsoleLog: Debug logging
                        // console.log(
                        //     `🔍 [EntityViewSection] Field ${field.id} hidden - no permission`
                        // );
                        return false;
                    }
                }

                // Check if field has value or if we should show empty fields
                // Support nested field access (e.g., 'location.city' -> values.location.city)
                // biome-ignore lint/suspicious/noExplicitAny: Dynamic nested object access
                const getNestedValue = (obj: any, path: string): any => {
                    return path.split('.').reduce((current, key) => current?.[key], obj);
                };

                const fieldValue = field.id.includes('.')
                    ? getNestedValue(values, field.id)
                    : values[field.id];
                const hasValue =
                    fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

                if (!hasValue && !showEmptyFields) {
                    return false;
                }

                // // biome-ignore lint/suspicious/noConsoleLog: Debug logging
                // console.log(
                //     `🔍 [EntityViewSection] Field ${field.id} visible - value:`,
                //     fieldValue
                // );

                // TODO [9583bd8d-bfd3-428f-a99a-3ec2f527021b]: Check field visibility conditions
                // For now, show all permitted fields
                return true;
            });

            // // biome-ignore lint/suspicious/noConsoleLog: Debug logging
            // console.log('🔍 [EntityViewSection] Visible fields:', {
            //     sectionId: config.id,
            //     totalFields: config.fields.length,
            //     visibleFields: filtered.length,
            //     fieldIds: filtered.map((f) => f.id)
            // });

            return filtered;
        }, [config.fields, userPermissions, values, showEmptyFields]);

        // Dynamic view field component loading based on field type
        const renderViewField = (field: SectionConfig['fields'][0]) => {
            // Support nested field access (e.g., 'location.city' -> values.location.city)
            // biome-ignore lint/suspicious/noExplicitAny: Dynamic nested object access
            const getNestedValue = (obj: any, path: string): any => {
                return path.split('.').reduce((current, key) => current?.[key], obj);
            };

            const fieldValue = field.id.includes('.')
                ? getNestedValue(values, field.id)
                : values[field.id];

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

            // Common field props - value type will be cast per component
            const baseFieldProps = {
                config: field,
                className: field.className,
                showLabel: mode !== 'compact',
                showDescription: mode === 'detailed' || mode === 'card'
            };

            // Render appropriate view component based on field type
            switch (field.type) {
                case FieldTypeEnum.TEXT:
                case FieldTypeEnum.EMAIL:
                case FieldTypeEnum.URL:
                case FieldTypeEnum.TEXTAREA:
                    return (
                        <TextViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as string}
                        />
                    );

                case FieldTypeEnum.SELECT:
                case FieldTypeEnum.RADIO:
                    return (
                        <SelectViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as string}
                            options={
                                field.typeConfig?.type === 'SELECT'
                                    ? field.typeConfig.options || []
                                    : []
                            }
                        />
                    );

                case FieldTypeEnum.SWITCH:
                case FieldTypeEnum.CHECKBOX:
                    return (
                        <BooleanViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as boolean}
                        />
                    );

                case FieldTypeEnum.ENTITY_SELECT:
                    return (
                        <EntitySelectViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as string}
                        />
                    );

                case FieldTypeEnum.CURRENCY:
                    return (
                        <CurrencyViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as CurrencyValue}
                        />
                    );

                case FieldTypeEnum.RICH_TEXT:
                    return (
                        <RichTextViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as string}
                        />
                    );

                case FieldTypeEnum.IMAGE:
                    return (
                        <ImageViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as ImageValue}
                        />
                    );

                case FieldTypeEnum.GALLERY:
                    return (
                        <GalleryViewField
                            key={field.id}
                            {...baseFieldProps}
                            value={fieldValue as GalleryImage[]}
                        />
                    );

                default:
                    // Fallback for unknown field types
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
                                            <span className="text-muted-foreground italic">
                                                No value
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground text-xs">
                                        Unknown type: {field.type}
                                    </div>
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
            }
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
