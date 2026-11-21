/**
 * @file check-owner-help.ts
 * @description GUARD (HOS-2333, spec HOS-2335 §5.4, AC-C41 and AC-C43): the
 * owner help catalog still describes a portal that exists.
 *
 * `get_help` answers from `apps/api/src/data/owner-help`. A help that is never
 * updated is worse than none, so this guard holds the catalog to the parts of the
 * portal it can check, and reports the part it cannot.
 *
 * ## What it checks (a failure exits 1)
 *
 * - (a) Every destination of every topic resolves to a page under
 *   `apps/web/src/pages/[lang]/`. It goes through the same route map the tool
 *   builds its links with (`portalDestinationTemplate`) and the same page lookup
 *   as `check-portal-routes`, so an editor section that loses its page, or a page
 *   that is renamed, fails here too. An editor-section destination is checked for
 *   the vertical it names: a section the vertical does not have would fall back to
 *   the hub in the link, which is not what the topic says, so it is a violation.
 * - (b) Every `faqKey` is an item of the es FAQ
 *   (`packages/i18n/src/locales/es/faq.json`, `categories.<category>.items.<item>`).
 * - (c) Every `reviewedAt` is a real `YYYY-MM-DD` date that is not in the future.
 * - (d) The catalog is not empty, so an emptied or moved catalog cannot turn the
 *   guard green by checking nothing.
 *
 * ## What it reports without failing (exit 0)
 *
 * - A topic whose `reviewedAt` is older than 180 days is listed as STALE. It does
 *   not fail the run: it asks a person to re-check the topic against the portal
 *   and bump the date (AC-C43).
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - Whether a step is TRUE. It checks that the pages exist, never that the button
 *   a step names is still on them, or that the flow still works in that order.
 *   That is what the review date and the person who changes a portal flow are for.
 * - A page that exists but redirects or answers 404/403 for some states.
 * - Whether a FAQ item still says something consistent with the topic that extends
 *   it, only that the item exists.
 * - The text of the topics: a price or a plan name written in a step is caught by
 *   `check:commercial-values` only when it looks like a price constant.
 *
 * Exit codes: 0 = clean (stale topics may be listed); 1 = a violation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OWNER_HELP_TOPICS } from '../apps/api/src/data/owner-help/owner-help.js';
import {
    OWNER_HELP_STALE_DAYS,
    type OwnerHelpDestination,
    type OwnerHelpTopic
} from '../apps/api/src/data/owner-help/owner-help.types.js';
import {
    EDITOR_SECTION_SLUGS,
    PORTAL_SECTION_PLACEHOLDER,
    portalDestinationTemplate
} from '../packages/portal-routes/src/index.js';
import { PORTAL_PAGES_DIR, pageExists } from './check-portal-routes.js';

/** The es FAQ file, relative to the repo root. */
export const ES_FAQ_FILE = 'packages/i18n/src/locales/es/faq.json';

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

/** Predicate letters, as listed in the file header. */
export type Predicate = 'a' | 'b' | 'c' | 'd';

/** One offending entry. */
export interface Violation {
    /** Which check failed. */
    readonly predicate: Predicate;
    /** Human-readable detail, naming the topic. */
    readonly detail: string;
}

/** A topic that is due for a re-check. */
export interface StaleTopic {
    /** The topic id. */
    readonly id: string;
    /** Its `reviewedAt`. */
    readonly reviewedAt: string;
    /** Whole days since then. */
    readonly ageDays: number;
}

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<Predicate, string>> = {
    a: 'GUARD:owner-help (a): a help topic links to a portal page that does not exist in apps/web.',
    b: 'GUARD:owner-help (b): a help topic extends a FAQ item that does not exist in the es FAQ.',
    c: 'GUARD:owner-help (c): a help topic has a reviewedAt that is not a past or present YYYY-MM-DD date.',
    d: 'GUARD:owner-help (d): the help catalog is empty, so nothing was checked.'
};

/** The destination as the route map needs it: an editor section gets a placeholder id. */
function toPortalDestination(destination: OwnerHelpDestination) {
    if (destination.kind === 'ownEditorSection') {
        return {
            kind: 'listingEditor' as const,
            vertical: destination.vertical,
            id: 'help-guard-placeholder',
            section: destination.section
        };
    }
    return destination;
}

/** Whether `faqKey` (`<category>.<item>`) is an item of the FAQ file's content. */
function faqItemExists({
    faq,
    faqKey
}: {
    readonly faq: unknown;
    readonly faqKey: string;
}): boolean {
    const [category, item] = faqKey.split('.');
    if (category === undefined || item === undefined) {
        return false;
    }
    const categories = (faq as { categories?: Record<string, unknown> } | null)?.categories;
    const items = (categories?.[category] as { items?: Record<string, unknown> } | undefined)
        ?.items;
    return items !== undefined && Object.hasOwn(items, item);
}

