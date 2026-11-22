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
    type HelpAudience,
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
    /** The target's audiences, so the page can carry the reader's tab. */
    readonly audiences: readonly HelpAudience[];
}

/** One link of the «Páginas» box. Hrefs never repeat within one box. */
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
    /**
     * The «Páginas» label of a link to an editor section, naming its vertical
     * («Fotos» → «Fotos de tu alojamiento»), in the content locale. The
     * authored label stays bare because `get_help` adds the listing name.
     */
    readonly editorSectionLabel: (args: {
        readonly label: string;
        readonly vertical: HelpEditorVertical;
    }) => string;
    /** Site origin for the sanitizer. */
    readonly siteOrigin: string;
}

/** The verticals an editor-section destination can name. */
export type HelpEditorVertical = 'accommodation' | 'venue' | 'experience';

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

/** Splits a label into words, for the common-prefix merge. */
function wordsOf(label: string): readonly string[] {
    return label.trim().split(/\s+/);
}

/**
 * One label for several links that open the same page. Labels that share a
 * leading run of words keep it once («Fotos de tu comercio» + «Fotos de tu
 * experiencia» → «Fotos de tu comercio o experiencia»); otherwise the whole
 * labels are joined as alternatives. Equal labels collapse to one.
 *
 * @param args.labels - The labels, in authoring order
 * @param args.locale - The locale the labels are written in (for «o» / «or» / «ou»)
 * @returns The merged label
 */
export function mergeHelpPageLabels({
    labels,
    locale
}: {
    readonly labels: readonly string[];
    readonly locale: HelpLocale;
}): string {
    const unique = [...new Set(labels.map((label) => label.trim()))];
    if (unique.length <= 1) {
        return unique[0] ?? '';
    }
    const split = unique.map(wordsOf);
    const shortest = Math.min(...split.map((words) => words.length));
    let shared = 0;
    while (shared < shortest - 1 && split.every((words) => words[shared] === split[0]?.[shared])) {
        shared += 1;
    }
    const list = new Intl.ListFormat(locale, { type: 'disjunction' });
    if (shared === 0) {
        return list.format(unique);
    }
    const prefix = (split[0] ?? []).slice(0, shared).join(' ');
    return `${prefix} ${list.format(split.map((words) => words.slice(shared).join(' ')))}`;
}

/** A «Páginas» link before deduplication. */
export interface HelpPageLinkCandidate extends HelpPageLinkView {
    /**
     * Whether the href is where the destination really goes. An editor
     * section is not: on the web it degrades to the vertical's list page.
     */
    readonly exact: boolean;
}

/**
 * The «Páginas» links with no repeated destination. Links that open the same
 * path become one: the label of a link that really goes there wins (an editor
 * section that degraded to the list page must not rename «Mis propiedades»);
 * otherwise the labels merge with {@link mergeHelpPageLabels}. The first
 * occurrence keeps its position.
 *
 * @param args.links - The links, in authoring order
 * @param args.locale - The locale the labels are written in
 * @returns One link per distinct href
 */
export function dedupeHelpPageLinks({
    links,
    locale
}: {
    readonly links: readonly HelpPageLinkCandidate[];
    readonly locale: HelpLocale;
}): readonly HelpPageLinkView[] {
    const groups = new Map<string, HelpPageLinkCandidate[]>();
    for (const link of links) {
        const group = groups.get(link.href);
        if (group === undefined) {
            groups.set(link.href, [link]);
        } else {
            group.push(link);
        }
    }
    return [...groups].map(([href, group]) => {
        const exact = group.find((link) => link.exact);
        return {
            href,
            label:
                exact?.label ??
                mergeHelpPageLabels({ labels: group.map((link) => link.label), locale })
        };
    });
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
    editorSectionLabel,
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
                href: helpArticlePath({ id, locale }),
                audiences: target.article.audiences
            }
        ];
    });

    const pages = dedupeHelpPageLinks({
        links: article.destinations.map(
            (destination): HelpPageLinkCandidate =>
                destination.kind === 'ownEditorSection'
                    ? {
                          href: helpDestinationPath({ destination, locale }),
                          label: editorSectionLabel({
                              label: helpDestinationLabel({ destination }),
                              vertical: destination.vertical
                          }),
                          exact: false
                      }
                    : {
                          href: helpDestinationPath({ destination, locale }),
                          label: helpDestinationLabel({ destination }),
                          exact: true
                      }
        ),
        locale: contentLocale
    });

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
