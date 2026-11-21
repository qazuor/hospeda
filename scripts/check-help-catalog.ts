/**
 * @file check-help-catalog.ts
 * @description GUARD (a) of the help catalog (HOS-2410 `docs/guards.md` §2,
 * AC-13, AC-24…AC-28): the Markdown help in `packages/help/content` parses,
 * resolves against the repo, and matches the committed index. It replaces
 * `check-owner-help` (HOS-2333), which checked the TS catalog this one
 * replaced.
 *
 * ## What it checks (a failure exits 1)
 *
 * - (a1) Every content file parses, its frontmatter passes the schema, its body
 *   has the five sections in order, no «Cómo se hace» step carries a token, it renders under the 5 000-character
 *   ceiling, and the layout rules R-1…R-4 hold.
 * - (a2) Every destination resolves to a page under `apps/web/src/pages/[lang]/`,
 *   through the route map and the same page lookup as `check-portal-routes`.
 *   Route keys whose page has not shipped yet (`PORTAL_UNRELEASED_ROUTE_KEYS`)
 *   are skipped, as `check-portal-routes` skips them.
 * - (a3) Every `faqKey` is an item of the es FAQ.
 * - (a4) Every `reviewedAt` and `translation.sourceReviewedAt` is a real date
 *   and not in the future, in Argentina local date.
 * - (a5) Every `covers` and `entryFor` anchor resolves (see
 *   `help-catalog-anchors.ts`), and no two articles claim one `entryFor`.
 * - (a6) Every token parses and names a limit key, link target or article that
 *   exists; a `{{limit}}` without vertical fails in a multi-vertical article.
 * - (a7) Every `related` id is an article.
 * - (a8) The committed `generated/help-index.json` equals a fresh generation byte
 *   for byte. The message names the first differing article. Fix: `pnpm help:build`.
 * - (a9) Non-vacuity: at least one article. The per-audience form (one article
 *   per audience) turns on in the closing PR of HOS-2410 (`requireEveryAudience`).
 * - (IL-1…IL-5) The interlinking rules of `docs/data-model.md` §3.1.
 *
 * ## What it reports without failing (exit 0)
 *
 * - Articles whose `reviewedAt` is older than 180 days (STALE), and translations
 *   older than their es source.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - Whether a step is TRUE: it checks that pages, keys and tools exist, never
 *   that a button is still there or a flow still works in that order.
 * - A page that exists but redirects, 404s or 403s for some states.
 * - Whether a FAQ item still agrees with the article that extends it.
 * - Whether a `section` slug still belongs to the section the article talks
 *   about (only that its page exists), the blind spot of `check-portal-routes`.
 * - IL-2 in the «Cómo se hace» steps: get_help returns them verbatim and does
 *   not resolve tokens yet (HOS-2410 PR-12), so a step cannot carry a token
 *   (a1 rejects any `{{` in a step) and cannot satisfy IL-1 either.
 * - `helpTopicId` literals in API refusals (none exist today).
 *
 * Exit codes: 0 = clean (stale articles may be listed); 1 = a violation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HelpArticle, HelpIndex } from '../packages/help/src/article.schema.js';
import { HELP_AUDIENCES, HELP_STALE_DAYS } from '../packages/help/src/constants.js';
import { helpDestinationTemplate } from '../packages/help/src/destination-template.js';
import {
    buildHelpIndex,
    formatHelpIssues,
    type HelpCatalogIssue,
    type HelpCatalogPredicate,
    helpIssue,
    readHelpContentFiles,
    toCanonicalJson
} from '../packages/help/src/generator/index.js';
import { parseHelpTokens } from '../packages/help/src/tokens.js';
import {
    PORTAL_ROUTE_TEMPLATES,
    PORTAL_UNRELEASED_ROUTE_KEYS
} from '../packages/portal-routes/src/index.js';
import { PORTAL_PAGES_DIR, pageExists } from './check-portal-routes.js';
import { createAnchorResolver, type HelpRepoVocabularies } from './help-catalog-anchors.js';

/** The content dir, relative to the repo root. */
export const HELP_CONTENT_PATH = 'packages/help/content';

