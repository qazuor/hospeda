import type { ReactNode } from 'react';
import type { z } from 'zod';

/**
 * Field types for forms using React Form Toolkit
 */
export enum FieldType {
    TEXT = 'text',
    TEXTAREA = 'textarea',
    NUMBER = 'number',
    EMAIL = 'email',
    PASSWORD = 'password',
    DATE = 'date',
    BOOLEAN = 'boolean',
    SELECT = 'select',
    MULTISELECT = 'multiselect',
    FILE = 'file',
    RELATION = 'relation'
}

/**
 * Form field configuration for React Form Toolkit
 */
export type FieldConfig = {
    readonly name: string;
    readonly label: string;
    readonly type: FieldType;
    readonly required?: boolean;
    readonly placeholder?: string;
    readonly description?: string;
    readonly section?: string;
    readonly order?: number;

    // Select/Multiselect options
    readonly options?: readonly { value: string; label: string }[];

    // File upload configuration
    readonly accept?: string;
    readonly multiple?: boolean;

    // Relation configuration
    readonly relationConfig?: {
        readonly endpoint: string;
        readonly displayField: string;
        readonly valueField: string;
        readonly searchable?: boolean;
    };

    // Conditional rendering
    readonly condition?: {
        readonly field: string;
        readonly value: unknown;
        readonly operator?: 'equals' | 'not-equals' | 'includes';
    };

    // Grid layout
    readonly colSpan?: 1 | 2;
};

/**
 * Form section configuration
 */
export type SectionConfig = {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly order: number;
    readonly collapsible?: boolean;
    readonly defaultExpanded?: boolean;
};

/**
 * Entity detail configuration
 */
export type EntityDetailConfig<TData = unknown, TEditData = unknown> = {
    // Metadata
    readonly name: string;
    readonly displayName: string;
    readonly pluralDisplayName: string;

    // API endpoints
    readonly getEndpoint: string; // GET /api/v1/admin/accommodations/:id
    readonly createEndpoint?: string; // POST /api/v1/admin/accommodations
    readonly updateEndpoint: string; // PUT /api/v1/admin/accommodations/:id
    readonly deleteEndpoint?: string; // DELETE /api/v1/admin/accommodations/:id

    // Routes
    readonly basePath: string; // /accommodations
    readonly viewPath: string; // /accommodations/[slug]
    readonly editPath: string; // /accommodations/[slug]/edit

    // Schemas
    readonly detailSchema: z.ZodSchema<TData>;
    readonly editSchema: z.ZodSchema<TEditData>;

    // Form configuration
    readonly sections: readonly SectionConfig[];
    readonly fields: readonly FieldConfig[];

    // Permissions
    readonly permissions?: {
        readonly canView?: boolean;
        readonly canEdit?: boolean;
        readonly canDelete?: boolean;
    };

    // Relations configuration
    readonly relations?: readonly {
        readonly key: string;
        readonly endpoint: string;
        readonly displayName: string;
    }[];

    // Layout configuration
    readonly layoutConfig: {
        readonly showBreadcrumbs?: boolean;
        readonly showBackButton?: boolean;
        readonly showEditButton?: boolean;
        readonly showDeleteButton?: boolean;
    };
};

/**
 * Generated entity detail components
 */
export type EntityDetailComponents = {
    readonly viewComponent: () => ReactNode;
    readonly editComponent: () => ReactNode;
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
    readonly viewRoute: any;
    // biome-ignore lint/suspicious/noExplicitAny: TanStack Router type compatibility
    readonly editRoute: any;
};
