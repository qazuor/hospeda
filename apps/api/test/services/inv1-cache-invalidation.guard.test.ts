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

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
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
 * Matches an actual `clearEntitlementCache(...)` INVOCATION, not a mention.
 *
 * The guard used to assert `source.toContain('clearEntitlementCache')`, which the
 * `import { clearEntitlementCache } from ...` line satisfies on its own. That was
 * verified by mutation: deleting the call while leaving the import in place kept
 * the whole suite green — the guard could not fail for the very defect it exists
 * to catch. Requiring the open paren separates a call from an import, since the
 * named-import form never has one directly after the identifier.
 *
 * Still source-level, so it does not prove the call sits on the right code path;
 * that remains the job of each file's own unit tests.
 */
const CLEAR_ENTITLEMENT_CACHE_CALL = /clearEntitlementCache\s*\(/;

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
     * ## Limitation: string-contains, not runtime-path verification
     *
     * This guard asserts the STRING "clearEntitlementCache" is present in the
     * source file. It passes as long as the string appears anywhere — including
     * inside a comment or in an unreachable branch. It does NOT verify that the
     * call executes on the correct code path (e.g. inside an if-branch that is
     * always skipped). This is a known and accepted trade-off:
     *
     *   - Per-handler unit/integration tests already assert the runtime behavior
     *     (cache is cleared on the happy path). Those tests are the complementary
     *     guard for path-correctness.
     *   - This guard's only job is to catch "someone deleted the line entirely"
     *     regressions — which it does reliably and with zero runtime deps.
     *
     * If a file is refactored and the call moves to a helper/delegate, update
     * the LIFECYCLE_SITES entry to point at the file where the call now lives.
     */
    it.each(
        LIFECYCLE_SITES.map((s) => [s.description, s.file] as const)
    )('clearEntitlementCache present in handler: %s', (_description: string, file: string) => {
        const source = readSrc(file);
        expect(
            source,
            `clearEntitlementCache call is MISSING from ${file}.\nEvery lifecycle handler that mutates billing state MUST call clearEntitlementCache(customerId) so the in-process cache reflects the new state immediately (INV-1, SPEC-145 T-021).\nIf this file was intentionally split/refactored, update the LIFECYCLE_SITES table in test/services/inv1-cache-invalidation.guard.test.ts.`
        ).toMatch(CLEAR_ENTITLEMENT_CACHE_CALL);
    });

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

// ---------------------------------------------------------------------------
// HOS-453 / H-91 — auto-discovery guard
// ---------------------------------------------------------------------------
//
// H-91 (SPEC-262 / HOS-453) found that `subscription-comp-create.service.ts`
// writes a new row to `billing_subscriptions` (a comp grant) but never called
// `clearEntitlementCache`, and the guard above — driven entirely by the
// hand-maintained `LIFECYCLE_SITES` table — never caught it, because nobody
// added an entry for it. A guard that only checks what someone remembered to
// list is not a guard against forgetting to list something.
//
// The block below closes that hole: instead of trusting a curated list, it
// WALKS the source tree and finds every file that actually writes to
// `billing_subscriptions` (`.insert(billingSubscriptions)` /
// `.update(billingSubscriptions)`), then requires each one to have an entry
// in `BILLING_SUBSCRIPTIONS_WRITERS` below. A new writer that nobody
// reviewed and registered — exactly what happened with the comp service —
// now fails CI on its own, without depending on anyone remembering to touch
// this file.
//
// Each registry entry also records whether that writer legitimately needs to
// call `clearEntitlementCache` (`requiresCacheClear`) and WHY. A `true` entry
// is enforced the same way as the LIFECYCLE_SITES scan above (source must
// contain the string). A `false` entry still forces a human-reviewed,
// non-empty justification — it can never be used to silently wave a writer
// through.

/** Absolute path to the API source root (test/.. -> ../src). */
const SRC_WALK_ROOT = resolve(__dirname, '../../src');

/** Matches a direct Drizzle insert/update call targeting `billingSubscriptions`. */
const BILLING_SUBSCRIPTIONS_WRITE_PATTERN = /\.(?:insert|update)\(billingSubscriptions\)/;

/**
 * Recursively lists every non-test, non-declaration `.ts` file under `dir`.
 *
 * Kept dependency-free (no glob package) — Node's own `readdirSync` is enough
 * for a bounded, synchronous walk of `apps/api/src`.
 */
function listSourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listSourceFiles(full));
            continue;
        }
        if (
            entry.isFile() &&
            extname(entry.name) === '.ts' &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.d.ts')
        ) {
            out.push(full);
        }
    }
    return out;
}

/**
 * Scans `apps/api/src` for every file that directly writes to the
 * `billing_subscriptions` table, returning paths relative to `SRC_WALK_ROOT`
 * (forward-slash, matching the `file` field used elsewhere in this module).
 */