/** The committed index, relative to the repo root. */
export const HELP_INDEX_PATH = 'packages/help/generated/help-index.json';

/** The es FAQ file, relative to the repo root. */
export const ES_FAQ_FILE = 'packages/i18n/src/locales/es/faq.json';

/** The time zone the review dates are written in. */
const REVIEW_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<HelpCatalogPredicate, string>> = {
    a1: 'GUARD:help-catalog (a1): an article does not parse, breaks a body or layout rule, or is too long.',
    a2: 'GUARD:help-catalog (a2): an article links to a portal page that does not exist in apps/web.',
    a3: 'GUARD:help-catalog (a3): an article extends a FAQ item that does not exist in the es FAQ.',
    a4: 'GUARD:help-catalog (a4): a review date is not a past or present YYYY-MM-DD date (Argentina).',
    a5: 'GUARD:help-catalog (a5): a covers/entryFor anchor names nothing in the repo, or an entryFor is claimed twice.',
    a6: 'GUARD:help-catalog (a6): a token does not parse or names a key, target or article that does not exist.',
    a7: 'GUARD:help-catalog (a7): a related id is not an article.',
    a8: 'GUARD:help-catalog (a8): the committed help index is stale.',
    a9: 'GUARD:help-catalog (a9): the help catalog is empty (or misses an audience), so nothing was checked.',
    'IL-1': 'GUARD:help-catalog (IL-1): a covered page or section has no {{link}} in the body.',
    'IL-2': 'GUARD:help-catalog (IL-2): an article quotes another article title without a token.',
    'IL-3': 'GUARD:help-catalog (IL-3): an {{article}} token points at an anchor the target does not have.',
    'IL-4': 'GUARD:help-catalog (IL-4): an article has no inbound link.',
    'IL-5': 'GUARD:help-catalog (IL-5): an article body has no {{article}} token.'
};

/** An article due for a re-check, or a translation behind its source. */
export interface StaleArticle {
    readonly id: string;
    readonly detail: string;
}

/** Arguments for {@link checkHelpCatalog}. RO-RO. */
export interface CheckHelpCatalogArgs {
    /** Repo root: pages, FAQ, registries, tools and anchored files are read from it. */
    readonly root: string;
    /** Content dir; defaults to `<root>/packages/help/content`. */
    readonly contentDir?: string;
    /** Committed index; defaults to `<root>/packages/help/generated/help-index.json`. */
    readonly indexFile?: string;
    /** The clock; defaults to now. */
    readonly now?: Date;
    /** Days after which an article is stale. */
    readonly staleDays?: number;
    /** a9 in its final form: every audience has an article. */
    readonly requireEveryAudience?: boolean;
    /** Overrides the key and enum vocabularies (tests). */
    readonly vocabularies?: HelpRepoVocabularies;
}

/** What {@link checkHelpCatalog} found. */
export interface CheckHelpCatalogResult {
    readonly violations: readonly HelpCatalogIssue[];
    readonly stale: readonly StaleArticle[];
    readonly articleCount: number;
}

/** Today in Argentina, as `YYYY-MM-DD`. */
function argentinaToday({ now }: { readonly now: Date }): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: REVIEW_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
}

