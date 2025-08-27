// Form validation hooks
export { useAsyncValidation } from '@/lib/validation/hooks/useAsyncValidation';
export { useCrossFieldValidation } from '@/lib/validation/hooks/useCrossFieldValidation';

// Validation types
export type {
    AsyncValidationConfig,
    AsyncValidator,
    ValidationState
} from '@/lib/validation/hooks/useAsyncValidation';

export type {
    CrossFieldRule,
    CrossFieldValidationConfig,
    CrossFieldValidationState
} from '@/lib/validation/hooks/useCrossFieldValidation';

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

export type { ApiValidatorConfig } from '@/lib/validation/validators/commonValidators';

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

export type {
    ConditionalFieldFormData,
    DateRangeFormData,
    PasswordFormData
} from '@/lib/validation/rules/commonRules';

// Form components
export { ValidatedForm } from './ValidatedForm';
export { VALIDATED_INPUT_PRESETS, ValidatedInput } from './ValidatedInput';

export type { FormSubmissionState, ValidatedFormProps } from './ValidatedForm';
export type { ValidatedInputProps } from './ValidatedInput';

// Examples
export { ValidationExample } from './examples/ValidationExample';
