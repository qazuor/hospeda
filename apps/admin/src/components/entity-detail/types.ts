import type { ReactNode } from 'react';
import type { z } from 'zod';

/**
 * Layout types for configurable entity views
 */
export enum LayoutType {
    GRID = 'grid',
    TABS = 'tabs',
    SIDEBAR = 'sidebar',
    ACCORDION = 'accordion',
    FLEX = 'flex',
    CUSTOM = 'custom'
}

/**
 * Responsive breakpoints for layout configuration
 */
export type ResponsiveBreakpoints = {
    readonly mobile: number;
    readonly tablet: number;
    readonly desktop: number;
    readonly wide?: number;
};

/**
 * Grid layout configuration
 */
export type GridLayoutConfig = {
    readonly type: LayoutType.GRID;
    readonly columns: ResponsiveBreakpoints;
    readonly gap: {
        readonly x: number;
        readonly y: number;
    };
    readonly autoFit?: boolean;
    readonly minColumnWidth?: string;
};

/**
 * Tabs layout configuration
 */
export type TabsLayoutConfig = {
    readonly type: LayoutType.TABS;
    readonly orientation: 'horizontal' | 'vertical';
    readonly variant: 'default' | 'pills' | 'underline';
    readonly lazy?: boolean;
    readonly keepMounted?: boolean;
};

/**
 * Sidebar layout configuration
 */
export type SidebarLayoutConfig = {
    readonly type: LayoutType.SIDEBAR;
    readonly position: 'left' | 'right';
    readonly width: string;
    readonly collapsible?: boolean;
    readonly defaultCollapsed?: boolean;
    readonly breakpoint?: keyof ResponsiveBreakpoints;
};

/**
 * Accordion layout configuration
 */
export type AccordionLayoutConfig = {
    readonly type: LayoutType.ACCORDION;
    readonly allowMultiple?: boolean;
    readonly defaultExpanded?: readonly string[];
    readonly variant: 'default' | 'ghost' | 'separated';
};

/**
 * Flex layout configuration
 */
export type FlexLayoutConfig = {
    readonly type: LayoutType.FLEX;
    readonly direction: 'row' | 'column';
    readonly wrap?: boolean;
    readonly gap: number;
    readonly align?: 'start' | 'center' | 'end' | 'stretch';
    readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
};

/**
 * Custom layout configuration
 */
export type CustomLayoutConfig = {
    readonly type: LayoutType.CUSTOM;
    readonly component: string; // Component name to render
    readonly props?: Record<string, unknown>;
};

/**
 * Union type for all layout configurations
 */
export type LayoutConfig =
    | GridLayoutConfig
    | TabsLayoutConfig
    | SidebarLayoutConfig
    | AccordionLayoutConfig
    | FlexLayoutConfig
    | CustomLayoutConfig;

/**
 * Validation configuration for fields
 */
export type ValidationConfig = {
    readonly showInline?: boolean;
    readonly showSummary?: boolean;
    readonly debounceMs?: number;
    readonly validateOnChange?: boolean;
    readonly validateOnBlur?: boolean;
};

/**
 * Permission levels for field access control
 */
export enum PermissionLevel {
    HIDDEN = 'hidden',
    READ_ONLY = 'read_only',
    EDITABLE = 'editable',
    REQUIRED = 'required'
}

/**
 * Role-based permission configuration
 */
export type RolePermissions = {
    readonly [role: string]: PermissionLevel;
};

/**
 * Field permission configuration
 */
