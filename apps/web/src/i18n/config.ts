/**
 * Re-export i18n configuration from the shared package
 *
 * This maintains backward compatibility while using the shared @repo/i18n package
 */
export {
    defaultLocale,
    locales,
    namespaces,
    trans,
    type Locale,
    type Namespace
} from '@repo/i18n';
