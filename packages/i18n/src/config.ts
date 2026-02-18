/**
 * Internationalization configuration for Hospeda
 *
 * This module provides the core configuration for the i18n system,
 * including supported locales, default locale, and translation data.
 */

export const defaultLocale = 'es' as const;
export const locales = ['es', 'en', 'pt'] as const;

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
    'auth-ui',
    'billing',
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
    'fields',
    'exchange-rate',
    // Admin namespaces
    'admin-auth',
    'admin-billing',
    'admin-nav',
    'admin-dashboard',
    'admin-menu',
    'admin-pages',
    'admin-tables',
    'admin-common',
    'admin-entities',
    'admin-tabs'
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
import adminAuthEs from './locales/es/admin-auth.json';
import adminBillingEs from './locales/es/admin-billing.json';
import adminCommonEs from './locales/es/admin-common.json';
import adminDashboardEs from './locales/es/admin-dashboard.json';
import adminEntitiesEs from './locales/es/admin-entities.json';
import adminMenuEs from './locales/es/admin-menu.json';
import adminNavEs from './locales/es/admin-nav.json';
import adminPagesEs from './locales/es/admin-pages.json';
import adminTablesEs from './locales/es/admin-tables.json';
import adminTabsEs from './locales/es/admin-tabs.json';
import authUiEs from './locales/es/auth-ui.json';
import benefitsEs from './locales/es/benefits.json';
import billingEs from './locales/es/billing.json';
import blogEs from './locales/es/blog.json';
import commonEs from './locales/es/common.json';
import contactEs from './locales/es/contact.json';
import destinationEs from './locales/es/destination.json';
import errorEs from './locales/es/error.json';
import eventEs from './locales/es/event.json';
import exchangeRateEs from './locales/es/exchange-rate.json';
import fieldsEs from './locales/es/fields.json';
import footerEs from './locales/es/footer.json';
import homeEs from './locales/es/home.json';
import navEs from './locales/es/nav.json';
import newsletterEs from './locales/es/newsletter.json';
import privacyEs from './locales/es/privacy.json';
import searchEs from './locales/es/search.json';
import termsEs from './locales/es/terms.json';
import uiEs from './locales/es/ui.json';

// English translations
import aboutEn from './locales/en/about.json';
import accommodationsEn from './locales/en/accommodations.json';
import adminAuthEn from './locales/en/admin-auth.json';
import adminBillingEn from './locales/en/admin-billing.json';
import adminCommonEn from './locales/en/admin-common.json';
import adminDashboardEn from './locales/en/admin-dashboard.json';
import adminEntitiesEn from './locales/en/admin-entities.json';
import adminMenuEn from './locales/en/admin-menu.json';
import adminNavEn from './locales/en/admin-nav.json';
import adminPagesEn from './locales/en/admin-pages.json';
import adminTablesEn from './locales/en/admin-tables.json';
import adminTabsEn from './locales/en/admin-tabs.json';
import authUiEn from './locales/en/auth-ui.json';
import benefitsEn from './locales/en/benefits.json';
import billingEn from './locales/en/billing.json';
import blogEn from './locales/en/blog.json';
import commonEn from './locales/en/common.json';
import contactEn from './locales/en/contact.json';
import destinationEn from './locales/en/destination.json';
import errorEn from './locales/en/error.json';
import eventEn from './locales/en/event.json';
import exchangeRateEn from './locales/en/exchange-rate.json';
import fieldsEn from './locales/en/fields.json';
import footerEn from './locales/en/footer.json';
import homeEn from './locales/en/home.json';
import navEn from './locales/en/nav.json';
import newsletterEn from './locales/en/newsletter.json';
import privacyEn from './locales/en/privacy.json';
import searchEn from './locales/en/search.json';
import termsEn from './locales/en/terms.json';
import uiEn from './locales/en/ui.json';

