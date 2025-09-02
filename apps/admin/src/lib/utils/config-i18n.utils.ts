import { useTranslations } from '@repo/i18n';

/**
 * Simple hook to get the translation function for use in configurations
 * This allows explicit control over translations at the config level
 */
export const useConfigTranslations = () => {
    const { t } = useTranslations();

    return {
        t
    };
};
