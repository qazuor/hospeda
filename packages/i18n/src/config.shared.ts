/**
 * Shared (non-admin) i18n configuration for the Hospeda platform.
 *
 * This module contains ONLY the web/shared namespaces and their translation
 * imports. It is intentionally free of any admin-* namespace imports so that
 * the `@repo/i18n/web` subpath export can reference this file without pulling
 * admin JSON bundles into the web client bundle.
 *
 * The full catalog (including admin namespaces) is composed in `config.ts`.
 */

export const defaultLocale = 'es' as const;

/** BCP 47 locale tag used for Intl formatting (dates, numbers, currency). */
export const defaultIntlLocale = 'es-AR' as const;

export const locales = ['es', 'en', 'pt'] as const;

export type Locale = (typeof locales)[number];

/**
 * Web/shared translation namespaces — excludes all admin-* namespaces.
 * These are the only namespaces shipped to web visitors.
 */
export const webNamespaces = [
    'common',
    'nav',
    'footer',
    'accommodations',
    'auth-ui',
    'billing',
    'blog',
    'comments',
    'destinations',
    'events',
    'home',
    'newsletter',
    'owners',
    'contact',
    'about',
    'faq',
    'benefits',
    'error',
    'pricing',
    'privacy',
    'search',
    'terms',
    'ui',
    'fields',
    'exchange-rate',
    'account',
    'review',
    'validation',
    'revalidation',
    'api',
    'host',
    'conversations',
    'cookieConsent',
    'tags',
    'maps',
    'contributions',
    'content-moderation',
    'aiSearch',
    'host-trades',
    'mobile',
    'gastronomy',
    'commerce',
    'external-reputation',
    'experience',
    'social'
] as const;

export type WebNamespace = (typeof webNamespaces)[number];

/**
 * Flattens a nested object into a single-level object with dot-notation keys.
 *
 * @param obj - The object to flatten.
 * @param parentKey - The prefix for the current key (used for recursion).
 * @param result - The accumulator for the flattened result.
 * @returns A new object with dot-notation keys and string values.
 */
