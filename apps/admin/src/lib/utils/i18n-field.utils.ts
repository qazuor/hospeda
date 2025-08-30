import type { I18nFieldConfig } from '@/components/entity-form/types/field-config.types';
import { useTranslations } from '@repo/i18n';

/**
 * Hook to get i18n strings for a field
 * @param fieldId - The field identifier
 * @param config - Optional i18n configuration override
 * @returns Object with translated strings and helper functions
 */
export const useFieldI18n = (fieldId: string, config?: I18nFieldConfig) => {
    const { t } = useTranslations();

    const getLabel = () => {
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        if (config?.labelKey) return t(config.labelKey as any);
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        return t(`fields.${fieldId}.label` as any, { defaultValue: fieldId });
    };

    const getDescription = () => {
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        if (config?.descriptionKey) return t(config.descriptionKey as any);
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        return t(`fields.${fieldId}.description` as any, { defaultValue: '' });
    };

    const getPlaceholder = () => {
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        if (config?.placeholderKey) return t(config.placeholderKey as any);
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        return t(`fields.${fieldId}.placeholder` as any, { defaultValue: '' });
    };

    const getErrorMessage = (errorKey: string) => {
        const i18nKey = config?.errorMessages?.[errorKey] || `fields.${fieldId}.errors.${errorKey}`;
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        return t(i18nKey as any, { defaultValue: `Validation error: ${errorKey}` });
    };

    const getHelpText = (helpTextKey?: string) => {
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        if (helpTextKey) return t(helpTextKey as any);
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        return t(`fields.${fieldId}.help` as any, { defaultValue: '' });
    };

    return {
        label: getLabel(),
        description: getDescription(),
        placeholder: getPlaceholder(),
        getErrorMessage,
        getHelpText,
        // Raw functions for dynamic usage
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        getLabelByKey: (key: string) => t(key as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        getDescriptionByKey: (key: string) => t(key as any),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        getPlaceholderByKey: (key: string) => t(key as any)
    };
};

/**
 * Create an i18n field configuration with standard keys
 * @param baseKey - Base i18n key (e.g., 'accommodation.name')
 * @returns I18nFieldConfig object
 */
export const createI18nFieldConfig = (baseKey: string): I18nFieldConfig => ({
    labelKey: `${baseKey}.label`,
    descriptionKey: `${baseKey}.description`,
    placeholderKey: `${baseKey}.placeholder`,
    errorMessages: {
        required: `${baseKey}.errors.required`,
        invalid: `${baseKey}.errors.invalid`,
        tooShort: `${baseKey}.errors.tooShort`,
        tooLong: `${baseKey}.errors.tooLong`,
        min: `${baseKey}.errors.min`,
        max: `${baseKey}.errors.max`,
        pattern: `${baseKey}.errors.pattern`,
        unique: `${baseKey}.errors.unique`,
        notFound: `${baseKey}.errors.notFound`,
        forbidden: `${baseKey}.errors.forbidden`
    }
});

/**
 * Create i18n configuration for a section
 * @param baseKey - Base i18n key (e.g., 'accommodation.sections.basicInfo')
 * @returns Object with section i18n keys
 */
export const createI18nSectionConfig = (baseKey: string) => ({
    titleKey: `${baseKey}.title`,
    descriptionKey: `${baseKey}.description`,
    helpTextKey: `${baseKey}.help`
});

/**
 * Hook to get i18n strings for a section
 * @param sectionId - The section identifier
 * @param entityType - The entity type (e.g., 'accommodation')
 * @returns Object with translated section strings
 */
export const useSectionI18n = (sectionId: string, entityType: string) => {
    const { t } = useTranslations();

    const baseKey = `${entityType}.sections.${sectionId}`;

    return {
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        title: t(`${baseKey}.title` as any, { defaultValue: sectionId }),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        description: t(`${baseKey}.description` as any, { defaultValue: '' }),
        // biome-ignore lint/suspicious/noExplicitAny: i18n keys are dynamic and type-safe at runtime
        helpText: t(`${baseKey}.help` as any, { defaultValue: '' })
    };
};

/**
 * Utility to create field configurations with consistent i18n
 * @param entityType - Entity type (e.g., 'accommodation')
 * @param fieldConfigs - Array of field configurations
 * @returns Array of field configurations with i18n applied
 */
export const withFieldI18n = (
    entityType: string,
    fieldConfigs: Array<{ id: string; [key: string]: unknown }>
) => {
    return fieldConfigs.map((config) => ({
        ...config,
        i18n: createI18nFieldConfig(`${entityType}.fields.${config.id}`)
    }));
};
