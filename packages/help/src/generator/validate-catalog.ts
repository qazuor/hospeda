/**
 * @file validate-catalog.ts
 * @description The checks that need more than one article (HOS-2410
 * `docs/data-model.md` §1, §3, §3.1, §5): the layout rules R-1…R-4, related
 * ids (a7), token references (a6), `entryFor` uniqueness (a5), the rendered
 * length ceiling (a1) and the interlinking rules IL-1…IL-5.
 *
 * Content-only: it reads no repo file. Whether an anchor, a limit key or a page
 * exists in the repo is guard (a), in `scripts/check-help-catalog.ts`.
 */

import { describePortalDestination } from '@repo/portal-routes';
import type { HelpArticleFrontmatter } from '../article.schema';
import {
    HELP_COMMON_FOLDER,
    HELP_MAX_RENDERED_CHARS,
    HELP_NEUTRAL_LIMIT_TEXT,
    HELP_SOURCE_LOCALE,
    type HelpFolder,
    type HelpLocale
} from '../constants';
import {
    helpDestinationTemplate,
    helpEditorSectionSlug,
    toPortalDestination
} from '../destination-template';
import { resolveHelpLinkTarget } from '../link-targets';
import { HELP_RETIRED_IDS } from '../retired-ids';
import { type HelpToken, parseHelpTokens, replaceHelpTokens } from '../tokens';
import { type HelpCatalogIssue, helpIssue } from './issues';
import type { ParsedHelpBody } from './parse-article';

/** One article that parsed, with where it lives. */
export interface ParsedHelpEntry {
    /** Path relative to the content dir (`es/common/photos.md`). */
    readonly file: string;
    /** The locale folder. */
    readonly locale: HelpLocale;
    /** The audience folder. */
    readonly folder: HelpFolder;
    /** The file name without `.md`. */
    readonly fileId: string;
    /** The validated frontmatter. */
    readonly frontmatter: HelpArticleFrontmatter;
    /** The parsed body. */
    readonly body: ParsedHelpBody;
}

/** Every authored text of an article, labelled by where it is. */
function bodyTexts({ body }: { readonly body: ParsedHelpBody }) {
    const { canDo, howTo, expect, notExpect, troubleshooting } = body.sections;
    return {
        steps: howTo.steps,
        prose: [canDo, howTo.after, expect, notExpect, troubleshooting]
    };
}

/** Every token of an article body. */
function tokensOf({ body }: { readonly body: ParsedHelpBody }): {
    readonly tokens: readonly HelpToken[];
    readonly errors: readonly string[];
} {
    const { steps, prose } = bodyTexts({ body });
    const results = [...steps, ...prose].map((text) => parseHelpTokens({ text }));
    return {
        tokens: results.flatMap((result) => result.tokens),
        errors: results.flatMap((result) => result.errors)
    };
}

/** Checks R-1 to R-4 and the translation rules of one entry. */
function layoutIssues({
    entry,
    byLocale
}: {
    readonly entry: ParsedHelpEntry;
    readonly byLocale: ReadonlyMap<HelpLocale, ReadonlyMap<string, ParsedHelpEntry>>;
}): HelpCatalogIssue[] {
    const { file, frontmatter: article } = entry;
    const issue = (detail: string) =>
        helpIssue({ predicate: 'a1', file, articleId: article.id, detail });
    const issues: HelpCatalogIssue[] = [];
    if (entry.fileId !== article.id) {
        issues.push(
            issue(`R-1: the file is named "${entry.fileId}.md" but its id is "${article.id}"`)
        );
    }
    const [single, ...more] = article.audiences;
    const expectedFolder = more.length === 0 && single !== undefined ? single : HELP_COMMON_FOLDER;
    if (entry.folder !== expectedFolder) {
        issues.push(
            issue(`R-2: it belongs in the "${expectedFolder}" folder, not "${entry.folder}"`)
        );
    }
    if (HELP_RETIRED_IDS.includes(article.id)) {
        issues.push(issue(`R-4: "${article.id}" is a retired id and cannot be reused`));
    }
    if (entry.locale === HELP_SOURCE_LOCALE && article.translation !== undefined) {
        issues.push(issue('an es article must not carry a "translation" block'));
    }
    if (entry.locale !== HELP_SOURCE_LOCALE) {
        if (article.translation === undefined) {
            issues.push(issue(`a ${entry.locale} article needs a "translation" block`));
        }
        if (!byLocale.get(HELP_SOURCE_LOCALE)?.has(article.id)) {
            issues.push(issue(`a ${entry.locale} article needs its es counterpart`));
        }
    }
    return issues;
}

