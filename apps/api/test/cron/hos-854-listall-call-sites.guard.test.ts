/**
 * HOS-854 — static guard over billing whole-table reads.
 *
 * ## Why a guard and not seven tests
 *
 * HOS-854's second cause was seven call sites that each meant "every row" but
 * called `list()`, which returns the first page only (20 rows) and, before
 * qzpay 5.0, accepted a `filters` option the Drizzle adapter discarded. The
 * defect is a PROPERTY OF THE CALL SITE, not of any one job's behaviour, and
 * an eighth call site written next month would reintroduce it silently.
 *
 * A behavioural test per call site would need 21+ fixture rows each, would only
 * cover the sites that exist today, and — as the mutation run in
 * `test/e2e/flows/billing/hos-854-listall-pagination.test.ts` measured — cannot
 * even detect a dropped filter once the JS post-filter absorbs it. So the
 * behaviour is pinned once, against a real database, in that e2e file; and the
 * SHAPE of every call site is pinned here, in a test that runs in CI.
 *
 * That last part matters: `test/e2e/flows/billing/**` is not wired into any
 * workflow (`grep -rn "flows/billing" .github/workflows/` returns nothing), so
 * the e2e file is a local/nightly-manual instrument. This guard runs in the
 * ordinary vitest suite, which CI does execute on every PR.
 *
 * ## The rule
 *
 * 1. Under `src/cron/jobs/`, a billing collection read must never be `list()`.
 *    A cron sweeping subscriptions always means the whole table; there is no
 *    legitimate "first 20 subscriptions" pass, and that is exactly the read
 *    that sent renewal reminders to a truncated, unfiltered slice.
 * 2. Anywhere else, `list()` is allowed only when the call passes an explicit
 *    `limit` — i.e. the caller is knowingly paginating (a paginated HTTP
 *    endpoint), not accidentally accepting a default.
 * 3. The known whole-table call sites must still use `listAll`, so a silent
 *    revert is caught even though the call would otherwise satisfy rules 1-2.
 *
 * @module test/cron/hos-854-listall-call-sites.guard
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = join(__dirname, '../../src');

/**
 * Billing collections whose reads this guard governs. These are the accessors
 * exposed by the QZPayBilling instance; `list`/`listAll` on anything else
 * (a Hospeda service, a Drizzle model) is out of scope.
 */
const BILLING_COLLECTIONS = [
    'subscriptions',
    'plans',
    'payments',
    'invoices',
    'customers',
    'promoCodes',
    'addOns'
] as const;

/**
 * Strip comments before scanning.
 *
 * Block comments are removed FIRST and line comments second. Doing it the
 * other way round lets a `/*` sequence that appears inside a `//` comment open
 * a block that swallows the rest of the file, which would leave the guard
 * scanning almost nothing and passing for the wrong reason. JSDoc in this
 * codebase discusses `billing.subscriptions.list()` in prose (for example
 * `src/services/trial.service.ts`), so an unstripped scan reports matches that
 * are not code at all.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** One `.list(` occurrence found in source. */
interface ListCallSite {
    readonly file: string;
    readonly line: number;
    readonly collection: string;
    readonly snippet: string;
}

/**
 * Find every `<...>.<collection>.list(` call in the given source.
 *
 * The pattern anchors on the collection name immediately followed by `.list(`,
 * which matches `billing.subscriptions.list(`, `this.billing.subscriptions.list(`
 * and a destructured `subscriptions.list(` alike — the receiver is deliberately
 * not part of the anchor, because pinning it to the literal `billing.` prefix
 * is what would let a renamed local variable walk straight past.
 */
function findListCalls(input: { readonly file: string; readonly source: string }): ListCallSite[] {
    const code = stripComments(input.source);
    const pattern = new RegExp(`\\b(${BILLING_COLLECTIONS.join('|')})\\.list\\(`, 'g');
    const found: ListCallSite[] = [];

    for (const match of code.matchAll(pattern)) {
        const index = match.index ?? 0;
        found.push({
            file: input.file,
            line: code.slice(0, index).split('\n').length,
            collection: match[1] as string,
            // Enough trailing text to see whether a `limit` is passed inline.
            snippet: code
                .slice(index, index + 120)
                .replace(/\s+/g, ' ')
                .trim()
        });
    }
    return found;
}

