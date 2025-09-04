import { useTranslations } from '@repo/i18n';

/**
 * Utility functions for converting enums to select options
 */

/**
 * Option type for select components
 */
export type SelectOption = {
    value: string;
    label: string;
};

/**
 * Converts an enum to select options
 * @param enumObject - The enum object to convert
 * @param labelMap - Optional mapping from enum values to display labels
 * @returns Array of select options
 */
export const enumToSelectOptions = <T extends Record<string, string>>(
    enumObject: T,
    labelMap?: Partial<Record<T[keyof T], string>>
): SelectOption[] => {
    return Object.values(enumObject).map((value) => ({
        value,
        label: labelMap?.[value as T[keyof T]] || formatEnumLabel(value)
    }));
};

/**
 * Formats an enum value to a human-readable label
 * Converts SNAKE_CASE or PascalCase to Title Case
 * @param value - The enum value to format
 * @returns Formatted label
 */
const formatEnumLabel = (value: string): string => {
    return value
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .replace(/_/g, ' ') // Replace underscores with spaces
        .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
        .trim();
};

/**
 * Hook to get accommodation type options with translations
 */
export const useAccommodationTypeOptions = <T extends Record<string, string>>(
    enumObject: T
): SelectOption[] => {
    const { t } = useTranslations();

    return Object.values(enumObject).map((value) => ({
        value,
        label:
            // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
            t(`common.enums.accommodationType.${value.toLowerCase()}` as any) ||
            formatEnumLabel(value)
    }));
};

/**
 * Hook to get visibility options with translations
 */
export const useVisibilityOptions = <T extends Record<string, string>>(
    enumObject: T
): SelectOption[] => {
    const { t } = useTranslations();

    return Object.values(enumObject).map((value) => ({
        value,
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        label: t(`common.enums.visibility.${value.toLowerCase()}` as any) || formatEnumLabel(value)
    }));
};

/**
 * Hook to get lifecycle status options with translations
 */
export const useLifecycleStatusOptions = <T extends Record<string, string>>(
    enumObject: T
): SelectOption[] => {
    const { t } = useTranslations();

    return Object.values(enumObject).map((value) => ({
        value,
        label:
            // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
            t(`common.enums.lifecycleStatus.${value.toLowerCase()}` as any) ||
            formatEnumLabel(value)
    }));
};

/**
 * Hook to get moderation status options with translations
 */
export const useModerationStatusOptions = <T extends Record<string, string>>(
    enumObject: T
): SelectOption[] => {
    const { t } = useTranslations();

    return Object.values(enumObject).map((value) => ({
        value,
        label:
            // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
            t(`common.enums.moderationStatus.${value.toLowerCase()}` as any) ||
            formatEnumLabel(value)
    }));
};
