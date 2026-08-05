/**
 * @file i18n-client-namespaces.ts
 * @description The i18n key prefixes that ship to the BROWSER, and the only
 * place that set is declared (HOS-369 W3-2).
 *
 * The dictionary has two consumers with very different needs:
 *
 *  - **SSR** reads the full `@repo/i18n` catalog directly through
 *    `getLocaleDict`. It is not affected by this list and never will be —
 *    server rendering must resolve every key of every namespace.
 *  - **The browser** reads only what the hashed `/i18n/<locale>.<hash>.js`
 *    asset carries, and an island can only ask for a key some client-reachable
 *    module names. Everything else was pure download weight.
 *
 * Two cuts got us here, and the second is why this list is prefixes rather than
 * namespaces. Dropping the 21 namespaces no browser module can name saved
 * 28,113 B brotli. But most of what remained was still unreachable: inside the
 * namespaces that survived, the majority of keys are named only by `.astro`
 * files rendering server-side. Cutting at the **two-segment prefix** the client
 * actually names removes another 21,336 B (76,558 -> 55,222 brotli, −27.9%).
 *
 * **Two segments is a deliberate stopping point, not the maximum.** Full-prefix
 * granularity would save 31,401 B instead of 21,336 — but it needs 1,777
 * declared entries instead of 164, and every PR that adds a translation key
 * would have to regenerate them. At two segments a new key under an existing
 * prefix is covered automatically, and the list stays short enough to read in a
 * diff. 68% of the available win for 9% of the declaration.
 *
 * **Read this before editing the list.** The failure mode is not a crash. A key
 * with no shipped prefix resolves to `undefined`, and `resolve()` in `./i18n`
 * then renders either the call site's inline fallback (invisible — 154 call
 * sites pass one) or, with no fallback, **the raw key text in production**. The
 * `[MISSING: …]` marker exists only in dev builds, so a wrong entry here looks
 * perfect in dev and ships garbage.
 *
 * That is why the list is not maintained by hand-auditing components:
 * `test/lib/i18n-client-namespaces.guard.test.ts` recomputes it from the real
 * import graph out of the island entry points and fails CI on any divergence,
 * in BOTH directions.
 *
 * @module lib/i18n-client-namespaces
 */

/**
 * Key prefixes reachable from browser code, and therefore serialized into the
 * client dictionary asset.
 *
 * A prefix covers itself and everything beneath it: `account.nav` ships
 * `account.nav.dashboard` and every sibling. Entries are one or two segments —
 * one when that is all the code proves (a template literal like
 * `` `alliance-leads.${slug}.form` `` bounds nothing narrower than its
 * namespace), two otherwise.
 *
 * Derived from the import graph, not from intuition — see the guard test. The
 * ordering is alphabetical purely so diffs stay readable.
 */