/** Whole days from a real `YYYY-MM-DD` date to another, or `undefined` when it is not real. */
function daysBetween({ from, to }: { readonly from: string; readonly to: string }) {
    const start = Date.parse(`${from}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(start)) {
        return undefined;
    }
    if (new Date(start).toISOString().slice(0, 10) !== from) {
        return undefined;
    }
    return Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS);
}

/** Whether `faqKey` (`<category>.<item>`) is an item of the FAQ content. */
function faqItemExists({ faq, faqKey }: { readonly faq: unknown; readonly faqKey: string }) {
    const [category = '', item = ''] = faqKey.split('.');
    const categories = (faq as { categories?: Record<string, { items?: object }> } | null)
        ?.categories;
    const items = categories?.[category]?.items;
    return items !== undefined && Object.hasOwn(items, item);
}

/** The first article id whose serialized entry differs between two indexes. */
export function firstDifferingArticle({
    committed,
    fresh
}: {
    readonly committed: string;
    readonly fresh: HelpIndex;
}): string {
    let parsed: { locales?: Record<string, Array<{ id?: string }>> };
    try {
        parsed = JSON.parse(committed);
    } catch {
        return '(the committed file is not valid JSON)';
    }
    for (const locale of ['es', 'en', 'pt'] as const) {
        const before = new Map(
            (parsed.locales?.[locale] ?? []).map((article) => [article.id, article])
        );
        const after = new Map<string | undefined, unknown>(
            (fresh.locales[locale] ?? []).map((article) => [article.id, article])
        );
        const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
        const differing = ids.find(
            (id) =>
                toCanonicalJson({ value: before.get(id) ?? null }) !==
                toCanonicalJson({ value: after.get(id) ?? null })
        );
        if (differing !== undefined) {
            return `${locale}/${differing}`;
        }
    }
    return '(no article differs: the version or contentHash does)';
}

/** a2 and a3 for one article. */
function linkIssues({
    article,
    root,
    faq
}: {
    readonly article: HelpArticle;
    readonly root: string;
    readonly faq: unknown;
}): HelpCatalogIssue[] {
    const issues: HelpCatalogIssue[] = [];
    const unreleased = new Set<string>(
        PORTAL_UNRELEASED_ROUTE_KEYS.map((key) => PORTAL_ROUTE_TEMPLATES[key])
    );
    for (const destination of article.destinations) {
        const template = helpDestinationTemplate({ destination });
        if (
            !unreleased.has(template) &&
            !pageExists({ pagesRoot: join(root, PORTAL_PAGES_DIR), path: template })
        ) {
            issues.push(
                helpIssue({
                    predicate: 'a2',
                    articleId: article.id,
                    detail: `no page for ${template} under ${PORTAL_PAGES_DIR}`
                })
            );
        }
    }
    if (article.faqKey !== undefined && !faqItemExists({ faq, faqKey: article.faqKey })) {
        issues.push(
            helpIssue({
                predicate: 'a3',
                articleId: article.id,
                detail: `faqKey ${article.faqKey} is not an item of ${ES_FAQ_FILE}`
            })
        );
    }
    return issues;
}

/**
 * Checks the help catalog against a repo.
 *
 * @param args - See {@link CheckHelpCatalogArgs}
 * @returns The violations, the stale articles and how many articles were read
 */
export function checkHelpCatalog({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    indexFile = join(root, HELP_INDEX_PATH),
    now = new Date(),
    staleDays = HELP_STALE_DAYS,
    requireEveryAudience = false,
    vocabularies
}: CheckHelpCatalogArgs): CheckHelpCatalogResult {
    const files = readHelpContentFiles({ contentDir });
    const built = buildHelpIndex({ files });
    const violations: HelpCatalogIssue[] = [...built.issues];
    const stale: StaleArticle[] = [];
    const articles = built.index === undefined ? [] : Object.values(built.index.locales).flat();

    if (files.length === 0) {
        violations.push(helpIssue({ predicate: 'a9', detail: `no article under ${contentDir}` }));
    }
    if (requireEveryAudience) {
        for (const audience of HELP_AUDIENCES) {
            if (!built.index?.locales.es.some((article) => article.audiences.includes(audience))) {
                violations.push(
                    helpIssue({
                        predicate: 'a9',
                        detail: `no es article for the ${audience} audience`
                    })
                );
            }
        }
    }

    const faqFile = join(root, ES_FAQ_FILE);
    const faq: unknown = existsSync(faqFile) ? JSON.parse(readFileSync(faqFile, 'utf8')) : null;
    const resolves = createAnchorResolver({
        root,
        ...(vocabularies === undefined ? {} : { vocabularies })
    });
    const today = argentinaToday({ now });
    const es = new Map((built.index?.locales.es ?? []).map((article) => [article.id, article]));

    for (const article of articles) {
        const at = { articleId: `${article.locale}/${article.id}` };
        violations.push(...linkIssues({ article, root, faq }));
        for (const anchor of new Set([...article.covers, ...article.entryFor])) {
            if (!resolves(anchor)) {
                violations.push(
                    helpIssue({
                        predicate: 'a5',
                        ...at,
                        detail: `${anchor} names nothing in the repo`
                    })
                );
            }
        }
        const { howTo, ...prose } = article.sections;
        for (const text of [...howTo.steps, howTo.after, ...Object.values(prose)]) {
            for (const token of parseHelpTokens({ text }).tokens) {
                if (token.kind === 'limit' && !resolves(`limit:${token.args[0] ?? ''}`)) {
                    violations.push(
                        helpIssue({
                            predicate: 'a6',
                            ...at,
                            detail: `${token.raw}: no limit key "${token.args[0] ?? ''}"`
                        })
                    );
                }
            }
        }
        const dates = [
            article.reviewedAt,
            ...(article.translation ? [article.translation.sourceReviewedAt] : [])
        ];
        for (const date of dates) {
            const age = daysBetween({ from: date, to: today });
            if (age === undefined || age < 0) {
                violations.push(
                    helpIssue({
                        predicate: 'a4',
                        ...at,
                        detail: `"${date}" is not a past or present YYYY-MM-DD date (today is ${today} in Argentina)`
                    })
                );
            }
        }
        const age = daysBetween({ from: article.reviewedAt, to: today });
        if (age !== undefined && age > staleDays) {
            stale.push({
                id: at.articleId,
                detail: `reviewed ${article.reviewedAt}, ${age} days ago (limit ${staleDays})`
            });
        }
        const source = es.get(article.id);
        if (
            article.translation &&
            source &&
            source.reviewedAt > article.translation.sourceReviewedAt
        ) {
            stale.push({
                id: at.articleId,
                detail: `translated from the ${article.translation.sourceReviewedAt} es text; es was reviewed ${source.reviewedAt}`
            });
        }
    }

    if (built.index !== undefined && built.json !== undefined) {
        const committed = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
        if (committed !== built.json) {
            violations.push(
                helpIssue({
                    predicate: 'a8',
                    detail: `${HELP_INDEX_PATH} differs from a fresh build; first differing article: ${firstDifferingArticle({ committed, fresh: built.index })}. Run: pnpm help:build`
                })
            );
        }
    }

    return { violations, stale, articleCount: files.length };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args - See {@link CheckHelpCatalogArgs}; the root defaults to this repo
 * @returns The exit code and the text to print
 */
export function run(args: Partial<CheckHelpCatalogArgs> = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const { violations, stale, articleCount } = checkHelpCatalog({ root: REPO_ROOT, ...args });
    const staleLines = stale.map(
        (entry) =>
            `  - ${entry.id}: ${entry.detail}. Re-check it and run pnpm help:review once it exists (PR-4); until then bump reviewedAt.`
    );
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        const lines = [
            ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
            formatHelpIssues({ issues: violations }),
            'Fix: edit the article under packages/help/content, then run pnpm help:build and commit the index.',
            ...(staleLines.length > 0 ? ['STALE articles:', ...staleLines] : [])
        ];
        return { exitCode: 1, output: lines.join('\n') };
    }
    const summary = `OK GUARD:help-catalog: ${articleCount} articles parse, resolve against the repo, interlink, and match the committed index`;
    return {
        exitCode: 0,
        output:
            staleLines.length > 0
                ? [
                      summary,
                      `WARN GUARD:help-catalog: ${stale.length} stale, not failing:`,
                      ...staleLines
                  ].join('\n')
                : summary
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    process[result.exitCode === 0 ? 'stdout' : 'stderr'].write(`${result.output}\n`);
    process.exit(result.exitCode);
}
