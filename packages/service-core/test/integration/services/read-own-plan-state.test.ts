/**
 * HOS-2328 — the SQL of the shared own plan-state reader (`readOwnSubscriptions`,
 * behind Mi suscripción and `get_my_plan`): only the owner's PRINCIPAL rows in
 * a live status, oldest first, each with its anchored plan version.
 */

import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    readOwnPlanState,
    readOwnSubscriptions
} from '../../../src/services/billing/subscription/read-own-plan-state.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { providerHarness } from './support/complement-fixtures.js';
import { retirePauseRows, seedPausePrincipal } from './support/pause-fixtures.js';

const DAY_MS = 86_400_000;

afterEach(retirePauseRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('readOwnSubscriptions (HOS-2328)', () => {
    it('reads only the owner live PRINCIPAL rows, oldest first, with the anchored version', async () => {
        // Arrange: a live origin, its live successor, and a cancelled principal
        const harness = providerHarness();
        const origin = await seedPausePrincipal({ harness });
        const successor = await seedPausePrincipal({
            harness,
            userId: origin.userId,
            succeedsId: origin.subscriptionId
        });
        const cancelled = await seedPausePrincipal({
            harness,
            userId: origin.userId,
            status: 'CANCELLED'
        });
        const stranger = await seedPausePrincipal({ harness });
        const now = new Date();

        // Act
        const rows = await readOwnSubscriptions({ userId: origin.userId, now });
        const state = await readOwnPlanState({ userId: origin.userId, now });

        // Assert
        expect(rows.map((row) => row.id)).toEqual([
            origin.subscriptionId,
            successor.subscriptionId
        ]);
        expect(rows.map((row) => row.planVersionId)).toEqual([
            origin.planVersionId,
            successor.planVersionId
        ]);
        expect(rows.every((row) => row.status === 'ACTIVE')).toBe(true);
        expect(rows.map((row) => row.id)).not.toContain(stranger.subscriptionId);
        expect(rows.map((row) => row.id)).not.toContain(cancelled.subscriptionId);
        expect(state.subscriptions.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    });

    it('orders by createdAt, not insertion, and reads PAUSED and GRACE_PERIOD but never PENDING_AUTHORIZATION', async () => {
        // Arrange: a PAUSED origin inserted first, a GRACE_PERIOD successor inserted
        // second but created EARLIER, and another owner whose only row is pending
        const harness = providerHarness();
        const paused = await seedPausePrincipal({ harness, status: 'PAUSED' });
        const grace = await seedPausePrincipal({
            harness,
            userId: paused.userId,
            succeedsId: paused.subscriptionId,
            status: 'GRACE_PERIOD'
        });
        // Fixture seeding: invert creation order against insertion order.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
            .where(eq(subscriptions.id, grace.subscriptionId));
        await getServiceTestDb()
            .update(subscriptions)
            .set({ createdAt: new Date('2026-02-01T00:00:00.000Z') })
            .where(eq(subscriptions.id, paused.subscriptionId));
        const pending = await seedPausePrincipal({ harness, status: 'PENDING_AUTHORIZATION' });
        const now = new Date();

        // Act
        const rows = await readOwnSubscriptions({ userId: paused.userId, now });
        const pendingRows = await readOwnSubscriptions({ userId: pending.userId, now });

        // Assert
        expect(rows.map((row) => [row.id, row.status])).toEqual([
            [grace.subscriptionId, 'GRACE_PERIOD'],
            [paused.subscriptionId, 'PAUSED']
        ]);
        expect(pendingRows).toEqual([]);
    });

    it('HOS-2553: reads a recent CHARGE_DECLINED and PENDING_AUTHORIZATION only when asked', async () => {
        // Arrange: an owner whose only row is a decline from now, and an owner whose
        // only row is an initial checkout waiting for authorization
        const harness = providerHarness();
        const declined = await seedPausePrincipal({ harness, status: 'CHARGE_DECLINED' });
        const waiting = await seedPausePrincipal({ harness, status: 'PENDING_AUTHORIZATION' });
        const now = new Date();

        // Act
        const settledOnly = await readOwnSubscriptions({ userId: declined.userId, now });
        const withUnsettled = await readOwnPlanState({
            userId: declined.userId,
            now,
            includeUnsettled: true
        });
        const waitingRows = await readOwnSubscriptions({
            userId: waiting.userId,
            now,
            includeUnsettled: true
        });

        // Assert
        expect(settledOnly).toEqual([]);
        expect(withUnsettled.subscriptions.map((row) => [row.id, row.status])).toEqual([
            [declined.subscriptionId, 'CHARGE_DECLINED']
        ]);
        expect(waitingRows.map((row) => row.status)).toEqual(['PENDING_AUTHORIZATION']);
    });

    it('HOS-2553: never lists a succession checkout, nor a decline whose vertical has a live checkout', async () => {
        // Arrange: a declined origin with an open succession checkout
        const harness = providerHarness();
        const declined = await seedPausePrincipal({ harness, status: 'CHARGE_DECLINED' });
        const successorCheckout = await seedPausePrincipal({
            harness,
            userId: declined.userId,
            succeedsId: declined.subscriptionId,
            status: 'PENDING_AUTHORIZATION'
        });

        // Act
        const rows = await readOwnSubscriptions({
            userId: declined.userId,
            now: new Date(),
            includeUnsettled: true
        });

        // Assert
        expect(rows.map((row) => row.id)).not.toContain(successorCheckout.subscriptionId);
        expect(rows.map((row) => row.id)).not.toContain(declined.subscriptionId);
    });

    it('HOS-2553: drops an old decline that sits next to an ACTIVE subscription in the same vertical', async () => {
        // Arrange: the first signup was declined, the second one is paying
        const harness = providerHarness();
        const declined = await seedPausePrincipal({ harness, status: 'CHARGE_DECLINED' });
        const active = await seedPausePrincipal({ harness, userId: declined.userId });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ createdAt: new Date(Date.now() - 2 * DAY_MS) })
            .where(eq(subscriptions.id, declined.subscriptionId));

        // Act
        const rows = await readOwnSubscriptions({
            userId: declined.userId,
            now: new Date(),
            includeUnsettled: true
        });

        // Assert
        expect(rows.map((row) => [row.id, row.status])).toEqual([
            [active.subscriptionId, 'ACTIVE']
        ]);
    });

    it('HOS-2553: hides a decline older than seven days even with nothing live', async () => {
        // Arrange
        const harness = providerHarness();
        const declined = await seedPausePrincipal({ harness, status: 'CHARGE_DECLINED' });
        const now = new Date(Date.now() + 8 * DAY_MS);

        // Act
        const rows = await readOwnSubscriptions({
            userId: declined.userId,
            now,
            includeUnsettled: true
        });

        // Assert
        expect(rows).toEqual([]);
    });

    it('leaves out a row that stopped being PRINCIPAL', async () => {
        // Arrange
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        // Fixture seeding: a tombstone keeps the provider link the constraint requires.
        await getServiceTestDb()
            .update(subscriptions)
            .set({ class: 'LAPIDA', status: 'CANCELLED' })
            .where(eq(subscriptions.id, principal.subscriptionId));

        // Act
        const rows = await readOwnSubscriptions({ userId: principal.userId, now: new Date() });

        // Assert
        expect(rows).toEqual([]);
    });
});
