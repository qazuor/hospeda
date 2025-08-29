/**
 * @file Field Renderers Index
 *
 * Central export file for all field renderer components.
 */

export { BooleanFieldRenderer } from './BooleanFieldRenderer';
export { EmailFieldRenderer } from './EmailFieldRenderer';
export { NumberFieldRenderer } from './NumberFieldRenderer';
export { TextFieldRenderer } from './TextFieldRenderer';

// Simplified implementations for remaining renderers
export {
    TextFieldRenderer as DateFieldRenderer,
    TextFieldRenderer as FileFieldRenderer,
    TextFieldRenderer as MultiselectFieldRenderer,
    TextFieldRenderer as PasswordFieldRenderer,
    TextFieldRenderer as RelationFieldRenderer,
    TextFieldRenderer as SelectFieldRenderer,
    TextFieldRenderer as TextAreaFieldRenderer
} from './TextFieldRenderer';

// TODO [0a680430-331f-4d16-91e5-de600e4d16f5]: Implement proper renderers for these field types
// - TextAreaFieldRenderer: Multi-line text input with resize
// - PasswordFieldRenderer: Password input with show/hide toggle
// - DateFieldRenderer: Date picker with calendar
// - SelectFieldRenderer: Dropdown select with options
// - MultiselectFieldRenderer: Multi-select with tags
// - FileFieldRenderer: File upload with drag & drop
// - RelationFieldRenderer: Async search with autocomplete
