import type { SelectOption } from '@/components/entity-form/types/field-config.types';
import { useTranslations } from '@repo/i18n';

/**
 * Convert an enum to select options with i18n support
 * @param enumObject - The enum object
 * @param i18nPrefix - i18n key prefix (e.g., 'enums.accommodationType')
 * @returns Array of select options
 */
export const enumToSelectOptions = (
    enumObject: Record<string, string>,
    i18nPrefix: string
): SelectOption[] => {
    return Object.values(enumObject).map((value) => ({
        value,
        label: value, // Will be replaced by hook
        labelKey: `${i18nPrefix}.${value.toLowerCase()}`
    }));
};

/**
 * Hook to get enum options with translations
 * @param enumObject - The enum object
 * @param i18nPrefix - i18n key prefix
 * @returns Array of translated select options
 */
export const useEnumOptions = (
    enumObject: Record<string, string>,
    i18nPrefix: string
): SelectOption[] => {
    const { t } = useTranslations();

    return Object.values(enumObject).map((value) => ({
        value,
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        label: t(`${i18nPrefix}.${value.toLowerCase()}` as any, { defaultValue: value }),
        labelKey: `${i18nPrefix}.${value.toLowerCase()}`
    }));
};

/**
 * Hook to get common enum options used across the application
 */
export const useCommonEnumOptions = () => {
    const { t } = useTranslations();

    // Import enums dynamically to avoid circular dependencies
    const createOptions = (enumObj: Record<string, string>, prefix: string) =>
        Object.values(enumObj).map((value) => ({
            value,
            // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
            label: t(`enums.${prefix}.${value.toLowerCase()}` as any, { defaultValue: value }),
            labelKey: `enums.${prefix}.${value.toLowerCase()}`
        }));

    return {
        // These will be populated when enums are imported
        getAccommodationTypeOptions: (AccommodationTypeEnum: Record<string, string>) =>
            createOptions(AccommodationTypeEnum, 'accommodationType'),

        getLifecycleStatusOptions: (LifecycleStatusEnum: Record<string, string>) =>
            createOptions(LifecycleStatusEnum, 'lifecycleStatus'),

        getModerationStatusOptions: (ModerationStatusEnum: Record<string, string>) =>
            createOptions(ModerationStatusEnum, 'moderationStatus'),

        getVisibilityOptions: (VisibilityEnum: Record<string, string>) =>
            createOptions(VisibilityEnum, 'visibility'),

        getCurrencyOptions: (CurrencyEnum: Record<string, string>) =>
            createOptions(CurrencyEnum, 'currency'),

        // Generic function for any enum
        createEnumOptions: (enumObj: Record<string, string>, prefix: string) =>
            createOptions(enumObj, prefix)
    };
};

/**
 * Create boolean options (Yes/No, True/False, etc.)
 * @param type - Type of boolean options ('yesNo', 'trueFalse', 'enabledDisabled')
 * @returns Array of boolean select options
 */
export const useBooleanOptions = (
    type: 'yesNo' | 'trueFalse' | 'enabledDisabled' = 'yesNo'
): SelectOption[] => {
    const { t } = useTranslations();

    const optionTypes = {
        yesNo: [
            { value: 'true', labelKey: 'common.yes' },
            { value: 'false', labelKey: 'common.no' }
        ],
        trueFalse: [
            { value: 'true', labelKey: 'common.true' },
            { value: 'false', labelKey: 'common.false' }
        ],
        enabledDisabled: [
            { value: 'true', labelKey: 'common.enabled' },
            { value: 'false', labelKey: 'common.disabled' }
        ]
    };

    return optionTypes[type].map((option) => ({
        value: option.value,
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        label: t(option.labelKey as any, { defaultValue: option.value }),
        labelKey: option.labelKey
    }));
};

/**
 * Create options from a simple array of strings
 * @param values - Array of string values
 * @param i18nPrefix - Optional i18n prefix
 * @returns Array of select options
 */
export const createOptionsFromArray = (values: string[], i18nPrefix?: string): SelectOption[] => {
    return values.map((value) => ({
        value,
        label: value,
        ...(i18nPrefix && { labelKey: `${i18nPrefix}.${value.toLowerCase()}` })
    }));
};
