/**
 * HOS-847 PR 6 — static guard: an add-on purchase must not go terminal while
 * its MercadoPago preapproval may still be charging.
 *
 * ## The regression this exists to stop
 *
 * `terminal-status-provider-cancel.guard.test.ts` guards the same invariant one
 * table over, on `billing_subscriptions`, after HOS-751: a row written
 * `cancelled` while its preapproval stayed authorized, charging the customer
 * again with no local row that explained it.
 *
 * A recurring add-on reproduces that shape exactly, and worse. Its preapproval
 * lives in `billing_addon_purchases.mp_subscription_id` and is reachable from
 * nothing else — in particular NOT through `subscription_id`, which holds the
 * customer's PLAN subscription. So no plan-side sweep can see it:
 * `finalize-cancelled-subs` selects `billing_subscriptions`, where the add-on's
 * preapproval simply is not. And every add-on sweep filters on
 * `status = 'active'`, which the terminal status just written excludes. The
 * write shuts the only gate that could have caught it.
 *
 * ## Why a REGISTRY and not just a scan
 *
 * The scan finds every file that writes a literal terminal status onto
 * `billing_addon_purchases`. The registry below forces each one to be
 * human-reviewed: `requiresProviderClose: true` is enforced by requiring the
 * file to reference `closeAddonPreapproval`, and `false` still demands a
 * non-empty reason — it can never be used to wave a writer through silently.
 * The `false` case is real and narrow: mirroring a status MercadoPago just
 * reported, where calling `cancel()` back at an already-terminal preapproval is
 * redundant rather than correct (the same exemption the HOS-753 guard states for
 * subscriptions).
 *
 * A seventh cancellation path added later appears in the scan, is absent from
 * the registry, and fails CI — which is the point. Enumerating by EVENT is what
 * the invariant needs; enumerating the callers of one function is what missed a
 * whole reimplementation earlier in this chain.
 *
 * ## What it deliberately does NOT catch (stated so nobody over-trusts it)
 *
 * - `packages/service-core/.../addon-user-addons.ts::cancelAddonPurchaseRecord`,
 *   a shared DB helper that writes `status: 'canceled'` from OUTSIDE
 *   `apps/api/src` and is therefore never scanned. Its only two callers —
 *   `cancelUserAddon` and `revokeAllAddonsForCustomer` — both live in
 *   `services/addon.user-addons.ts`, which IS registered here, and both close
 *   the provider before calling it. A third caller elsewhere would escape.
 * - A write whose status comes from a variable, or split across two files.
 * - It proves the reference EXISTS in the file, never that the call sits on the
 *   same branch as the write. The per-path unit tests do that.
 *
 * @module test/services/addon-terminal-status-provider-cancel.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC_ROOT = resolve(__dirname, '../../src');

/** The single gate every add-on cancellation path must go through. */
const CANONICAL_HELPER = 'closeAddonPreapproval';

/** A Drizzle UPDATE targeting the add-on purchases table. */
const UPDATES_ADDON_PURCHASES = 'update(billingAddonPurchases)';

/**
 * A LITERAL assignment of a terminal add-on purchase status.
 *
 * All three are terminal for this invariant's purposes: whichever one is
 * written, the row leaves `status = 'active'` and with it every sweep that could
 * still have closed the preapproval.
 *
 * Anchored on `status:` at the start of an indented line so fields that merely
 * RECORD a transition (`newStatus:`, `previousStatus:`) do not match — only the
 * field that writes the column does.
 */
const LITERAL_TERMINAL_WRITE = /^\s+status: '(?:canceled|expired|refunded)'/m;

/**
 * A file that writes a literal terminal status onto `billing_addon_purchases`,
 * and the reviewed verdict on whether that write must first close the add-on's
 * MercadoPago preapproval.
 */
interface AddonTerminalWriterEntry {
    /** Path relative to `apps/api/src`. */
    readonly file: string;
    /** The cancellation EVENT this write belongs to. */
    readonly event: string;
    /** Whether this path must call {@link CANONICAL_HELPER} before the write. */
    readonly requiresProviderClose: boolean;
    /** Why. Never empty — a `false` verdict has to argue for itself. */
    readonly reason: string;
}

