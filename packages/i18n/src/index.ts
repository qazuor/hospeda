/**
 * @repo/i18n - Shared internationalization package
 *
 * This package provides shared translation data and types for all apps
 * in the Hospeda monorepo. It includes JSON translation files and
 * TypeScript types for type-safe translation keys.
 */

export type { ApiErrorShape, SupportedLocale, TranslationFn } from './api-errors';
// API error translation
export { translateApiError } from './api-errors';
// Core configuration and data
export {
    defaultIntlLocale,
    defaultLocale,
    type Locale,
    locales,
    type Namespace,
    namespaces,
    trans
} from './config';
export type { FormatCurrencyInput, FormatDateInput, FormatNumberInput } from './formatting';
// Formatting utilities
export {
    formatCurrency,
    formatDate,
    formatNumber,
    resolveDefaultCurrency,
    toBcp47Locale
} from './formatting';
// React hooks for translations
export { useTranslations } from './hooks/use-translations';
// Pluralization utilities
export { pluralize } from './pluralization';
// TypeScript types for translation keys
export type { TranslationKey, TranslationKeys } from './types';
// Validation utilities
export { resolveValidationMessage } from './utils/resolve-validation-message';
