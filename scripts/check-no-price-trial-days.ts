/**
 * @file check-no-price-trial-days.ts
 * @description HOS-1224, guard G-2 — fails CI when production source writes a
 * value into `billing_prices.trial_days`.
 *
 * -----------------------------------------------------------------------------
 * THE PROVEN CASE
 * -----------------------------------------------------------------------------
 * `billing_prices.trial_days` is a column nothing in Hospeda reads to decide the
 * product. The real trial is `billing_plans.metadata.trialDays`, on the dedicated
 * `owner-trial` / `gastronomy-trial` / `experience-trial` plans — which carry no
 * `billing_prices` row at all. The repo said so itself:
 * `0055-owner-trial-30-days` calls its price-row write a "mirror" and states
 * "Nothing currently reads it"; `0064-hos-590` says the column "is deliberately
 * NOT touched here".
 *
 * That was never the same as harmless. `@qazuor/qzpay-core` INHERITS the resolved
 * price's `trialDays` whenever a caller of `subscriptions.create` omits the field:
 *
 *     const price = prices.find((p) => p.id === input.priceId) ?? prices[0];
 *     if (input.trialDays !== void 0) createInput.trialDays = input.trialDays;
 *     else if (price?.trialDays != null) createInput.trialDays = price.trialDays;
 *
 * and `@qazuor/qzpay-drizzle` turns whatever came out of that into `trial_start` /
 * `trial_end` on the new `billing_subscriptions` row. Measured 2026-09-07:
 * `owner-basico`, `owner-pro` and `owner-premium` carried `trial_days = 30` on
 * their monthly price in BOTH staging and production. That is HOS-1221's bug D3 —
 * a PAID subscription born marked `trialing` for 30 days with the customer
 * already charged.
 *
 * HOS-1221 fixes the call sites on the paid path by stating `trialDays: 0`
 * explicitly. This guard covers the other half: the value can no longer be
 * WRITTEN, so a future call site that forgets inherits nothing.
 *
 * -----------------------------------------------------------------------------
 * WHAT IT PROVES
 * -----------------------------------------------------------------------------
 * No production TypeScript file passes a `trialDays` / `trial_days` property with
 * any value other than a literal `null` inside the object handed to a Drizzle
 * write against the `billingPrices` table — i.e. the `.values({...})` of an
 * `.insert(billingPrices)` or the `.set({...})` of an `.update(billingPrices)`.
 *
 * `null` stays legal on purpose: nulling the column is the point of the change
 * this guard defends, and the data-migration that does it must name the field.
 *
 * -----------------------------------------------------------------------------
 * WHY THIS SHAPE AND NOT A LINE-BASED GREP
 * -----------------------------------------------------------------------------
 * A first cut of this guard was a line grep for a `trialDays:` key inside any
 * file that mentioned `billingPrices`. It matched 56 lines, and every one of them
 * was innocent: `billing_plans.metadata.trialDays` writes, the unrelated
 * `billing_mp_plans.trial_days` column, Zod schema fields, and the per-plan
 * constants in `plans.config.ts`. A guard that noisy does not get fixed — it gets
 * a per-line escape hatch bolted on by the third person it inconveniences, and
 * that escape hatch is the real fail-open (see the sibling
 * `check-no-trial-to-mercadopago.sh`, which argues the same point).
 *
 * So the match is scoped to the OBJECT ACTUALLY BEING WRITTEN TO THE TABLE,
 * found by brace-balancing from the write call. There is deliberately no
 * per-line escape hatch.
 *
 * ANCHORING. The anchor is the TABLE SYMBOL (`billingPrices`), never a function
 * name. A guard anchored on `ensurePrice` or `createPlan` dies at the first
 * rename, and the PR that renames does not see it fail — it exits 0 over a tree
 * where its subject no longer exists. That has already happened in this repo.
 * Renaming a surrounding function, moving a file, or adding a brand-new
 * price-writing path all stay in scope automatically.
 *
 * -----------------------------------------------------------------------------
 * WHAT IT DOES NOT PROVE
 * -----------------------------------------------------------------------------
 * - It matches the Drizzle call SHAPE (`.insert(billingPrices).values({…})` /
 *   `.update(billingPrices).set({…})`). Raw SQL against the table, or an object
 *   spread from a variable built elsewhere (`...priceOverrides`), is invisible to
 *   it. Bounded: no current path is written either way.
 * - It skips `.test.ts` / `.spec.ts`. A regression proving the column is NOT
 *   written legitimately needs to name it in a fixture.
 * - It says nothing about an operator writing the column by hand in SQL, nor
 *   about `billing_plans.metadata.trialDays`, which is the REAL trial source and
 *   is deliberately untouched by all of this.
 *
 * -----------------------------------------------------------------------------
 * THE ALLOWLIST, AND WHY IT CANNOT ROT
 * -----------------------------------------------------------------------------
 * Two applied, ledgered, checksummed seed data-migrations are exempt: they are a
 * historical record of what already ran against staging and production, not live
 * code, and editing one rewrites history. Every OTHER file under
 * `data-migrations/` stays IN scope, so a NEW migration that writes the column
 * trips this guard — a directory-wide exemption would have been the fail-open.
 *
 * The allowlist is verified: if an allowlisted path stops existing the guard
 * FAILS rather than silently shrinking. An exemption that outlives its subject is
 * how a blind spot widens unnoticed.
 *
 * -----------------------------------------------------------------------------
 * TESTABILITY / POSITIVE CONTROL
 * -----------------------------------------------------------------------------
 * A guard green over a clean tree has proved nothing. `SCAN_FILES_OVERRIDE`
 * (newline-separated paths) replaces the derived file list verbatim:
 *
 *   printf 'db.insert(billingPrices).values({ a: 1, trialDays: 30 });\n' > /tmp/x.ts
 *   SCAN_FILES_OVERRIDE=/tmp/x.ts tsx scripts/check-no-price-trial-days.ts   # exit 1
 *
 *   printf 'db.insert(billingPrices).values({ a: 1, trialDays: null });\n' > /tmp/y.ts
 *   SCAN_FILES_OVERRIDE=/tmp/y.ts tsx scripts/check-no-price-trial-days.ts   # exit 0
 *
 * Exit codes: 0 = the column is never written a value; 1 = at least one write.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';

/** Production source roots. Build output and test dirs are never scanned. */
const SCAN_GLOBS = [
    'apps/api/src/**/*.ts',
    'apps/admin/src/**/*.ts',
    'apps/web/src/**/*.ts',
    'packages/service-core/src/**/*.ts',
    'packages/billing/src/**/*.ts',
    'packages/db/src/**/*.ts',
    'packages/schemas/src/**/*.ts',
    'packages/seed/src/**/*.ts'
] as const;

