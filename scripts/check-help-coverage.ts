/**
 * @file check-help-coverage.ts
 * @description GUARD (b) of the help catalog, reverse coverage (HOS-2410
 * `docs/guards.md` §3, AC-29, AC-30, AC-34): every owner-facing surface the code
 * has is explained by an article, or is exempted with a reason. Guard (a)
 * checks that what the articles name exists; this checks the other direction.
 *
 * The universe is enumerated from code at run time (`help-coverage-universe.ts`):
 * account pages, editor sections, entitlement keys, limit keys and MCP tools.
 * A page or section is covered by an article's `entryFor` (it is the «?»
 * target); a key or tool by any article's `covers`. Exemptions live in
 * `packages/help/coverage-exemptions.json`, one entry per line, sorted by anchor.
 *
 * ## What it checks (a failure exits 1)
 *
 * - (b1) Every universe unit is covered or exempt. The message names the unit.
 * - (b2) Every exemption is well formed (schema, sorted, no duplicate) and names
 *   a unit that exists in the universe: no stale exemption.
 * - (b3) No unit is both covered and exempt: the exemption must go.
 * - (b4) Non-vacuity: every universe set is non-empty, the MCP registry could be
 *   read, and the help content parsed, so a moved folder cannot pass by
 *   checking nothing.
 *
 * ## What it reports without failing (exit 0)
 *
 * - How many `pending-content` exemptions are left (the Phase 5 ratchet; their
 *   count is pinned by `scripts/__tests__/check-help-coverage.test.ts`).
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - Whether the covering article really explains the unit: only that it names it.
 * - Owner-facing surfaces outside the five sets: emails, crons, the `publicar/*`
 *   funnels, `planes/*` and the public pages. They are inventoried and covered by
 *   content, with no gate: a new email gets no CI failure.
 * - Whether a page is for owners or tourists: that classification is the
 *   exemption file's, written by a person.
 * - Translations: only `es` articles count, the source locale.
 *
 * Exit codes: 0 = clean; 1 = a violation.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { buildHelpIndex, readHelpContentFiles } from '../packages/help/src/generator/index.js';
import { HELP_CONTENT_PATH } from './check-help-catalog.js';
import {
    COVERAGE_SETS,
    type ComputeCoverageUniverseArgs,
    type CoverageSet,
    type CoverageUniverse,
    computeCoverageUniverse
} from './help-coverage-universe.js';

/** The exemption file, relative to the repo root. */
export const HELP_COVERAGE_EXEMPTIONS_PATH = 'packages/help/coverage-exemptions.json';

/**
 * The exemption kinds. `pending-content` exists only during HOS-2410: the
 * closing PR removes it from this list (AC-38).
 */
export const COVERAGE_EXEMPTION_KINDS = [
    'out-of-scope',
    'no-user-surface',
    'pending-content'
] as const;

/** One exemption of `coverage-exemptions.json`. */
export const CoverageExemptionSchema = z
    .object({
        anchor: z.string().regex(/^(?:page|section|entitlement|limit|tool):\S+$/),
        kind: z.enum(COVERAGE_EXEMPTION_KINDS),
        reason: z.string().trim().min(1),
        plannedArticle: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional()
    })
    .strict()
    .refine(
        (entry) => (entry.kind === 'pending-content') === (entry.plannedArticle !== undefined),
        {
            message: 'plannedArticle is required for pending-content, and only allowed there'
        }
    );

/** One exemption. */
export type CoverageExemption = z.infer<typeof CoverageExemptionSchema>;

/** Predicate letters, as listed in the file header. */
export type CoveragePredicate = 'b1' | 'b2' | 'b3' | 'b4';

/** One violation. */
export interface CoverageViolation {
    readonly predicate: CoveragePredicate;
    readonly detail: string;
}

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<CoveragePredicate, string>> = {
    b1: 'GUARD:help-coverage (b1): an owner-facing unit has no article and no exemption.',
    b2: 'GUARD:help-coverage (b2): an exemption is malformed, out of order, duplicated, or names a unit that does not exist.',
    b3: 'GUARD:help-coverage (b3): a unit is covered by an article and also exempt.',
    b4: 'GUARD:help-coverage (b4): a universe set is empty or unreadable, or the content does not parse, so nothing was checked.'
};