/** Checks the tokens of one entry (a6, IL-3) and returns them for the other rules. */
function tokenIssues({
    entry,
    articles
}: {
    readonly entry: ParsedHelpEntry;
    readonly articles: ReadonlyMap<string, ParsedHelpEntry>;
}): HelpCatalogIssue[] {
    const { file, frontmatter: article } = entry;
    const issue = (predicate: 'a6' | 'IL-3', detail: string) =>
        helpIssue({ predicate, file, articleId: article.id, detail });
    const { tokens, errors } = tokensOf({ body: entry.body });
    const issues = errors.map((error) => issue('a6', error));
    for (const token of tokens) {
        if (token.kind === 'limit') {
            const [, vertical, ...extra] = token.args;
            if (extra.length > 0) {
                issues.push(
                    issue('a6', `${token.raw}: a limit token takes a key and an optional vertical`)
                );
            } else if (vertical === undefined && article.verticals.length !== 1) {
                issues.push(
                    issue(
                        'a6',
                        `${token.raw}: the article has ${article.verticals.length} verticals, so the token must name one`
                    )
                );
            } else if (
                vertical !== undefined &&
                !article.verticals.some((value) => value === vertical)
            ) {
                issues.push(
                    issue('a6', `${token.raw}: "${vertical}" is not one of the article's verticals`)
                );
            }
        } else if (token.kind === 'link') {
            const resolved = resolveHelpLinkTarget({ args: token.args });
            if (!resolved.ok) {
                issues.push(issue('a6', `${token.raw}: ${resolved.reason}`));
            }
        } else {
            const [id, anchor, ...extra] = token.args;
            const target = id === undefined ? undefined : articles.get(id);
            if (extra.length > 0 || target === undefined) {
                issues.push(
                    issue('a6', `${token.raw}: no article "${id ?? ''}" in ${entry.locale}`)
                );
            } else if (anchor !== undefined && !target.body.anchors.includes(anchor)) {
                issues.push(issue('IL-3', `${token.raw}: "${id}" has no anchor "${anchor}"`));
            }
        }
    }
    return issues;
}

/** IL-1: every page and section the article covers is linked from its body. */
function linkCoverageIssues({ entry }: { readonly entry: ParsedHelpEntry }): HelpCatalogIssue[] {
    const { file, frontmatter: article } = entry;
    const destinations = tokensOf({ body: entry.body })
        .tokens.filter((token) => token.kind === 'link')
        .flatMap((token) => {
            const resolved = resolveHelpLinkTarget({ args: token.args });
            return resolved.ok ? [resolved.destination] : [];
        });
    const issues: HelpCatalogIssue[] = [];
    for (const anchor of new Set([...article.covers, ...article.entryFor])) {
        const [kind, target = ''] = [
            anchor.slice(0, anchor.indexOf(':')),
            anchor.slice(anchor.indexOf(':') + 1)
        ];
        const linked =
            kind === 'page'
                ? destinations.some(
                      (destination) => helpDestinationTemplate({ destination }) === target
                  )
                : kind === 'section'
                  ? destinations.some(
                        (destination) =>
                            destination.kind === 'ownEditorSection' &&
                            `${destination.vertical}.${helpEditorSectionSlug({ destination })}` ===
                                target
                    )
                  : true;
        if (!linked) {
            issues.push(
                helpIssue({
                    predicate: 'IL-1',
                    file,
                    articleId: article.id,
                    detail: `${anchor} is covered but the body has no {{link:…}} token to it`
                })
            );
        }
    }
    return issues;
}

/** The length of an article with every token resolved neutrally. */
function renderedLength({
    entry,
    articles
}: {
    readonly entry: ParsedHelpEntry;
    readonly articles: ReadonlyMap<string, ParsedHelpEntry>;
}): number {
    const neutral = (token: HelpToken): string => {
        if (token.label !== undefined) {
            return token.label;
        }
        if (token.kind === 'limit') {
            return HELP_NEUTRAL_LIMIT_TEXT;
        }
        if (token.kind === 'article') {
            return articles.get(token.args[0] ?? '')?.frontmatter.title ?? '';
        }
        const resolved = resolveHelpLinkTarget({ args: token.args });
        return resolved.ok
            ? describePortalDestination({
                  destination: toPortalDestination({ destination: resolved.destination })
              })
            : '';
    };
    const { steps, prose } = bodyTexts({ body: entry.body });
    return [...steps, ...prose].reduce(
        (total, text) => total + replaceHelpTokens({ text, replace: neutral }).length,
        0
    );
}

