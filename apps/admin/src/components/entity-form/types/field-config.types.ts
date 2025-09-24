import type { PermissionEnum } from '@repo/schemas';
import type { ZodSchema } from 'zod';
import type {
    EntityTypeEnum,
    FieldTypeEnum,
    RichTextFeatureEnum,
    ValidationTriggerEnum
} from '../enums/form-config.enums';

/**
 * Actor type for permission checks
 */
export type Actor = {
    id: string;
    role: string;
    permissions: PermissionEnum[];
};

/**
 * Base option type for selects and other choice fields
 */
export type SelectOption = {
    value: string;
    label: string;
    labelKey?: string; // i18n key
    description?: string;
    descriptionKey?: string; // i18n key
    disabled?: boolean;
    metadata?: Record<string, unknown>;
};

/**
 * Async validation configuration
 */
export type AsyncValidationConfig = {
    validator: AsyncValidatorFn;
    trigger: ValidationTriggerEnum;
    debounceMs?: number;
    errorMessageKey?: string; // i18n key for error message
};

/**
 * Async validator function type
 */
export type AsyncValidatorFn = (value: unknown, context?: ValidationContext) => Promise<boolean>;

/**
 * Context provided to async validators
 */
export type ValidationContext = {
    entityId?: string;
    entityType?: string;
    fieldPath?: string;
    formData?: Record<string, unknown>;
    actor?: Actor;
};

/**
 * Derived field configuration for computed/auto-updated fields
 */
export type DerivedFieldConfig = {
    targetField: string;
    deriveFn: (sourceValue: unknown, formData: Record<string, unknown>) => unknown;
    triggerOn?: string[]; // Fields that trigger this derivation
    debounceMs?: number;
    condition?: (formData: Record<string, unknown>) => boolean; // Only derive if condition is true
};

/**
 * Configuration for different field types
 */
export type FieldTypeConfig =
    | TextFieldConfig
    | TextareaFieldConfig
    | SelectFieldConfig
    | EntitySelectFieldConfig
    | CurrencyFieldConfig
    | RichTextFieldConfig
    | ImageFieldConfig
    | GalleryFieldConfig
    | NumberFieldConfig
    | DateFieldConfig
    | TimeFieldConfig
    | SliderFieldConfig
    | SwitchFieldConfig
    | JsonFieldConfig
    // Specific entity select configurations
    | DestinationSelectFieldConfig
    | UserSelectFieldConfig
    | AccommodationSelectFieldConfig
    | EventSelectFieldConfig
    | PostSelectFieldConfig
    | FeatureSelectFieldConfig
    | AmenitySelectFieldConfig
    | TagSelectFieldConfig;

/**
 * Text field specific configuration
 */
export type TextFieldConfig = {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    autocomplete?: string;
};

/**
 * Textarea field specific configuration
 */
export type TextareaFieldConfig = {
    minLength?: number;
    maxLength?: number;
    minRows?: number;
    maxRows?: number;
    resize?: boolean;
};

/**
 * Select field specific configuration
 */
export type SelectFieldConfig = {
    options: SelectOption[];
    searchable?: boolean;
    clearable?: boolean;
    multiple?: boolean;
};

/**
 * Entity select field specific configuration
 */
export type EntitySelectFieldConfig = {
    entityType: EntityTypeEnum;
    searchFn: (query: string) => Promise<SelectOption[]>;
    loadByIdsFn: (ids: string[]) => Promise<SelectOption[]>;
    allowCreate?: boolean; // For future modal creation
    createModalConfig?: CreateModalConfig; // For future implementation
    multiple?: boolean;
    searchable?: boolean;
    clearable?: boolean;
    minSearchLength?: number;
    searchDebounceMs?: number;
    // New options for client vs server search
    searchMode?: 'client' | 'server'; // Default: 'server'
    loadAllFn?: () => Promise<SelectOption[]>; // For client-side search
    showAllWhenEmpty?: boolean; // Show all options when no search query
};

/**
 * Currency field specific configuration
 */
export type CurrencyFieldConfig = {
    defaultCurrency?: string; // CurrencyEnum value
    allowedCurrencies?: string[]; // CurrencyEnum values
    showCurrencySymbol?: boolean;
    precision?: number;
    min?: number;
    max?: number;
};

/**
 * Rich text field specific configuration
 */
export type RichTextFieldConfig = {
    type: 'RICH_TEXT';
    allowedFeatures?: RichTextFeatureEnum[];
    maxLength?: number;
    minLength?: number;
    placeholder?: string;
    placeholderKey?: string; // i18n key
};

/**
 * Image field specific configuration
 */
export type ImageFieldConfig = {
    type: 'IMAGE';
    maxSize?: number; // in bytes
    allowedTypes?: string[]; // MIME types
    maxWidth?: number;
    maxHeight?: number;
    aspectRatio?: string; // e.g., "16:9", "1:1"
    quality?: number; // 0-1
};

/**
 * Gallery field specific configuration
 */
export type GalleryFieldConfig = {
    type: 'GALLERY';
    maxImages?: number;
    maxSize?: number; // in bytes per image
    allowedTypes?: string[]; // MIME types
    maxWidth?: number;
    maxHeight?: number;
    sortable?: boolean;
};