function discoverBillingSubscriptionsWriters(): string[] {
    const writers: string[] = [];
    for (const absPath of listSourceFiles(SRC_WALK_ROOT)) {
        const source = readFileSync(absPath, 'utf-8');
        if (BILLING_SUBSCRIPTIONS_WRITE_PATTERN.test(source)) {
            writers.push(relative(SRC_WALK_ROOT, absPath).split('\\').join('/'));
        }
    }
    return writers.sort();
}

/**
 * A file that directly writes to `billing_subscriptions`, and the reviewed
 * verdict on whether that write requires `clearEntitlementCache`.
 */
interface BillingSubscriptionsWriterEntry {
    /** Path relative to `apps/api/src`. */
    readonly file: string;
    /** Whether this write path must call `clearEntitlementCache`. */
    readonly requiresCacheClear: boolean;
    /**
     * Why. For `requiresCacheClear: true`, what lifecycle event this is. For
     * `false`, why this particular write does not change accommodation
     * entitlements (e.g. the row is not active/entitled yet, the mutated
     * field is not entitlement-bearing, or the subscription is outside the
     * `accommodation` product domain that `loadEntitlements` reads).
     */
    readonly reason: string;
}

const BILLING_SUBSCRIPTIONS_WRITERS: readonly BillingSubscriptionsWriterEntry[] = [
    {
        file: 'cron/jobs/abandoned-pending-subs.job.ts',
        requiresCacheClear: false,
        reason: 'Marks a PENDING/never-activated subscription as abandoned. The row never granted entitlements, so there is nothing cached to invalidate.'
    },
    {
        file: 'cron/jobs/finalize-cancelled-subs.ts',
        requiresCacheClear: true,
        reason: 'Finalizes a cancellation — already calls clearEntitlementCache (also tracked in LIFECYCLE_SITES).'
    },
    {
        file: 'cron/jobs/preapproval-less-expiry.job.ts',
        requiresCacheClear: true,
        reason: 'Expires an active/trialing subscription that has no MercadoPago preapproval and whose period elapsed (H-21). The row WAS granting entitlements, so the cached set must be dropped or the user keeps the old plan gates until the 5-minute TTL lapses — already calls clearEntitlementCache.'
    },
    {
        file: 'routes/webhooks/mercadopago/payment-logic.ts',
        requiresCacheClear: true,
        reason: 'Activation/upgrade via MP payment webhook — already calls clearEntitlementCache (also tracked in LIFECYCLE_SITES).'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-logic.ts',
        requiresCacheClear: true,
        reason: 'Plan change/cancel via MP subscription webhook — already calls clearEntitlementCache (also tracked in LIFECYCLE_SITES).'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-payment-handler.ts',
        requiresCacheClear: true,
        reason: 'MP payment-handler webhook path — already calls clearEntitlementCache. This is the path that gives a paid checkout its fast (~1 min) entitlement update, per the HOS-453 measurement.'
    },
    {
        file: 'services/addon.user-addons.ts',
        requiresCacheClear: false,
        reason: 'Sets an `addonCancellationIncomplete` audit flag in subscription metadata for reconciliation crons. Not an entitlement-bearing field (plan/status unchanged).'
    },
    {
        file: 'services/billing-customer-sync.ts',
        requiresCacheClear: true,
        reason: "Soft-deletes every subscription of a customer on account deletion. The follow-up audit this entry was originally flagged for came back POSITIVE: qzpay's findByCustomerId filters deleted_at IS NULL, so the cascade does change what loadEntitlements resolves, and account deletion fires no MercadoPago webhook — handleUserDeletion is the only place that can invalidate."
    },
    {
        file: 'services/billing/link-preapproval.service.ts',
        requiresCacheClear: false,
        reason: 'Stamps promo/discount bookkeeping columns and CAS-links a preapproval while the row is still pending (not yet active/entitled). The subscription webhook handler that activates the row (subscription-logic.ts) already calls clearEntitlementCache.'
    },
    {
        file: 'services/billing/pending-provider-subscription-create.ts',
        requiresCacheClear: false,
        reason: "Creates the row in PENDING_PROVIDER status (mirrors the comp-create insert shape) before any MP authorization, and stamps its product_domain ('accommodation' by default, 'commerce'/'partner' for the non-accommodation checkouts that route through it since all four flows moved to Path C). No entitlement is granted until the webhook activates it, and loadEntitlements() filters strictly to product_domain='accommodation' (SPEC-239) anyway."
    },
    {
        file: 'services/plan-disable-lifecycle.service.ts',
        requiresCacheClear: true,
        reason: 'Disables a plan — already calls clearEntitlementCache.'
    },
    {
        file: 'services/promo-discount-apply.service.ts',
        requiresCacheClear: false,
        reason: 'Seeds/corrects `promoEffectRemainingCycles`, a pricing counter — not an entitlement-bearing field (plan/status unchanged).'
    },
    {
        file: 'services/refund-lifecycle.service.ts',
        requiresCacheClear: true,
        reason: 'Full refund downgrade/cancel — already calls clearEntitlementCache (also tracked in LIFECYCLE_SITES).'
    },
    {
        file: 'services/subscription-cancel.service.ts',
        requiresCacheClear: true,
        reason: 'Subscription cancel — already calls clearEntitlementCache.'
    },
    {
        file: 'services/subscription-comp-create.service.ts',
        requiresCacheClear: true,
        reason: 'HOS-453 / H-91 fix: a comp grant has no MercadoPago preapproval and therefore no webhook, so this is the ONLY place that can clear the cache for a comp subscription. Fixed by this change.'
    },
    {
        file: 'services/subscription-uncancel.service.ts',
        requiresCacheClear: true,
        reason: 'Subscription un-cancel — already calls clearEntitlementCache.'
    },
    {
        file: 'services/trial.service.ts',
        requiresCacheClear: true,
        reason: 'Trial start/expire/activation — already calls clearEntitlementCache (also tracked in LIFECYCLE_SITES).'
    }
] as const;

