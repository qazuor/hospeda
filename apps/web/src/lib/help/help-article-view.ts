/**
 * @file help-article-view.ts
 * @description Everything the help article page renders, computed from one
 * article of the index (HOS-2410 `docs/web-ui.md` §4, AC-9, AC-11): the five
 * sections as sanitized HTML with their fixed anchors, the generated
 * «Relacionados» list, the side index, the «Páginas» box and whether the
 * limit island is needed.
 *
 * Pure and session-free (D-H4), so the page stays a thin template and the
 * whole rendering is unit-tested over the real index.
 */

import {
    HELP_RELATED_ANCHOR,
    HELP_RELATED_HEADINGS,
    HELP_SECTION_ANCHORS,
    HELP_SECTION_HEADINGS,
    HELP_SECTION_KEYS,
    HELP_SOURCE_LOCALE,
    type HelpArticle,
    type HelpLocale,
    type HelpSectionKey,
    parseHelpTokens
} from '@repo/help';
import { buildUrl } from '@/lib/urls';
import { findLocalizedHelpArticle } from './help-catalog';
import {
    escapeHelpHtml,
    helpArticlePath,
    helpDestinationLabel,
    helpDestinationPath,
    resolveHelpTokensForWeb
} from './help-tokens';
import { renderHelpMarkdown } from './render-help-markdown';

/** One authored section, ready for `set:html`. */
export interface HelpSectionView {
    readonly key: HelpSectionKey;
    readonly anchor: string;
    readonly heading: string;
    /** Sanitized HTML of the section body. */
    readonly html: string;
}

/** One link of the side index. */
export interface HelpTocEntry {
    readonly anchor: string;
    readonly label: string;
}

/** One entry of the generated «Relacionados» list. */
export interface HelpRelatedView {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly href: string;
}

/** One link of the «Páginas» box. */
export interface HelpPageLinkView {
    readonly href: string;
    readonly label: string;
}

/** What the article page renders. */
export interface HelpArticleView {
    readonly sections: readonly HelpSectionView[];
    readonly relatedHeading: string;
    readonly related: readonly HelpRelatedView[];
    readonly toc: readonly HelpTocEntry[];
    readonly pages: readonly HelpPageLinkView[];
    /** The FAQ category link, when the article has a `faqKey`. */
    readonly faqHref: string | undefined;
    /** The verticals named by the article's `limit` tokens; empty means no limit island. */
    readonly limitVerticals: readonly string[];
}

/** Arguments for {@link buildHelpArticleView}. RO-RO. */
export interface BuildHelpArticleViewArgs {
    /** The article, in its content locale. */
    readonly article: HelpArticle;
    /** The page locale, used in every link. */
    readonly locale: HelpLocale;
    /** The locale the article content is written in (headings follow it). */
    readonly contentLocale: HelpLocale;
    /** What a `limit` token reads before the island fills the value. */
    readonly neutralLimitText: string;
    /** Site origin for the sanitizer. */
    readonly siteOrigin: string;
}

/** Every authored text of an article: the four prose sections, the steps and the text after them. */
function authoredTexts({ article }: { readonly article: HelpArticle }): readonly string[] {
    const { canDo, howTo, expect, notExpect, troubleshooting } = article.sections;
    return [canDo, ...howTo.steps, howTo.after, expect, notExpect, troubleshooting];
}

/** The verticals the `limit` tokens of an article name (explicitly or by default). */
function limitVerticalsOf({ article }: { readonly article: HelpArticle }): readonly string[] {
    const verticals = new Set<string>();
    for (const text of authoredTexts({ article })) {
        for (const token of parseHelpTokens({ text }).tokens) {
            if (token.kind === 'limit') {
                const vertical = token.args[1] ?? article.verticals[0];
                if (vertical !== undefined) {
                    verticals.add(vertical);
                }
            }
        }
    }
    return [...verticals].sort();
}

/**
 * Computes the article page.
 *
 * @param args - The article, the locales, the neutral limit text and the origin
 * @returns The view the page renders
 */
export function buildHelpArticleView({
    article,
    locale,
    contentLocale,
    neutralLimitText,
    siteOrigin
}: BuildHelpArticleViewArgs): HelpArticleView {
    const headings =
        HELP_SECTION_HEADINGS[contentLocale] ?? HELP_SECTION_HEADINGS[HELP_SOURCE_LOCALE];
    const relatedHeading =
        HELP_RELATED_HEADINGS[contentLocale] ?? HELP_RELATED_HEADINGS[HELP_SOURCE_LOCALE] ?? '';
    const titleOf = (id: string): string | undefined =>
        findLocalizedHelpArticle({ id, locale })?.article.title;
    const resolve = (text: string): string =>
        resolveHelpTokensForWeb({ text, article, locale, neutralLimitText, titleOf });
    const render = (markdown: string): string =>
        renderHelpMarkdown({ markdown: resolve(markdown), siteOrigin });

    const sections = HELP_SECTION_KEYS.map((key): HelpSectionView => {
        let html: string;
        if (key === 'howTo') {
            const { steps, after } = article.sections.howTo;
            const list = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
            html = render(after.trim() === '' ? list : `${list}\n\n${after}`);
        } else {
            html = render(article.sections[key]);
        }
        return { key, anchor: HELP_SECTION_ANCHORS[key], heading: headings?.[key] ?? key, html };
    });

    const related = article.related.flatMap((id): HelpRelatedView[] => {
        const target = findLocalizedHelpArticle({ id, locale });
        if (target === undefined) {
            return [];
        }
        return [
            {
                id,
                title: target.article.title,
                summary: target.article.summary,
                href: helpArticlePath({ id, locale })
            }
        ];
    });

    const pages = article.destinations.map(
        (destination): HelpPageLinkView => ({
            href: helpDestinationPath({ destination, locale }),
            label: helpDestinationLabel({ destination })
        })
    );

    const faqCategory = article.faqKey?.split('.')[0];
    const faqHref =
        faqCategory === undefined
            ? undefined
            : `${buildUrl({ locale, path: 'preguntas-frecuentes' })}#cat-${escapeHelpHtml({ text: faqCategory })}`;

    return {
        sections,
        relatedHeading,
        related,
        toc: [
            ...sections.map((section) => ({ anchor: section.anchor, label: section.heading })),
            { anchor: HELP_RELATED_ANCHOR, label: relatedHeading }
        ],
        pages,
        faqHref,
        limitVerticals: limitVerticalsOf({ article })
    };
}
