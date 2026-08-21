/**
 * @file addon-focus.ts
 * @description The add-on "focus" contract (HOS-729): how a caller points the
 * add-ons page at ONE add-on without hiding the rest of the catalog.
 *
 * The add-ons page is two things at once — a patch (you arrived because you hit
 * a concrete cap) and a browsable catalog. A hard filter serves the patch and
 * kills the catalog: whoever arrives from the photo cap never learns that
 * featuring a listing exists. So focus REORDERS and HIGHLIGHTS, it never
 * filters:
 *
 * 1. the focused card renders first, alone, highlighted, under a heading that
 *    names the user's problem ("Para ampliar tus fotos");
 * 2. every other add-on renders below it, under "Otros complementos".
 *
 * Nothing is hidden, in any case — including when the slug does not match.
 *
 * Kept out of the island so the ordering rule is unit-testable without
 * rendering, and so the three consumers (limit links, the featured-listing
 * offer state, expiry emails) build the same URL from one place instead of
 * concatenating it by hand.
 *
 * @see apps/web/src/components/account/AddonsPurchasePanel.client.tsx
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

/**
 * Query-string parameter that puts an add-on in focus.
 *
 * Deliberately NOT `addon`: that name is already taken by the MercadoPago
 * return redirect (`?status=success&addon=<slug>`), where it feeds the result
 * banner's text. Overloading it would make a returning buyer's banner and a
 * cap-driven focus indistinguishable.
 */
export const ADDON_FOCUS_PARAM = 'focus';

/** Path of the add-ons page, after the locale segment. */
const ADDONS_PATH = 'mi-cuenta/addons';

/**
 * Contextual heading key per add-on slug: what the user came to solve, stated
 * in their terms rather than the product's.
 *
 * The heading is the only non-visual carrier of "this card is the one you came
 * for", so it must name the problem, not repeat the card's title.
 *
 * A slug absent from this table is NOT an error — it falls back to
 * {@link ADDON_FOCUS_FALLBACK_HEADING_KEY}, so a newly-added add-on can be
 * focused the day it ships, before anyone writes copy for it.
 */
export const ADDON_FOCUS_HEADING_KEY_BY_SLUG: Readonly<Record<string, string>> = {
    'extra-photos-20': 'account.addons.focus.headings.extra-photos-20',
    'extra-accommodations-5': 'account.addons.focus.headings.extra-accommodations-5',
    'extra-properties-5': 'account.addons.focus.headings.extra-properties-5',
    'visibility-boost-7d': 'account.addons.focus.headings.visibility-boost-7d',
    'visibility-boost-30d': 'account.addons.focus.headings.visibility-boost-30d',
    'ai-support-monthly': 'account.addons.focus.headings.ai-support-monthly'
};

/** Heading key used when a focused slug has no specific copy of its own. */
export const ADDON_FOCUS_FALLBACK_HEADING_KEY = 'account.addons.focus.headings.fallback';

/**
 * Returns the i18n key of the contextual heading for a focused add-on.
 *
 * @param slug - The focused add-on slug.
 * @returns Its specific heading key, or the generic fallback key.
 */
export function addonFocusHeadingKey(slug: string): string {
    return ADDON_FOCUS_HEADING_KEY_BY_SLUG[slug] ?? ADDON_FOCUS_FALLBACK_HEADING_KEY;
}

/**
 * Builds the URL that opens the add-ons page with one add-on in focus.
 *
 * Carries BOTH the query parameter and the `#addon-<slug>` fragment: the
 * fragment is the pre-existing contract (live links already use it, and native
 * scroll depends on it), the parameter is what actually highlights and
 * reorders. One link does both.
 *
 * @param params.locale - Active locale, for the URL's locale segment.
 * @param params.slug - Add-on slug to focus (e.g. `extra-photos-20`).
 * @returns e.g. `/es/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20`
 */
export function buildAddonFocusUrl({
    locale,
    slug
}: {
    readonly locale: SupportedLocale;
    readonly slug: string;
}): string {
    const base = buildUrl({ locale, path: ADDONS_PATH });
    const query = new URLSearchParams({ [ADDON_FOCUS_PARAM]: slug }).toString();

    return `${base}?${query}#addon-${slug}`;
}

/** Minimum shape the focus split needs from an add-on. */
interface FocusableAddon {
    readonly slug: string;
}

/** Result of splitting a catalog around the focused add-on. */
export interface AddonFocusSplit<TAddon extends FocusableAddon> {
    /** The focused add-on, or `null` when nothing matched. */
    readonly focused: TAddon | null;
    /**
     * Everything else, in its original order.
     *
     * When `focused` is `null` this is the WHOLE catalog — the page degrades to
     * its normal render rather than showing an empty or partial list.
     */
    readonly rest: readonly TAddon[];
}

/**
 * Splits a catalog into the focused add-on and everything else.
 *
 * A `focusSlug` that matches nothing (an invalid slug, or an add-on the user
 * already owns and which is therefore not in the list) yields
 * `{ focused: null, rest: <the whole catalog> }`. That is the degradation
 * contract: no card is ever dropped, whatever the query string says.
 *
 * @param params.addons - The catalog, in the order the page would show it.
 * @param params.focusSlug - The requested slug, or `null`/`undefined`.
 * @returns The focused add-on (or `null`) and the remaining catalog.
 */
export function splitAddonsByFocus<TAddon extends FocusableAddon>({
    addons,
    focusSlug
}: {
    readonly addons: readonly TAddon[];
    readonly focusSlug?: string | null;
}): AddonFocusSplit<TAddon> {
    if (!focusSlug) {
        return { focused: null, rest: addons };
    }

    const focused = addons.find((addon) => addon.slug === focusSlug) ?? null;

    if (focused === null) {
        return { focused: null, rest: addons };
    }

    return { focused, rest: addons.filter((addon) => addon.slug !== focusSlug) };
}
