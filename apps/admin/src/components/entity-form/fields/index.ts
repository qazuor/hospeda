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

// TODO [73e556b2-d13a-4566-bd85-de189617b4a5]: Implement additional field types
// export { NumberField } from './NumberField';
// export type { NumberFieldProps } from './NumberField';

// export { DateField } from './DateField';
// export type { DateFieldProps } from './DateField';

// export { TimeField } from './TimeField';
// export type { TimeFieldProps } from './TimeField';

// export { EmailField } from './EmailField';
// export type { EmailFieldProps } from './EmailField';

// export { UrlField } from './UrlField';
// export type { UrlFieldProps } from './UrlField';

// export { PhoneField } from './PhoneField';
// export type { PhoneFieldProps } from './PhoneField';

// export { ColorField } from './ColorField';
// export type { ColorFieldProps } from './ColorField';

// export { SliderField } from './SliderField';
// export type { SliderFieldProps } from './SliderField';

// export { RangeField } from './RangeField';
// export type { RangeFieldProps } from './RangeField';

// export { RadioField } from './RadioField';
// export type { RadioFieldProps } from './RadioField';

// export { SelectMultipleField } from './SelectMultipleField';
// export type { SelectMultipleFieldProps } from './SelectMultipleField';

// export { EntitySelectField } from './EntitySelectField';
// export type { EntitySelectFieldProps } from './EntitySelectField';

// export { EntityMultiSelectField } from './EntityMultiSelectField';
// export type { EntityMultiSelectFieldProps } from './EntityMultiSelectField';

// export { RichTextField } from './RichTextField';
// export type { RichTextFieldProps } from './RichTextField';

// export { CurrencyField } from './CurrencyField';
// export type { CurrencyFieldProps } from './CurrencyField';

// export { ImageField } from './ImageField';
// export type { ImageFieldProps } from './ImageField';

// export { GalleryField } from './GalleryField';
// export type { GalleryFieldProps } from './GalleryField';

// export { FileField } from './FileField';
// export type { FileFieldProps } from './FileField';

// export { JsonField } from './JsonField';
// export type { JsonFieldProps } from './JsonField';

// export { HiddenField } from './HiddenField';
// export type { HiddenFieldProps } from './HiddenField';

// export { ComputedField } from './ComputedField';
// export type { ComputedFieldProps } from './ComputedField';