const ADDON_TERMINAL_WRITERS: readonly AddonTerminalWriterEntry[] = [
    {
        file: 'services/addon.user-addons.ts',
        event: 'the owner cancels one ONE-TIME add-on (POST /protected/billing/addons/{id}/cancel), and the account-level bulk revoke',
        requiresProviderClose: true,
        reason: "Both paths in this file write a terminal row, and both close first. The user cancel returns 503 without touching anything on refusal; the bulk revoke closes before opening its SELECT ... FOR UPDATE (ADR-019: no third-party latency under a row lock) and skips any locked row whose preapproval it did not close. The RECURRING user cancel no longer reaches a terminal write at all — it closes the preapproval and then soft-cancels through addon-soft-cancel.ts, and the expiry cron writes 'expired' when the paid period ends."
    },
    {
        file: 'services/addon-lifecycle-cancellation.service.ts',
        event: "the customer's PLAN subscription is cancelled — MP webhook and the finalize-cancelled-subs cron both enter here",
        requiresProviderClose: true,
        reason: 'A refused close throws into the same catch as a failed revocation, so the row stays active, joins `failed`, and the function rethrows → HTTP 500 → MercadoPago redelivers. The close also runs on the HOSPEDA_ADDON_LIFECYCLE_ENABLED-off path: that flag gates the entitlement half, never the provider half.'
    },
    {
        file: 'routes/billing/admin/qzpay-admin-hooks.ts',
        event: 'an admin cancels the subscription from the admin panel',
        requiresProviderClose: true,
        reason: 'The literal write is in the AFTER hook, which can no longer refuse anything; the close therefore lives in the BEFORE hook, the last point where a failure still aborts the whole cancel with a 422. Both hooks are in this file, so the reference is present either way — the placement is asserted by the hook unit tests, not here.'
    },
    {
        file: 'services/addon-expiration.service.ts',
        event: 'the purchase reaches expires_at, or a soft-cancelled recurring one reaches current_period_end, and is expired',
        requiresProviderClose: true,
        reason: '`expired` is as terminal as `canceled`, and a recurring add-on whose period lapsed without a charge is precisely when MercadoPago may charge next. A refusal returns SERVICE_UNAVAILABLE and leaves the row active for the next cron tick. One documented exception inside the file: a soft-cancelled row (cancel_at_period_end) already had its preapproval hard-cancelled under a fail-closed guarantee at cancellation time, and re-issuing the cancel could be swallowed into `failed`, stranding the row active forever.'
    },
    {
        file: 'cron/jobs/addon-expiry.job.ts',
        event: "the expiry cron's orphan sweep finds an active add-on under a cancelled subscription",
        requiresProviderClose: true,
        reason: 'This sweep selects on status = active, so its own write removes the row from the only query that would revisit it. A refused close skips the row and leaves it active instead.'
    },
    {
        file: 'services/addon-recurring-revoke.service.ts',
        event: 'MercadoPago reports the preapproval canceled/finished and we mirror it locally',
        requiresProviderClose: false,
        reason: 'The ONLY inbound path. The preapproval is already terminal at MercadoPago — this write mirrors a status just read from the provider, and issuing cancel() back at it would be redundant, not correct (the same exemption the HOS-753 subscription guard states). What this path owes instead is the QZPay revocation, which it performs BEFORE the write, because loadEntitlements reads QZPay tables and not this one.'
    }
];

/**
 * Recursively collects production `.ts` files under a directory.
 *
 * @param dir - Absolute directory to walk.
 * @returns Absolute paths of every non-test, non-declaration `.ts` file found.
 */
function collectSourceFiles(dir: string): readonly string[] {
    const found: string[] = [];

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);

        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full));
            continue;
        }

        if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.includes('.test.')) {
            continue;
        }

        found.push(full);
    }

    return found;
}