export function flattenObject(
    obj: Record<string, unknown>,
    parentKey = '',
    result: Record<string, string> = {}
): Record<string, string> {
    for (const key in obj) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenObject(value as Record<string, unknown>, newKey, result);
        } else if (typeof value === 'string') {
            result[newKey] = value;
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Spanish — shared namespaces only
// ---------------------------------------------------------------------------
import aboutEs from './locales/es/about.json';
import accommodationsEs from './locales/es/accommodations.json';
import accountEs from './locales/es/account.json';
import aiSearchEs from './locales/es/aiSearch.json';
import apiEs from './locales/es/api.json';
import authUiEs from './locales/es/auth-ui.json';
import benefitsEs from './locales/es/benefits.json';
import billingEs from './locales/es/billing.json';
import blogEs from './locales/es/blog.json';
import commentsEs from './locales/es/comments.json';
import commerceEs from './locales/es/commerce.json';
import commonEs from './locales/es/common.json';
import contactEs from './locales/es/contact.json';
import contentModerationEs from './locales/es/content-moderation.json';
import contributionsEs from './locales/es/contributions.json';
import conversationsEs from './locales/es/conversations.json';
import cookieConsentEs from './locales/es/cookieConsent.json';
import destinationEs from './locales/es/destination.json';
import errorEs from './locales/es/error.json';
import eventEs from './locales/es/event.json';
import exchangeRateEs from './locales/es/exchange-rate.json';
import experienceEs from './locales/es/experience.json';
import externalReputationEs from './locales/es/external-reputation.json';
import faqEs from './locales/es/faq.json';
import fieldsEs from './locales/es/fields.json';
import footerEs from './locales/es/footer.json';
import gastronomyEs from './locales/es/gastronomy.json';
import homeEs from './locales/es/home.json';
import hostTradesEs from './locales/es/host-trades.json';
import hostEs from './locales/es/host.json';
import mapsEs from './locales/es/maps.json';
import mobileEs from './locales/es/mobile.json';
import navEs from './locales/es/nav.json';
import newsletterEs from './locales/es/newsletter.json';
import ownersEs from './locales/es/owners.json';
import pricingEs from './locales/es/pricing.json';
import privacyEs from './locales/es/privacy.json';
import revalidationEs from './locales/es/revalidation.json';
import reviewEs from './locales/es/review.json';
import searchEs from './locales/es/search.json';
import socialEs from './locales/es/social.json';
import tagsEs from './locales/es/tags.json';
import termsEs from './locales/es/terms.json';
import uiEs from './locales/es/ui.json';
import validationEs from './locales/es/validation.json';

// ---------------------------------------------------------------------------
// English — shared namespaces only
// ---------------------------------------------------------------------------
import aboutEn from './locales/en/about.json';
import accommodationsEn from './locales/en/accommodations.json';
import accountEn from './locales/en/account.json';
import aiSearchEn from './locales/en/aiSearch.json';
import apiEn from './locales/en/api.json';
import authUiEn from './locales/en/auth-ui.json';
import benefitsEn from './locales/en/benefits.json';
import billingEn from './locales/en/billing.json';
import blogEn from './locales/en/blog.json';
import commentsEn from './locales/en/comments.json';
import commerceEn from './locales/en/commerce.json';
import commonEn from './locales/en/common.json';
import contactEn from './locales/en/contact.json';
import contentModerationEn from './locales/en/content-moderation.json';
import contributionsEn from './locales/en/contributions.json';
import conversationsEn from './locales/en/conversations.json';
import cookieConsentEn from './locales/en/cookieConsent.json';
import destinationEn from './locales/en/destination.json';
import errorEn from './locales/en/error.json';
import eventEn from './locales/en/event.json';
import exchangeRateEn from './locales/en/exchange-rate.json';
import experienceEn from './locales/en/experience.json';
import externalReputationEn from './locales/en/external-reputation.json';
import faqEn from './locales/en/faq.json';
import fieldsEn from './locales/en/fields.json';
import footerEn from './locales/en/footer.json';
import gastronomyEn from './locales/en/gastronomy.json';
import homeEn from './locales/en/home.json';
import hostTradesEn from './locales/en/host-trades.json';
import hostEn from './locales/en/host.json';
import mapsEn from './locales/en/maps.json';
import mobileEn from './locales/en/mobile.json';
import navEn from './locales/en/nav.json';
import newsletterEn from './locales/en/newsletter.json';
import ownersEn from './locales/en/owners.json';
import pricingEn from './locales/en/pricing.json';
import privacyEn from './locales/en/privacy.json';
import revalidationEn from './locales/en/revalidation.json';
import reviewEn from './locales/en/review.json';
import searchEn from './locales/en/search.json';
import socialEn from './locales/en/social.json';
import tagsEn from './locales/en/tags.json';
import termsEn from './locales/en/terms.json';
import uiEn from './locales/en/ui.json';
import validationEn from './locales/en/validation.json';

// ---------------------------------------------------------------------------
// Portuguese — shared namespaces only
// ---------------------------------------------------------------------------
import aboutPt from './locales/pt/about.json';
import accommodationsPt from './locales/pt/accommodations.json';
import accountPt from './locales/pt/account.json';
import aiSearchPt from './locales/pt/aiSearch.json';
import apiPt from './locales/pt/api.json';
import authUiPt from './locales/pt/auth-ui.json';
import benefitsPt from './locales/pt/benefits.json';
import billingPt from './locales/pt/billing.json';
import blogPt from './locales/pt/blog.json';
import commentsPt from './locales/pt/comments.json';
import commercePt from './locales/pt/commerce.json';
import commonPt from './locales/pt/common.json';
import contactPt from './locales/pt/contact.json';
import contentModerationPt from './locales/pt/content-moderation.json';
import contributionsPt from './locales/pt/contributions.json';
import conversationsPt from './locales/pt/conversations.json';
import cookieConsentPt from './locales/pt/cookieConsent.json';
import destinationPt from './locales/pt/destination.json';
import errorPt from './locales/pt/error.json';
import eventPt from './locales/pt/event.json';
import exchangeRatePt from './locales/pt/exchange-rate.json';
import experiencePt from './locales/pt/experience.json';
import externalReputationPt from './locales/pt/external-reputation.json';
import faqPt from './locales/pt/faq.json';
import fieldsPt from './locales/pt/fields.json';
import footerPt from './locales/pt/footer.json';
import gastronomyPt from './locales/pt/gastronomy.json';
import homePt from './locales/pt/home.json';
import hostTradesPt from './locales/pt/host-trades.json';
import hostPt from './locales/pt/host.json';
import mapsPt from './locales/pt/maps.json';
import mobilePt from './locales/pt/mobile.json';
import navPt from './locales/pt/nav.json';
import newsletterPt from './locales/pt/newsletter.json';
import ownersPt from './locales/pt/owners.json';
import pricingPt from './locales/pt/pricing.json';
import privacyPt from './locales/pt/privacy.json';
import revalidationPt from './locales/pt/revalidation.json';
import reviewPt from './locales/pt/review.json';
import searchPt from './locales/pt/search.json';
import socialPt from './locales/pt/social.json';
import tagsPt from './locales/pt/tags.json';
import termsPt from './locales/pt/terms.json';
import uiPt from './locales/pt/ui.json';
import validationPt from './locales/pt/validation.json';

// ---------------------------------------------------------------------------
// Shared raw translations (no admin-* namespaces)
// ---------------------------------------------------------------------------

/**
 * Raw (un-flattened) translation data for all supported locales, web/shared
 * namespaces only. Admin namespaces are absent from this object so bundlers
 * will not include admin JSON files when this module is in the import graph.
 */
export const rawWebTranslations = {
    es: {
        about: aboutEs,
        account: accountEs,
        aiSearch: aiSearchEs,
        accommodations: accommodationsEs,
        api: apiEs,
        'auth-ui': authUiEs,
        billing: billingEs,
        benefits: benefitsEs,
        blog: blogEs,
        comments: commentsEs,
        common: commonEs,
        contact: contactEs,
        contributions: contributionsEs,
        'content-moderation': contentModerationEs,
        destinations: destinationEs,
        error: errorEs,
        events: eventEs,
        'exchange-rate': exchangeRateEs,
        'external-reputation': externalReputationEs,
        faq: faqEs,
        footer: footerEs,
        home: homeEs,
        host: hostEs,
        'host-trades': hostTradesEs,
        nav: navEs,
        newsletter: newsletterEs,
        owners: ownersEs,
        pricing: pricingEs,
        privacy: privacyEs,
        review: reviewEs,
        search: searchEs,
        terms: termsEs,
        ui: uiEs,
        fields: fieldsEs,
        conversations: conversationsEs,
        cookieConsent: cookieConsentEs,
        validation: validationEs,
        revalidation: revalidationEs,
        tags: tagsEs,
        maps: mapsEs,
        mobile: mobileEs,
        gastronomy: gastronomyEs,
        commerce: commerceEs,
        experience: experienceEs,
        social: socialEs
    },
    en: {
        about: aboutEn,
        account: accountEn,
        aiSearch: aiSearchEn,
        accommodations: accommodationsEn,
        api: apiEn,
        'auth-ui': authUiEn,
        billing: billingEn,
        benefits: benefitsEn,
        blog: blogEn,
        comments: commentsEn,
        common: commonEn,
        contact: contactEn,
        contributions: contributionsEn,
        'content-moderation': contentModerationEn,
        destinations: destinationEn,
        error: errorEn,
        events: eventEn,
        'exchange-rate': exchangeRateEn,
        'external-reputation': externalReputationEn,
        faq: faqEn,
        footer: footerEn,
        home: homeEn,
        host: hostEn,
        'host-trades': hostTradesEn,
        nav: navEn,
        newsletter: newsletterEn,
        owners: ownersEn,
        pricing: pricingEn,
        privacy: privacyEn,
        review: reviewEn,
        search: searchEn,
        terms: termsEn,
        ui: uiEn,
        fields: fieldsEn,
        conversations: conversationsEn,
        cookieConsent: cookieConsentEn,
        validation: validationEn,
        revalidation: revalidationEn,
        tags: tagsEn,
        maps: mapsEn,
        mobile: mobileEn,
        gastronomy: gastronomyEn,
        commerce: commerceEn,
        experience: experienceEn,
        social: socialEn
    },
    pt: {
        about: aboutPt,
        account: accountPt,
        aiSearch: aiSearchPt,
        accommodations: accommodationsPt,
        api: apiPt,
        'auth-ui': authUiPt,
        billing: billingPt,
        benefits: benefitsPt,
        blog: blogPt,
        comments: commentsPt,
        common: commonPt,
        contact: contactPt,
        contributions: contributionsPt,
        'content-moderation': contentModerationPt,
        destinations: destinationPt,
        error: errorPt,
        events: eventPt,
        'exchange-rate': exchangeRatePt,
        'external-reputation': externalReputationPt,
        faq: faqPt,
        footer: footerPt,
        home: homePt,
        host: hostPt,
        'host-trades': hostTradesPt,
        nav: navPt,
        newsletter: newsletterPt,
        owners: ownersPt,
        pricing: pricingPt,
        privacy: privacyPt,
        review: reviewPt,
        search: searchPt,
        terms: termsPt,
        ui: uiPt,
        fields: fieldsPt,
        conversations: conversationsPt,
        cookieConsent: cookieConsentPt,
        validation: validationPt,
        revalidation: revalidationPt,
        tags: tagsPt,
        maps: mapsPt,
        mobile: mobilePt,
        gastronomy: gastronomyPt,
        commerce: commercePt,
        experience: experiencePt,
        social: socialPt
    }
} as const;

// Flatten all shared translations for easier access
const webTranslationsFlat: Record<string, Record<string, string>> = {};
for (const locale in rawWebTranslations) {
    webTranslationsFlat[locale] = flattenObject(
        rawWebTranslations[locale as keyof typeof rawWebTranslations]
    );
}

/**
 * Flattened translations for all web/shared namespaces.
 * Admin namespaces are NOT present — use `trans` from `config.ts` for the full catalog.
 *
 * Structure: `{ [locale]: { "namespace.key": "value" } }`
 */
export const webTrans = webTranslationsFlat as Record<Locale, Record<string, string>>;
