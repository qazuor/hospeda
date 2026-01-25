/**
 * @file Entity Form Field Components Index
 *
 * This file exports all field components used in entity forms.
 * Each component handles a specific field type from FieldConfig.
 */

// Basic Input Fields
export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';

export { TextareaField } from './TextareaField';
export type { TextareaFieldProps } from './TextareaField';

// Selection Fields
export { SelectField } from './SelectField';
export type { SelectFieldProps } from './SelectField';

// Boolean Fields
export { CheckboxField } from './CheckboxField';
export type { CheckboxFieldProps } from './CheckboxField';

export { SwitchField } from './SwitchField';
export type { SwitchFieldProps } from './SwitchField';

// Advanced Field Components
export { EntitySelectField } from './EntitySelectField';
export type { EntitySelectFieldProps } from './EntitySelectField';

// Specific Entity Select Fields (with encapsulated logic)
export * from './entity-selects';

export { CurrencyField } from './CurrencyField';
export type { CurrencyFieldProps, CurrencyValue } from './CurrencyField';

export { RichTextField } from './RichTextField';
export type { RichTextFeature, RichTextFieldProps } from './RichTextField';

export { ImageField } from './ImageField';
export type { ImageFieldProps, ImageValue } from './ImageField';

export { GalleryField } from './GalleryField';
export type { GalleryFieldProps, GalleryImage } from './GalleryField';
