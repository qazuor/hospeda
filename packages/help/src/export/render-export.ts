/**
 * @file render-export.ts
 * @description Renders the help catalog of one audience as a single Markdown
 * document for flyers (HOS-2410 US-10, AC-35). Pure: the articles, the site URL
 * and the article lookup are arguments, so it reads no file.
 *
 * Shape:
 *
 * ```text
 * # Ayuda Hospeda — <audience label>
 * ## <article title>            one per article, sorted by title (es collation)
 * <summary>
 * ### Qué podés hacer … ### Problemas comunes   the five sections, fixed order
 * ### Relacionados              the related titles, left out when there are none
 * ```
 *
 * Tokens resolve as `docs/data-model.md` §5.2 fixes for the export: a limit reads
 * "según tu plan", a link is `[label](<siteUrl>/es/<path>)` (an editor section
 * points at the vertical's list page, since no listing is known), and an article
 * reference is the target's title in «». A `###` inside a section becomes `####`
 * so it nests under its section, and its explicit `{#id}` is dropped.
 *
 * Screenshots (`docs/screenshots.md` §7) are not rendered: articles declare no
 * shots until HOS-2410 PR-15, so there is no image URL to export yet.
 */

import { buildPortalUrl } from '@repo/portal-routes';
import type { HelpArticle } from '../article.schema';
import {
    HELP_AUDIENCE_LABELS,
    HELP_AUDIENCES,
    HELP_EXPORT_LIMIT_TEXT,
    HELP_RELATED_HEADINGS,
    HELP_SECTION_HEADINGS
} from '../constants';
import type { HelpDestination } from '../destination.schema';
import { toPortalDestination } from '../destination-template';
import { helpDestinationLabel, resolveHelpText } from '../resolve-tokens';

/** What `--audience` may name: one audience, or every article. */
export const HELP_EXPORT_AUDIENCES = [...HELP_AUDIENCES, 'all'] as const;

/** One value of {@link HELP_EXPORT_AUDIENCES}. */
export type HelpExportAudience = (typeof HELP_EXPORT_AUDIENCES)[number];

/** The title suffix of the bundle with every article. */
const ALL_AUDIENCES_LABEL = 'Todas las guías';

/** The locale every exported link and heading is in. */
const EXPORT_LOCALE = 'es';

/** Arguments for {@link renderHelpExport}. RO-RO. */
export interface RenderHelpExportArgs {
    /** The catalog to export from (the es articles). */
    readonly articles: readonly HelpArticle[];
    /** Which articles to export. */
    readonly audience: HelpExportAudience;
    /** Public base URL every link is made absolute under. */
    readonly siteUrl: string;
}

/** The destination an exported link points at: an editor section becomes its list page. */
function exportDestination(destination: HelpDestination): HelpDestination {
    return destination.kind === 'ownEditorSection'
        ? { kind: 'ownerListings', vertical: destination.vertical }
        : destination;
}

/** Escapes the characters that would end or nest a Markdown link text early. */
function escapeLinkText(text: string): string {
    return text.replace(/[\\[\]]/g, '\\$&');
}

/** A Markdown link to a destination, or just its label when no URL can be built. */
function markdownLink({
    destination,
    label,
    siteUrl
}: {
    readonly destination: HelpDestination;
    readonly label?: string;
    readonly siteUrl: string;
}): string {
    const target = exportDestination(destination);
    const text = escapeLinkText(label ?? helpDestinationLabel({ destination: target }));
    try {
        const url = buildPortalUrl({
            destination: toPortalDestination({ destination: target }),
            locale: EXPORT_LOCALE,
            siteUrl
        });
        return `[${text}](${url})`;
    } catch {
        return text;
    }
}