// Portuguese translations
import aboutPt from './locales/pt/about.json';
import accommodationsPt from './locales/pt/accommodations.json';
import adminAuthPt from './locales/pt/admin-auth.json';
import adminBillingPt from './locales/pt/admin-billing.json';
import adminCommonPt from './locales/pt/admin-common.json';
import adminDashboardPt from './locales/pt/admin-dashboard.json';
import adminEntitiesPt from './locales/pt/admin-entities.json';
import adminMenuPt from './locales/pt/admin-menu.json';
import adminNavPt from './locales/pt/admin-nav.json';
import adminPagesPt from './locales/pt/admin-pages.json';
import adminTablesPt from './locales/pt/admin-tables.json';
import adminTabsPt from './locales/pt/admin-tabs.json';
import authUiPt from './locales/pt/auth-ui.json';
import benefitsPt from './locales/pt/benefits.json';
import billingPt from './locales/pt/billing.json';
import blogPt from './locales/pt/blog.json';
import commonPt from './locales/pt/common.json';
import contactPt from './locales/pt/contact.json';
import destinationPt from './locales/pt/destination.json';
import errorPt from './locales/pt/error.json';
import eventPt from './locales/pt/event.json';
import exchangeRatePt from './locales/pt/exchange-rate.json';
import fieldsPt from './locales/pt/fields.json';
import footerPt from './locales/pt/footer.json';
import homePt from './locales/pt/home.json';
import navPt from './locales/pt/nav.json';
import newsletterPt from './locales/pt/newsletter.json';
import privacyPt from './locales/pt/privacy.json';
import searchPt from './locales/pt/search.json';
import termsPt from './locales/pt/terms.json';
import uiPt from './locales/pt/ui.json';

/**
 * Processed translations object
 * Structure: { [locale]: { [flattenedKey]: translationValue } }
 */
const rawTranslations = {
    es: {
        about: aboutEs,
        accommodations: accommodationsEs,
        'auth-ui': authUiEs,
        billing: billingEs,
        benefits: benefitsEs,
        blog: blogEs,
        common: commonEs,
        contact: contactEs,
        destination: destinationEs,
        error: errorEs,
        event: eventEs,
        'exchange-rate': exchangeRateEs,
        footer: footerEs,
        home: homeEs,
        nav: navEs,
        newsletter: newsletterEs,
        privacy: privacyEs,
        search: searchEs,
        terms: termsEs,
        ui: uiEs,
        fields: fieldsEs,
        'admin-auth': adminAuthEs,
        'admin-billing': adminBillingEs,
        'admin-nav': adminNavEs,
        'admin-dashboard': adminDashboardEs,
        'admin-menu': adminMenuEs,
        'admin-pages': adminPagesEs,
        'admin-tables': adminTablesEs,
        'admin-common': adminCommonEs,
        'admin-entities': adminEntitiesEs,
        'admin-tabs': adminTabsEs
    },
    en: {
        about: aboutEn,
        accommodations: accommodationsEn,
        'auth-ui': authUiEn,
        billing: billingEn,
        benefits: benefitsEn,
        blog: blogEn,
        common: commonEn,
        contact: contactEn,
        destination: destinationEn,
        error: errorEn,
        event: eventEn,
        'exchange-rate': exchangeRateEn,
        footer: footerEn,
        home: homeEn,
        nav: navEn,
        newsletter: newsletterEn,
        privacy: privacyEn,
        search: searchEn,
        terms: termsEn,
        ui: uiEn,
        fields: fieldsEn,
        'admin-auth': adminAuthEn,
        'admin-billing': adminBillingEn,
        'admin-nav': adminNavEn,
        'admin-dashboard': adminDashboardEn,
        'admin-menu': adminMenuEn,
        'admin-pages': adminPagesEn,
        'admin-tables': adminTablesEn,
        'admin-common': adminCommonEn,
        'admin-entities': adminEntitiesEn,
        'admin-tabs': adminTabsEn
    },
    pt: {
        about: aboutPt,
        accommodations: accommodationsPt,
        'auth-ui': authUiPt,
        billing: billingPt,
        benefits: benefitsPt,
        blog: blogPt,
        common: commonPt,
        contact: contactPt,
        destination: destinationPt,
        error: errorPt,
        event: eventPt,
        'exchange-rate': exchangeRatePt,
        footer: footerPt,
        home: homePt,
        nav: navPt,
        newsletter: newsletterPt,
        privacy: privacyPt,
        search: searchPt,
        terms: termsPt,
        ui: uiPt,
        fields: fieldsPt,
        'admin-auth': adminAuthPt,
        'admin-billing': adminBillingPt,
        'admin-nav': adminNavPt,
        'admin-dashboard': adminDashboardPt,
        'admin-menu': adminMenuPt,
        'admin-pages': adminPagesPt,
        'admin-tables': adminTablesPt,
        'admin-common': adminCommonPt,
        'admin-entities': adminEntitiesPt,
        'admin-tabs': adminTabsPt
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
