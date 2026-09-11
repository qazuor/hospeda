/**
 * Regression tests for the carry-forward bridge-row write guard (HOS-1287
 * judgment-day finding, verified before this PR merged).
 *
 * ## The bug this pins
 *
 * `writeCarryForwardBridgeRow` upserts `entity_subscriptions` (commerce) /
 * `partner_subscriptions` (partner) on a fixed per-entity/per-partner key,
 * unconditionally re-pointing it at a freshly-minted `pending_provider` retry
 * attempt. The two OTHER writers of the same row —
 * `apps/api/src/routes/commerce/protected/start-subscription.ts` (409, "never
 * silently overwrite a live subscription") and
 * `commerce-reconcile.service.ts` / `partner-reconcile.service.ts` (refuse +
 * log rather than steal) — both read the incumbent before writing. This
 * module did not, so a buyer clicking a stale `cancelled` retry email long
 * after a LATER checkout for the same listing went on to activate could
 * re-point the bridge row away from that live, paying subscription and
 * unpublish the listing while it kept being charged. The 6-hourly reconcile
 * cron does NOT repair this: it re-derives status from the CURRENT
 * `subscription_id`, and after the steal that is genuinely `pending_provider`.
 *
 * `writeCarryForwardBridgeRow` now reads the incumbent inside the SAME
 * transaction and refuses with {@link SubscriptionDomainCarryForwardError}
 * when it is held by a publishing subscription — the same
 * `isPublishingSubscriptionStatus` predicate the two reconcilers already use.
 *
 * @module test/services/billing/subscription-domain-carry-forward
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type SubscriptionDomainCarryForward,
    SubscriptionDomainCarryForwardError,
    writeCarryForwardBridgeRow
} from '../../../src/services/billing/subscription-domain-carry-forward';

const NEW_SUB_ID = 'new-sub-001';
const INCUMBENT_SUB_ID = 'incumbent-sub-002';
const ENTITY_ID = 'entity-001';
const PARTNER_ID = 'partner-001';

const COMMERCE_CARRY_FORWARD: SubscriptionDomainCarryForward = {
    kind: 'commerce',
    productDomain: 'gastronomy',
    vertical: 'gastronomy',
    entityId: ENTITY_ID
};

const PARTNER_CARRY_FORWARD: SubscriptionDomainCarryForward = {
    kind: 'partner',
    productDomain: 'partner',
    partnerId: PARTNER_ID
};

/**
 * Minimal `DrizzleClient`-shaped transaction mock: a `.select().from().where()
 * .limit()` chain resolving to the given incumbent row (or none), and an
 * `.insert().values().onConflictDoUpdate()` chain recording its own calls.
 */
function makeTx(incumbent: { subscriptionId: string; status: string } | null) {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });

    const limit = vi.fn().mockResolvedValue(incumbent ? [incumbent] : []);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const tx = { insert, select };
    return { tx: tx as never, insert, values, onConflictDoUpdate, select, from, where, limit };
}

