/**
 * @file subscription-linked-entities-bridge.guard.test.ts
 * @description Static guard, HOS-1280: pins the known call sites of
 * `reconcileSubscriptionLinkedEntities` (and, for the two files this fix
 * touched, `reconcilePartnerForSubscription`) so this exact bug class cannot
 * regress silently.
 *
 * ## The defect class
 *
 * Three state-changing sites never called the bridge that publishes /
 * unpublishes a commerce listing: the admin hard-cancel hook, both pause/
 * resume surfaces (admin + self-serve), and the comp-grant supersede loop
 * (which called it once for the NEW row, never for each row it superseded).
 * The accommodation half is self-healing — the 6-hourly
 * `entity-subscription-cache-reconcile` cron re-derives every accommodation
 * row — but commerce visibility has no such backstop, so a cancelled/paused
 * gastronomy or experience listing stayed PUBLIC with the underlying charge
 * dead, forever (HOS-1280).
 *
 * ## Why a hand-maintained comment could not be trusted (and why this isn't one)
 *
 * `subscription-linked-entities.service.ts`'s own docblock used to enumerate
 * "six call sites" by name. By the time HOS-1280 measured it, there were 9 in
 * 8 files — a seventh had been added, then an eighth and ninth, and nobody
 * came back to update the comment. A prose list is not evidence; this file
 * is a scan, so it fails the moment it stops matching reality instead of
 * quietly drifting.
 *
 * ## Scope — what this guard DOES prove
 *
 *   - Every file pinned in `BRIDGE_CALL_SITES` still contains at least the
 *     recorded number of `reconcileSubscriptionLinkedEntities(...)` calls —
 *     regression protection for the exact three sites HOS-1280 fixed, plus
 *     the six sites that already called it correctly.
 *   - The two files HOS-1280 also wired to `reconcilePartnerForSubscription`
 *     (`qzpay-admin-hooks.ts`, `subscription-pause.ts` — both demonstrably
 *     reachable by a partner subscription; see the HOS-1280 PR description
 *     for the reachability measurement) keep calling it too.
 *   - The TOTAL count of `reconcileSubscriptionLinkedEntities(...)` call
 *     expressions under `apps/api/src` matches the sum of the pinned counts
 *     — so a brand-new tenth file that starts calling the bridge, or a
 *     literal count that moves in an already-pinned file, forces this table
 *     to be updated instead of silently drifting the way the old docblock
 *     did. This is the guard's answer to "did every site get wired?": ask
 *     `rg 'reconcileSubscriptionLinkedEntities\(' apps/api/src` and diff
 *     against this table, never trust a hand-written list on its own.
 *
 * ## Scope — what this guard does NOT prove (stated so green is not read as more)
 *
 *   - It is NOT the "every `billing_subscriptions.status` writer is
 *     reviewed" audit that `inv1-cache-invalidation.guard.test.ts` runs for
 *     `clearEntitlementCache` (its `discoverBillingSubscriptionsWriters()` /
 *     `BILLING_SUBSCRIPTIONS_WRITERS` pair). Building that SAME auto-
 *     discovery + reviewed-registry pattern for the reconcile-bridge
 *     invariant is the natural next step, but doing it properly means
 *     triaging on the order of 40 direct `.update(billingSubscriptions)`
 *     sites across `apps/api/src`, `packages/service-core` and
 *     `packages/seed/src/data-migrations` — each one requires judgment on
 *     whether the write changes `status`, whether the row can ever be
 *     commerce/partner-domain, and whether an existing webhook/cron already
 *     covers it. That is a bounded but real audit and doing it hastily here
 *     risks exactly the "guard born with unreviewed exceptions" failure mode
 *     HOS-1277 explicitly declined for its own guard. Left as an explicit,
 *     named follow-up rather than a rushed, possibly-wrong allowlist.
 *   - It is source-level (`.matchAll` over file text), not a runtime
 *     assertion: it proves the call is PRESENT, not that it sits on the
 *     reachable branch or is never dead code. The HOS-1280 regression tests
 *     added alongside the three fixed sites — in
 *     `test/routes/billing/admin/hooks/qzpay-admin-hooks.test.ts`,
 *     `test/routes/subscription-pause.test.ts`, and
 *     `test/services/subscription-comp-grant.service.test.ts` — are what
 *     prove the runtime effect (the call fires with the right arguments, in
 *     the right order relative to the underlying write).
 *   - It says nothing about `reconcilePartnerForSubscription`'s OTHER four
 *     call sites (or lack thereof) outside the two files HOS-1280 touched —
 *     that full audit is HOS-1306's.
 *
 * @module test/services/subscription-linked-entities-bridge.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../src');

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/** Recursively collect source files under a directory, as repo-relative paths. */
function collectSourceFiles(dir: string, base: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full, base));
        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
            found.push(full.slice(base.length + 1));
        }
    }
    return found;
}