/**
 * Runs every cross-article check over the parsed entries.
 *
 * @param args.entries - Every article that parsed, of every locale
 * @returns The issues found, in file order
 */
export function validateHelpCatalog({
    entries
}: {
    readonly entries: readonly ParsedHelpEntry[];
}): HelpCatalogIssue[] {
    const issues: HelpCatalogIssue[] = [];
    const byLocale = new Map<HelpLocale, Map<string, ParsedHelpEntry>>();
    for (const entry of entries) {
        const articles = byLocale.get(entry.locale) ?? new Map<string, ParsedHelpEntry>();
        if (articles.has(entry.frontmatter.id)) {
            issues.push(
                helpIssue({
                    predicate: 'a1',
                    file: entry.file,
                    articleId: entry.frontmatter.id,
                    detail: `R-3: the id "${entry.frontmatter.id}" is used by another ${entry.locale} article`
                })
            );
        }
        articles.set(entry.frontmatter.id, entry);
        byLocale.set(entry.locale, articles);
    }

    const entryForOwner = new Map<string, string>();
    for (const entry of entries) {
        const articles = byLocale.get(entry.locale) ?? new Map<string, ParsedHelpEntry>();
        const { file, frontmatter: article } = entry;
        const at = { file, articleId: article.id };
        issues.push(...layoutIssues({ entry, byLocale }));
        issues.push(...tokenIssues({ entry, articles }));
        issues.push(...linkCoverageIssues({ entry }));

        for (const id of article.related) {
            if (!articles.has(id)) {
                issues.push(
                    helpIssue({
                        predicate: 'a7',
                        ...at,
                        detail: `related "${id}" is not an article in ${entry.locale}`
                    })
                );
            }
        }
        if (entry.locale === HELP_SOURCE_LOCALE) {
            for (const anchor of article.entryFor) {
                const owner = entryForOwner.get(anchor);
                if (owner !== undefined && owner !== article.id) {
                    issues.push(
                        helpIssue({
                            predicate: 'a5',
                            ...at,
                            detail: `entryFor ${anchor} is already claimed by "${owner}"`
                        })
                    );
                }
                entryForOwner.set(anchor, owner ?? article.id);
            }
        }
        for (const destination of article.destinations) {
            if (destination.kind === 'helpArticle' && !articles.has(destination.id)) {
                issues.push(
                    helpIssue({
                        predicate: 'a2',
                        ...at,
                        detail: `destination helpArticle "${destination.id}" is not an article`
                    })
                );
            }
        }
        const length = renderedLength({ entry, articles });
        if (length > HELP_MAX_RENDERED_CHARS) {
            issues.push(
                helpIssue({
                    predicate: 'a1',
                    ...at,
                    detail: `renders to ${length} characters, over the ${HELP_MAX_RENDERED_CHARS} ceiling: split it`
                })
            );
        }

        const ownTokens = tokensOf({ body: entry.body }).tokens;
        if (!ownTokens.some((token) => token.kind === 'article')) {
            issues.push(
                helpIssue({
                    predicate: 'IL-5',
                    ...at,
                    detail: 'the body has no {{article:…}} token'
                })
            );
        }
        const inbound = entries.some(
            (other) =>
                other !== entry &&
                other.locale === entry.locale &&
                (other.frontmatter.related.includes(article.id) ||
                    tokensOf({ body: other.body }).tokens.some(
                        (token) => token.kind === 'article' && token.args[0] === article.id
                    ))
        );
        if (!inbound) {
            issues.push(
                helpIssue({
                    predicate: 'IL-4',
                    ...at,
                    detail: 'no other article links to it (related or {{article}})'
                })
            );
        }
        // IL-2 reads the prose only: the «Cómo se hace» steps are returned verbatim
        // by get_help, which does not resolve tokens yet (HOS-2410 PR-12), so a
        // step cannot carry an {{article}} token.
        const prose = bodyTexts({ body: entry.body })
            .prose.map((text) => replaceHelpTokens({ text, replace: () => '' }))
            .join('\n');
        for (const other of articles.values()) {
            if (other !== entry && prose.includes(other.frontmatter.title)) {
                issues.push(
                    helpIssue({
                        predicate: 'IL-2',
                        ...at,
                        detail: `the title of "${other.frontmatter.id}" is quoted without an {{article:${other.frontmatter.id}}} token`
                    })
                );
            }
        }
    }
    return issues;
}