describe('writeCarryForwardBridgeRow — incumbent guard (HOS-1287 judgment-day)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('REGRESSION (4-step scenario, commerce): refuses to steal the bridge row from a PUBLISHING incumbent', async () => {
        // Mirrors the scenario verbatim: S2 is `active` and public; a stale
        // `cancelled` S1 retry must never re-point the row onto S3.
        const { tx, insert, onConflictDoUpdate } = makeTx({
            subscriptionId: INCUMBENT_SUB_ID,
            status: 'active'
        });

        await expect(
            writeCarryForwardBridgeRow({
                tx,
                localSubscriptionId: NEW_SUB_ID,
                carryForward: COMMERCE_CARRY_FORWARD
            })
        ).rejects.toThrow(SubscriptionDomainCarryForwardError);
        await expect(
            writeCarryForwardBridgeRow({
                tx,
                localSubscriptionId: NEW_SUB_ID,
                carryForward: COMMERCE_CARRY_FORWARD
            })
        ).rejects.toThrow(/held by publishing subscription '.*incumbent-sub-002.*'/);
        expect(insert).not.toHaveBeenCalled();
        expect(onConflictDoUpdate).not.toHaveBeenCalled();
    });

    it('REGRESSION (4-step scenario, partner): refuses to steal the bridge row from a PUBLISHING incumbent', async () => {
        const { tx, insert, onConflictDoUpdate } = makeTx({
            subscriptionId: INCUMBENT_SUB_ID,
            status: 'active'
        });

        await expect(
            writeCarryForwardBridgeRow({
                tx,
                localSubscriptionId: NEW_SUB_ID,
                carryForward: PARTNER_CARRY_FORWARD
            })
        ).rejects.toThrow(/held by publishing subscription '.*incumbent-sub-002.*'/);
        expect(insert).not.toHaveBeenCalled();
        expect(onConflictDoUpdate).not.toHaveBeenCalled();
    });

    it.each([
        'active',
        'trialing',
        'comp',
        'courtesy'
    ])("commerce: refuses for every publishing status ('%s')", async (status) => {
        const { tx, insert } = makeTx({ subscriptionId: INCUMBENT_SUB_ID, status });

        await expect(
            writeCarryForwardBridgeRow({
                tx,
                localSubscriptionId: NEW_SUB_ID,
                carryForward: COMMERCE_CARRY_FORWARD
            })
        ).rejects.toThrow(SubscriptionDomainCarryForwardError);
        expect(insert).not.toHaveBeenCalled();
    });

    it.each([
        'active',
        'trialing',
        'comp',
        'courtesy'
    ])("partner: refuses for every publishing status ('%s')", async (status) => {
        const { tx, insert } = makeTx({ subscriptionId: INCUMBENT_SUB_ID, status });

        await expect(
            writeCarryForwardBridgeRow({
                tx,
                localSubscriptionId: NEW_SUB_ID,
                carryForward: PARTNER_CARRY_FORWARD
            })
        ).rejects.toThrow(SubscriptionDomainCarryForwardError);
        expect(insert).not.toHaveBeenCalled();
    });

    // ── TOO-WIDE-GUARD checks: the fix must not also reject the legitimate
    // retry — a free bridge row, or one held by a DEAD subscription. ────────

    it('TOO-WIDE GUARD: commerce — proceeds when the bridge row is FREE (no incumbent row at all)', async () => {
        const { tx, insert, onConflictDoUpdate, select } = makeTx(null);

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: COMMERCE_CARRY_FORWARD
        });

        expect(select).toHaveBeenCalledTimes(1);
        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('TOO-WIDE GUARD: partner — proceeds when the bridge row is FREE (no incumbent row at all)', async () => {
        const { tx, insert, onConflictDoUpdate } = makeTx(null);

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: PARTNER_CARRY_FORWARD
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it.each([
        'cancelled',
        'expired',
        'abandoned',
        'paused',
        'pending_provider',
        'incomplete'
    ])("TOO-WIDE GUARD: commerce — proceeds and re-points the row when the incumbent is DEAD ('%s')", async (status) => {
        const { tx, insert, onConflictDoUpdate, values } = makeTx({
            subscriptionId: INCUMBENT_SUB_ID,
            status
        });

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: COMMERCE_CARRY_FORWARD
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const written = values.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.subscriptionId).toBe(NEW_SUB_ID);
    });

    it.each([
        'cancelled',
        'expired',
        'abandoned',
        'paused',
        'pending_provider',
        'incomplete'
    ])("TOO-WIDE GUARD: partner — proceeds and re-points the row when the incumbent is DEAD ('%s')", async (status) => {
        const { tx, insert, onConflictDoUpdate, values } = makeTx({
            subscriptionId: INCUMBENT_SUB_ID,
            status
        });

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: PARTNER_CARRY_FORWARD
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const written = values.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(written.subscriptionId).toBe(NEW_SUB_ID);
    });

    it('TOO-WIDE GUARD: commerce — proceeds when the incumbent IS the row being written (idempotent replay)', async () => {
        // A retry that already won the claim and is replaying/re-running its
        // own write must not be blocked by its own prior row.
        const { tx, insert, onConflictDoUpdate } = makeTx({
            subscriptionId: NEW_SUB_ID,
            status: 'active'
        });

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: COMMERCE_CARRY_FORWARD
        });

        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });

    it('reads the incumbent scoped to the SAME entity/partner key the upsert targets, not just any row', async () => {
        // Sanity check on the mock plumbing itself: the select chain is
        // exercised with .from().where().limit() for both verticals, proving
        // the guard's read is scoped rather than an unbounded table scan.
        const { tx, from, where, limit } = makeTx(null);

        await writeCarryForwardBridgeRow({
            tx,
            localSubscriptionId: NEW_SUB_ID,
            carryForward: PARTNER_CARRY_FORWARD
        });

        expect(from).toHaveBeenCalledTimes(1);
        expect(where).toHaveBeenCalledTimes(1);
        expect(limit).toHaveBeenCalledTimes(1);
    });
});
