/**
 * @repo/i18n/web — Web-only subpath export.
 *
 * Exposes the same public API as `@repo/i18n` (the default export) but
 * WITHOUT any admin-* namespace. This keeps the web client bundle free of
 * admin translation JSON files (~200KB+ raw savings).
 *
 * The module graph of this file NEVER reaches `config.admin.ts` or any
 * admin-* JSON file, so bundlers (Vite/Rollup/Astro) will tree-shake them
 * out of the web build entirely.
 *
 * Usage (web app only):
 * ```ts
 * import { trans, namespaces, pluralize } from '@repo/i18n/web';
 * ```
 *
 * Admin, API, or other full-catalog consumers MUST continue to use:
 * ```ts
 * import { trans, namespaces } from '@repo/i18n';
 * ```
 */

// Core configuration — shared (non-admin) only
export {
    defaultLocale,
    defaultIntlLocale,
    locales,
    webNamespaces as namespaces,
    webTrans as trans,
    type Locale,
    type WebNamespace as Namespace
} from './config.shared';

// Pluralization (no admin dependency — safe to share)
export { pluralize } from './pluralization';

// Formatting utilities (no admin dependency)
export {
    formatDate,
    formatNumber,
    formatCurrency,
    resolveDefaultCurrency,
    toBcp47Locale
} from './formatting';
export type { FormatDateInput, FormatNumberInput, FormatCurrencyInput } from './formatting';

// Validation message resolver (no admin dependency)
export { resolveValidationMessage } from './utils/resolve-validation-message';

// API error translation (no admin dependency)
export { translateApiError } from './api-errors';
export type { ApiErrorShape, TranslationFn, SupportedLocale } from './api-errors';

// React hook — imports trans from config (full catalog). The hook is used only
// in React components; in the web app those components import useTranslations
// via '@repo/i18n' directly, not this subpath. Omit it here to avoid pulling
// config.ts (full catalog) into the web graph. Admin uses '@repo/i18n' anyway.
// export { useTranslations } from './hooks/use-translations';