const IGNORED_GLOBS = ['**/*.test.ts', '**/*.spec.ts', '**/dist/**'] as const;

/**
 * Applied, ledgered, checksummed data-migrations. History, not live code.
 * Paths are repo-relative and POSIX-separated.
 */
const ALLOWLIST: readonly string[] = [
    'packages/seed/src/data-migrations/0051-hos-301-tourist-trial-30-days.ts',
    'packages/seed/src/data-migrations/0055-owner-trial-30-days.ts'
];

/** The table symbol. This, not any function name, is the guard's anchor. */
const TABLE_SYMBOL = 'billingPrices';

/**
 * A Drizzle write against the table, plus the method whose argument object
 * carries the column values. Matches `.insert(billingPrices).values(` and
 * `.update(billingPrices).set(`, tolerating whitespace and newlines between.
 */
const WRITE_CALL_RE = new RegExp(
    `\\b(insert|update)\\s*\\(\\s*${TABLE_SYMBOL}\\s*\\)\\s*(?:\\.\\s*\\w+\\s*\\([^()]*\\)\\s*)*?\\.\\s*(values|set)\\s*\\(`,
    'g'
);

/** `trialDays` / `trial_days` in a property slot, quoted or bare. */
const TRIAL_KEY_RE = /(^|[{,\s])['"]?(trialDays|trial_days)['"]?\s*:\s*([^,\n}]*)/g;

/** One offending write. */
interface Violation {
    readonly file: string;
    readonly line: number;
    readonly value: string;
}

/**
 * Returns the source slice of the balanced argument that starts at `openParen`
 * (the index of the `(`), or `null` when the parentheses never balance.
 *
 * Brace/paren balancing is deliberately naive about strings and comments: an
 * unbalanced paren inside a string literal in a price-write argument would make
 * this over-read, which fails LOUD (a wider slice can only produce a false
 * positive a human then reads), never silently under-read.
 */
function readBalancedArgument({
    source,
    openParen
}: {
    readonly source: string;
    readonly openParen: number;
}): string | null {
    let depth = 0;
    for (let i = openParen; i < source.length; i++) {
        const ch = source[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) return source.slice(openParen + 1, i);
        }
    }
    return null;
}

/** Scans one file's source for offending price writes. */
function findViolations({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): readonly Violation[] {
    if (!source.includes(TABLE_SYMBOL)) return [];

    const found: Violation[] = [];
    WRITE_CALL_RE.lastIndex = 0;
    let call: RegExpExecArray | null = WRITE_CALL_RE.exec(source);

    while (call !== null) {
        const openParen = call.index + call[0].length - 1;
        const argument = readBalancedArgument({ source, openParen });

        if (argument !== null) {
            TRIAL_KEY_RE.lastIndex = 0;
            let key: RegExpExecArray | null = TRIAL_KEY_RE.exec(argument);
            while (key !== null) {
                const value = (key[3] ?? '').trim();
                // Nulling the column is the point, not the violation.
                if (value !== 'null') {
                    const upto = source.slice(0, openParen + 1 + key.index);
                    found.push({
                        file,
                        line: upto.split('\n').length,
                        value: value === '' ? '(shorthand/spread)' : value
                    });
                }
                key = TRIAL_KEY_RE.exec(argument);
            }
        }

        call = WRITE_CALL_RE.exec(source);
    }

    return found;
}

function main(): void {
    const root = path.resolve(import.meta.dirname, '..');
    const override = process.env.SCAN_FILES_OVERRIDE;

    console.log(
        '=== Checking billing_prices.trial_days is never written a value (HOS-1224 G-2) ==='
    );
    console.log('');

    if (override === undefined) {
        // Verify the allowlist BEFORE using it: an entry whose file is gone means
        // the exemption has outlived its subject, and that must be loud.
        const missing = ALLOWLIST.filter((rel) => !globSync(rel, { cwd: root }).length);
        if (missing.length > 0) {
            console.error('ERROR: allowlisted file(s) no longer exist:');
            for (const rel of missing) console.error(`  ${rel}`);
            console.error('  Remove them from ALLOWLIST in this script — an exemption that');
            console.error("  outlives its file silently widens the guard's blind spot.");
            process.exit(1);
        }
    }

    const files =
        override === undefined
            ? SCAN_GLOBS.flatMap((pattern) =>
                  globSync(pattern, { cwd: root, ignore: [...IGNORED_GLOBS] })
              )
                  .filter((rel) => !ALLOWLIST.includes(rel))
                  .sort()
            : override.split('\n').filter((line) => line.trim().length > 0);

    if (files.length === 0) {
        // An empty scope is a BROKEN guard, not a clean tree.
        console.error('ERROR: no in-scope files found.');
        console.error('  The file derivation is broken (moved source roots?).');
        console.error('  Fix it; do not ignore this.');
        process.exit(1);
    }

    const inScope = files.filter((rel) =>
        readFileSync(path.resolve(root, rel), 'utf8').includes(TABLE_SYMBOL)
    );
    console.log(
        `  Scanned ${files.length} production file(s); ${inScope.length} touch ${TABLE_SYMBOL}.`
    );
    console.log('');

    const violations = inScope.flatMap((rel) =>
        findViolations({ file: rel, source: readFileSync(path.resolve(root, rel), 'utf8') })
    );

    if (violations.length > 0) {
        console.error('ERROR: billing_prices.trial_days is being written a value.');
        console.error('');
        for (const v of violations) console.error(`  ${v.file}:${v.line} — trialDays: ${v.value}`);
        console.error('');
        console.error('  Each line above sets trialDays inside an object written to');
        console.error('  billing_prices. Nothing in Hospeda READS that column to decide the');
        console.error('  product — but @qazuor/qzpay-core inherits it whenever a caller of');
        console.error('  subscriptions.create omits trialDays, and qzpay-drizzle turns the');
        console.error('  inherited number into trial_start/trial_end on the new subscription.');
        console.error('  In production that is a PAID subscription born marked trialing for');
        console.error('  30 days with the customer already charged (HOS-1221 bug D3).');
        console.error('');
        console.error('  The trial you actually want is billing_plans.metadata.trialDays, on');
        console.error('  the dedicated *-trial plans. Set it there.');
        console.error('');
        console.error('  Writing a literal null is allowed and is not what this matched.');
        process.exit(1);
    }

    console.log('  OK - no production path writes a value into billing_prices.trial_days.');
    console.log('');
    console.log('All checks passed.');
}

main();
