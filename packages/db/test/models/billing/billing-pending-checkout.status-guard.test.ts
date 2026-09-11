import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static guard for the correlation-row status vocabulary (HOS-276 follow-up).
 *
 * Why static instead of behavioural: this model has no integration coverage,
 * and a unit test would have to mock the Drizzle client — which makes any
 * assertion about the WHERE clause vacuous (the mock, not the query, decides
 * what comes back). The thing that must not regress is a property of the
 * source itself, so the source is what gets asserted.
 *
 * What it protects: a lookup narrowed to `status = 'pending'` silently drops
 * `reconcile_ambiguous` rows — rows the webhook fallback REFUSED to link, where
 * a real approved payment is waiting to be resolved. That exact narrowing is
 * what made the original HOS-276 charge unrecoverable (measured in staging on
 * 2026-08-29: a $35.000 payment stranded, and the manual link endpoint
 * answering 422 `not_found`). Re-adding it would be invisible in CI otherwise.
 */

const MODEL_PATH = join(__dirname, '../../../src/models/billing/billing-pending-checkout.model.ts');

/**
 * Source with comments removed, so prose that merely MENTIONS a pattern can
 * never satisfy or trip a check.
 *
 * Block comments are stripped BEFORE line comments on purpose. Doing it the
 * other way round lets a block-comment opener sitting inside a line comment
 * swallow the rest of the file, leaving every check below trivially green.
 */
function readCodeWithoutComments(): string {
    const raw = readFileSync(MODEL_PATH, 'utf-8');
    return raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Extracts the string literals of a `const NAME = [...] as const;` declaration. */
function readStatusSet(code: string, constName: string): string[] | null {
    const match = code.match(new RegExp(`const ${constName} = \\[([^\\]]*)\\] as const;`));
    if (!match) {
        return null;
    }
    return (match[1] ?? '')
        .split(',')
        .map((raw) => raw.trim().replace(/^'|'$/g, ''))
        .filter((value) => value.length > 0);
}

describe('billing_pending_checkouts status vocabulary (static guard)', () => {
    it('has a resolvable set that includes reconcile_ambiguous and excludes the terminal statuses', () => {
        const values = readStatusSet(readCodeWithoutComments(), 'RESOLVABLE_STATUSES');
        expect(values, 'RESOLVABLE_STATUSES must exist as a shared const').not.toBeNull();

        expect(values).toContain('pending');
        // A REFUSED row is not a resolved row: it must stay reachable.
        expect(values).toContain('reconcile_ambiguous');
        // Terminal outcomes must never be re-resolved (FIX E).
        expect(values).not.toContain('reconcile_assisted');
        expect(values).not.toContain('linked');
        expect(values).not.toContain('superseded');
    });

    it('never narrows a lookup to status = pending alone', () => {
        const code = readCodeWithoutComments();
        const offenders = code.match(
            /eq\(\s*billingPendingCheckouts\.status\s*,\s*'pending'\s*\)/g
        );
        expect(
            offenders,
            "a lookup narrowed to 'pending' alone drops reconcile_ambiguous rows — the rows holding an unlinked real payment. Use inArray(..., RESOLVABLE_STATUSES)."
        ).toBeNull();
    });

    it('resolves every unresolved-row query through the shared resolvable set', () => {
        const code = readCodeWithoutComments();
        const uses = code.match(
            /inArray\(\s*billingPendingCheckouts\.status\s*,\s*RESOLVABLE_STATUSES\s*\)/g
        );
        // findByNonce (Tier 2), findByLocalSubscriptionId (Tier 1),
        // findReconcileCandidates (Tier 3), plus supersedePendingForCustomerPlan,
        // which may only retire rows that are still unresolved.
        expect(uses?.length ?? 0).toBe(4);
    });

    it('treats both unlinked-charge statuses as reaper-protected', () => {
        const code = readCodeWithoutComments();
        const values = readStatusSet(code, 'UNLINKED_CHARGE_STATUSES');
        expect(values, 'UNLINKED_CHARGE_STATUSES must exist as a shared const').not.toBeNull();

        // Legacy rows conflate refusal with success; the safe reading of that
        // ambiguity is the one that does not let the reaper bury money.
        expect(values).toContain('reconcile_assisted');
        expect(values).toContain('reconcile_ambiguous');

        expect(
            code,
            'the reaper lookup must match the whole unlinked-charge set, not one status'
        ).toMatch(
            /inArray\(\s*billingPendingCheckouts\.status\s*,\s*UNLINKED_CHARGE_STATUSES\s*\)/
        );
    });

    it('writes the refusal and supersede statuses from their own dedicated methods', () => {
        const code = readCodeWithoutComments();
        expect(code).toMatch(/async markReconcileAmbiguous\(/);
        expect(code).toMatch(/status: 'reconcile_ambiguous'/);
        expect(code).toMatch(/async supersedePendingForCustomerPlan\(/);
        expect(code).toMatch(/status: 'superseded'/);
    });
});
