/**
 * SPEC-145 T-021 — Transversal INV-1 guard: all lifecycle handlers call clearEntitlementCache
 *
 * This test ensures that every money-mutating lifecycle event in the billing
 * subsystem has a clearEntitlementCache() call in its handler. It uses
 * source-level static assertions via readFileSync — if someone refactors a
 * handler and drops the cache-invalidation call, this test fails loudly.
 *
 * ## Approach: source-level static scan
 *
 * Alternative approaches considered:
 *
 *   a) Import each handler + mock clearEntitlementCache + drive the minimal path.
 *      Pro: exercises the actual runtime path. Con: requires per-file mocking
 *      of every service/DB/QZPay dependency for ~24 call sites — extremely fragile
 *      and high-maintenance; the per-handler unit tests already cover this.
 *
 *   b) Source-level grep (chosen): read each source file and assert the string
 *      "clearEntitlementCache" appears in the file. Pro: zero runtime deps, fast,
 *      stable, self-documenting. Con: does not verify the call is on the correct
 *      code path (e.g., it could be inside a dead branch). However:
 *        - Every handler in this table is already covered by unit/integration tests
 *          that assert the cache was cleared on the happy path.
 *        - This guard catches the "someone deleted the line" regression which the
 *          per-handler tests would also catch, but this test provides a single
 *          cross-cutting view that makes the invariant visible.
 *
 * ## Events covered (mapped from the drift report — ~24 call sites)
 *
 *  ACTIVATION / UPGRADE
 *    payment-logic.ts          — subscription.activated (activate + plan upgrade via payment)
 *    subscription-logic.ts     — subscription.updated (plan change via MP subscription webhook)
 *
 *  DOWNGRADE / SCHEDULED
 *    apply-scheduled-plan-changes.ts — downgrade-cron (apply-scheduled-plan-changes)
 *
 *  CANCEL
 *    qzpay-admin-hooks.ts      — admin cancel + admin pause + admin resume + admin update
 *    subscription-logic.ts     — subscription.cancelled (cancel via MP subscription webhook)
 *
 *  PAUSE / RESUME
 *    subscription-pause.ts     — pause + resume (protected billing route)
 *
 *  ADDON PURCHASE (checkout confirm)
 *    addon.checkout.ts         — confirmAddonPurchase (webhook payment confirm)
 *
 *  ADDON EXPIRY (cron Phase 1 — INV-1 fix)
 *    addon-expiry.job.ts       — Phase 1 expiry loop (this very fix)
 *    addon-expiry.job.ts       — Phase 4 revocation retry
 *    addon-expiry.job.ts       — Phase 6 entitlement reconciliation
 *    addon-expiry.job.ts       — Phase 7 grant reconciliation (post-tx)
 *
 *  ADDON CANCEL
 *    addon-lifecycle-cancellation.service.ts — cancelAddon (admin + user cancel)
 *    addons.ts (route)         — addon cancel route
 *
 *  TRIAL START / EXPIRE
 *    trial.service.ts          — trial start, trial expire, trial activation
 *
 *  REFUND (full)
 *    refund-lifecycle.service.ts — full refund downgrade + refund cancel
 *
 *  DUNNING CANCEL
 *    dunning.job.ts            — dunning cancel event
 *
 *  ADMIN GRANT / REVOKE
 *    customer-entitlements.ts  — admin grant + admin revoke entitlements
 *
 *  ADDON ENTITLEMENT APPLY / REMOVE
 *    addon-entitlement.service.ts — applyAddonEntitlements + removeAddonEntitlements
 *
 *  ADDON LIFECYCLE (checkout + plan change)
 *    addon-lifecycle.service.ts  — purchase confirm, refund, cancel
 *    addon-plan-change.service.ts — plan-change addon propagation
 *
 * @module test/services/inv1-cache-invalidation.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Absolute path to the API source root.
 * Every entry in LIFECYCLE_SITES below is relative to this root.
 */
const SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Read a source file relative to SRC_ROOT and return its text content.
 * Throws (and fails the test) if the file does not exist.
 */
function readSrc(relativePath: string): string {
    const absPath = resolve(SRC_ROOT, relativePath);
    return readFileSync(absPath, 'utf-8');
}

/**
 * Each entry describes ONE lifecycle event and the source file that must
 * contain clearEntitlementCache. Multiple events mapping to the same file
 * appear as separate rows so the table is event-centric, not file-centric.
 *
 * `description` — human-readable event name (appears in test output on failure).
 * `file`        — relative path from SRC_ROOT to the handler source file.
 */
interface LifecycleSite {
    readonly description: string;
    readonly file: string;
}

