/**
 * @file load-feedback-styles.ts
 * @description Lazy loader for the @repo/feedback widget's stylesheets (HOS-369 W3-5).
 *
 * `BaseLayout.astro` statically imported both `@repo/feedback/styles.css` (the
 * package's own rules) and `@/styles/feedback-overrides.css` (the Hospeda brand
 * mapping) at the top of the module. Measured live on staging: 4,105 B wire /
 * 18,611 B decoded, render-blocking on every page — even though the widget it
 * styles, `FeedbackHeadlessHost`, hydrates with `client:idle` and cannot be
 * interacted with before that.
 *
 * As with GLightbox (`lib/load-glightbox.ts`) and react-day-picker
 * (`filter-types/load-day-picker-styles.ts`), moving the import into its own
 * module is NOT enough — Vite merges a module whose only content is a CSS
 * import back into its parent chunk, and Astro hoists the stylesheet into
 * `<head>` again regardless. `?url` is what breaks the chain: see
 * `lib/ensure-stylesheet.ts` for the full explanation.
 *
 * ## Cascade order is load-bearing
 *
 * `feedback-overrides.css` maps the package's neutral tokens onto the Hospeda
 * brand palette. Its selectors have the SAME specificity as the package's own
 * rules, so it wins the cascade purely by loading AFTER
 * `@repo/feedback/styles.css` — not via higher specificity or `!important`.
 * `attachFeedbackStylesInOrder` below awaits each `ensureStylesheet` call
 * before starting the next one for exactly this reason: a `Promise.all` (or
 * two independent callers) would race the two `<link>` insertions and the
 * load order would no longer be guaranteed. Do NOT parallelize these calls,
 * and do NOT "fix" a cascade regression with specificity — that means the
 * order broke; restore the order instead.
 *
 * ## Re-attaching after Astro view-transition navigation
 *
 * `FeedbackHeadlessHost` is mounted with `transition:persist="feedback-host"`
 * in `BaseLayout.astro`, so it is NEVER unmounted/remounted by `ClientRouter`
 * navigations — `transition:persist` exists specifically to keep an island's
 * internal state (and therefore its effects) from re-running. That is
 * different from `react-day-picker`'s host (`DateRangeFilter`), which is a
 * plain, non-persisted island that gets a fresh mount — and therefore a fresh
 * `loadDayPickerStyles()` call — on every page that renders it.
 *
 * Astro's default swap independently strips any `<link>` it does not
 * recognize from the OLD document's `<head>` on every navigation
 * (`swapFunctions.swapHeadElements` removes every head element not persisted
 * to the new document — verified against Astro's own docs, and empirically:
 * a runtime-injected `<link data-ensured>` disappears after one soft nav).
 * Because `FeedbackHeadlessHost` never remounts, it cannot rely on that to
 * restore its own CSS the way `DateRangeFilter` does. So `loadFeedbackStyles`
 * ALSO re-runs itself on every `astro:after-swap`, independent of whether the
 * island's mount effect fires again.
 */

import feedbackPackageCssUrl from '@repo/feedback/styles.css?url';
import { ensureStylesheet } from '@/lib/ensure-stylesheet';
import feedbackOverridesCssUrl from '@/styles/feedback-overrides.css?url';

/** Guards against attaching the `astro:after-swap` re-loader more than once. */
let reloadListenerAttached = false;

/**
 * Attaches the package stylesheet, then the Hospeda override stylesheet, in
 * that order. See the file header for why the order must not change.
 */
async function attachFeedbackStylesInOrder(): Promise<void> {
    await ensureStylesheet({ href: feedbackPackageCssUrl });
    await ensureStylesheet({ href: feedbackOverridesCssUrl });
}

/**
 * Loads the feedback widget's stylesheets and keeps them attached across
 * Astro view-transition navigations.
 *
 * Call from `FeedbackHeadlessHost`'s mount effect — not on-open — so the
 * styles are already in place before the user can trigger the modal (via the
 * keyboard shortcut or the `feedback:open` event). Safe to call more than
 * once: `ensureStylesheet` no-ops when a link is already attached, and the
 * `astro:after-swap` listener is registered only on the first call.
 *
 * @returns A promise that settles once both stylesheets have loaded (or
 *   failed) for this call. The `astro:after-swap` re-attachments run
 *   independently and do not extend this promise.
 */
export function loadFeedbackStyles(): Promise<void> {
    if (typeof document !== 'undefined' && !reloadListenerAttached) {
        reloadListenerAttached = true;
        document.addEventListener('astro:after-swap', () => {
            void attachFeedbackStylesInOrder();
        });
    }
    return attachFeedbackStylesInOrder();
}
