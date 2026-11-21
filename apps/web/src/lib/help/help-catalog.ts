/**
 * @file help-catalog.ts
 * @description What the web help pages read of the help index (HOS-2410
 * `docs/web-ui.md` §1–§4): the articles of a locale with the es fallback
 * (AC-11), the cards of one audience sorted by title (AC-1), and the compact
 * projection the search island receives instead of the full index (§3).
 *
 * Pure over `HELP_INDEX`: nothing here reads the session (D-H4), so every
 * reader of a locale gets the same lists.
 */

import {
    HELP_AUDIENCES,
    HELP_INDEX,
    HELP_SOURCE_LOCALE,
    type HelpArticle,
    type HelpAudience,
    type HelpLocale
} from '@repo/help';

/** One article as the web shows it, with the locale its content is written in. */
export interface LocalizedHelpArticle {
    /** The article, in `contentLocale`. */
    readonly article: HelpArticle;
    /** The locale of the content: the page locale, or `es` when it has no translation. */
    readonly contentLocale: HelpLocale;
    /** Whether the content fell back to `es` because the page locale has none (AC-11). */
    readonly isFallback: boolean;
}

/** What the search island receives per article (web-ui §3). Never the full index. */
export interface HelpSearchEntry {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly keywords: readonly string[];
    readonly audiences: readonly HelpAudience[];
}

/**
 * One article for a page locale: that locale's translation when it exists,
 * else the es source.
 *
 * @param args.id - The article id
 * @param args.locale - The page locale
 * @returns The article and its content locale, or `undefined` for an unknown id (AC-10)
 */
export function findLocalizedHelpArticle({
    id,
    locale
}: {
    readonly id: string;
    readonly locale: HelpLocale;
}): LocalizedHelpArticle | undefined {
    const translated = HELP_INDEX.locales[locale]?.find((article) => article.id === id);
    if (translated !== undefined) {
        return { article: translated, contentLocale: locale, isFallback: false };
    }
    const source = HELP_INDEX.locales[HELP_SOURCE_LOCALE].find((article) => article.id === id);
    if (source === undefined) {
        return undefined;
    }
    return {
        article: source,
        contentLocale: HELP_SOURCE_LOCALE,
        isFallback: locale !== HELP_SOURCE_LOCALE
    };
}

/**
 * Every article for a page locale, each in its best available language.
 *
 * @param args.locale - The page locale
 * @returns One entry per es article, in index order (by id)
 */
export function listLocalizedHelpArticles({
    locale
}: {
    readonly locale: HelpLocale;
}): readonly LocalizedHelpArticle[] {
    return HELP_INDEX.locales[HELP_SOURCE_LOCALE].flatMap((source) => {
        const localized = findLocalizedHelpArticle({ id: source.id, locale });
        return localized === undefined ? [] : [localized];
    });
}

/**
 * The articles of one audience, sorted by title with the locale's collation (AC-1).
 *
 * @param args.articles - The localized articles
 * @param args.audience - The audience of the tab
 * @param args.locale - The page locale, which fixes the collation
 * @returns The articles whose `audiences` include `audience`
 */
export function helpArticlesForAudience({
    articles,
    audience,
    locale
}: {
    readonly articles: readonly LocalizedHelpArticle[];
    readonly audience: HelpAudience;
    readonly locale: HelpLocale;
}): readonly LocalizedHelpArticle[] {
    const collator = new Intl.Collator(locale);
    return articles
        .filter(({ article }) => article.audiences.includes(audience))
        .sort((a, b) => collator.compare(a.article.title, b.article.title));
}

/**
 * The search projection of the localized articles (web-ui §3).
 *
 * @param args.articles - The localized articles
 * @returns `{ id, title, summary, keywords, audiences }` per article
 */
export function toHelpSearchEntries({
    articles
}: {
    readonly articles: readonly LocalizedHelpArticle[];
}): readonly HelpSearchEntry[] {
    return articles.map(({ article }) => ({
        id: article.id,
        title: article.title,
        summary: article.summary,
        keywords: article.keywords,
        audiences: article.audiences
    }));
}

/**
 * The audience a `?para=` value names, or `undefined` when it names none.
 *
 * @param args.value - The raw query parameter, maybe absent
 * @returns A help audience, or `undefined`
 */
export function parseHelpAudience({
    value
}: {
    readonly value: string | null | undefined;
}): HelpAudience | undefined {
    return HELP_AUDIENCES.find((audience) => audience === value);
}

/** The tab selected when the URL names no audience (web-ui §2). */
export const DEFAULT_HELP_AUDIENCE: HelpAudience = 'host';
