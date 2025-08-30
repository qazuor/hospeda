import type { PermissionEnum } from '@repo/types';
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
 * i18n configuration for fields
 */
export type I18nFieldConfig = {
    labelKey?: string;
    descriptionKey?: string;
    placeholderKey?: string;
    errorMessages?: Record<string, string>; // error key -> i18n key
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
    | JsonFieldConfig;

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
    min?: number;
    max?: number;
    step?: number;
    precision?: number; // decimal places
};

/**
 * Date field specific configuration
 */
export type DateFieldConfig = {
    minDate?: string | Date;
    maxDate?: string | Date;
    format?: string;
    showTime?: boolean;
};

/**
 * Time field specific configuration
 */
export type TimeFieldConfig = {
    format?: '12h' | '24h';
    step?: number; // minutes
};

/**
 * Slider field specific configuration
 */
export type SliderFieldConfig = {
    min: number;
    max: number;
    step?: number;
    marks?: Array<{ value: number; label: string }>;
    range?: boolean; // for range slider
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

    // i18n configuration
    i18n?: I18nFieldConfig;

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
};
