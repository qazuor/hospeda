#!/usr/bin/env tsx

/**
 * check-product-domain-on-writes.ts — HOS-1233 T-035 / AC-15d
 *
 * A write that CREATES a `billing_subscriptions` or `billing_plans` row must
 * state that row's product domain, in the create itself, unconditionally.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS GUARD EXISTS
 * ---------------------------------------------------------------------------
 * `@qazuor/qzpay-drizzle` declares both columns
 * `varchar(...).notNull().default('accommodation')`. A create that omits the
 * column therefore does not fail — it succeeds, and files the row under
 * whatever vertical the default names. Measured 2026-09-08 in BOTH live
 * environments: every `tourist-*` plan row, and every subscription on one,
 * reported `product_domain = 'accommodation'`. Not one line of code was wrong.
 * The value was simply never stated, and the default answered for a whole
 * vertical for as long as the plans had existed (spec §3 F-4b / F-4c).
 *
 * That is the failure mode this guard is built against: silent, plausible, and
 * invisible to the type system. While the default exists, `productDomain` is
 * OPTIONAL in Drizzle's insert type, so `tsc` has no opinion on an omission —
 * and the enum's own docblock says nothing in the type system defends it. The
 * guard is what makes D-6.3 real rather than aspirational.
 *
 * It is deliberately ordered BEFORE the default is dropped (T-036, AC-15i):
 * dropping it while a create still omits the column breaks every paid
 * checkout, of every vertical, at the first insert (R-8). This guard is how
 * "every write names its domain" is known to be true beforehand, rather than
 * discovered in production afterwards.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ASSERTS
 * ---------------------------------------------------------------------------
 * Across every production `.ts`/`.tsx` file under `apps/<app>/src` and
 * `packages/<pkg>/src`, each of these three create shapes states the domain:
 *
 *   1. Drizzle — `.insert(billingSubscriptions | billingPlans)` followed by
 *      `.values(<payload>)`. The payload must carry a top-level
 *      `productDomain` key.
 *   2. qzpay client — `.subscriptions.create(<payload>)` /
 *      `.plans.create(<payload>)`, which reaches the same columns through
 *      qzpay's own mapper.
 *   3. Raw SQL — a template literal containing
 *      `INSERT INTO billing_subscriptions | billing_plans`, which must name
 *      the `product_domain` column in the same statement. Raw SQL is invisible
 *      to both the compiler and any symbol search: `grep -w productDomain`
 *      never matches `product_domain` inside a backtick string. A seed fixture
 *      writing this column in raw SQL is not hypothetical — see
 *      `check-product-domain-raw-sql.sh`'s header for the one that shipped.
 *
 * "States the domain" is stricter than "mentions the word", and the three
 * rejections below are the whole point of the check:
 *
 *   - **A conditional spread does not count.** `...(x ? { productDomain } : {})`
 *     and `...(x === undefined ? {} : { productDomain })` both name the key and
 *     both produce a row without it whenever the condition is false. That row
 *     lands on the default — the exact bug — while a guard that merely grepped
 *     for the identifier would report the site as compliant.
 *   - **A nested key does not count.** `productDomain` inside a `metadata: {}`
 *     literal is a JSON blob entry, not the column. Only depth-1 keys of the
 *     payload object are read. (This is not a theoretical shape: a regex
 *     patching script inserted the key into `metadata` objects four times
 *     while this spec was being implemented.)
 *   - **A stamp issued AFTERWARDS does not count.** Three production sites
 *     inserted the row and then corrected `product_domain` with a separate
 *     `UPDATE` a statement later. That satisfies "the row ends up right"; it
 *     does not satisfy AC-15b, and it does not survive T-036 at all — with no
 *     default, the INSERT is rejected before its UPDATE ever runs.
 *
 * ---------------------------------------------------------------------------
 * THE ONE SITE THAT CANNOT COMPLY YET, AND WHY THERE IS NO ALLOWLIST
 * ---------------------------------------------------------------------------
 * `createPaidSubscription` cannot name the domain until `@qazuor/qzpay-core`
 * offers the parameter (spec D-7.1 / T-030, qzpay PR #85). A file-path
 * allowlist would be the obvious way to hold that open — and an allowlist is
 * how a guard quietly becomes fail-open, because the next site opts out by
 * being added to a list rather than by being fixed.
 *
 * So the exemption is DERIVED, not configured, and it retires itself: the
 * guard reads the INSTALLED `@qazuor/qzpay-core` type declarations and asks
 * whether they carry `productDomain` at all. While they do not, a
 * `subscriptions.create(...)` that omits the domain is reported as BLOCKED —
 * printed in full on every run, never silently skipped. The day the wave
 * publishes and the field appears in the package's own types, the same site
 * becomes a hard failure with nobody editing this file.
 *
 * A package that cannot be resolved is an ERROR, not a pass. "I could not
 * determine the capability" must never read as "there is nothing to enforce".
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DOES NOT PROVE — stated so a green run is not read as more than it is
 * ---------------------------------------------------------------------------
 *   - It proves the key is STATED, not that the VALUE is right. A create that
 *     hardcodes the wrong vertical passes. That is what the per-write-site
 *     tests are for (spec §9: "one test per write site asserting the row lands
 *     with the RIGHT domain, not merely a non-null one").
 *   - When the value is an identifier (`productDomain,` /
 *     `productDomain: input.productDomain`), the guard cannot follow it. If
 *     that identifier is itself optional upstream, the omission moves one hop
 *     away and this check does not see it. The schema boundary is what closes
 *     that (AC-15f), not a grep.
 *   - `.values(<identifier>)` and `.values([...])` are reported as
 *     UNVERIFIABLE rather than passed: the guard cannot read a payload it
 *     cannot see, and treating "invisible" as "fine" is the same fail-open the
 *     default itself was.
 *   - It scans creates only. An `UPDATE ... SET product_domain` is not a
 *     create; a row's domain being corrected later is out of scope by design,
 *     because the correction is not what the dropped default rejects.
 *   - Test files (`*.test.ts`, `*.spec.ts`) and `.d.ts` are excluded. A test
 *     that reproduces the misfiled shape on purpose (spec §9 requires at least
 *     one) must be able to write a row the way the bug wrote it.
 *   - Data-migrations under `packages/seed/src/data-migrations/` ARE scanned,
 *     unlike in the sibling vocabulary guards. Those exclude history because a
 *     migration that WROTE the retired `'commerce'` value was correct at the
 *     time. This one cannot: a historical migration that inserts a plan row
 *     without a domain still runs, in order, against every freshly built
 *     database — and after T-036 it is the statement that fails there.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

/** The two Drizzle table identifiers whose rows carry a product domain. */
export const DOMAIN_TABLES = ['billingSubscriptions', 'billingPlans'] as const;

