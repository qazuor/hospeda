/**
 * Enums for entity form configuration
 * These enums provide type safety and consistency across the form system
 */

/**
 * Validation trigger options for async validation
 */
export enum ValidationTriggerEnum {
    ON_BLUR = 'onBlur',
    ON_SUBMIT = 'onSubmit',
    ON_CHANGE = 'onChange'
}

/**
 * All available field types for entity forms
 */
export enum FieldTypeEnum {
    HIDDEN = 'HIDDEN',
    TEXT = 'TEXT',
    TEXTAREA = 'TEXTAREA',
    NUMBER = 'NUMBER',
    DATE = 'DATE',
    TIME = 'TIME',
    CHECKBOX = 'CHECKBOX',
    RADIO = 'RADIO',
    SELECT = 'SELECT',
    SELECT_MULTIPLE = 'SELECT_MULTIPLE',
    SWITCH = 'SWITCH',
    SLIDER = 'SLIDER',
    RANGE = 'RANGE',
    COLOR = 'COLOR',
    IMAGE = 'IMAGE',
    GALLERY = 'GALLERY',
    ENTITY_SELECT = 'ENTITY_SELECT',
    ENTITY_MULTISELECT = 'ENTITY_MULTISELECT',
    RICH_TEXT = 'RICH_TEXT',
    PHONE = 'PHONE',
    EMAIL = 'EMAIL',
    URL = 'URL',
    CURRENCY = 'CURRENCY',
    JSON = 'JSON',
    FILE = 'FILE',
    COMPUTED = 'COMPUTED',
    SECTION = 'SECTION'
}

/**
 * Layout types for sections and forms
 */
export enum LayoutTypeEnum {
    TABS = 'TABS',
    GRID = 'GRID',
    GALLERY = 'GALLERY',
    LIST = 'LIST',
    SPLIT = 'SPLIT',
    STEPPER = 'STEPPER'
}

/**
 * Entity types for entity select fields
 */
export enum EntityTypeEnum {
    DESTINATION = 'DESTINATION',
    USER = 'USER',
    EVENT = 'EVENT',
    POST = 'POST',
    FEATURE = 'FEATURE',
    AMENITY = 'AMENITY',
    TAG = 'TAG'
}

/**
 * Autosave strategies (prepared for future implementation)
 */
export enum AutosaveStrategyEnum {
    FIELD = 'field',
    SECTION = 'section',
    MANUAL = 'manual'
}

/**
 * Rich text editor features
 */
export enum RichTextFeatureEnum {
    BOLD = 'bold',
    ITALIC = 'italic',
    UNDERLINE = 'underline',
    STRIKETHROUGH = 'strikethrough',
    LINK = 'link',
    LIST = 'list',
    ORDERED_LIST = 'orderedList',
    HEADING = 'heading',
    QUOTE = 'quote',
    CODE = 'code',
    TABLE = 'table',
    IMAGE = 'image'
}

/**
 * Form modes
 */
export enum FormModeEnum {
    VIEW = 'view',
    EDIT = 'edit',
    CREATE = 'create'
}
