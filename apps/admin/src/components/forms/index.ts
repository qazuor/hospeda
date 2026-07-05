// Form validation hooks

// Validation types
export type {
    AsyncValidationConfig,
    AsyncValidator,
    ValidationState
} from '@/lib/validation/hooks/useAsyncValidation';
export { useAsyncValidation } from '@/lib/validation/hooks/useAsyncValidation';
export type {
    CrossFieldRule,
    CrossFieldValidationConfig,
    CrossFieldValidationState
} from '@/lib/validation/hooks/useCrossFieldValidation';
export { useCrossFieldValidation } from '@/lib/validation/hooks/useCrossFieldValidation';
export type {
    ConditionalFieldFormData,
    DateRangeFormData,
    PasswordFormData
} from '@/lib/validation/rules/commonRules';
// Common validation rules
export {
    COMMON_CROSS_FIELD_RULES,
    createAgeValidationRule,
    createConditionalRequiredRule,
    createDateRangeRule,
    createEmailConfirmationRule,
    createFileSizeRule,
    createMinDateRangeDurationRule,
    createNumericRangeRule,
    createPasswordConfirmationRule
} from '@/lib/validation/rules/commonRules';
export type { ApiValidatorConfig } from '@/lib/validation/validators/commonValidators';
// Common validators
export {
    COMMON_VALIDATORS,
    createApiValidator,
    createDomainValidator,
    createEmailUniquenessValidator,
    createSlugUniquenessValidator,
    createTaxIdValidator,
    createUsernameUniquenessValidator,
    creditCardValidator,
    phoneValidator,
    urlValidator
} from '@/lib/validation/validators/commonValidators';
// Examples
export { ValidationExample } from './examples/ValidationExample';
export type { FormSubmissionState, ValidatedFormProps } from './ValidatedForm';
// Form components
export { ValidatedForm } from './ValidatedForm';
export type { ValidatedInputProps } from './ValidatedInput';
export { VALIDATED_INPUT_PRESETS, ValidatedInput } from './ValidatedInput';