describe('HOS-847 guard — a terminal add-on purchase must not outlive an open preapproval', () => {
    const sourceFiles = collectSourceFiles(API_SRC_ROOT);

    /** Files that write a literal terminal status onto `billing_addon_purchases`. */
    const discovered = sourceFiles
        .filter((file) => {
            const source = readFileSync(file, 'utf8');
            return source.includes(UPDATES_ADDON_PURCHASES) && LITERAL_TERMINAL_WRITE.test(source);
        })
        .map((file) => relative(API_SRC_ROOT, file).split('\\').join('/'))
        .sort();

    it('scans a non-empty set of files (anti-vacuity)', () => {
        // Without this, renaming `billingAddonPurchases` or reformatting the
        // status assignment would leave the guard scanning ZERO files and
        // reporting green — the most believable false negative there is.
        expect(sourceFiles.length).toBeGreaterThan(100);
        expect(discovered.length).toBeGreaterThanOrEqual(5);
    });

    it('every discovered terminal writer is registered with a reviewed verdict', () => {
        const registered = new Set(ADDON_TERMINAL_WRITERS.map((entry) => entry.file));
        const unregistered = discovered.filter((file) => !registered.has(file));

        expect(
            unregistered,
            'These files write a LITERAL terminal status onto billing_addon_purchases but are not registered in ADDON_TERMINAL_WRITERS. ' +
                "A recurring add-on's MercadoPago preapproval is reachable ONLY from that row's mp_subscription_id: no plan-side sweep can see it, and every add-on sweep filters on status = 'active', which the status you just wrote excludes. So the write both creates the forbidden state and shuts the gate that would have caught it (HOS-751, one table over). " +
                'Add an entry saying which cancellation EVENT this is and whether it must call closeAddonPreapproval first — and if the verdict is false, say why the provider side is already closed.'
        ).toEqual([]);
    });

    it('every registered writer still exists and still writes a terminal status', () => {
        // Stops the registry from rotting into a list of files that were renamed
        // or that no longer write anything — a stale entry is a claim nobody
        // checks.
        const stale = ADDON_TERMINAL_WRITERS.map((entry) => entry.file).filter(
            (file) => !discovered.includes(file)
        );

        expect(
            stale,
            'These files are registered in ADDON_TERMINAL_WRITERS but no longer write a literal terminal status onto billing_addon_purchases. Remove the entry, or fix the path if the file moved.'
        ).toEqual([]);
    });

    it('every writer that requires a provider close references the canonical helper', () => {
        const offenders = ADDON_TERMINAL_WRITERS.filter(
            (entry) =>
                entry.requiresProviderClose &&
                !readFileSync(resolve(API_SRC_ROOT, entry.file), 'utf8').includes(CANONICAL_HELPER)
        ).map((entry) => entry.file);

        expect(
            offenders,
            `These files write a terminal add-on status but never reference ${CANONICAL_HELPER}. ` +
                'Call it from apps/api/src/services/addon-preapproval-cancel.ts BEFORE the write, and treat closed:false as a refusal to proceed — leaving the row active is recoverable, a terminal row over a live preapproval is not.'
        ).toEqual([]);
    });

    it('every registry entry carries a real, human-written reason', () => {
        for (const entry of ADDON_TERMINAL_WRITERS) {
            expect(entry.reason.trim().length, `Empty reason for ${entry.file}`).toBeGreaterThan(
                60
            );
            expect(entry.event.trim().length, `Empty event for ${entry.file}`).toBeGreaterThan(10);
        }
    });

    it('the exemption stays exceptional', () => {
        // A `false` verdict is the one way a writer can skip the close. If that
        // set ever grows past the single inbound mirror, the exemption has
        // become the rule and this guard is no longer guarding anything.
        const exempt = ADDON_TERMINAL_WRITERS.filter((entry) => !entry.requiresProviderClose);

        expect(exempt.map((entry) => entry.file)).toEqual([
            'services/addon-recurring-revoke.service.ts'
        ]);
    });
});
