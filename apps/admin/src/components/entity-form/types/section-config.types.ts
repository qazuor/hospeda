import type { PermissionEnum } from '@repo/schemas';
import type * as React from 'react';
import type { LayoutTypeEnum } from '../enums/form-config.enums';
import type { FieldConfig } from './field-config.types';

/**
 * Section configuration type
 */
export type SectionConfig = {
    id: string;

    /**
     * Optional custom render function that bypasses the standard field-grid
     * renderer entirely. When provided, the section is rendered by calling
     * this function and the `fields` array is ignored by `EntityViewContent`.
     *
     * Used for non-standard sections such as `stats-chips` (SPEC-197 T-016)
     * that inject a React component rather than a field list.
     *
     * The section is still subject to permission filtering via
     * `section.permissions.view` / `section.permissions.edit`.
     */
    customRender?: () => React.ReactNode;

    // Direct translations (explicit control)
    title?: string;
    description?: string;

    layout: LayoutTypeEnum;

    // Modes where this section should appear
    modes?: ('view' | 'edit' | 'create')[];

    // UI elements
    icon?: React.ReactNode;
    badge?: React.ReactNode;

    // Section-level permissions
    permissions?: {
        view?: PermissionEnum[];
        edit?: PermissionEnum[];
    };
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

    // Entitlement gating (for premium features)
    entitlementKey?: string;
};