/** Their snake_case names, as they appear in raw SQL. */
export const DOMAIN_SQL_TABLES = ['billing_subscriptions', 'billing_plans'] as const;

/** The qzpay client namespaces whose `create()` reaches those tables. */
export const QZPAY_CREATE_CALLS = ['.subscriptions.create(', '.plans.create('] as const;

const COLUMN_TS = 'productDomain';
const COLUMN_SQL = 'product_domain';

/**
 * How far past `INSERT INTO <table>` a raw statement is read when no closing
 * quote is found first. Bounds an untagged string so one match cannot swallow
 * the rest of the file and drown the `product_domain` test in unrelated text.
 */
const RAW_SQL_WINDOW = 600;

const SCAN_ROOTS = ['apps', 'packages'] as const;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.astro']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Why a create site failed to state its domain. */
export type Verdict =
    /** The payload is visible and carries no unconditional top-level key. */
    | 'omits'
    /** The payload is not an inline object literal, so it cannot be read. */
    | 'unverifiable'
    /** qzpay-core does not offer the parameter yet (derived, self-retiring). */
    | 'blocked-by-package';

export type Finding = {
    readonly file: string;
    readonly line: number;
    readonly shape: 'drizzle-insert' | 'qzpay-create' | 'raw-sql';
    readonly verdict: Verdict;
    readonly snippet: string;
};

// ---------------------------------------------------------------------------
// Source walking
// ---------------------------------------------------------------------------

/** Collects production `.ts`/`.tsx` sources under every app's and package's `src`. */
export function collectSourceFiles(root: string): string[] {
    const out: string[] = [];

    const walk = (dir: string): void => {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry)) continue;
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.tsx?$/.test(entry)) continue;
            if (/\.(test|spec)\.tsx?$/.test(entry)) continue;
            if (/\.d\.ts$/.test(entry)) continue;
            out.push(full);
        }
    };

    for (const top of SCAN_ROOTS) {
        const base = join(root, top);
        let pkgs: string[];
        try {
            pkgs = readdirSync(base);
        } catch {
            continue;
        }
        for (const pkg of pkgs) {
            const src = join(base, pkg, 'src');
            try {
                if (statSync(src).isDirectory()) walk(src);
            } catch {
                // package without a src/ directory
            }
        }
    }

    return out.sort();
}