/** Matches an actual invocation, not an import or a comment mention. */
const BRIDGE_CALL = /reconcileSubscriptionLinkedEntities\s*\(/g;
const PARTNER_CALL = /reconcilePartnerForSubscription\s*\(/g;

function countCalls(source: string, pattern: RegExp): number {
    return [...source.matchAll(pattern)].length;
}

/**
 * Every file that calls `reconcileSubscriptionLinkedEntities`, as measured on
 * HOS-1280 (2026-09-09), and the minimum number of call expressions each must
 * keep containing. `hos1280Fix: true` marks the three sites this issue
 * actually added the call to; the rest already called it before this fix.
 */
const BRIDGE_CALL_SITES: ReadonlyArray<{
    readonly file: string;
    readonly minCalls: number;
    readonly hos1280Fix: boolean;
    readonly note: string;
}> = [
    {
        file: 'cron/jobs/abandoned-pending-subs.job.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'cron/jobs/preapproval-less-expiry.job.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'cron/jobs/dunning.job.ts',
        minCalls: 2,
        hos1280Fix: false,
        note: 'Pre-existing: enters-dunning branch + recovers branch.'
    },
    {
        file: 'cron/jobs/finalize-cancelled-subs.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing — the contrast case HOS-1280 measured the other three against.'
    },
    {
        file: 'services/commerce-subscription-attach.service.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'services/billing/trial-local-expiry.service.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-logic.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing: the MercadoPago webhook.'
    },
    {
        file: 'services/subscription-comp-grant.service.ts',
        minCalls: 2,
        hos1280Fix: true,
        note: 'HOS-1280: the pre-existing call for the new comp row, PLUS a new call inside the supersede loop for each row it retires — the loop used to call the bridge zero times per superseded row.'
    },
    {
        file: 'routes/billing/subscription-pause.ts',
        minCalls: 2,
        hos1280Fix: true,
        note: 'HOS-1280: self-serve pause + self-serve resume, both previously uncalled.'
    },
    {
        file: 'routes/billing/admin/qzpay-admin-hooks.ts',
        minCalls: 3,
        hos1280Fix: true,
        note: 'HOS-1280: admin hard-cancel, admin pause, admin resume — all three previously uncalled.'
    }
] as const;

/**
 * Files where HOS-1280 also wired `reconcilePartnerForSubscription`, having
 * measured that a partner subscription CAN reach them (generic admin routes
 * with no product-domain filter; a self-serve route gated only on having a
 * `billingCustomerId`, not a role — see the HOS-1280 PR description).
 */
const PARTNER_CALL_SITES: ReadonlyArray<{ readonly file: string; readonly minCalls: number }> = [
    { file: 'routes/billing/subscription-pause.ts', minCalls: 2 },
    { file: 'routes/billing/admin/qzpay-admin-hooks.ts', minCalls: 3 }
] as const;

describe('HOS-1280 guard: reconcileSubscriptionLinkedEntities call sites are pinned', () => {
    it.each(
        BRIDGE_CALL_SITES.map((s) => [s.file, s.minCalls, s.note] as const)
    )('%s calls the bridge at least %i time(s) (%s)', (file, minCalls) => {
        const source = readSrc(file);
        const actual = countCalls(source, BRIDGE_CALL);
        expect(
            actual,
            `${file} calls reconcileSubscriptionLinkedEntities ${actual} time(s), expected ` +
                `at least ${minCalls}. If this dropped, a state-changing write in this file lost ` +
                'its bridge call — the exact HOS-1280 bug class (a cancelled/paused commerce ' +
                'subscription leaves its listing PUBLIC forever, with no backstop cron).'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it.each(
        PARTNER_CALL_SITES.map((s) => [s.file, s.minCalls] as const)
    )('%s calls reconcilePartnerForSubscription at least %i time(s) (HOS-1280)', (file, minCalls) => {
        const source = readSrc(file);
        const actual = countCalls(source, PARTNER_CALL);
        expect(
            actual,
            `${file} calls reconcilePartnerForSubscription ${actual} time(s), expected at ` +
                `least ${minCalls}. HOS-1280 measured this file as reachable by a partner ` +
                'subscription and wired the call accordingly — do not remove it without ' +
                're-measuring reachability.'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it('the pinned files still exist and are readable', () => {
        for (const site of BRIDGE_CALL_SITES) {
            expect(() => readSrc(site.file), `Missing or unreadable: ${site.file}`).not.toThrow();
        }
    });

    it('every pinned entry carries a real note', () => {
        for (const site of BRIDGE_CALL_SITES) {
            expect(
                site.note.trim().length,
                `BRIDGE_CALL_SITES entry for ${site.file} has no note`
            ).toBeGreaterThan(10);
        }
    });

    it("at least three pinned entries are marked as this issue's own fix", () => {
        // Sanity check on the table itself, not the source tree: HOS-1280 fixed
        // exactly three sites. If this count changes, the table was edited
        // without updating this assertion (or vice versa) — worth a second look.
        const fixed = BRIDGE_CALL_SITES.filter((s) => s.hos1280Fix);
        expect(fixed.map((s) => s.file).sort()).toEqual(
            [
                'routes/billing/admin/qzpay-admin-hooks.ts',
                'routes/billing/subscription-pause.ts',
                'services/subscription-comp-grant.service.ts'
            ].sort()
        );
    });

    it('total bridge call-expression count under apps/api/src matches the pinned sum (tripwire for new/removed sites)', () => {
        // Excludes the reconciler's OWN definition file: `export async function
        // reconcileSubscriptionLinkedEntities(` matches the same
        // `identifier(` shape as an invocation, but it is the declaration, not
        // a call site.
        const DEFINITION_FILE = 'services/subscription-linked-entities.service.ts';
        const allFiles = collectSourceFiles(SRC_ROOT, SRC_ROOT).filter(
            (f) => f !== DEFINITION_FILE
        );
        let total = 0;
        const perFile = new Map<string, number>();
        for (const file of allFiles) {
            const n = countCalls(readFileSync(resolve(SRC_ROOT, file), 'utf-8'), BRIDGE_CALL);
            if (n > 0) {
                perFile.set(file, n);
                total += n;
            }
        }

        const pinnedSum = BRIDGE_CALL_SITES.reduce((sum, s) => sum + s.minCalls, 0);
        const pinnedFiles = new Set(BRIDGE_CALL_SITES.map((s) => s.file));
        const unpinned = [...perFile.keys()].filter((f) => !pinnedFiles.has(f));

        expect(
            unpinned,
            `Found file(s) calling reconcileSubscriptionLinkedEntities that are NOT in ` +
                `BRIDGE_CALL_SITES: ${unpinned.join(', ')}. Add an entry (this is exactly the drift ` +
                'that let the old docblock lie about "six call sites" while there were nine.)'
        ).toEqual([]);

        expect(
            total,
            `Total reconcileSubscriptionLinkedEntities(...) call expressions under apps/api/src is ` +
                `${total}, but BRIDGE_CALL_SITES' minCalls sum to ${pinnedSum}. If a pinned file's ` +
                'call count changed, update its minCalls; do not silently let this table undercount ' +
                'reality.'
        ).toBe(pinnedSum);
    });
});
