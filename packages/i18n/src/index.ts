/**
 * @repo/i18n - Shared internationalization package
 *
 * This package provides shared translation data and types for all apps
 * in the Hospeda monorepo. It includes JSON translation files and
 * TypeScript types for type-safe translation keys.
 */

// Core configuration and data
export {
    defaultLocale,
    locales,
    namespaces,
    trans,
    type Locale,
    type Namespace
} from './config';

// TypeScript types for translation keys
export type { TranslationKey, TranslationKeys } from './types';

// React hooks for translations
export { useTranslations } from './hooks/use-translations';
