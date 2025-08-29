/**
 * @file FieldRenderer Component
 *
 * Dynamic field renderer that selects the appropriate component based on field type
 * and configuration. Supports both view and edit modes with validation and permissions.
 */

import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import { memo, useMemo } from 'react';
import type { FieldConfig, FieldRendererContext } from '../types';
import { FieldType, PermissionLevel } from '../types';
import {
    BooleanFieldRenderer,
    DateFieldRenderer,
    EmailFieldRenderer,
    FileFieldRenderer,
    MultiselectFieldRenderer,
    NumberFieldRenderer,
    PasswordFieldRenderer,
    RelationFieldRenderer,
    SelectFieldRenderer,
    TextAreaFieldRenderer,
    TextFieldRenderer
} from './renderers';

/**
 * Props for the FieldRenderer component
 */
type FieldRendererProps<TData = unknown> = {
    readonly field: FieldConfig;
    readonly value: unknown;
    readonly onChange: (value: unknown) => void;
    readonly onBlur: () => void;
    readonly error?: string;
    readonly isLoading?: boolean;
    readonly isDisabled?: boolean;
    readonly formData: TData;
    readonly mode: 'view' | 'edit';
    readonly className?: string;
    readonly customRenderers?: Record<string, React.ComponentType<FieldRendererContext<TData>>>;
    readonly userRoles?: readonly string[];
};

/**
 * Default field renderer registry
 */
const defaultFieldRenderers = {
    [FieldType.TEXT]: TextFieldRenderer,
    [FieldType.TEXTAREA]: TextAreaFieldRenderer,
    [FieldType.NUMBER]: NumberFieldRenderer,
    [FieldType.EMAIL]: EmailFieldRenderer,
    [FieldType.PASSWORD]: PasswordFieldRenderer,
    [FieldType.DATE]: DateFieldRenderer,
    [FieldType.BOOLEAN]: BooleanFieldRenderer,
    [FieldType.SELECT]: SelectFieldRenderer,
    [FieldType.MULTISELECT]: MultiselectFieldRenderer,
    [FieldType.FILE]: FileFieldRenderer,
    [FieldType.RELATION]: RelationFieldRenderer
} as const;

/**
 * Hook to determine field permission level based on user roles and conditions
 */
const useFieldPermission = <TData,>(
    field: FieldConfig,
    formData: TData,
    userRoles: readonly string[] = []
): PermissionLevel => {
    return useMemo(() => {
        if (!field.permissions) {
            return field.required ? PermissionLevel.REQUIRED : PermissionLevel.EDITABLE;
        }

        // Check role-based permissions
        if (field.permissions.roles) {
            for (const role of userRoles) {
                if (field.permissions.roles[role]) {
                    return field.permissions.roles[role];
                }
            }
        }

        // Check conditional permissions
        if (field.permissions.conditions) {
            for (const condition of field.permissions.conditions) {
                const fieldValue = (formData as Record<string, unknown>)[condition.field];
                let matches = false;

                switch (condition.operator) {
                    case 'equals':
                        matches = fieldValue === condition.value;
                        break;
                    case 'not-equals':
                        matches = fieldValue !== condition.value;
                        break;
                    case 'includes':
                        matches = Array.isArray(fieldValue) && fieldValue.includes(condition.value);
                        break;
                    case 'excludes':
                        matches =
                            Array.isArray(fieldValue) && !fieldValue.includes(condition.value);
                        break;
                }

                if (matches) {
                    return condition.permission;
                }
            }
        }

        return field.permissions.default;
    }, [field, formData, userRoles]);
};

/**
 * Hook to check if field should be rendered based on conditions
 */
const useFieldVisibility = <TData,>(field: FieldConfig, formData: TData): boolean => {
    return useMemo(() => {
        if (!field.condition) {
            return true;
        }

        const fieldValue = (formData as Record<string, unknown>)[field.condition.field];
        const operator = field.condition.operator || 'equals';

        switch (operator) {
            case 'equals':
                return fieldValue === field.condition.value;
            case 'not-equals':
                return fieldValue !== field.condition.value;
            case 'includes':
                return Array.isArray(fieldValue) && fieldValue.includes(field.condition.value);
            case 'excludes':
                return Array.isArray(fieldValue) && !fieldValue.includes(field.condition.value);
            default:
                return true;
        }
    }, [field, formData]);
};

