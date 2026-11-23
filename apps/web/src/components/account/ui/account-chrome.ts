/**
 * The data of the account chrome: the header's site navigation and icon
 * actions, and the footer's link groups (HOS-2550, HOS-2546).
 *
 * Owner decision of 2026-11-22, the «punto intermedio» between the compact
 * shell and the marketing chrome:
 *
 * - From 80rem (1280px) the header shows a compact site nav: Alojamientos,
 *   Destinos, Comer y salir and Experiencias. Eventos is deliberately NOT
 *   inline; it stays in the site menu with Blog and Contacto.
 * - Below 80rem the hamburger opens the site menu with every entry.
 * - «Ayuda» and «Qué hay de nuevo» are header icons, not sidebar entries.
 * - The footer has two rows: three link groups, then the legal links and ©.
 *
 * Pure functions: the Astro header and the React footer render what these
 * return, so the decisions are unit-tested here instead of as source text.
 *
 * @module components/account/ui/account-chrome
 */

import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { buildVenueCollectionNavItems } from '@/lib/venue/business-line-collection';

/** One link of the chrome. */
export interface ChromeLink {
    /** Stable id, for keys and tests. */
    readonly id: string;
    /** Translated label. */
    readonly label: string;
    /** Locale-prefixed href with a trailing slash. */
    readonly href: string;
}

/** One entry of the site menu behind the hamburger (may carry sub-links). */
export interface ChromeMenuItem {
    /** Translated label. */
    readonly label: string;
    /** Locale-prefixed href. */
    readonly href: string;
    /** Sub-links (the «Comer y salir» collections). */
    readonly children?: readonly { readonly label: string; readonly href: string }[];
}

/** The site entries, in menu order, with the i18n key of each label. */
const SITE_ENTRIES = [
    { id: 'accommodations', key: 'nav.accommodations', path: '/alojamientos/' },
    { id: 'destinations', key: 'nav.destinations', path: '/destinos/' },
    { id: 'venue', key: 'nav.venue', path: '/comer-y-salir/' },
    { id: 'experiences', key: 'nav.experiences', path: '/experiencias/' },
    { id: 'events', key: 'nav.events', path: '/eventos/' },
    { id: 'blog', key: 'nav.blog', path: '/publicaciones/' },
    { id: 'contact', key: 'nav.contact', path: '/contacto/' }
] as const;

/** Ids of the site entries the header shows inline from 80rem (owner, 2026-11-22). */
export const ACCOUNT_HEADER_INLINE_NAV_IDS = [
    'accommodations',
    'destinations',
    'venue',
    'experiences'
] as const;

/** Account path of the help center (the header «?»). */
export const ACCOUNT_HELP_CENTER_PATH = 'mi-cuenta/ayuda/';

/** Account path of the what's-new page (the header sparkle icon). */
export const ACCOUNT_WHATS_NEW_PATH = 'mi-cuenta/novedades/';

/** The header's site navigation. */
export interface AccountHeaderSiteNav {
    /** The links shown inline from 80rem. */
    readonly inline: readonly ChromeLink[];
    /** Every entry, for the site menu behind the hamburger (below 80rem). */
    readonly menu: readonly ChromeMenuItem[];
}

/**
 * Builds the header's site navigation.
 *
 * @param input - Options object.
 * @param input.locale - Locale for the hrefs.
 * @param input.t - Translator.
 * @returns The inline links and the full site menu.
 */
export function buildAccountHeaderSiteNav({
    locale,
    t
}: {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
}): AccountHeaderSiteNav {
    const links = SITE_ENTRIES.map((entry) => ({
        id: entry.id,
        label: t(entry.key),
        href: buildUrl({ locale, path: entry.path })
    }));
    const inlineIds: readonly string[] = ACCOUNT_HEADER_INLINE_NAV_IDS;
    return {
        inline: links.filter((link) => inlineIds.includes(link.id)),
        menu: links.map(({ id, label, href }) =>
            id === 'venue'
                ? { label, href, children: buildVenueCollectionNavItems({ locale, t }) }
                : { label, href }
        )
    };
}

/** One icon action of the header. */
export interface AccountHeaderAction {
    /** Locale-prefixed href. */
    readonly href: string;
    /** True on the page (or under the section) the action opens. */
    readonly current: boolean;
}

/** The header's icon actions. */
export interface AccountHeaderActions {
    /** The «?»: the help center, which preselects the reader's tab itself. */
    readonly help: AccountHeaderAction;
    /** «Qué hay de nuevo». */
    readonly whatsNew: AccountHeaderAction;
}

/**
 * Builds the header's icon actions.
 *
 * @param input - Options object.
 * @param input.locale - Locale for the hrefs.
 * @param input.currentPath - `Astro.url.pathname`, to mark the current action.
 * @returns The help and what's-new actions.
 */
export function buildAccountHeaderActions({
    locale,
    currentPath
}: {
    readonly locale: SupportedLocale;
    readonly currentPath: string;
}): AccountHeaderActions {
    const path = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
    const actionFor = (accountPath: string): AccountHeaderAction => {
        const href = buildUrl({ locale, path: accountPath });
        return { href, current: path.startsWith(href) };
    };
    return {
        help: actionFor(ACCOUNT_HELP_CENTER_PATH),
        whatsNew: actionFor(ACCOUNT_WHATS_NEW_PATH)
    };
}

/** One link group of the footer's first row. */
export interface AccountFooterGroup {
    /** Stable id. */
    readonly id: 'explore' | 'forYou' | 'help';
    /** Translated heading. */
    readonly title: string;
    /** The links. */
    readonly links: readonly ChromeLink[];
}

/** The footer's two rows. */
export interface AccountFooterModel {
    /** Row 1: Explorar, Para vos, Ayuda. */
    readonly groups: readonly AccountFooterGroup[];
    /** Row 2: the legal links (the © line is rendered next to them). */
    readonly legal: readonly ChromeLink[];
}

/**
 * Builds the footer's link groups and legal links.
 *
 * @param input - Options object.
 * @param input.locale - Locale for the hrefs.
 * @param input.t - Translator.
 * @returns The two footer rows.
 */
export function buildAccountFooterModel({
    locale,
    t
}: {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
}): AccountFooterModel {
    const link = (id: string, key: string, path: string): ChromeLink => ({
        id,
        label: t(key),
        href: buildUrl({ locale, path })
    });
    return {
        groups: [
            {
                id: 'explore',
                title: t('footer.exploreTitle'),
                links: [
                    link('accommodations', 'footer.accommodations', '/alojamientos/'),
                    link('destinations', 'footer.destinations', '/destinos/'),
                    link('experiences', 'footer.experiences', '/experiencias/')
                ]
            },
            {
                id: 'forYou',
                title: t('footer.forYouTitle'),
                links: [
                    link('publish', 'account.ui.chrome.publish', '/publicar/'),
                    link('plans', 'footer.plans', '/suscriptores/planes/')
                ]
            },
            {
                id: 'help',
                title: t('account.ui.chrome.helpGroup'),
                links: [
                    link('helpCenter', 'account.ui.chrome.helpCenter', ACCOUNT_HELP_CENTER_PATH),
                    link('contact', 'footer.contact', '/contacto/')
                ]
            }
        ],
        legal: [
            link('terms', 'footer.terms', '/legal/terminos/'),
            link('privacy', 'footer.privacy', '/legal/privacidad/'),
            link('cookies', 'footer.cookies', '/legal/cookies/')
        ]
    };
}
