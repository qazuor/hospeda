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
    | CoordinatesFieldConfig
    | ImageFieldConfig
    | GalleryFieldConfig
    | VideoGalleryFieldConfig
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
    | EventLocationSelectFieldConfig
    | EventOrganizerSelectFieldConfig
    | PostSelectFieldConfig
    | PostSponsorshipSelectFieldConfig
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
 * Coordinates field specific configuration.
 *
 * The COORDINATES field renders a draggable Leaflet marker over OSM tiles
 * plus inline lat/long inputs. Value shape mirrors
 * `@repo/schemas#CoordinatesSchema`: `{ lat: string, long: string }`
 * (strings so values round-trip cleanly through the JSONB column).
 */
export type CoordinatesFieldConfig = {
    type: 'COORDINATES';
    /**
     * Map zoom when the field renders an existing point. Default 15.
     */
    defaultZoom?: number;
    /**
     * Map zoom when the field is empty and falls back to the default centre.
     * Default 12 (broader view to invite the user to drop a pin).
     */
    fallbackZoom?: number;
    /**
     * Hard-coded fallback centre when no value and no destination context
     * is provided. Defaults to Concepción del Uruguay
     * (lat -32.4825, long -58.2372).
     */
    fallbackCenter?: { lat: number; lng: number };
    /**
     * Optional tile URL — overrides the OSM default. Useful if we swap
     * provider later without changing the field.
     */
    tileUrl?: string;
    /** Optional tile attribution text. */
    tileAttribution?: string;
    /**
     * Sibling field ids that participate in geocoding. When provided the
     * field renders two buttons:
     *  - "Locate from address" reads `street` (+ optional `number`,
     *    `cityContext`) from the form state, forward-geocodes via Nominatim
     *    and updates the coordinates.
     *  - "Fill address from map" reverse-geocodes the current coordinates
     *    and writes the resolved `street` / `number` back into the sibling
     *    fields when they are empty.
     *
     * All ids are dot-notation paths (e.g. `location.street`). Omit to
     * hide the geocoding controls entirely.
     */
    addressFields?: {
        street?: string;
        number?: string;
        /**
         * Optional read-only field id whose value seeds the forward-geocode
         * query with city context (e.g. the projected `cityDestination.name`).
         */
        cityContext?: string;
    };
    /**
     * Two-letter country codes to scope Nominatim forward search.
     * Defaults to `['ar']` for the Hospeda Argentina use case.
     */
    geocodingCountryCodes?: string[];
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
 * Video gallery field specific configuration.
 *
 * URL-only multi-entry field that persists to `media.videos[]`. No file
 * upload, no drag-and-drop reorder — videos are appended in input order.
 */
export type VideoGalleryFieldConfig = {
    type: 'VIDEO_GALLERY';
    /** Maximum number of video entries allowed. Soft cap (no UI block yet). */
    maxVideos?: number;
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
 * Event location select field configuration
 */
export type EventLocationSelectFieldConfig = BaseEntitySelectFieldConfig;

/**
 * Event organizer select field configuration
 */
export type EventOrganizerSelectFieldConfig = BaseEntitySelectFieldConfig;

/**
 * Post sponsorship select field configuration
 */
export type PostSponsorshipSelectFieldConfig = BaseEntitySelectFieldConfig;

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
    modes?: ('view' | 'edit' | 'create')[];
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

    /**
     * Non-editable prefix visually attached to the input widget (e.g. "+54", "$", "https://").
     * Rendered by FieldAffix. Does not affect the stored value.
     * Per spec §4.2 "Prefijos / sufijos no editables".
     */
    prefix?: string;

    /**
     * Non-editable suffix visually attached to the input widget (e.g. "m²", "%", "kg").
     * Rendered by FieldAffix. Does not affect the stored value.
     * Per spec §4.2 "Prefijos / sufijos no editables".
     */
    suffix?: string;

    // Entitlement gating (for premium features)
    entitlementKey?: string;
    limitKey?: string; // For limit-based gates (e.g., max_photos)

    // Type-specific configuration
    typeConfig?: FieldTypeConfig;
};
