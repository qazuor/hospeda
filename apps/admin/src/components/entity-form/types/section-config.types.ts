import type { PermissionEnum } from '@repo/types';
import type { LayoutTypeEnum } from '../enums/form-config.enums';
import type { Actor, FieldConfig } from './field-config.types';

/**
 * Section configuration type
 */
export type SectionConfig = {
    id: string;
    title: string; // i18n key
    titleKey?: string; // alternative i18n key
    description?: string; // i18n key
    descriptionKey?: string; // alternative i18n key
    layout: LayoutTypeEnum;

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
