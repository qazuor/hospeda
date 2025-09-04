import type { PermissionEnum } from '@repo/types';
import type * as React from 'react';
import type { LayoutTypeEnum } from '../enums/form-config.enums';
import type { Actor, FieldConfig } from './field-config.types';

/**
 * Section configuration type
 */
export type SectionConfig = {
    id: string;

    // Direct translations (explicit control)
    title?: string;
    description?: string;

    layout: LayoutTypeEnum;

    // Modes where this section should appear
    modes?: ('view' | 'edit')[];

    // UI elements
    icon?: React.ReactNode;
    badge?: React.ReactNode;

    // Section-level permissions
    permissions?: {
        view?: PermissionEnum[];
        edit?: PermissionEnum[];
    };
    visibleIf?: (actor: Actor, entity?: unknown) => boolean;
    editableIf?: (actor: Actor, entity?: unknown) => boolean;

    // Fields in this section
    fields: FieldConfig[];

    // Nested sections (for complex layouts)
    sections?: SectionConfig[];

    // Repeatable section (for arrays)
    repeatable?: boolean;
    maxItems?: number;
    minItems?: number;

    // Section styling
    className?: string;

    // Collapsible section
    collapsible?: boolean;
    defaultCollapsed?: boolean;

    // Section ordering/priority
    order?: number;

    // Conditional rendering
    showIf?: (formData: Record<string, unknown>) => boolean;

    // Section validation (cross-field validation)
    sectionValidation?: {
        validator: (sectionData: Record<string, unknown>) => Promise<boolean> | boolean;
        errorMessageKey: string; // i18n key
    };
};