/** Whole days between a `YYYY-MM-DD` date and `now`, or `undefined` when it is not a real date. */
function ageInDays({
    reviewedAt,
    now
}: {
    readonly reviewedAt: string;
    readonly now: Date;
}): number | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) {
        return undefined;
    }
    const time = Date.parse(`${reviewedAt}T00:00:00Z`);
    if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== reviewedAt) {
        return undefined;
    }
    return Math.floor((now.getTime() - time) / DAY_MS);
}

/** Arguments for {@link checkOwnerHelp}. RO-RO. */
export interface CheckOwnerHelpArgs {
    /** Repo root. */
    readonly root: string;
    /** The catalog; defaults to the API's. */
    readonly topics?: readonly OwnerHelpTopic[];
    /** The clock; defaults to now. */
    readonly now?: Date;
    /** Days after which a topic is stale. */
    readonly staleDays?: number;
}

/** What {@link checkOwnerHelp} found. */
export interface CheckOwnerHelpResult {
    /** What fails the run. */
    readonly violations: readonly Violation[];
    /** What is only reported. */
    readonly stale: readonly StaleTopic[];
}

/**
 * Checks the help catalog against a repo.
 *
 * @param args - The repo root, and optionally the catalog, clock and stale limit
 * @returns The violations and the stale topics
 */
export function checkOwnerHelp({
    root,
    topics = OWNER_HELP_TOPICS,
    now = new Date(),
    staleDays = OWNER_HELP_STALE_DAYS
}: CheckOwnerHelpArgs): CheckOwnerHelpResult {
    if (topics.length === 0) {
        return { violations: [{ predicate: 'd', detail: 'the catalog has no topics' }], stale: [] };
    }

    const pagesRoot = join(root, PORTAL_PAGES_DIR);
    const faqFile = join(root, ES_FAQ_FILE);
    const faq: unknown = existsSync(faqFile) ? JSON.parse(readFileSync(faqFile, 'utf8')) : null;
    const violations: Violation[] = [];
    const stale: StaleTopic[] = [];

    for (const topic of topics) {
        for (const destination of topic.destinations) {
            if (
                destination.kind === 'ownEditorSection' &&
                !Object.hasOwn(EDITOR_SECTION_SLUGS[destination.vertical], destination.section)
            ) {
                violations.push({
                    predicate: 'a',
                    detail: `${topic.id}: ${destination.vertical} has no editor section ${destination.section}`
                });
                continue;
            }
            const template = portalDestinationTemplate({
                destination: toPortalDestination(destination)
            });
            if (
                template.includes(PORTAL_SECTION_PLACEHOLDER) ||
                !pageExists({ pagesRoot, path: template })
            ) {
                violations.push({
                    predicate: 'a',
                    detail: `${topic.id}: no page for ${template} under ${PORTAL_PAGES_DIR}`
                });
            }
        }

        if (topic.faqKey !== undefined && !faqItemExists({ faq, faqKey: topic.faqKey })) {
            violations.push({
                predicate: 'b',
                detail: `${topic.id}: faqKey ${topic.faqKey} is not an item of ${ES_FAQ_FILE}`
            });
        }

        const ageDays = ageInDays({ reviewedAt: topic.reviewedAt, now });
        if (ageDays === undefined || ageDays < 0) {
            violations.push({
                predicate: 'c',
                detail: `${topic.id}: reviewedAt "${topic.reviewedAt}" is not a past or present YYYY-MM-DD date`
            });
        } else if (ageDays > staleDays) {
            stale.push({ id: topic.id, reviewedAt: topic.reviewedAt, ageDays });
        }
    }

    return { violations, stale };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args - See {@link CheckOwnerHelpArgs}; the root defaults to this repo
 * @returns The exit code and the text to print
 */
export function run({
    root = REPO_ROOT,
    topics = OWNER_HELP_TOPICS,
    now = new Date(),
    staleDays = OWNER_HELP_STALE_DAYS
}: Partial<CheckOwnerHelpArgs> = {}): { readonly exitCode: 0 | 1; readonly output: string } {
    const { violations, stale } = checkOwnerHelp({ root, topics, now, staleDays });
    const staleLines = stale.map(
        (topic) =>
            `  - ${topic.id}: reviewed ${topic.reviewedAt}, ${topic.ageDays} days ago (limit ${staleDays}). Re-check it against the portal and bump reviewedAt.`
    );
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        const lines = [
            ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
            ...violations.map((violation) => `  - (${violation.predicate}) ${violation.detail}`),
            'Fix: update apps/api/src/data/owner-help in the same PR as the web change.',
            ...(staleLines.length > 0 ? ['STALE topics:', ...staleLines] : [])
        ];
        return { exitCode: 1, output: lines.join('\n') };
    }
    const summary = `OK GUARD:owner-help: ${topics.length} help topics, every link resolves to a page in apps/web and every faqKey exists`;
    if (staleLines.length > 0) {
        return {
            exitCode: 0,
            output: [
                summary,
                `WARN GUARD:owner-help: ${stale.length} topic(s) older than ${staleDays} days, not failing:`,
                ...staleLines
            ].join('\n')
        };
    }
    return { exitCode: 0, output: summary };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