export const CLIENT_I18N_KEY_PREFIXES = [
    'accommodations.aiChat',
    'accommodations.amenityCategories',
    'accommodations.amenityNames',
    'accommodations.comparison',
    'accommodations.detail',
    'accommodations.featureNames',
    'accommodations.types',
    'account.addons',
    'account.alerts',
    'account.alliances',
    'account.avatar',
    'account.editProfile',
    'account.exclusiveDeals',
    'account.favorites',
    'account.myContent',
    'account.nav',
    'account.newsletter',
    'account.pages',
    'account.preferences',
    'account.profileCompletion',
    'account.provider',
    'account.recommendations',
    'account.reviews',
    'account.searchHistory',
    'account.setPassword',
    'account.status',
    'account.subscription',
    'account.welcomeTour',
    'account.whatsNewBadge',
    'account.whatsNewModal',
    'account.whatsNewPanel',
    'aiSearch.charCount',
    'aiSearch.chat',
    'aiSearch.chips',
    'aiSearch.examples',
    'aiSearch.loginPromptCta',
    'aiSearch.loginPromptMessage',
    'aiSearch.loginPromptRegisterCta',
    'aiSearch.loginPromptTitle',
    'aiSearch.lowConfidenceMessage',
    'aiSearch.nearbyDestinations',
    'aiSearch.panelTitle',
    'aiSearch.rateLimitError',
    'aiSearch.serviceError',
    'aiSearch.triggerLabel',
    'alliance-leads',
    'alliance-leads.form',
    'auth-ui.common',
    'auth-ui.loading',
    'auth-ui.signIn',
    'auth-ui.signOut',
    'auth-ui.signUp',
    'auth-ui.userMenu',
    'auth.forgotPassword',
    'auth.resetPassword',
    'auth.signIn',
    'auth.signUp',
    'auth.verifyEmail',
    'billing.checkout',
    'billing.limit',
    'blog.categories',
    'comments.form',
    'comments.thread',
    'commerce.changePassword',
    'commerce.editOwn',
    'commerce.lead',
    'commerce.owner',
    'common.anonymous',
    'common.auth',
    'common.back',
    'common.cancel',
    'common.close',
    'common.deleting',
    'common.enums',
    'common.form',
    'common.loading',
    'common.modal',
    'common.next',
    'common.nextPage',
    'common.noImage',
    'common.optional',
    'common.pagination',
    'common.prev',
    'common.prevPage',
    'common.removing',
    'common.retry',
    'common.saving',
    'common.untitled',
    'contact.form',
    'contributions.form',
    'conversations.actions',
    'conversations.errors',
    'conversations.form',
    'conversations.inbox',
    'conversations.notifications',
    'conversations.thread',
    'cookieConsent.buttons',
    'cookieConsent.categories',
    'cookieConsent.description',
    'cookieConsent.learnMore',
    'cookieConsent.title',
    'destinations.climate',
    'destinations.detailPage',
    'destinations.poiTypeLabels',
    'destinations.weather',
    'events.categories',
    'experience.reviews',
    'external-reputation.aggregate',
    'external-reputation.errors',
    'external-reputation.ownerConfig',
    'external-reputation.platform',
    'external-reputation.refresh',
    'external-reputation.snippets',
    'external-reputation.status',
    'footer.newsletter',
    'home.featuredDestinations',
    'home.searchBar',
    'host-trades.card',
    'host-trades.categories',
    'host-trades.emptyState',
    'host-trades.filter',
    'host-trades.page',
    'host.dashboard',
    'host.form',
    'host.importFromUrl',
    'host.landing',
    'host.miniForm',
    'host.pages',
    'host.promotions',
    'host.properties',
    'maps.ariaLabelPointsOfInterest',
    'maps.attribution',
    'maps.hideSurroundings',
    'maps.showSurroundings',
    'nav.closeMenu',
    'nav.goHome',
    'nav.hostModeCta',
    'nav.language',
    'nav.mainNavigation',
    'nav.mobileMenu',
    'nav.ownerCta',
    'nav.signIn',
    'nav.theme',
    'newsletter.confirmYourEmail',
    'newsletter.error',
    'newsletter.errorMessage',
    'newsletter.errorPage',
    'pricing.free',
    'pricing.monthlyOnly',
    'pricing.period',
    'pricing.trialNotEligible',
    'review.carousel',
    'review.destinationSidebar',
    'review.dialog',
    'review.form',
    'review.gastronomySidebar',
    'review.list',
    'review.sidebar',
    'search.fewerAdults',
    'search.fewerChildren',
    'search.moreAdults',
    'search.moreChildren',
    'ui.accessibility',
    'ui.actions',
    'ui.errors',
    'ui.favorite',
    'ui.filter',
    'validation'
] as const;

/**
 * Prefixes whose keys are named ONLY from inside a workspace package, and are
 * therefore invisible to a scan of `apps/web`.
 *
 * These are not a convenience escape hatch — each one is a real code path that
 * a graph walk over the web app cannot see, and dropping it breaks the browser
 * silently:
 *
 *  - **`common.apiError`** — `lib/api-errors.ts` delegates to
 *    `translateApiErrorWithT`, which builds `common.apiError.<CODE>` inside
 *    `@repo/i18n`. No literal under that prefix exists anywhere in `apps/web`.
 *    Without this entry every API error message in the browser renders its own
 *    key.
 *  - **`validation`** (declared in the main list) — `lib/forms/field-errors.ts`
 *    feeds `issue.message` from `@repo/schemas` through
 *    `resolveValidationMessage`, which rewrites `zodError.X` to `validation.X`.
 *    1,722 of the namespace's 1,902 keys are reachable that way, and the
 *    fallback is passed as an explicit `undefined`, so a miss is visible to the
 *    user on a PUBLIC form.
 *
 * The guard asserts both code paths still exist, so removing one of these
 * entries without removing its call path fails CI rather than shipping.
 */
export const EXTERNAL_I18N_KEY_PREFIXES = ['common.apiError'] as const;

/** Every prefix the client asset carries. */
const ALL_CLIENT_PREFIXES: readonly string[] = [
    ...CLIENT_I18N_KEY_PREFIXES,
    ...EXTERNAL_I18N_KEY_PREFIXES
];

/**
 * Narrows a flattened `{ "namespace.key": value }` dictionary to the keys the
 * browser can actually name.
 *
 * @param messages - The full flattened dictionary for one locale.
 * @returns A new dictionary containing only client-reachable keys.
 */
export function pickClientNamespaces(
    messages: Readonly<Record<string, string>>
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(messages)) {
        for (const prefix of ALL_CLIENT_PREFIXES) {
            if (key === prefix || key.startsWith(`${prefix}.`)) {
                out[key] = value;
                break;
            }
        }
    }
    return out;
}