// ---------------------------------------------------------------------------
// Balanced-text helpers
// ---------------------------------------------------------------------------

/**
 * Returns the text between the bracket at `openIdx` and its match, excluding
 * both. Returns null when the bracket never closes.
 */
export function readBalanced(source: string, openIdx: number): string | null {
    const open = source[openIdx];
    if (open !== '(' && open !== '{' && open !== '[') return null;
    let depth = 0;
    for (let i = openIdx; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            if (depth === 0) return source.slice(openIdx + 1, i);
        }
    }
    return null;
}

/** Splits an argument list on top-level commas. */
export function splitTopLevelArgs(args: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < args.length; i++) {
        const ch = args[i];
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ',' && depth === 0) {
            parts.push(args.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(args.slice(start));
    return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

const lineOf = (source: string, idx: number): number => source.slice(0, idx).split('\n').length;

const condense = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 140);

// ---------------------------------------------------------------------------
// The predicate — "states the domain, unconditionally, on this row"
// ---------------------------------------------------------------------------

/**
 * True when `payload` is an inline object literal (`{ ... }`), the only shape
 * whose keys this guard can read.
 */
export function isInlineObjectLiteral(payload: string): boolean {
    const trimmed = payload.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
}

/**
 * True when the payload carries `productDomain` as a top-level key with a real
 * value.
 *
 * Depth matters: a `productDomain` nested inside `metadata: { ... }` is a JSON
 * blob entry, not the column, and must not satisfy the check. A conditional
 * spread never satisfies it either — it lives at depth 0 but yields the key
 * only on one branch, so the other branch writes a row on the column default.
 */
export function statesDomainUnconditionally(payload: string): boolean {
    if (!isInlineObjectLiteral(payload)) return false;
    const body = payload.trim().slice(1, -1);

    let depth = 0;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
            continue;
        }
        if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            continue;
        }
        if (depth !== 0) continue;
        if (!body.startsWith(COLUMN_TS, i)) continue;

        // A word boundary on both sides, so `productDomainOverride` and
        // `mpProductDomain` are not read as this key.
        const before = i === 0 ? '' : (body[i - 1] ?? '');
        if (/[\w$]/.test(before)) continue;
        const after = body.slice(i + COLUMN_TS.length);
        const nextChar = after.trim()[0] ?? '';

        // ES6 shorthand — `productDomain,` or `productDomain` as the last key.
        if (nextChar === ',' || nextChar === '') return true;

        // `productDomain: <value>` — reject the two values that write nothing.
        if (nextChar === ':') {
            const value = splitTopLevelArgs(after.replace(/^\s*:/, ''))[0]?.trim() ?? '';
            if (value === 'undefined' || value === 'null') continue;
            return true;
        }
    }

    return false;
}

// ---------------------------------------------------------------------------
// Shape 1 — Drizzle `.insert(<table>).values(<payload>)`
// ---------------------------------------------------------------------------

function scanDrizzleInserts(rel: string, source: string): Finding[] {
    const findings: Finding[] = [];

    for (const table of DOMAIN_TABLES) {
        // Tolerates whitespace and newlines between the call and its argument,
        // so a Biome reformat cannot disable the match.
        const pattern = new RegExp(`\\.insert\\(\\s*${table}\\s*\\)`, 'g');
        for (const match of source.matchAll(pattern)) {
            const at = match.index;
            const valuesAt = source.indexOf('.values(', at);
            if (valuesAt < 0) {
                findings.push({
                    file: rel,
                    line: lineOf(source, at),
                    shape: 'drizzle-insert',
                    verdict: 'unverifiable',
                    snippet: `.insert(${table}) with no .values(...) after it`
                });
                continue;
            }
            const args = readBalanced(source, valuesAt + '.values'.length);
            if (args === null) continue;
            const payload = splitTopLevelArgs(args)[0] ?? '';

            if (!isInlineObjectLiteral(payload)) {
                findings.push({
                    file: rel,
                    line: lineOf(source, valuesAt),
                    shape: 'drizzle-insert',
                    verdict: 'unverifiable',
                    snippet: condense(payload)
                });
                continue;
            }
            if (statesDomainUnconditionally(payload)) continue;

            findings.push({
                file: rel,
                line: lineOf(source, valuesAt),
                shape: 'drizzle-insert',
                verdict: 'omits',
                snippet: condense(payload)
            });
        }
    }

    return findings;
}

// ---------------------------------------------------------------------------
// Shape 2 — qzpay `<client>.subscriptions.create(<payload>)`
// ---------------------------------------------------------------------------

