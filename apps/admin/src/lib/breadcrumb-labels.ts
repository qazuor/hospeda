/**
 * Path → i18n key map used by `Breadcrumbs` to translate path segments
 * that are NOT registered in `menuTree`.
 *
 * The breadcrumb component first looks up `menuTree` (driven by sidebar nav
 * items). For routes that exist as sub-pages but aren't surfaced in the main
 * nav (e.g. `/billing/exchange-rates`, `/notifications`, accommodation tabs),
 * it then falls back to this map before defaulting to a capitalized raw
 * segment.
 *
 * Keys are full pathnames starting with `/`. Values are i18n keys resolved
 * via the `t()` translator.
 */
export const breadcrumbLabels: Readonly<Record<string, string>> = {
    // Billing section (HOS-1416: the plans/subscriptions/addons/payments/
    // reconciliation/invoices/promo-codes/metrics/settings entries were
    // removed with the deleted billing pages)
    '/billing': 'admin-menu.billing.title',
    '/billing/sponsorships': 'admin-menu.billing.sponsorships',
    '/billing/owner-promotions': 'admin-menu.billing.ownerPromotions',
    '/billing/exchange-rates': 'admin-menu.billing.exchangeRates',
    '/platform/ops/cron': 'admin-menu.billing.cron',
    '/platform/ops/logs': 'admin-menu.billing.appLogs',
    '/platform/ops/webhooks': 'admin-menu.billing.webhookEvents',

    // Notifications (top-level)
    '/notifications': 'admin-menu.notifications',

    // Access section (users / roles / permissions)
    '/access': 'admin-menu.access.title',
    '/access/users': 'admin-menu.access.users',
    '/access/roles': 'admin-menu.access.roles',
    '/access/permissions': 'admin-menu.access.permissions'
};

/**
 * Segment-only suffix labels appended after an entity ID in breadcrumbs.
 *
 * Used for nested routes like `/accommodations/:id/amenities` where the path
 * has variable middle segments. The breadcrumb resolves the entity portion
 * separately via `entityContext`, then maps the trailing segment through
 * this dictionary.
 */
export const breadcrumbSegmentLabels: Readonly<Record<string, string>> = {
    edit: 'admin-menu.accommodations.edit',
    amenities: 'admin-menu.accommodations.amenities',
    features: 'admin-menu.accommodations.features',
    gallery: 'admin-menu.accommodations.gallery',
    pricing: 'admin-menu.accommodations.pricing',
    reviews: 'admin-menu.accommodations.reviews',
    activity: 'admin-menu.access.activity',
    permissions: 'admin-menu.access.permissions'
};