/**
 * Below this count, treat the auto-discovery scan itself as broken (e.g. a
 * changed import style the regex no longer matches, or a wrong root path)
 * rather than as "the codebase shrank" — a scan that silently returns an
 * empty or truncated list must FAIL, not be read as a pass. The real count
 * at the time this guard was written is 17; this floor leaves headroom for
 * refactors while still catching a scan that stops finding anything.
 */
const MIN_EXPECTED_WRITERS = 12;

describe('HOS-453 auto-discovery guard: every billing_subscriptions writer is reviewed', () => {
    const discovered = discoverBillingSubscriptionsWriters();
    const registryByFile = new Map(BILLING_SUBSCRIPTIONS_WRITERS.map((e) => [e.file, e]));

    it('the scan itself is not broken (fail-closed against a silent empty/truncated result)', () => {
        expect(
            discovered.length,
            `discoverBillingSubscriptionsWriters() found only ${discovered.length} writer(s) ` +
                `(expected at least ${MIN_EXPECTED_WRITERS}). Either the codebase genuinely lost ` +
                'writers (update MIN_EXPECTED_WRITERS down deliberately) or the scan regex/root ' +
                'path is broken — an unexpectedly small result must FAIL this guard, never pass ' +
                'silently as "nothing to check".'
        ).toBeGreaterThanOrEqual(MIN_EXPECTED_WRITERS);
    });

    it.each(
        discovered
    )('discovered billing_subscriptions writer is inventoried: %s', (file: string) => {
        expect(
            registryByFile.has(file),
            `A file that writes to billing_subscriptions was found and is NOT inventoried: ${file}.\n` +
                'This is exactly the H-91/HOS-453 failure mode: a new (or newly-discovered) writer ' +
                'went live without anyone deciding whether it needs clearEntitlementCache. Add an ' +
                'entry to BILLING_SUBSCRIPTIONS_WRITERS in this file — requiresCacheClear:true if it ' +
                'changes plan/status for an accommodation-domain subscription, false (with a concrete ' +
                'reason) if it genuinely does not.'
        ).toBe(true);
    });

    it.each(
        BILLING_SUBSCRIPTIONS_WRITERS.filter((e) => e.requiresCacheClear)
    )('inventoried writer requiring cache clear actually calls clearEntitlementCache: %o', (entry: BillingSubscriptionsWriterEntry) => {
        const source = readSrc(entry.file);
        expect(
            source,
            `${entry.file} is registered as requiresCacheClear:true (${entry.reason}) but its ` +
                'source contains no clearEntitlementCache(...) INVOCATION — the call was removed. ' +
                'A leftover import alone does not satisfy this guard.'
        ).toMatch(CLEAR_ENTITLEMENT_CACHE_CALL);
    });

    it('every registry entry has a non-empty, specific reason', () => {
        for (const entry of BILLING_SUBSCRIPTIONS_WRITERS) {
            expect(
                entry.reason.trim().length,
                `BILLING_SUBSCRIPTIONS_WRITERS entry for ${entry.file} has no reason — every entry ` +
                    'must document WHY it does or does not need clearEntitlementCache.'
            ).toBeGreaterThan(10);
        }
    });

    it('every registry entry still corresponds to a discovered writer (no stale entries)', () => {
        const discoveredSet = new Set(discovered);
        for (const entry of BILLING_SUBSCRIPTIONS_WRITERS) {
            expect(
                discoveredSet.has(entry.file),
                `BILLING_SUBSCRIPTIONS_WRITERS has an entry for ${entry.file}, but the file no longer ` +
                    'writes to billing_subscriptions (or was removed/renamed). Remove or update the entry.'
            ).toBe(true);
        }
    });
});
