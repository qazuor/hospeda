import type { createT } from '@/lib/i18n';

/** Static breadcrumb labels available in every supported locale. */
export const BREADCRUMB_LABEL_KEYS = [
    'accommodations',
    'destinations',
    'events',
    'experiences',
    'eatAndDrink',
    'posts',
    'authors',
    'plans',
    'plansHosts',
    'plansTourists',
    'plansExperiences',
    'plansBusinesses',
    'pricing',
    'map',
    'compare',
    'photos',
    'menu',
    'contact',
    'about',
    'faq',
    'promotions',
    'benefits',
    'partners',
    'sumateProvider',
    'sumateSponsor',
    'claimPartner',
    'collaborate',
    'collaborateEditors',
    'collaboratePhotos',
    'collaborateReport',
    'features',
    'integrations',
    'googleCalendar',
    'publish'
] as const;

/** A short-label key in the nav.breadcrumbLabels registry. */
export type BreadcrumbLabelKey = (typeof BREADCRUMB_LABEL_KEYS)[number];

/** Resolve a short breadcrumb label through the caller's translation function. */
export function breadcrumbLabel({
    t,
    key
}: {
    readonly t: ReturnType<typeof createT>;
    readonly key: BreadcrumbLabelKey;
}): string {
    return t(`nav.breadcrumbLabels.${key}`);
}
