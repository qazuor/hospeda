/**
 * @file check-help-values.ts
 * @description GUARD (d) of the help catalog, values (HOS-2410
 * `docs/guards.md` §6, AC-33, AC-34): help content never states a price, a
 * plan name or a plan limit literally. Prices and limits are DB rows that the
 * owner changes without a deploy; an article that copies one goes stale
 * silently. Content says "el tope de tu plan" through a `{{limit}}` token, and
 * points at the plans page through `{{link:plans:…}}`.
 *
 * `check:commercial-values` only scans billing TS sources; it never sees help.
 * This guard scans `title`, `summary`, `keywords` and every body section of
 * every locale, with tokens removed and accents folded.
 *
 * ## What it checks (a failure exits 1)
 *
 * - (d1) Currency: a number next to a currency marker (`$`, `ARS`, `USD`,
 *   `U$S`, `peso(s)`, `dólar(es)`), on either side.
 * - (d2) Plan names: a whole word of {@link PLAN_TIER_WORDS}, case- and
 *   accent-insensitive. A companion test fails when a sellable plan of the
 *   migrations has a tier word missing from the list.
 * - (d3) Limits: a number within three words of a limit noun
 *   ({@link LIMIT_NOUNS}), or right after `hasta`, `máximo (de)`, `mínimo (de)`
 *   or `tope de`. A number directly followed by a unit of
 *   {@link TECHNICAL_UNITS} is allowed: a file-size or length constant of the
 *   system is not a plan value (the `get_help` steps frozen by AC-15 say
 *   "hasta 10 MB").
 *   The few system constants that are frozen elsewhere without a unit next to
 *   the number are listed, one exact phrase per article, in
 *   {@link FROZEN_SYSTEM_CONSTANTS}; an entry that stops matching fails d3.
 * - (d4) Non-vacuity: the content parses and at least one article is scanned.
 *
 * ## What it does NOT see, so a green run is not read as more
 *
 * - Numbers written as words ("cinco fotos").
 * - A plan named with a word that is not in the list.
 * - A commercial claim without a number ("los planes superiores incluyen…").
 * - A technical unit misused for a plan limit ("hasta 50 MB según tu plan").
 * - Token labels: tokens are removed before scanning, labels included.
 *
 * Exit codes: 0 = clean; 1 = a violation.
 */

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HelpArticle } from '../packages/help/src/article.schema.js';
import { buildHelpIndex, readHelpContentFiles } from '../packages/help/src/generator/index.js';
import { HELP_CONTENT_PATH } from './check-help-catalog.js';

/** Words that name a plan tier, folded (lowercase, no accents). */
export const PLAN_TIER_WORDS = [
    'basico',
    'basic',
    'profesional',
    'professional',
    'premium',
    'gold',
    'silver',
    'vip'
] as const;

/** Nouns a plan limit counts, folded. A number near one reads as a limit. */
export const LIMIT_NOUNS = [
    'foto',
    'fotos',
    'publicacion',
    'publicaciones',
    'alojamiento',
    'alojamientos',
    'comercio',
    'comercios',
    'experiencia',
    'experiencias',
    'promocion',
    'promociones',
    'galeria',
    'galerias',
    'cuenta',
    'cuentas',
    'consulta',
    'consultas',
    'mes',
    'meses',
    'dia',
    'dias'
] as const;

/** Units of a technical constant of the system, folded. A number followed by one is allowed by d3. */
export const TECHNICAL_UNITS = ['mb', 'kb', 'gb', 'px', 'caracteres'] as const;

/**
 * System constants the guard must not flag even though they read as a limit,
 * each pinned to one article and one exact folded phrase. Only for text that
 * is frozen elsewhere: an entry that stops matching fails d3, so it cannot
 * outlive its text.
 */
export const FROZEN_SYSTEM_CONSTANTS: ReadonlyArray<{
    readonly articleId: string;
    readonly phrase: string;
    readonly reason: string;
}> = [
    {
        articleId: 'publish-requirements',
        phrase: 'descripcion (minimo 20)',
        reason: 'The 20-character minimum description length is a system constant, not a plan value; the unit is named by the sibling "(mínimo 10 caracteres)". The step is returned by get_help byte for byte, frozen by AC-15 (apps/api/test/mcp/tools/help/fixtures/get-help-pre-migration.json).'
    }
];

/** How many words away from a limit noun a number still reads as a limit. */
export const LIMIT_WINDOW_WORDS = 3;

