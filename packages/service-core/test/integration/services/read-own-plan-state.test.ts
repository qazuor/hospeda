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