/**
 * Number field specific configuration
 */
export type NumberFieldConfig = {
    type: 'NUMBER';
    min?: number;
    max?: number;
    step?: number;
    precision?: number; // decimal places
};

/**
 * Date field specific configuration
 */
export type DateFieldConfig = {
    type: 'DATE';
    minDate?: string | Date;
    maxDate?: string | Date;
    format?: string;
    showTime?: boolean;
};

/**
 * Time field specific configuration
 */
export type TimeFieldConfig = {
    type: 'TIME';
    format?: '12h' | '24h';
    step?: number; // minutes
};

/**
 * Slider field specific configuration
 */
export type SliderFieldConfig = {
    type: 'SLIDER';
    min: number;
    max: number;
    step?: number;
    marks?: Array<{ value: number; label: string }>;
    range?: boolean; // for range slider
};

/**
 * Switch field specific configuration
 */
export type SwitchFieldConfig = {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
    disabled?: boolean;
};

/**
 * JSON field specific configuration
 */
export type JsonFieldConfig = {
    schema?: ZodSchema; // Zod schema for validation
    pretty?: boolean; // Pretty print JSON
    height?: number; // Editor height in pixels
};

/**
 * Base configuration for specific entity select fields
 */
export type BaseEntitySelectFieldConfig = {
    multiple?: boolean;
    searchMode?: 'client' | 'server';
    clearable?: boolean;
    minCharToSearch?: number; // Default: 3
    searchDebounce?: number; // Default: 300ms
    showAvatar?: boolean; // Default: false
    itemClassName?: string; // Default: null
};

/**
 * Destination select field specific configuration
 */
export type DestinationSelectFieldConfig = BaseEntitySelectFieldConfig;

/**
 * User select field specific configuration
 */
export type UserSelectFieldConfig = BaseEntitySelectFieldConfig & {
    roleFilter?: string[]; // Filter by specific roles
    statusFilter?: string[]; // Filter by user status
};

/**
 * Accommodation select field specific configuration
 */
export type AccommodationSelectFieldConfig = BaseEntitySelectFieldConfig & {
    typeFilter?: string[]; // Filter by accommodation type
    statusFilter?: string[]; // Filter by accommodation status
};

/**
 * Event select field specific configuration
 */
export type EventSelectFieldConfig = BaseEntitySelectFieldConfig & {
    statusFilter?: string[]; // Filter by event status
    dateRange?: { from?: Date; to?: Date }; // Filter by date range
};

/**
 * Post select field specific configuration
 */
export type PostSelectFieldConfig = BaseEntitySelectFieldConfig & {
    statusFilter?: string[]; // Filter by post status
    categoryFilter?: string[]; // Filter by category
};

/**
 * Feature select field specific configuration
 */
export type FeatureSelectFieldConfig = BaseEntitySelectFieldConfig & {
    categoryFilter?: string[]; // Filter by feature category
};

/**
 * Amenity select field specific configuration
 */
export type AmenitySelectFieldConfig = BaseEntitySelectFieldConfig & {
    categoryFilter?: string[]; // Filter by amenity category
};

/**
 * Tag select field specific configuration
 */
export type TagSelectFieldConfig = BaseEntitySelectFieldConfig & {
    categoryFilter?: string[]; // Filter by tag category
};

/**
 * Create modal configuration (for future implementation)
 */
export type CreateModalConfig = {
    title: string;
    titleKey?: string; // i18n key
    fields: FieldConfig[];
    onSubmit: (data: Record<string, unknown>) => Promise<SelectOption>;
};

/**
 * Main field configuration type
 */
export type FieldConfig = {
    id: string;
    type: FieldTypeEnum;
    required?: boolean;
    readonly?: boolean;
    hidden?: boolean;

    // Modes where this field should appear
    modes?: ('view' | 'edit')[];
    viewOnly?: boolean;
    editOnly?: boolean;

    // Direct translations (explicit control)
    label?: string;
    description?: string;
    placeholder?: string;
    help?: string;
    title?: string;

    // Schema validation (extracted from main entity schema)
    schema?: ZodSchema;

    // Permissions (hybrid approach)
    permissions?: {
        view?: PermissionEnum[];
        edit?: PermissionEnum[];
    };
    visibleIf?: (actor: Actor, entity?: unknown) => boolean;
    editableIf?: (actor: Actor, entity?: unknown) => boolean;

    // Async validation
    asyncValidation?: AsyncValidationConfig;

    // Field relationships and computed values
    derivedFields?: DerivedFieldConfig[];
    computedValue?: (formData: Record<string, unknown>) => unknown;

    // Type-specific configuration
    config?: FieldTypeConfig;

    // Styling
    className?: string;

    // Edit in place (for view mode)
    editInPlace?: boolean;

    // Nested fields (for SECTION type)
    fields?: FieldConfig[];

    // Repeatable section configuration
    repeatable?: boolean;
    maxItems?: number;
    minItems?: number;

    // Default value
    defaultValue?: unknown;

    // Help text
    helpText?: string;
    helpTextKey?: string; // i18n key

    // Type-specific configuration
    typeConfig?: FieldTypeConfig;
};
