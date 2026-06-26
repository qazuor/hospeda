/**
 * Admin-only i18n configuration for the Hospeda platform.
 *
 * This module contains ONLY the admin-* namespace imports. It is kept separate
 * from `config.shared.ts` so that the `@repo/i18n/web` subpath export can
 * exclude it entirely from the web client bundle via static import analysis.
 *
 * This module is composed into the full catalog by `config.ts` only.
 * It must NEVER be imported by web-facing code.
 */

import type { Locale } from './config.shared';
import { flattenObject } from './config.shared';

// ---------------------------------------------------------------------------
// Admin namespaces
// ---------------------------------------------------------------------------
export const adminNamespaces = [
    'admin-auth',
    'admin-billing',
    'admin-newsletter',
    'admin-nav',
    'admin-dashboard',
    'admin-menu',
    'admin-pages',
    'admin-tables',
    'admin-common',
    'admin-entities',
    'admin-filters',
    'admin-tabs',
    // What's New / Release Notes (admin panel only, SPEC-175)
    'admin-whats-new'
] as const;

export type AdminNamespace = (typeof adminNamespaces)[number];

// ---------------------------------------------------------------------------
// Spanish — admin namespaces only
// ---------------------------------------------------------------------------
import adminAuthEs from './locales/es/admin-auth.json';
import adminBillingEs from './locales/es/admin-billing.json';
import adminCommonEs from './locales/es/admin-common.json';
import adminDashboardEs from './locales/es/admin-dashboard.json';
import adminEntitiesEs from './locales/es/admin-entities.json';
import adminFiltersEs from './locales/es/admin-filters.json';
import adminMenuEs from './locales/es/admin-menu.json';
import adminNavEs from './locales/es/admin-nav.json';
import adminNewsletterEs from './locales/es/admin-newsletter.json';
import adminPagesEs from './locales/es/admin-pages.json';
import adminTablesEs from './locales/es/admin-tables.json';
import adminTabsEs from './locales/es/admin-tabs.json';
import adminWhatsNewEs from './locales/es/admin-whats-new.json';

// ---------------------------------------------------------------------------
// English — admin namespaces only
// ---------------------------------------------------------------------------
import adminAuthEn from './locales/en/admin-auth.json';
import adminBillingEn from './locales/en/admin-billing.json';
import adminCommonEn from './locales/en/admin-common.json';
import adminDashboardEn from './locales/en/admin-dashboard.json';
import adminEntitiesEn from './locales/en/admin-entities.json';
import adminFiltersEn from './locales/en/admin-filters.json';
import adminMenuEn from './locales/en/admin-menu.json';
import adminNavEn from './locales/en/admin-nav.json';
import adminNewsletterEn from './locales/en/admin-newsletter.json';
import adminPagesEn from './locales/en/admin-pages.json';
import adminTablesEn from './locales/en/admin-tables.json';
import adminTabsEn from './locales/en/admin-tabs.json';
import adminWhatsNewEn from './locales/en/admin-whats-new.json';

// ---------------------------------------------------------------------------
// Portuguese — admin namespaces only
// ---------------------------------------------------------------------------
import adminAuthPt from './locales/pt/admin-auth.json';
import adminBillingPt from './locales/pt/admin-billing.json';
import adminCommonPt from './locales/pt/admin-common.json';
import adminDashboardPt from './locales/pt/admin-dashboard.json';
import adminEntitiesPt from './locales/pt/admin-entities.json';
import adminFiltersPt from './locales/pt/admin-filters.json';
import adminMenuPt from './locales/pt/admin-menu.json';
import adminNavPt from './locales/pt/admin-nav.json';
import adminNewsletterPt from './locales/pt/admin-newsletter.json';
import adminPagesPt from './locales/pt/admin-pages.json';
import adminTablesPt from './locales/pt/admin-tables.json';
import adminTabsPt from './locales/pt/admin-tabs.json';
import adminWhatsNewPt from './locales/pt/admin-whats-new.json';

// ---------------------------------------------------------------------------
// Raw admin translations (admin-* namespaces only)
// ---------------------------------------------------------------------------

const rawAdminTranslations = {
    es: {
        'admin-auth': adminAuthEs,
        'admin-billing': adminBillingEs,
        'admin-newsletter': adminNewsletterEs,
        'admin-nav': adminNavEs,
        'admin-dashboard': adminDashboardEs,
        'admin-menu': adminMenuEs,
        'admin-pages': adminPagesEs,
        'admin-tables': adminTablesEs,
        'admin-common': adminCommonEs,
        'admin-entities': adminEntitiesEs,
        'admin-filters': adminFiltersEs,
        'admin-tabs': adminTabsEs,
        'admin-whats-new': adminWhatsNewEs
    },
    en: {
        'admin-auth': adminAuthEn,
        'admin-billing': adminBillingEn,
        'admin-newsletter': adminNewsletterEn,
        'admin-nav': adminNavEn,
        'admin-dashboard': adminDashboardEn,
        'admin-menu': adminMenuEn,
        'admin-pages': adminPagesEn,
        'admin-tables': adminTablesEn,
        'admin-common': adminCommonEn,
        'admin-entities': adminEntitiesEn,
        'admin-filters': adminFiltersEn,
        'admin-tabs': adminTabsEn,
        'admin-whats-new': adminWhatsNewEn
    },
    pt: {
        'admin-auth': adminAuthPt,
        'admin-billing': adminBillingPt,
        'admin-newsletter': adminNewsletterPt,
        'admin-nav': adminNavPt,
        'admin-dashboard': adminDashboardPt,
        'admin-menu': adminMenuPt,
        'admin-pages': adminPagesPt,
        'admin-tables': adminTablesPt,
        'admin-common': adminCommonPt,
        'admin-entities': adminEntitiesPt,
        'admin-filters': adminFiltersPt,
        'admin-tabs': adminTabsPt,
        'admin-whats-new': adminWhatsNewPt
    }
} as const;

// Flatten all admin translations for easier access
const adminTranslationsFlat: Record<string, Record<string, string>> = {};
for (const locale in rawAdminTranslations) {
    adminTranslationsFlat[locale] = flattenObject(
        rawAdminTranslations[locale as keyof typeof rawAdminTranslations]
    );
}

/**
 * Flattened translations for all admin-* namespaces.
 * Composed into the full catalog by `config.ts`.
 *
 * Structure: `{ [locale]: { "admin-namespace.key": "value" } }`
 */
export const adminTrans = adminTranslationsFlat as Record<Locale, Record<string, string>>;