/** Predicate letters, as listed in the file header. */
export type ValuesPredicate = 'd1' | 'd2' | 'd3' | 'd4';

/** One violation. */
export interface ValuesViolation {
    readonly predicate: ValuesPredicate;
    readonly detail: string;
}

/** What each predicate means; printed with the violations. */
export const PREDICATE_MESSAGES: Readonly<Record<ValuesPredicate, string>> = {
    d1: 'GUARD:help-values (d1): help content states a price.',
    d2: 'GUARD:help-values (d2): help content names a plan tier.',
    d3: 'GUARD:help-values (d3): help content states a plan limit as a number.',
    d4: 'GUARD:help-values (d4): no article was scanned, so nothing was checked.'
};

/** A help token, removed before scanning. */
const TOKEN = /\{\{[^}]*\}\}/g;

/** A number: digits with optional `.`/`,` groups. */
const NUMBER = String.raw`\d+(?:[.,]\d+)*`;

/**
 * A currency marker, folded. `u$s` and `us$` come before `$` so they are matched
 * whole. The word markers are bounded by letters only, so a marker glued to its
 * number (`15usd`, `usd15`, `15pesos`) still matches.
 */
const CURRENCY = String.raw`(?:(?<![a-z])(?:u\$s|us\$)|\$|(?<![a-z])(?:ars|usd|pesos?|dolar(?:es)?)(?![a-z]))`;

/** d1: a number on either side of a currency marker. */
const CURRENCY_NEAR_NUMBER = new RegExp(
    String.raw`${CURRENCY}\s*${NUMBER}|(?<![\d.,])${NUMBER}\s*${CURRENCY}`
);

/** d2: a whole plan-tier word. */
const PLAN_WORD = new RegExp(`(?<![a-z0-9])(${PLAN_TIER_WORDS.join('|')})(?![a-z0-9])`);

/**
 * Folds a text for matching: tokens removed, lowercase, accents stripped.
 *
 * @param args.text - Any content text
 * @returns The folded text
 */
