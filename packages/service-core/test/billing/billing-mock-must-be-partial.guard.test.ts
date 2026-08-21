/**
 * @file billing-mock-must-be-partial.guard.test.ts
 * @description Static guard: no test may replace the WHOLE `@repo/billing`
 * module with an object literal. Every `vi.mock('@repo/billing', ...)` must be
 * a PARTIAL mock that spreads the real module via `importOriginal`.
 *
 * ## The failure mode
 *
 * `vi.mock('@repo/billing', () => ({ getAddonBySlug: vi.fn() }))` does not add
 * a stub — it REPLACES the module. Every other export becomes `undefined`. The
 * suite keeps passing, because nothing under test referenced those exports yet.
 *
 * The moment production code starts importing one more symbol from
 * `@repo/billing`, every such suite breaks — and it breaks in two different
 * ways, only one of which is visible:
 *
 * - **Loud**: `Error: [vitest] No "ENTITLEMENT_GRANTING_STATUSES" export is
 *   defined on the "@repo/billing" mock.` The file aborts. You find it.
 * - **Silent**: the missing export is a FUNCTION called inside a `try/catch`.
 *   The call throws `undefined is not a function`, the catch swallows it, the
 *   phase does nothing, and every assertion in the file still runs and still
 *   passes. HOS-702 hit exactly this: `addon-expiry`'s split-state
 *   reconciliation went from 1 to 0 with the source correct, and the only
 *   reason it surfaced at all was one assertion that happened to count the
 *   reconciled rows.
 *
 * The silent variant is why this is a guard and not a lint rule you could skip.
 * A whole-module literal mock is a test that can stop testing without telling
 * anyone.
 *
 * ## Why "spread the real module" and not "add the missing export"
 *
 * Because listing exports by hand is the same defect one layer down: the stub
 * drifts from the real module exactly the way HOS-702's hand-rolled
 * `['active', 'trialing']` sets drifted from `ENTITLEMENT_GRANTING_STATUSES`.
 * A predicate stubbed with a hand-written copy can disagree with the real one
 * and turn a passing test into a lie. Spreading the original and overriding
 * only what genuinely needs controlling has neither problem.
 *
 * ## Scope
 *
 * `packages/service-core` only — this file can read only its own package's
 * tests. A sibling guards `apps/api`. Known remaining literal mocks outside
 * both, left as documented debt by HOS-702 because they belong to unrelated
 * packages: 4 in `apps/admin`, 2 in `packages/seed`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TEST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Matches any `vi.mock('@repo/billing', <factory>)` and captures the factory's
 * parameter list. A partial mock necessarily declares a parameter
 * (`importOriginal`); a whole-module replacement takes none. Deliberately
 * anchored on the EMPTY PARAMETER LIST rather than on the string
 * `importOriginal`, so a factory that names the parameter something else still
 * passes and a `() => ({...})` written in any style still fails.
 */
const BILLING_MOCK = /vi\.mock\(\s*['"]@repo\/billing['"]\s*,\s*(?:async\s+)?\(([^)]*)\)/g;

/**
 * Strips block and line comments before scanning. Required, not cosmetic: this
 * guard's own docstring spells out the forbidden `vi.mock('@repo/billing',
 * () => ({...}))` form to explain what it forbids, and without this the guard
 * fails on its own documentation. Same treatment the sibling
 * `billing-status-gate-canonical-predicate` guards apply, for the same reason.
 *
 * Note the guard still polices ITSELF — it is not excluded by path. Only its
 * prose is stripped, so a real whole-module mock written in this file would
 * still be caught.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Recursively collects every `.ts`/`.tsx` file under `dir`. */
function collectTestFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectTestFiles(full));
        } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Every file under the test root that replaces the whole `@repo/billing`
 * module (a factory taking no parameters, so it cannot call `importOriginal`).
 */
function findWholeModuleBillingMocks(): string[] {
    const offenders: string[] = [];
    for (const file of collectTestFiles(TEST_ROOT)) {
        const source = stripComments(readFileSync(file, 'utf-8'));
        for (const match of source.matchAll(BILLING_MOCK)) {
            if ((match[1] ?? '').trim() === '') {
                offenders.push(relative(TEST_ROOT, file));
                break;
            }
        }
    }
    return offenders;
}

describe('HOS-702 guard: @repo/billing is never mocked as a whole-module literal', () => {
    it('finds billing mocks to check at all (guard is not vacuously green)', () => {
        const total = collectTestFiles(TEST_ROOT).filter((f) =>
            /vi\.mock\(\s*['"]@repo\/billing['"]/.test(stripComments(readFileSync(f, 'utf-8')))
        ).length;
        expect(
            total,
            "No vi.mock('@repo/billing', ...) call sites were found under packages/service-core/test. " +
                'Either the test root moved or the matcher broke — a guard that scans nothing ' +
                'passes for the wrong reason.'
        ).toBeGreaterThan(0);
    });

    it("every vi.mock('@repo/billing') is a partial mock spreading the real module", () => {
        const offenders = findWholeModuleBillingMocks();
        expect(
            offenders,
            `${offenders.length} test file(s) replace the WHOLE @repo/billing module with an ` +
                'object literal, leaving every other export undefined:\n' +
                offenders.map((f) => `  - ${f}`).join('\n') +
                '\n\nThe next production import from @repo/billing breaks these — loudly ' +
                '("No <X> export is defined on the mock") or, when the missing export is a ' +
                'function called inside a try/catch, SILENTLY: the phase does nothing while ' +
                'every assertion still passes (HOS-702). Use a partial mock instead:\n\n' +
                "  vi.mock('@repo/billing', async (importOriginal) => ({\n" +
                "      ...(await importOriginal<typeof import('@repo/billing')>()),\n" +
                '      // override only what this suite genuinely needs to control\n' +
                '  }));\n'
        ).toEqual([]);
    });
});