/** Nests a section's `###` headings under the export's `###` section headings. */
function demoteHeadings(markdown: string): string {
    return markdown.replace(
        /^(#{3,5}) (.*?)(?:\s*\{#[a-z0-9-]+\})?[ \t]*$/gm,
        (_line, hashes: string, text: string) => `#${hashes} ${text}`
    );
}

/** Whether an article belongs to the exported audience. */
function inAudience({
    article,
    audience
}: {
    readonly article: HelpArticle;
    readonly audience: HelpExportAudience;
}): boolean {
    return audience === 'all' || article.audiences.some((value) => value === audience);
}

/**
 * The articles an export of the audience holds, in catalog order.
 *
 * @param args.articles - The catalog
 * @param args.audience - The exported audience
 * @returns The articles of that audience (every article for `all`)
 */
export function helpExportArticles({
    articles,
    audience
}: {
    readonly articles: readonly HelpArticle[];
    readonly audience: HelpExportAudience;
}): readonly HelpArticle[] {
    return articles.filter((article) => inAudience({ article, audience }));
}

/** Renders one article as a `##` block. */
function renderArticle({
    article,
    audience,
    siteUrl,
    byId
}: {
    readonly article: HelpArticle;
    readonly audience: HelpExportAudience;
    readonly siteUrl: string;
    readonly byId: ReadonlyMap<string, HelpArticle>;
}): string {
    const headings = HELP_SECTION_HEADINGS.es;
    const relatedHeading = HELP_RELATED_HEADINGS.es;
    if (headings === undefined || relatedHeading === undefined) {
        throw new Error('the es section headings are not defined');
    }
    const resolve = (text: string) =>
        resolveHelpText({
            text,
            article,
            findArticle: ({ id }) => byId.get(id),
            resolvers: {
                limit: () => HELP_EXPORT_LIMIT_TEXT,
                link: ({ destination, label }) => markdownLink({ destination, label, siteUrl }),
                article: ({ id, target }) => `«${target?.title ?? id}»`
            }
        });
    const section = (heading: string, body: string) =>
        `### ${heading}\n\n${demoteHeadings(resolve(body).trim())}`;
    const { canDo, howTo, expect, notExpect, troubleshooting } = article.sections;
    const steps = howTo.steps.map((step, index) => `${index + 1}. ${resolve(step)}`).join('\n');
    const after = howTo.after.trim();
    const related = article.related
        .flatMap((id) => {
            const target = byId.get(id);
            return target !== undefined && inAudience({ article: target, audience })
                ? [`- «${target.title}»`]
                : [];
        })
        .join('\n');
    return [
        `## ${article.title}`,
        article.summary,
        section(headings.canDo, canDo),
        `### ${headings.howTo}\n\n${steps}${after.length > 0 ? `\n\n${demoteHeadings(resolve(after))}` : ''}`,
        section(headings.expect, expect),
        section(headings.notExpect, notExpect),
        section(headings.troubleshooting, troubleshooting),
        ...(related.length > 0 ? [`### ${relatedHeading}\n\n${related}`] : [])
    ].join('\n\n');
}

/**
 * Renders the Markdown bundle of one audience.
 *
 * @param args - The catalog, the audience and the site URL
 * @returns One Markdown document, ending with a newline
 *
 * @example
 * ```ts
 * renderHelpExport({ articles: HELP_ARTICLES, audience: 'venue', siteUrl: 'https://example.test' });
 * // '# Ayuda Hospeda — Comer y salir\n\n## …'
 * ```
 */
export function renderHelpExport({ articles, audience, siteUrl }: RenderHelpExportArgs): string {
    const byId = new Map(articles.map((article) => [article.id, article]));
    const collator = new Intl.Collator(EXPORT_LOCALE);
    const label = audience === 'all' ? ALL_AUDIENCES_LABEL : HELP_AUDIENCE_LABELS[audience];
    const blocks = [...helpExportArticles({ articles, audience })]
        .sort((left, right) => collator.compare(left.title, right.title))
        .map((article) => renderArticle({ article, audience, siteUrl, byId }));
    return `${[`# Ayuda Hospeda — ${label}`, ...blocks].join('\n\n')}\n`;
}
