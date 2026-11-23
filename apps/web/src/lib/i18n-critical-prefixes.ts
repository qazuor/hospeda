/**
 * @file i18n-critical-prefixes.ts
 * @description Which islands may hydrate before the deferred half of the
 * client dictionary has run, and which key prefixes they need — the two lists
 * the critical/rest split of the i18n asset is cut by (HOS-2572).
 *
 * ## Why the dictionary is split
 *
 * HOS-2388 made the whole client dictionary (~630 KB raw, ~125 KB gzip for
 * `es`) parser-blocking, because a deferred one could run after an island had
 * already rendered against an empty dictionary. It fixed raw keys and cost the
 * home ~680 ms of render-blocking time. So the asset is now two classic
 * scripts: a small parser-blocking CRITICAL part and a `defer` REST part.
 *
 * ## Which islands can hydrate before a deferred script runs (Astro 7.4)
 *
 * All of them. A deferred script runs after parsing ends AND after its own
 * download finishes, and the island runtime does not wait for either:
 *
 *  - `client:load` / `client:only` call `import()` the moment the island's
 *    custom element connects, mid-parse.
 *  - `client:media` does the same when the query already matches.
 *  - `client:visible` creates an IntersectionObserver mid-parse, and its
 *    callback fires on the next rendering opportunity, which the parser yields
 *    to. An above-the-fold island hydrates before the end of parsing.
 *  - `client:idle` uses `requestIdleCallback` (or `setTimeout(200)` where it is
 *    missing, e.g. Safari). The main thread IS idle while the browser waits for
 *    the deferred dictionary to finish downloading, so it fires in exactly that
 *    window. The HOS-2388 cookie banner was `client:idle`.
 *
 * Deriving the critical set from "every island that can hydrate early" would
 * therefore mean every island: measured, the `client:load`/`client:only`
 * islands alone name 90 KB of the 125 KB gzip — not a split worth having.
 *
 * ## What the split does instead
 *
 * The critical script also installs a hydration GATE (`./i18n-hydration-gate`)
 * that holds every island back until `DOMContentLoaded` — which the HTML spec
 * fires only after every deferred script has run (or failed) — EXCEPT the
 * islands listed in {@link EARLY_HYDRATION_ISLANDS}. Those hydrate exactly as
 * Astro intends, and their keys are in {@link CRITICAL_I18N_KEY_PREFIXES}. So:
 *
 *  - a gated island always sees the full dictionary;
 *  - an early island always finds its keys, because the critical script is
 *    parser-blocking in `<head>`.
 *
 * Either list can only fail safe in one direction: forgetting an island in the
 * early list delays its hydration to `DOMContentLoaded`; forgetting a prefix an
 * early island needs is what `test/lib/i18n-critical-prefixes.guard.test.ts`
 * catches, from the real import graph.
 *
 * @module lib/i18n-critical-prefixes
 */

/**
 * Islands that hydrate without waiting for the deferred dictionary, by the tag
 * name the `.astro` template renders them with — the name Astro serializes as
 * `opts.name` on the `<astro-island>` and hands to every hydration directive.
 *
 * Selection rule: the islands the shared chrome of the HTML shells mounts
 * (`BaseLayout`, `AuthLayout`, `ErrorLayout`, `Header`, `Footer`,
 * `MobileMenuIsland`) — they are on every page, above the fold or reachable
 * immediately, and their keys are few. A page-level island (an editor, a form,
 * a carousel) is gated: it waits for `DOMContentLoaded`, never for a key.
 *
 * Adding a name here is a PERFORMANCE decision with a correctness obligation:
 * every key prefix the island's import graph names must be added to
 * {@link CRITICAL_I18N_KEY_PREFIXES} — the guard fails until it is.
 */
export const EARLY_HYDRATION_ISLANDS = [
    'AiResetReviewPrompt',
    'AuthedPreferenceSync',
    'CookieConsentBanner',
    'FeedbackHeadlessHost',
    'GuestPreferenceNudge',
    'LanguageSwitcher',
    'MobileMenu',
    'NewsletterForm',
    'PaginationLoading',
    'PublishMenu',
    'SettingsDropdown',
    'ThemeControl',
    'ToastViewport',
    'UserMenu'
] as const;

/**
 * Key prefixes serialized into the parser-blocking critical script — what the
 * {@link EARLY_HYDRATION_ISLANDS} can name, and nothing else.
 *
 * Mixed granularity on purpose. The guard derives three-segment prefixes from
 * the early islands' import graph; an entry here may be that prefix or a
 * shorter ancestor of it when the ancestor costs about the same bytes
 * (`footer.newsletter` instead of its 24 leaves). Where the ancestor is big the
 * entry stays narrow.
 *
 * Every entry must also be covered by `CLIENT_I18N_KEY_PREFIXES`: the critical
 * part is cut FROM the client dictionary, so anything outside it never ships.
 */
export const CRITICAL_I18N_KEY_PREFIXES = [
    'account.aiAssistants.resetReview',
    'account.doors.common',
    'account.doors.partner',
    'account.doors.publish',
    'account.nav',
    'account.pages.dashboard',
    'account.ui.cancel',
    'account.ui.confirmError',
    'account.ui.dialogClose',
    'common.cancel',
    'conversations.inbox.guestInboxTitle',
    'conversations.inbox.ownerInboxTitle',
    'cookieConsent.buttons',
    'cookieConsent.categories',
    'cookieConsent.description',
    'cookieConsent.learnMore',
    'cookieConsent.title',
    // Permission values UserMenu compares against, not translation keys — kept
    // because the literal scan cannot tell the two apart (see the same note in
    // `CLIENT_I18N_KEY_PREFIXES`). They match no key, so they cost nothing.
    'experience.editOwn',
    'footer.newsletter',
    'nav.closeMenu',
    'nav.goHome',
    'nav.language',
    'nav.mainNavigation',
    'nav.mobileMenu',
    'nav.publishCta',
    'nav.publishCtaAria',
    'nav.signIn',
    'nav.theme',
    'ui.accessibility.closeToast',
    'venue.editOwn'
] as const;