function scanQzpayCreates(rel: string, source: string, qzpayOffersDomain: boolean): Finding[] {
    const findings: Finding[] = [];

    for (const call of QZPAY_CREATE_CALLS) {
        let from = 0;
        for (;;) {
            const at = source.indexOf(call, from);
            if (at < 0) break;
            from = at + call.length;

            // Skip prose: the repo's billing services quote this call by name
            // in their docblocks more often than they make it.
            const lineStart = source.lastIndexOf('\n', at) + 1;
            const linePrefix = source.slice(lineStart, at).trimStart();
            if (linePrefix.startsWith('*') || linePrefix.startsWith('//')) continue;

            const args = readBalanced(source, at + call.length - 1);
            if (args === null) continue;
            const payload = splitTopLevelArgs(args)[0] ?? '';
            if (isInlineObjectLiteral(payload) && statesDomainUnconditionally(payload)) continue;

            findings.push({
                file: rel,
                line: lineOf(source, at),
                shape: 'qzpay-create',
                verdict: qzpayOffersDomain
                    ? isInlineObjectLiteral(payload)
                        ? 'omits'
                        : 'unverifiable'
                    : 'blocked-by-package',
                snippet: condense(payload)
            });
        }
    }

    return findings;
}

// ---------------------------------------------------------------------------
// Shape 3 — raw SQL `INSERT INTO billing_subscriptions | billing_plans`
// ---------------------------------------------------------------------------

