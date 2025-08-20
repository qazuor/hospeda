/**
 * Internationalization configuration for Hospeda
 *
 * This module provides the core configuration for the i18n system,
 * including supported locales, default locale, and translation data.
 */

export const defaultLocale = 'es' as const;
export const locales = ['es'] as const;

export type Locale = (typeof locales)[number];

/**
 * Available translation namespaces
 * Each namespace corresponds to a JSON file in the locales directory
 */
export const namespaces = [
    'common',
    'nav',
    'footer',
    'accommodations',
    'blog',
    'destinations',
    'events',
    'home',
    'newsletter',
    'contact',
    'about',
    'benefits',
    'error',
    'privacy',
    'search',
    'terms',
    'ui',
    // Admin namespaces
    'admin-auth',
    'admin-nav',
    'admin-dashboard',
    'admin-menu',
    'admin-pages',
    'admin-tables',
    'admin-common'
] as const;

export type Namespace = (typeof namespaces)[number];

/**
 * Flattens a nested object into dot-notation keys
 * @param obj - The object to flatten
 * @param parentKey - The parent key for nested objects
 * @param result - The accumulator for the flattened result
 * @returns A flattened object with dot-notation keys
 */
/**
 * Flattens a nested object into a single-level object with dot-notation keys.
 * @param obj - The object to flatten.
 * @param parentKey - The prefix for the current key (used for recursion).
 * @param result - The accumulator for the flattened result.
 * @returns A new object with dot-notation keys and string values.
 */
function flattenObject(
    obj: Record<string, unknown>,
    parentKey = '',
    result: Record<string, string> = {}
): Record<string, string> {
    for (const key in obj) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // Recursively flatten nested objects
            flattenObject(value as Record<string, unknown>, newKey, result);
        } else if (typeof value === 'string') {
            // Only assign string values to the result
            result[newKey] = value;
        }
        // Non-string, non-object values are ignored to satisfy type safety
    }
    return result;
}

/**
 * Import all translation files statically
 * This approach works in both Vite/Astro and Node.js environments
 */

// Spanish translations
import aboutEs from './locales/es/about.json';
import accommodationsEs from './locales/es/accommodations.json';
// Admin translations
import adminAuthEs from './locales/es/admin-auth.json';
import adminCommonEs from './locales/es/admin-common.json';
import adminDashboardEs from './locales/es/admin-dashboard.json';
import adminMenuEs from './locales/es/admin-menu.json';
import adminNavEs from './locales/es/admin-nav.json';
import adminPagesEs from './locales/es/admin-pages.json';
import adminTablesEs from './locales/es/admin-tables.json';
import benefitsEs from './locales/es/benefits.json';
import blogEs from './locales/es/blog.json';
import commonEs from './locales/es/common.json';
import contactEs from './locales/es/contact.json';
import destinationEs from './locales/es/destination.json';
import errorEs from './locales/es/error.json';
import eventEs from './locales/es/event.json';
import footerEs from './locales/es/footer.json';
import homeEs from './locales/es/home.json';
import navEs from './locales/es/nav.json';
import newsletterEs from './locales/es/newsletter.json';
import privacyEs from './locales/es/privacy.json';
import searchEs from './locales/es/search.json';
import termsEs from './locales/es/terms.json';
import uiEs from './locales/es/ui.json';

/**
 * Processed translations object
 * Structure: { [locale]: { [flattenedKey]: translationValue } }
 */
const rawTranslations = {
    es: {
        about: aboutEs,
        accommodations: accommodationsEs,
        benefits: benefitsEs,
        blog: blogEs,
        common: commonEs,
        contact: contactEs,
        destination: destinationEs,
        error: errorEs,
        event: eventEs,
        footer: footerEs,
        home: homeEs,
        nav: navEs,
        newsletter: newsletterEs,
        privacy: privacyEs,
        search: searchEs,
        terms: termsEs,
        ui: uiEs,
        // Admin translations
        'admin-auth': adminAuthEs,
        'admin-nav': adminNavEs,
        'admin-dashboard': adminDashboardEs,
        'admin-menu': adminMenuEs,
        'admin-pages': adminPagesEs,
        'admin-tables': adminTablesEs,
        'admin-common': adminCommonEs
    }
};

// Flatten all translations for easier access
const translations: Record<string, Record<string, string>> = {};
for (const locale in rawTranslations) {
    translations[locale] = flattenObject(rawTranslations[locale as keyof typeof rawTranslations]);
}

/**
 * Exported translations object
 * Use this to access translations in your applications
 */
export const trans = translations as Record<Locale, Record<string, string>>;
