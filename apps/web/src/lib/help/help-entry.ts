/**
 * @file help-entry.ts
 * @description The «?» button's lookup (HOS-2410 `docs/web-ui.md` §6, D-H5):
 * which help article a page or editor section opens, read from the articles'
 * `entryFor` anchors, and the anchor a page or section stands for.
 *
 * A page anchor is `page:<route template without /[lang]/>`; only `/mi-cuenta`
 * pages get one, because no «?» is rendered outside the account area (AC-21).
 * An anchor no article claims has no entry, so the button renders nothing
 * (AC-22): an exempt page never shows a dead link.
 */

import { HELP_INDEX, HELP_SOURCE_LOCALE, type HelpLocale } from '@repo/help';
import type { TranslationFn } from '@/lib/i18n';
import { findLocalizedHelpArticle } from './help-catalog';
import { helpArticlePath } from './help-tokens';

/** The only route prefix whose pages carry a «?» (AC-21). */
export const HELP_LINK_ROUTE_PREFIX = 'mi-cuenta';

/**
 * `entryFor` anchor → article id, built once from the es index. Anchors are
 * locale-independent and guard (a) keeps them unique across the catalog.
 */
export const HELP_ENTRY_ARTICLE_IDS: ReadonlyMap<string, string> = new Map(
    HELP_INDEX.locales[HELP_SOURCE_LOCALE].flatMap((article) =>
        article.entryFor.map((anchor) => [anchor, article.id] as const)
    )
);

/** Route of the help center itself; its pages open help in the same tab. */
export const HELP_CENTER_ROUTE = `${HELP_LINK_ROUTE_PREFIX}/ayuda`;

/**
 * Whether a «?» with this anchor opens its article in a new tab. Everywhere
 * the reader keeps the page they were working on (AC-21 of HOS-2410), except
 * inside the help center: there the reader is already reading help, so a new
 * tab only piles up tabs (HOS-2552).
 *
 * @param args.anchor - The «?» anchor
 * @returns `false` for the help center's own pages, `true` otherwise
 *
 * @example
 * ```ts
 * helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/ayuda/[id]' }); // false
 * helpLinkOpensNewTab({ anchor: 'page:mi-cuenta/suscripcion' }); // true
 * ```
 */
export function helpLinkOpensNewTab({ anchor }: { readonly anchor: string }): boolean {
    const page = `page:${HELP_CENTER_ROUTE}`;
    return anchor !== page && !anchor.startsWith(`${page}/`);
}

/** The link attributes of a «?» button. */
export interface HelpLinkAttributes {
    readonly href: string;
    readonly target: '_blank' | undefined;
    readonly rel: 'noopener' | undefined;
    readonly ariaLabel: string;
}

/**
 * Everything `HelpLink.astro` puts on its `<a>`, so the new-tab rule is tested
 * as behaviour rather than as source text (HOS-2552).
 *
 * @param args.anchor - The «?» anchor
 * @param args.entry - The article it opens
 * @param args.locale - The page locale
 * @param args.t - The page translator
 * @returns `href`, `target`, `rel` and the accessible name
 */
export function helpLinkAttributes({
    anchor,
    entry,
    locale,
    t
}: {
    readonly anchor: string;
    readonly entry: HelpEntry;
    readonly locale: HelpLocale;
    readonly t: TranslationFn;
}): HelpLinkAttributes {
    const newTab = helpLinkOpensNewTab({ anchor });
    return {
        href: helpArticlePath({ id: entry.id, locale }),
        target: newTab ? '_blank' : undefined,
        rel: newTab ? 'noopener' : undefined,
        ariaLabel: t(
            newTab ? 'account.help.link.ariaLabel' : 'account.help.link.ariaLabelSameTab',
            undefined,
            { title: entry.title }
        )
    };
}

/**
 * The page anchor of a route pattern, or `undefined` outside `/mi-cuenta`.
 *
 * @param args.routePattern - `Astro.routePattern`, e.g. `/[lang]/mi-cuenta/suscripcion`
 * @returns For example `page:mi-cuenta/suscripcion`
 *
 * @example
 * ```ts
 * pageHelpAnchor({ routePattern: '/[lang]/mi-cuenta/propiedades/[id]/editar' });
 * // 'page:mi-cuenta/propiedades/[id]/editar'
 * pageHelpAnchor({ routePattern: '/[lang]/publicar' }); // undefined
 * ```
 */
export function pageHelpAnchor({
    routePattern
}: {
    readonly routePattern: string;
}): string | undefined {
    const route = routePattern
        .replace(/^\/+/, '')
        .replace(/^\[lang\]\/?/, '')
        .replace(/\/+$/, '');
    if (route !== HELP_LINK_ROUTE_PREFIX && !route.startsWith(`${HELP_LINK_ROUTE_PREFIX}/`)) {
        return undefined;
    }
    return `page:${route}`;
}

/**
 * The anchor of an editor section page.
 *
 * @param args.vertical - The listing vertical (`accommodation`, `venue`, `experience`)
 * @param args.slug - The web editor slug, e.g. `fotos`
 * @returns For example `section:venue.carta`
 */
export function sectionHelpAnchor({
    vertical,
    slug
}: {
    readonly vertical: string;
    readonly slug: string;
}): string {
    return `section:${vertical}.${slug}`;
}

/** What the «?» button needs to render. */
export interface HelpEntry {
    /** The article id, for the link. */
    readonly id: string;
    /** The article title in the page locale (or es), for the accessible name. */
    readonly title: string;
}

/**
 * The article a «?» with this anchor opens.
 *
 * @param args.anchor - A `page:` or `section:` anchor, maybe absent
 * @param args.locale - The page locale, for the title
 * @param args.entries - The anchor map; defaults to {@link HELP_ENTRY_ARTICLE_IDS}
 * @returns The entry, or `undefined` when no article claims the anchor
 */
export function findHelpEntry({
    anchor,
    locale,
    entries = HELP_ENTRY_ARTICLE_IDS
}: {
    readonly anchor: string | null | undefined;
    readonly locale: HelpLocale;
    readonly entries?: ReadonlyMap<string, string>;
}): HelpEntry | undefined {
    if (anchor === null || anchor === undefined) {
        return undefined;
    }
    const id = entries.get(anchor);
    if (id === undefined) {
        return undefined;
    }
    const localized = findLocalizedHelpArticle({ id, locale });
    return localized === undefined ? undefined : { id, title: localized.article.title };
}