export function foldHelpText({ text }: { readonly text: string }): string {
    return text
        .replace(TOKEN, ' ')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

/**
 * d3 on one folded text: the first number that reads as a plan limit, with its
 * context. Numbers and letters are split into separate words, so a number glued
 * to its noun (`20fotos`) or unit (`10mb`) reads like the spaced form.
 */
function limitNumber({ folded }: { readonly folded: string }): string | undefined {
    const words = [...folded.matchAll(/\d+(?:[.,]\d+)*|[a-z$]+/g)].map((match) => match[0]);
    const nouns: ReadonlySet<string> = new Set(LIMIT_NOUNS);
    const units: ReadonlySet<string> = new Set(TECHNICAL_UNITS);
    for (const [index, word] of words.entries()) {
        if (!new RegExp(`^${NUMBER}$`).test(word) || units.has(words[index + 1] ?? '')) {
            continue;
        }
        const before = words[index - 1] ?? '';
        const twoBefore = words[index - 2] ?? '';
        const afterKeyword =
            before === 'hasta' ||
            before === 'maximo' ||
            before === 'minimo' ||
            (before === 'de' && ['tope', 'maximo', 'minimo'].includes(twoBefore));
        const window = words.slice(
            Math.max(0, index - LIMIT_WINDOW_WORDS),
            index + LIMIT_WINDOW_WORDS + 1
        );
        if (afterKeyword || window.some((candidate) => nouns.has(candidate))) {
            return window.join(' ');
        }
    }
    return undefined;
}

/**
 * The value violations of one text.
 *
 * @param args.text - A title, summary, keyword or section text
 * @returns For each of d1, d2, d3 that fires, the matched context
 */
export function valueFindings({
    text,
    allowedPhrases = []
}: {
    readonly text: string;
    /** Folded phrases removed before scanning (see {@link FROZEN_SYSTEM_CONSTANTS}). */
    readonly allowedPhrases?: readonly string[];
}): ReadonlyArray<{ readonly predicate: 'd1' | 'd2' | 'd3'; readonly match: string }> {
    const folded = allowedPhrases.reduce(
        (current, phrase) => current.split(phrase).join(' '),
        foldHelpText({ text })
    );
    const findings: Array<{ predicate: 'd1' | 'd2' | 'd3'; match: string }> = [];
    const currency = CURRENCY_NEAR_NUMBER.exec(folded)?.[0];
    if (currency !== undefined) findings.push({ predicate: 'd1', match: currency.trim() });
    const plan = PLAN_WORD.exec(folded)?.[1];
    if (plan !== undefined) findings.push({ predicate: 'd2', match: plan });
    const limit = limitNumber({ folded });
    if (limit !== undefined) findings.push({ predicate: 'd3', match: limit });
    return findings;
}

/** Every scanned text of an article, with the field it comes from. */
function articleTexts({ article }: { readonly article: HelpArticle }) {
    const { howTo, ...prose } = article.sections;
    return [
        { field: 'title', text: article.title },
        { field: 'summary', text: article.summary },
        ...article.keywords.map((text, index) => ({ field: `keywords[${index}]`, text })),
        ...Object.entries(prose).map(([field, text]) => ({ field, text })),
        ...howTo.steps.map((text, index) => ({ field: `howTo.steps[${index}]`, text })),
        { field: 'howTo.after', text: howTo.after }
    ];
}

/** Arguments for {@link checkHelpValues}. RO-RO. */
export interface CheckHelpValuesArgs {
    readonly root: string;
    /** Content dir; defaults to `<root>/packages/help/content`. */
    readonly contentDir?: string;
    /** Overrides {@link FROZEN_SYSTEM_CONSTANTS} (tests). */
    readonly frozenConstants?: typeof FROZEN_SYSTEM_CONSTANTS;
}

/**
 * Scans every article of every locale.
 *
 * @param args - See {@link CheckHelpValuesArgs}
 * @returns The violations and how many articles were scanned
 */
export function checkHelpValues({
    root,
    contentDir = join(root, HELP_CONTENT_PATH),
    frozenConstants = FROZEN_SYSTEM_CONSTANTS
}: CheckHelpValuesArgs): {
    readonly violations: readonly ValuesViolation[];
    readonly articleCount: number;
} {
    const index = buildHelpIndex({ files: readHelpContentFiles({ contentDir }) }).index;
    const articles = index === undefined ? [] : Object.values(index.locales).flat();
    if (articles.length === 0) {
        return {
            violations: [
                {
                    predicate: 'd4',
                    detail: `no article scanned under ${contentDir} (missing, empty or not parsing: run pnpm check:help-catalog)`
                }
            ],
            articleCount: 0
        };
    }
    const violations: ValuesViolation[] = [];
    const used = new Set<(typeof frozenConstants)[number]>();
    for (const article of articles) {
        const allowances = frozenConstants.filter((entry) => entry.articleId === article.id);
        for (const { field, text } of articleTexts({ article })) {
            const folded = foldHelpText({ text });
            const allowed = allowances.filter((entry) => folded.includes(entry.phrase));
            for (const entry of allowed) used.add(entry);
            const allowedPhrases = allowed.map((entry) => entry.phrase);
            for (const finding of valueFindings({ text, allowedPhrases })) {
                violations.push({
                    predicate: finding.predicate,
                    detail: `${article.locale}/${article.id} ${field}: "${finding.match}"`
                });
            }
        }
    }
    for (const entry of frozenConstants) {
        if (!used.has(entry)) {
            violations.push({
                predicate: 'd3',
                detail: `FROZEN_SYSTEM_CONSTANTS entry "${entry.phrase}" (${entry.articleId}) no longer matches any text: remove it`
            });
        }
    }
    return { violations, articleCount: articles.length };
}

/** Repo root of this script. */
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Runs the guard.
 *
 * @param args - See {@link CheckHelpValuesArgs}; the root defaults to this repo
 * @returns The exit code and the text to print
 */
export function run(args: Partial<CheckHelpValuesArgs> = {}): {
    readonly exitCode: 0 | 1;
    readonly output: string;
} {
    const { violations, articleCount } = checkHelpValues({ root: REPO_ROOT, ...args });
    if (violations.length > 0) {
        const predicates = [...new Set(violations.map((violation) => violation.predicate))].sort();
        return {
            exitCode: 1,
            output: [
                ...predicates.map((predicate) => `FAIL ${PREDICATE_MESSAGES[predicate]}`),
                ...violations.map(
                    (violation) => `  - (${violation.predicate}) ${violation.detail}`
                ),
                'Fix: write {{limit:<key>}} for a limit and {{link:plans:<vertical>}} for plans and prices; never the value or the plan name.'
            ].join('\n')
        };
    }
    return {
        exitCode: 0,
        output: `OK GUARD:help-values: ${articleCount} articles state no price, plan name or plan limit`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    process[result.exitCode === 0 ? 'stdout' : 'stderr'].write(`${result.output}\n`);
    process.exit(result.exitCode);
}