/** How each set is covered: by `entryFor` (the «?» target) or by any `covers`. */
const COVERED_BY: Readonly<Record<CoverageSet, 'entryFor' | 'covers'>> = {
    page: 'entryFor',
    section: 'entryFor',
    entitlement: 'covers',
    limit: 'covers',
    tool: 'covers'
};

/** The anchors of `es` articles, per the field that covers each set. */
interface ArticleCoverage {
    readonly entryFor: ReadonlyMap<string, string>;
    readonly covers: ReadonlyMap<string, string>;
}

/**
 * Parses the exemption file text.
 *
 * @param args.text - The file content
 * @returns The valid entries, and a b2 violation per problem
 */
export function parseCoverageExemptions({ text }: { readonly text: string }): {
    readonly entries: readonly CoverageExemption[];
    readonly violations: readonly CoverageViolation[];
} {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (error) {
        return {
            entries: [],
            violations: [{ predicate: 'b2', detail: `not valid JSON: ${String(error)}` }]
        };
    }
    if (!Array.isArray(raw)) {
        return { entries: [], violations: [{ predicate: 'b2', detail: 'not a JSON array' }] };
    }
    const entries: CoverageExemption[] = [];
    const violations: CoverageViolation[] = [];
    raw.forEach((item: unknown, index) => {
        const parsed = CoverageExemptionSchema.safeParse(item);
        if (parsed.success) {
            entries.push(parsed.data);
        } else {
            violations.push({
                predicate: 'b2',
                detail: `entry ${index}: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || '(entry)'} ${issue.message}`).join('; ')}`
            });
        }
    });
    entries.forEach((entry, index) => {
        const previous = entries[index - 1];
        if (previous !== undefined && previous.anchor >= entry.anchor) {
            violations.push({
                predicate: 'b2',
                detail:
                    previous.anchor === entry.anchor
                        ? `${entry.anchor} is exempted twice`
                        : `${entry.anchor} is out of order: entries are sorted by anchor so parallel PRs merge cleanly`
            });
        }
    });
    return { entries, violations };
}

/**
 * Serializes exemptions in the committed layout: one entry per line, sorted by
 * anchor, keys in a fixed order.
 *
 * @param args.entries - The exemptions
 * @returns The file text, ending in a newline
 */
export function formatCoverageExemptions({
    entries
}: {
    readonly entries: readonly CoverageExemption[];
}): string {
    const lines = [...entries]
        .sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : 0))
        .map((entry) =>
            JSON.stringify({
                anchor: entry.anchor,
                kind: entry.kind,
                reason: entry.reason,
                ...(entry.plannedArticle === undefined
                    ? {}
                    : { plannedArticle: entry.plannedArticle })
            })
        );
    return `[\n${lines.join(',\n')}\n]\n`;
}

/** Arguments for {@link checkHelpCoverage}. RO-RO. */
export interface CheckHelpCoverageArgs extends ComputeCoverageUniverseArgs {
    /** Content dir; defaults to `<root>/packages/help/content`. */
    readonly contentDir?: string;
    /** Exemption file; defaults to `<root>/packages/help/coverage-exemptions.json`. */
    readonly exemptionsFile?: string;
    /** A precomputed universe (tests); computed from `root` otherwise. */
    readonly universe?: CoverageUniverse;
}

/** What {@link checkHelpCoverage} found. */
export interface CheckHelpCoverageResult {
    readonly violations: readonly CoverageViolation[];
    readonly universe: CoverageUniverse;
    readonly exemptions: readonly CoverageExemption[];
    readonly articleCount: number;
}

/** The anchors the es articles cover, each with the first article that claims it. */
function readArticleCoverage({ contentDir }: { readonly contentDir: string }) {
    const built = buildHelpIndex({ files: readHelpContentFiles({ contentDir }) });
    if (built.index === undefined) {
        return undefined;
    }
    const entryFor = new Map<string, string>();
    const covers = new Map<string, string>();
    for (const article of built.index.locales.es) {
        for (const anchor of article.entryFor) {
            if (!entryFor.has(anchor)) entryFor.set(anchor, article.id);
            if (!covers.has(anchor)) covers.set(anchor, article.id);
        }
        for (const anchor of article.covers) {
            if (!covers.has(anchor)) covers.set(anchor, article.id);
        }
    }
    return {
        coverage: { entryFor, covers } satisfies ArticleCoverage,
        articleCount: built.index.locales.es.length
    };
}

/**
 * Checks reverse coverage against a repo.
 *
 * @param args - See {@link CheckHelpCoverageArgs}
 * @returns The violations, the universe, the exemptions and the article count
 */
export function checkHelpCoverage({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    exemptionsFile = join(root, HELP_COVERAGE_EXEMPTIONS_PATH),
    universe,
    ...universeArgs
}: CheckHelpCoverageArgs): CheckHelpCoverageResult {
    const computed = universe ?? computeCoverageUniverse({ root, ...universeArgs });
    const violations: CoverageViolation[] = computed.problems.map((detail) => ({
        predicate: 'b4',
        detail
    }));
    for (const set of COVERAGE_SETS) {
        if (computed.units[set].length === 0) {
            violations.push({ predicate: 'b4', detail: `the ${set} set of the universe is empty` });
        }
    }
    const read = readArticleCoverage({ contentDir });
    if (read === undefined) {
        violations.push({
            predicate: 'b4',
            detail: `the help content under ${contentDir} does not parse: run pnpm check:help-catalog`
        });
    }
    const parsed = existsSync(exemptionsFile)
        ? parseCoverageExemptions({ text: readFileSync(exemptionsFile, 'utf8') })
        : {
              entries: [],
              violations: [
                  {
                      predicate: 'b2' as const,
                      detail: `${HELP_COVERAGE_EXEMPTIONS_PATH} does not exist`
                  }
              ]
          };
    violations.push(...parsed.violations);
    if (read === undefined) {
        return { violations, universe: computed, exemptions: parsed.entries, articleCount: 0 };
    }

    const exempt = new Map(parsed.entries.map((entry) => [entry.anchor, entry]));
    const universeUnits = new Set(COVERAGE_SETS.flatMap((set) => computed.units[set]));
    for (const set of COVERAGE_SETS) {
        const coveredBy = read.coverage[COVERED_BY[set]];
        for (const unit of computed.units[set]) {
            const article = coveredBy.get(unit);
            const exemption = exempt.get(unit);
            if (article === undefined && exemption === undefined) {
                violations.push({
                    predicate: 'b1',
                    detail: `${unit}: no article has it in ${COVERED_BY[set]} and it is not exempt. Write or extend an article, or add an exemption with a reason to ${HELP_COVERAGE_EXEMPTIONS_PATH}`
                });
            }
            if (article !== undefined && exemption !== undefined) {
                violations.push({
                    predicate: 'b3',
                    detail: `${unit}: covered by ${article} and exempt as ${exemption.kind}. Remove the exemption`
                });
            }
        }
    }
    for (const entry of parsed.entries) {
        if (!universeUnits.has(entry.anchor)) {
            violations.push({
                predicate: 'b2',
                detail: `${entry.anchor}: exempted, but no such unit exists in the code. Remove the exemption`
            });
        }
    }
    return {
        violations,
        universe: computed,
        exemptions: parsed.entries,
        articleCount: read.articleCount
    };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args - See {@link CheckHelpCoverageArgs}; the root defaults to this repo
 * @returns The exit code and the text to print
 */
export function run(args: Partial<CheckHelpCoverageArgs> = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const { violations, universe, exemptions, articleCount } = checkHelpCoverage({
        root: REPO_ROOT,
        ...args
    });
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        return {
            exitCode: 1,
            output: [
                ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
                ...violations.map(
                    (violation) => `  - (${violation.predicate}) ${violation.detail}`
                ),
                `Fix: cover the unit in an article's entryFor (pages, sections) or covers (keys, tools), or edit ${HELP_COVERAGE_EXEMPTIONS_PATH}.`
            ].join('\n')
        };
    }
    const counts = COVERAGE_SETS.map((set) => `${universe.units[set].length} ${set}`).join(', ');
    const pending = exemptions.filter((entry) => entry.kind === 'pending-content').length;
    return {
        exitCode: 0,
        output: [
            `OK GUARD:help-coverage: every unit (${counts}) is covered by one of ${articleCount} articles or exempt (${exemptions.length} exemptions)`,
            ...(pending > 0
                ? [
                      `INFO GUARD:help-coverage: ${pending} pending-content exemptions left (HOS-2410 Phase 5)`
                  ]
                : [])
        ].join('\n')
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    process[result.exitCode === 0 ? 'stdout' : 'stderr'].write(`${result.output}\n`);
    process.exit(result.exitCode);
}