export type FieldPermissions = {
    readonly default: PermissionLevel;
    readonly roles?: RolePermissions;
    readonly conditions?: readonly {
        readonly field: string;
        readonly value: unknown;
        readonly operator: 'equals' | 'not-equals' | 'includes' | 'excludes';
        readonly permission: PermissionLevel;
    }[];
};

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
 * Enhanced form field configuration with advanced features
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
    readonly options?: readonly { value: string; label: string; disabled?: boolean }[];

    // File upload configuration
    readonly accept?: string;
    readonly multiple?: boolean;
    readonly maxSize?: number; // in bytes
    readonly maxFiles?: number;

    // Relation configuration
    readonly relationConfig?: {
        readonly endpoint: string;
        readonly displayField: string;
        readonly valueField: string;
        readonly searchable?: boolean;
        readonly preload?: boolean;
        readonly dependencies?: readonly string[]; // Other fields this depends on
    };

    // Conditional rendering
    readonly condition?: {
        readonly field: string;
        readonly value: unknown;
        readonly operator?: 'equals' | 'not-equals' | 'includes' | 'excludes';
    };

    // Layout configuration
    readonly colSpan?: 1 | 2 | 3 | 4;
    readonly rowSpan?: number;
    readonly breakpoints?: {
        readonly mobile?: number;
        readonly tablet?: number;
        readonly desktop?: number;
    };

    // Validation configuration
    readonly validation?: ValidationConfig;

    // Permissions
    readonly permissions?: FieldPermissions;

    // Styling and appearance
    readonly className?: string;
    readonly variant?: 'default' | 'ghost' | 'outline';
    readonly size?: 'sm' | 'md' | 'lg';

    // Advanced features
    readonly helpText?: string;
    readonly tooltip?: string;
    readonly icon?: string; // Icon name from @repo/icons
    readonly prefix?: string;
    readonly suffix?: string;
    readonly mask?: string; // Input mask pattern
    readonly debounceMs?: number; // For search/async validation

    // Custom renderer
    readonly customRenderer?: string; // Component name for custom rendering
    readonly rendererProps?: Record<string, unknown>;
};

/**
 * Enhanced form section configuration with layout support
 */
export type SectionConfig = {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly order: number;
    readonly collapsible?: boolean;
    readonly defaultExpanded?: boolean;

    // Layout configuration for this section
    readonly layout?: LayoutConfig;

    // Permissions for the entire section
    readonly permissions?: FieldPermissions;

    // Conditional rendering for sections
    readonly condition?: {
        readonly field: string;
        readonly value: unknown;
        readonly operator?: 'equals' | 'not-equals' | 'includes' | 'excludes';
    };

    // Styling and appearance
    readonly className?: string;
    readonly variant?: 'default' | 'card' | 'bordered' | 'ghost';
    readonly icon?: string; // Icon name from @repo/icons

    // Advanced features
    readonly helpText?: string;
    readonly badge?: {
        readonly text: string;
        readonly variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    };

    // Custom section renderer
    readonly customRenderer?: string; // Component name for custom section rendering
    readonly rendererProps?: Record<string, unknown>;
};

/**
 * Enhanced entity detail configuration with advanced layout and features
 */