function scanRawSqlInserts(rel: string, source: string): Finding[] {
    const findings: Finding[] = [];

    for (const table of DOMAIN_SQL_TABLES) {
        const pattern = new RegExp(`INSERT\\s+INTO\\s+${table}\\b`, 'gi');
        for (const match of source.matchAll(pattern)) {
            const at = match.index;
            // The statement runs to the end of its string literal, bounded so a
            // plain (untagged) string cannot swallow the rest of the file.
            const close = source.slice(at, at + RAW_SQL_WINDOW).search(/[`'"]/);
            const statement = source.slice(at, close < 0 ? at + RAW_SQL_WINDOW : at + close);

            // `INSERT INTO <table>` in English prose is not a statement, and
            // this repo writes plenty of it — every one of these seeds throws
            // `Insert into billing_subscriptions returned no row for ...` when
            // its own insert comes back empty, which the case-insensitive match
            // above reads as SQL. A real insert names its source of rows.
            if (!/\b(VALUES|SELECT)\b/i.test(statement)) continue;
            if (statement.includes(COLUMN_SQL)) continue;

            findings.push({
                file: rel,
                line: lineOf(source, at),
                shape: 'raw-sql',
                verdict: 'omits',
                snippet: condense(statement)
            });
        }
    }

    return findings;
}

// ---------------------------------------------------------------------------
// The derived qzpay capability probe
// ---------------------------------------------------------------------------

/**
 * True when the INSTALLED `@qazuor/qzpay-core` declares `productDomain`
 * anywhere in its own type declarations.
 *
 * This is the self-retiring exemption described in the header. It is a
 * capability question, not a version question, on purpose: a version range is
 * configuration somebody can widen, whereas the presence of the field in the
 * shipped `.d.ts` is the same fact the compiler reads.
 *
 * @throws Error when the package cannot be resolved — an undeterminable
 *   capability must not read as "nothing to enforce".
 */
export function qzpayCoreOffersProductDomain(root: string): boolean {
    const require_ = createRequire(join(root, 'package.json'));
    let pkgDir: string;
    try {
        pkgDir = dirname(require_.resolve('@qazuor/qzpay-core/package.json'));
    } catch {
        try {
            pkgDir = dirname(dirname(require_.resolve('@qazuor/qzpay-core')));
        } catch {
            throw new Error(
                '@qazuor/qzpay-core could not be resolved, so this guard cannot tell whether ' +
                    'the package offers a productDomain parameter yet. Install dependencies and re-run.'
            );
        }
    }

    let found = false;
    const walk = (dir: string): void => {
        if (found) return;
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }
        for (const entry of entries) {
            if (found) return;
            const full = join(dir, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.endsWith('.d.ts')) continue;
            if (readFileSync(full, 'utf8').includes(COLUMN_TS)) found = true;
        }
    };
    walk(pkgDir);

    return found;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export type ScanResult = {
    readonly findings: readonly Finding[];
    readonly sitesChecked: number;
};

export function scanSources(
    root: string,
    files: readonly string[],
    qzpayOffersDomain: boolean
): ScanResult {
    const findings: Finding[] = [];
    let sitesChecked = 0;

    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const touchesInsert = source.includes('.insert(');
        const touchesCreate = QZPAY_CREATE_CALLS.some((c) => source.includes(c));
        const touchesSql = /INSERT\s+INTO/i.test(source);
        if (!touchesInsert && !touchesCreate && !touchesSql) continue;

        const rel = relative(root, file);
        const fileFindings = [
            ...scanDrizzleInserts(rel, source),
            ...scanQzpayCreates(rel, source, qzpayOffersDomain),
            ...scanRawSqlInserts(rel, source)
        ];

        // Every create of one of the two tables is a checked site, whether or
        // not it turned into a finding. Counting only the failures would let a
        // scan that matched nothing at all report a confident green.
        for (const table of DOMAIN_TABLES) {
            sitesChecked += source.split(`.insert(${table})`).length - 1;
        }
        sitesChecked += fileFindings.filter((f) => f.shape !== 'drizzle-insert').length;

        findings.push(...fileFindings);
    }

    return { findings, sitesChecked };
}

function main(): void {
    console.log(
        '=== Checking every billing plan/subscription create states its domain (HOS-1233 AC-15d) ==='
    );
    console.log('');

    const qzpayOffersDomain = qzpayCoreOffersProductDomain(REPO_ROOT);
    const files = collectSourceFiles(REPO_ROOT);
    const { findings, sitesChecked } = scanSources(REPO_ROOT, files, qzpayOffersDomain);

    if (sitesChecked === 0) {
        console.error('ERROR: the scan matched no create site at all.');
        console.error('');
        console.error('  This repo has billing plan and subscription creates; finding none means');
        console.error('  the scan is broken (a moved directory, a renamed table identifier), not');
        console.error(
            '  that the invariant holds. A guard that matches nothing passes everything.'
        );
        process.exit(1);
    }

    const blocked = findings.filter((f) => f.verdict === 'blocked-by-package');
    const failures = findings.filter((f) => f.verdict !== 'blocked-by-package');

    for (const f of blocked) {
        console.log(`  BLOCKED  ${f.file}:${f.line}`);
        console.log(`           ${f.snippet}`);
    }
    if (blocked.length > 0) {
        console.log('');
        console.log(
            `  ${blocked.length} create(s) above cannot state the domain yet: the installed`
        );
        console.log('  @qazuor/qzpay-core does not declare a productDomain parameter (spec D-7.1,');
        console.log("  qzpay PR #85). This exemption is DERIVED from the package's own .d.ts and");
        console.log('  retires itself — the moment the wave publishes, each line above becomes a');
        console.log('  hard failure with no edit to this guard.');
        console.log('');
    }

    if (failures.length > 0) {
        console.error(
            'ERROR: a billing plan/subscription create does not state its product domain.'
        );
        console.error('');
        for (const f of failures) {
            console.error(`  ${f.verdict.toUpperCase()}  [${f.shape}]  ${f.file}:${f.line}`);
            console.error(`         ${f.snippet}`);
        }
        console.error('');
        console.error(
            '  The column is NOT NULL with a default, so an omitted write does not fail —'
        );
        console.error("  it files the row under the default's vertical. That is how every tourist");
        console.error(
            '  plan came to report `accommodation` in prod and staging alike (spec F-4b).'
        );
        console.error('');
        console.error('  Fix by naming the column in the create itself:');
        console.error('');
        console.error(
            '    .insert(billingPlans).values({ ..., productDomain: plan.productDomain })'
        );
        console.error('');
        console.error('  Three shapes do NOT satisfy this, on purpose:');
        console.error(
            '    - a conditional spread — `...(x ? { productDomain } : {})` writes a row on'
        );
        console.error('      the default whenever the condition is false;');
        console.error('    - a key nested inside `metadata: { ... }` — that is a JSON blob entry,');
        console.error('      not the column;');
        console.error(
            '    - a separate `UPDATE ... SET product_domain` issued afterwards — the row'
        );
        console.error('      still starts on the default, and once T-036 removes it the INSERT is');
        console.error('      rejected before that UPDATE ever runs.');
        console.error('');
        console.error(
            '  An UNVERIFIABLE payload is not a pass: the guard cannot read a `.values(x)`'
        );
        console.error('  whose argument is not an inline object literal. Inline it, or state the');
        console.error('  domain where the object is built.');
        process.exit(1);
    }

    console.log(
        `  OK - ${sitesChecked} create site(s) inspected; every one states its product domain`
    );
    console.log(
        `  unconditionally${blocked.length > 0 ? `, except the ${blocked.length} blocked above` : ''}.`
    );
    console.log('');
    console.log('All checks passed.');
}

// Only run when invoked directly, so the unit test can import the predicates.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
