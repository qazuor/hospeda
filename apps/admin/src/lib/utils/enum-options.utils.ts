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
            label: t(`common.enums.${prefix}.${value.toLowerCase()}` as any, {
                defaultValue: value
            }),
            labelKey: `common.enums.${prefix}.${value.toLowerCase()}`
        }));

    return {
        // Accommodation specific enums
        getAccommodationTypeOptions: (AccommodationTypeEnum: Record<string, string>) =>
            createOptions(AccommodationTypeEnum, 'accommodationType'),

        // Lifecycle and status enums
        getLifecycleStatusOptions: (LifecycleStatusEnum: Record<string, string>) =>
            createOptions(LifecycleStatusEnum, 'lifecycleStatus'),

        getModerationStatusOptions: (ModerationStatusEnum: Record<string, string>) =>
            createOptions(ModerationStatusEnum, 'moderationStatus'),

        getVisibilityOptions: (VisibilityEnum: Record<string, string>) =>
            createOptions(VisibilityEnum, 'visibility'),

        // Currency enum
        getCurrencyOptions: (CurrencyEnum: Record<string, string>) =>
            createOptions(CurrencyEnum, 'currency'),

        // Role enum
        getRoleOptions: (RoleEnum: Record<string, string>) => createOptions(RoleEnum, 'role'),

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

/**
 * Create options with custom value-label mapping
 * @param mapping - Object mapping values to labels
 * @param i18nPrefix - Optional i18n prefix for labels
 * @returns Array of select options
 */
export const createOptionsFromMapping = (
    mapping: Record<string, string>,
    i18nPrefix?: string
): SelectOption[] => {
    return Object.entries(mapping).map(([value, label]) => ({
        value,
        label,
        ...(i18nPrefix && { labelKey: `${i18nPrefix}.${value.toLowerCase()}` })
    }));
};

/**
 * Create grouped options for select fields that support optgroups
 * @param groups - Object mapping group names to options
 * @param i18nPrefix - Optional i18n prefix for group names
 * @returns Array of grouped select options
 */
export const createGroupedOptions = (
    groups: Record<string, SelectOption[]>,
    i18nPrefix?: string
) => {
    return Object.entries(groups).map(([groupName, options]) => ({
        label: groupName,
        labelKey: i18nPrefix ? `${i18nPrefix}.${groupName.toLowerCase()}` : undefined,
        options
    }));
};

/**
 * Filter options based on a search query
 * @param options - Array of select options to filter
 * @param query - Search query
 * @param searchFields - Fields to search in ('label', 'description', 'value')
 * @returns Filtered array of select options
 */
export const filterOptions = (
    options: SelectOption[],
    query: string,
    searchFields: ('label' | 'description' | 'value')[] = ['label']
): SelectOption[] => {
    if (!query) return options;

    const lowerQuery = query.toLowerCase();

    return options.filter((option) =>
        searchFields.some((field) => {
            const fieldValue = option[field];
            return fieldValue?.toLowerCase().includes(lowerQuery);
        })
    );
};

/**
 * Sort options by label, value, or custom function
 * @param options - Array of select options to sort
 * @param sortBy - Field to sort by or custom sort function
 * @param order - Sort order ('asc' or 'desc')
 * @returns Sorted array of select options
 */
export const sortOptions = (
    options: SelectOption[],
    sortBy: 'label' | 'value' | ((a: SelectOption, b: SelectOption) => number) = 'label',
    order: 'asc' | 'desc' = 'asc'
): SelectOption[] => {
    const sorted = [...options].sort((a, b) => {
        if (typeof sortBy === 'function') {
            return sortBy(a, b);
        }

        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';

        return aValue.localeCompare(bValue);
    });

    return order === 'desc' ? sorted.reverse() : sorted;
};

/**
 * Utility to create options with icons
 * @param items - Array of items with value, label, and icon
 * @returns Array of select options with icon metadata
 */
export const createOptionsWithIcons = (
    items: Array<{ value: string; label: string; icon?: string; description?: string }>
): SelectOption[] => {
    return items.map((item) => ({
        value: item.value,
        label: item.label,
        description: item.description,
        metadata: {
            icon: item.icon
        }
    }));
};

/**
 * Utility to create options with status indicators
 * @param items - Array of items with value, label, and status
 * @returns Array of select options with status metadata
 */
export const createOptionsWithStatus = (
    items: Array<{
        value: string;
        label: string;
        status?: 'active' | 'inactive' | 'pending' | 'archived';
        description?: string;
    }>
): SelectOption[] => {
    return items.map((item) => ({
        value: item.value,
        label: item.label,
        description: item.description,
        disabled: item.status === 'inactive' || item.status === 'archived',
        metadata: {
            status: item.status
        }
    }));
};