export type EntityDetailConfig<TData = unknown, TEditData = unknown> = {
    // Metadata
    readonly name: string;
    readonly displayName: string;
    readonly pluralDisplayName: string;
    readonly description?: string;
    readonly icon?: string; // Icon name from @repo/icons

    // API endpoints
    readonly getEndpoint: string; // GET /api/v1/admin/accommodations/:id
    readonly createEndpoint?: string; // POST /api/v1/admin/accommodations
    readonly updateEndpoint: string; // PUT /api/v1/admin/accommodations/:id
    readonly deleteEndpoint?: string; // DELETE /api/v1/admin/accommodations/:id

    // Routes
    readonly basePath: string; // /accommodations
    readonly viewPath: string; // /accommodations/[slug]
    readonly editPath: string; // /accommodations/[slug]/edit
    readonly listPath?: string; // /accommodations

    // Schemas
    readonly detailSchema: z.ZodSchema<TData>;
    readonly editSchema: z.ZodSchema<TEditData>;

    // Form configuration
    readonly sections: readonly SectionConfig[];
    readonly fields: readonly FieldConfig[];

    // Main layout configuration for the entire entity view/edit
    readonly layout: LayoutConfig;

    // Permissions
    readonly permissions?: {
        readonly canView?: boolean;
        readonly canEdit?: boolean;
        readonly canDelete?: boolean;
        readonly canCreate?: boolean;
        readonly roles?: RolePermissions;
    };

    // Relations configuration
    readonly relations?: readonly {
        readonly key: string;
        readonly endpoint: string;
        readonly displayName: string;
        readonly type: 'one-to-one' | 'one-to-many' | 'many-to-many';
        readonly lazy?: boolean;
    }[];

    // Enhanced layout configuration
    readonly layoutConfig: {
        readonly showBreadcrumbs?: boolean;
        readonly showBackButton?: boolean;
        readonly showEditButton?: boolean;
        readonly showDeleteButton?: boolean;
        readonly showCreateButton?: boolean;
        readonly customActions?: readonly {
            readonly key: string;
            readonly label: string;
            readonly icon?: string;
            readonly variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
            readonly permissions?: FieldPermissions;
            readonly handler: string; // Function name to call
        }[];
    };

    // Validation configuration
    readonly validation?: ValidationConfig;

    // Performance optimizations
    readonly performance?: {
        readonly lazy?: boolean;
        readonly preload?: readonly string[]; // Fields to preload
        readonly cache?: {
            readonly ttl: number;
            readonly tags: readonly string[];
        };
    };

    // Accessibility configuration
    readonly accessibility?: {
        readonly announceChanges?: boolean;
        readonly focusManagement?: boolean;
        readonly keyboardNavigation?: boolean;
    };

    // Theming and styling
    readonly theme?: {
        readonly variant?: 'default' | 'compact' | 'comfortable';
        readonly colorScheme?: 'light' | 'dark' | 'auto';
        readonly customStyles?: Record<string, string>;
    };
};

/**
 * Field renderer context for custom field components
 */
export type FieldRendererContext<TData = unknown> = {
    readonly field: FieldConfig;
    readonly value: unknown;
    readonly onChange: (value: unknown) => void;
    readonly onBlur: () => void;
    readonly error?: string;
    readonly isLoading?: boolean;
    readonly isDisabled?: boolean;
    readonly formData: TData;
    readonly mode: 'view' | 'edit';
};

/**
 * Section renderer context for custom section components
 */
export type SectionRendererContext<TData = unknown> = {
    readonly section: SectionConfig;
    readonly fields: readonly FieldConfig[];
    readonly formData: TData;
    readonly mode: 'view' | 'edit';
    readonly children: ReactNode;
};

/**
 * Layout renderer context for custom layout components
 */
export type LayoutRendererContext<TData = unknown> = {
    readonly layout: LayoutConfig;
    readonly sections: readonly SectionConfig[];
    readonly formData: TData;
    readonly mode: 'view' | 'edit';
    readonly children: ReactNode;
};

/**
 * Field renderer registry for dynamic component resolution
 */
export type FieldRendererRegistry = {
    readonly [fieldType in FieldType]: React.ComponentType<FieldRendererContext>;
} & {
    readonly [customRenderer: string]: React.ComponentType<FieldRendererContext>;
};

/**
 * Section renderer registry for dynamic component resolution
 */
export type SectionRendererRegistry = {
    readonly [renderer: string]: React.ComponentType<SectionRendererContext>;
};

/**
 * Layout renderer registry for dynamic component resolution
 */
export type LayoutRendererRegistry = {
    readonly [layoutType in LayoutType]: React.ComponentType<LayoutRendererContext>;
} & {
    readonly [customRenderer: string]: React.ComponentType<LayoutRendererContext>;
};

/**
 * Complete renderer registry for the entity system
 */
export type EntityRendererRegistry = {
    readonly fields: FieldRendererRegistry;
    readonly sections: SectionRendererRegistry;
    readonly layouts: LayoutRendererRegistry;
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

/**
 * Entity configuration factory options
 */
export type EntityConfigFactoryOptions<TData = unknown, TEditData = unknown> = {
    readonly config: EntityDetailConfig<TData, TEditData>;
    readonly renderers?: Partial<EntityRendererRegistry>;
    readonly middleware?: readonly {
        readonly name: string;
        readonly handler: (context: FieldRendererContext<TData>) => FieldRendererContext<TData>;
    }[];
};