/**
 * Collect every `.ts` file under `dir`, recursively.
 *
 * Kept dependency-free, matching `test/services/inv1-cache-invalidation.guard.test.ts`:
 * `apps/api` does not carry a glob package, and adding one for a guard would be
 * a dependency the policy does not need.
 */
function collectTsFiles(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            collectTsFiles(full, acc);
        } else if (extname(entry.name) === '.ts') {
            acc.push(full);
        }
    }
    return acc;
}

function readApiSources(): ReadonlyArray<{ file: string; source: string }> {
    return collectTsFiles(API_SRC).map((absolute) => ({
        file: relative(API_SRC, absolute),
        source: readFileSync(absolute, 'utf8')
    }));
}

describe('HOS-854 guard — billing whole-table reads use listAll()', () => {
    it('no cron job reads a billing collection with list()', () => {
        const sources = readApiSources();

        // Self-check: a glob that silently matched nothing would make every
        // assertion below vacuously true.
        expect(sources.length).toBeGreaterThan(0);
        const cronSources = sources.filter((s) => s.file.startsWith('cron/jobs/'));
        expect(cronSources.length).toBeGreaterThan(0);

        const offenders = cronSources.flatMap((s) =>
            findListCalls({ file: s.file, source: s.source })
        );

        expect(
            offenders.map((o) => `${o.file}:${o.line} — ${o.snippet}`),
            'A cron sweeping a billing collection always means every row. `list()` returns the first page only (20 rows by default), which is HOS-854. Use `listAll()`.'
        ).toEqual([]);
    });

    it('every remaining list() call passes an explicit limit', () => {
        const sources = readApiSources();
        const nonCron = sources.filter((s) => !s.file.startsWith('cron/jobs/'));

        const unbounded = nonCron
            .flatMap((s) => findListCalls({ file: s.file, source: s.source }))
            .filter((call) => !/\blimit\b/.test(call.snippet));

        expect(
            unbounded.map((o) => `${o.file}:${o.line} — ${o.snippet}`),
            '`list()` without an explicit `limit` silently takes the 20-row default. Either pass a limit (you are paginating on purpose) or use `listAll()` (you want every row).'
        ).toEqual([]);
    });

    it('the known whole-table call sites still use listAll()', () => {
        // Anchored on the FILE, not on a function name: a rename inside these
        // modules must not quietly retire the check. Each entry is a call site
        // the HOS-854 fix converted; a revert to `list()` shows up as a zero.
        const expectedCallSites: ReadonlyArray<{
            readonly file: string;
            readonly atLeast: number;
        }> = [
            { file: 'cron/jobs/dunning.job.ts', atLeast: 2 },
            { file: 'cron/jobs/notification-schedule.job.ts', atLeast: 2 },
            { file: 'cron/jobs/trial-expiry.ts', atLeast: 1 },
            { file: 'routes/billing/start-paid.ts', atLeast: 1 },
            { file: 'services/billing/reactivation-plan-guard.ts', atLeast: 1 },
            { file: 'services/subscription-checkout.service.ts', atLeast: 1 },
            { file: 'services/trial.service.ts', atLeast: 1 }
        ];

        const shortfalls: string[] = [];
        for (const expected of expectedCallSites) {
            const source = readFileSync(join(API_SRC, expected.file), 'utf8');
            const code = stripComments(source);
            const pattern = new RegExp(`\\b(${BILLING_COLLECTIONS.join('|')})\\.listAll\\(`, 'g');
            const count = [...code.matchAll(pattern)].length;
            if (count < expected.atLeast) {
                shortfalls.push(
                    `${expected.file}: expected at least ${expected.atLeast} listAll() call(s), found ${count}`
                );
            }
        }

        expect(
            shortfalls,
            'A whole-table read reverted to list(). See HOS-854: this is the change that sent renewal reminders to expired and non-active subscriptions.'
        ).toEqual([]);
    });
});