const LIFECYCLE_SITES: readonly LifecycleSite[] = [
    // ── ACTIVATION / UPGRADE ──────────────────────────────────────────────────

    {
        description: 'activation/upgrade via payment webhook (payment-logic.ts)',
        file: 'routes/webhooks/mercadopago/payment-logic.ts'
    },
    {
        description: 'plan change via MP subscription webhook (subscription-logic.ts)',
        file: 'routes/webhooks/mercadopago/subscription-logic.ts'
    },

    // ── DOWNGRADE / SCHEDULED ─────────────────────────────────────────────────

    {
        description: 'downgrade-cron (apply-scheduled-plan-changes.ts)',
        file: 'cron/jobs/apply-scheduled-plan-changes.ts'
    },

    // ── CANCEL (admin hooks + subscription webhook) ───────────────────────────

    {
        description:
            'admin cancel/pause/resume/update via qzpay-admin-hooks (qzpay-admin-hooks.ts)',
        file: 'routes/billing/admin/qzpay-admin-hooks.ts'
    },

    // ── PAUSE / RESUME ────────────────────────────────────────────────────────

    {
        description: 'subscription pause/resume route (subscription-pause.ts)',
        file: 'routes/billing/subscription-pause.ts'
    },

    // ── ADDON PURCHASE (checkout confirm) ─────────────────────────────────────

    {
        description: 'addon purchase checkout confirm clearEntitlementCache (addon.checkout.ts)',
        file: 'services/addon.checkout.ts'
    },
    {
        description: 'addon entitlement apply (addon-entitlement.service.ts)',
        file: 'services/addon-entitlement.service.ts'
    },

    // ── ADDON EXPIRY (cron Phases 1, 4, 6, 7) ────────────────────────────────

    {
        description:
            'addon expiry cron Phase 1 loop (INV-1 fix) + Phases 4/6/7 (addon-expiry.job.ts)',
        file: 'cron/jobs/addon-expiry.job.ts'
    },

    // ── ADDON CANCEL ─────────────────────────────────────────────────────────

    {
        description: 'addon cancel service (addon-lifecycle-cancellation.service.ts)',
        file: 'services/addon-lifecycle-cancellation.service.ts'
    },
    {
        description: 'addon cancel route (routes/billing/addons.ts)',
        file: 'routes/billing/addons.ts'
    },

    // ── TRIAL START / EXPIRE ──────────────────────────────────────────────────

    {
        description: 'trial start/expire/activation (trial.service.ts)',
        file: 'services/trial.service.ts'
    },

    // ── REFUND ────────────────────────────────────────────────────────────────

    {
        description: 'full refund lifecycle downgrade + cancel (refund-lifecycle.service.ts)',
        file: 'services/refund-lifecycle.service.ts'
    },

    // ── DUNNING CANCEL ────────────────────────────────────────────────────────

    {
        description: 'dunning cancel event (dunning.job.ts)',
        file: 'cron/jobs/dunning.job.ts'
    },

    // ── ADMIN GRANT / REVOKE ──────────────────────────────────────────────────

    {
        description: 'admin grant/revoke entitlements (customer-entitlements.ts)',
        file: 'routes/billing/admin/customer-entitlements.ts'
    },

    // ── ADDON ENTITLEMENT REMOVE ──────────────────────────────────────────────
    // (applyAddonEntitlements already covered above via addon-entitlement.service.ts)
    // removeAddonEntitlements is in the same file — already covered.

    // ── ADDON LIFECYCLE (purchase + plan-change) ──────────────────────────────

    {
        description:
            'addon lifecycle service (purchase confirm, refund, cancel) (addon-lifecycle.service.ts)',
        file: 'services/addon-lifecycle.service.ts'
    },
    {
        description: 'addon plan-change propagation (addon-plan-change.service.ts)',
        file: 'services/addon-plan-change.service.ts'
    }
] as const;

// ---------------------------------------------------------------------------
// Guard suite
// ---------------------------------------------------------------------------

describe('INV-1 transversal guard: every lifecycle handler calls clearEntitlementCache', () => {
    /**
     * Table-driven: one test case per lifecycle event.
     *
     * Each test reads the handler source file and asserts "clearEntitlementCache"
     * appears in it. A missing call (e.g. after a refactor) fails this specific
     * test case, making the gap immediately visible.
     *
     * NOTE: this checks the file contains the string, not that the call is on the
     * correct path. Per-handler unit tests already guard the runtime behavior.
     * This guard catches "someone deleted the line entirely" regressions.
     */
    it.each(LIFECYCLE_SITES.map((s) => [s.description, s.file] as const))(
        'clearEntitlementCache present in handler: %s',
        (_description: string, file: string) => {
            const source = readSrc(file);
            expect(
                source,
                `clearEntitlementCache call is MISSING from ${file}.\nEvery lifecycle handler that mutates billing state MUST call clearEntitlementCache(customerId) so the in-process cache reflects the new state immediately (INV-1, SPEC-145 T-021).\nIf this file was intentionally split/refactored, update the LIFECYCLE_SITES table in test/services/inv1-cache-invalidation.guard.test.ts.`
            ).toContain('clearEntitlementCache');
        }
    );

    it('LIFECYCLE_SITES table is non-empty (guard against accidental wipe)', () => {
        expect(LIFECYCLE_SITES.length).toBeGreaterThan(10);
    });

    it('all entries in LIFECYCLE_SITES reference files that exist and are readable', () => {
        for (const site of LIFECYCLE_SITES) {
            expect(
                () => readSrc(site.file),
                `File referenced in LIFECYCLE_SITES does not exist or is unreadable: ${site.file}`
            ).not.toThrow();
        }
    });
});