/**
 * FieldRenderer component that dynamically renders fields based on configuration
 */
export const FieldRenderer = memo(
    <TData = unknown>({
        field,
        value,
        onChange,
        onBlur,
        error,
        isLoading = false,
        isDisabled = false,
        formData,
        mode,
        className,
        customRenderers = {},
        userRoles = []
    }: FieldRendererProps<TData>) => {
        // Check field visibility
        const isVisible = useFieldVisibility(field, formData);

        // Check field permissions
        const permission = useFieldPermission(field, formData, userRoles);

        // Don't render if hidden
        if (!isVisible || permission === PermissionLevel.HIDDEN) {
            return null;
        }

        // Determine if field should be disabled
        const fieldDisabled =
            isDisabled ||
            permission === PermissionLevel.READ_ONLY ||
            (mode === 'view' && permission !== PermissionLevel.EDITABLE);

        /**
         * Resolve the appropriate field renderer
         */
        const FieldRendererComponent = useMemo(() => {
            // Check for custom renderer first
            if (field.customRenderer) {
                const customRenderer = customRenderers[field.customRenderer];
                if (customRenderer) {
                    return customRenderer;
                }

                adminLogger.error(
                    `Custom field renderer "${field.customRenderer}" not found for field "${field.name}". Falling back to default renderer.`
                );
            }

            // Use default renderer
            const renderer = defaultFieldRenderers[field.type];
            if (!renderer) {
                adminLogger.error(
                    `Field renderer for type "${field.type}" not found for field "${field.name}". Falling back to text renderer.`
                );
                return TextFieldRenderer;
            }

            return renderer;
        }, [field, customRenderers]);

        /**
         * Create the renderer context
         */
        const context: FieldRendererContext<TData> = useMemo(
            () => ({
                field,
                value,
                onChange,
                onBlur,
                error,
                isLoading,
                isDisabled: fieldDisabled,
                formData,
                mode
            }),
            [field, value, onChange, onBlur, error, isLoading, fieldDisabled, formData, mode]
        );

        return (
            <div
                className={cn(
                    'field-renderer',
                    `field-${field.type}`,
                    `field-${field.name}`,
                    `mode-${mode}`,
                    `permission-${permission}`,
                    field.className,
                    className
                )}
                data-field-name={field.name}
                data-field-type={field.type}
                data-mode={mode}
                data-permission={permission}
            >
                <FieldRendererComponent {...context} />
            </div>
        );
    }
);

FieldRenderer.displayName = 'FieldRenderer';

/**
 * Utility function to validate field configuration
 */
export const validateFieldConfig = (field: FieldConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Basic validation
    if (!field.name) {
        errors.push('Field name is required');
    }
    if (!field.label) {
        errors.push('Field label is required');
    }
    if (!field.type) {
        errors.push('Field type is required');
    }

    // Type-specific validation
    switch (field.type) {
        case FieldType.SELECT:
        case FieldType.MULTISELECT:
            if (!field.options || field.options.length === 0) {
                errors.push(`${field.type} field requires options`);
            }
            break;
        case FieldType.RELATION:
            if (field.relationConfig) {
                if (!field.relationConfig.endpoint) {
                    errors.push('Relation field requires endpoint');
                }
                if (!field.relationConfig.displayField) {
                    errors.push('Relation field requires displayField');
                }
                if (!field.relationConfig.valueField) {
                    errors.push('Relation field requires valueField');
                }
            } else {
                errors.push('Relation field requires relationConfig');
            }
            break;
        case FieldType.FILE:
            if (field.multiple && field.maxFiles && field.maxFiles < 2) {
                errors.push('Multiple file field should have maxFiles >= 2');
            }
            break;
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};
