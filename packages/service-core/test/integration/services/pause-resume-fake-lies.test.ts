import { eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { endDuePauses } from '../../../src/services/billing/subscription/end-due-pauses.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    adjustablePauseHarness,
    pausePlanPolicy,
    retirePauseRows,
    seedPausePrincipal
} from './support/pause-fixtures.js';

const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};
const db = () => getServiceTestDb();
const setup = async (options: { honestM12?: boolean; withoutRP10?: boolean } = {}) => {
    const harness = adjustablePauseHarness(options);
    const principal = await seedPausePrincipal({ harness });
    const firstCharge = new Date(harness.clock.now());
    firstCharge.setUTCMonth(firstCharge.getUTCMonth() + 1);
    harness.fake.moveNextCharge({ authorizationId: principal.authorizationId, at: firstCharge });
    const paused = await pauseSubscription(
        { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
        {
            provider: harness.provider,
            clock: harness.clock,
            complements,
            planPolicy: pausePlanPolicy()
        }
    );
    if (paused.outcome !== 'PAUSED') throw new Error('S8 did not pause');
    return { harness, principal, paused, firstCharge };
};
const status = async (subscriptionId: string) => {
    const [row] = await db()
        .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const [pause] = await db()
        .select({ actualEndAt: subscriptionPauses.actualEndAt })
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, subscriptionId));
    return { row, pause };
};
const end = async (input: Awaited<ReturnType<typeof setup>>) => {
    input.harness.clock.set({ at: input.paused.expectedEndAt });
    return endDuePauses(
        { limit: 100 },
        {
            provider: input.harness.provider,
            clock: input.harness.clock,
            complements
        }
    );
};

afterEach(retirePauseRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('AC:B8b:28 and TEST:B8b:27 M12/RP10 defense', () => {
    it('keeps M12 paused until S10 and writes RP10 calendar without a new charge', async () => {
        const input = await setup();
        input.harness.clock.set({ at: input.firstCharge });
        const before = await input.harness.fake.readAuthorization({
            authorizationId: input.principal.authorizationId
        });
        expect(before.snapshot.status).toBe('paused');
        expect((await status(input.principal.subscriptionId)).row?.status).toBe('PAUSED');
        const chargesBefore = await input.harness.fake.listCharges({
            authorizationId: input.principal.authorizationId
        });
        const result = await end(input);
        const after = await input.harness.fake.readAuthorization({
            authorizationId: input.principal.authorizationId
        });
        const chargesAfter = await input.harness.fake.listCharges({
            authorizationId: input.principal.authorizationId
        });
        expect(result.resumed).toBe(1);
        expect(after.snapshot.status).toBe('active');
        expect(
            (await status(input.principal.subscriptionId)).row?.nextChargeAt?.toISOString()
        ).toBe(after.snapshot.nextChargeAt);
        expect(new Date(after.snapshot.nextChargeAt ?? 0).getTime()).toBeGreaterThan(
            input.paused.expectedEndAt.getTime()
        );
        expect(chargesBefore.chargeIds).toHaveLength(0);
        expect(chargesAfter.chargeIds).toHaveLength(0);
    });

    it('applies the honest M12 return at term without sending resume', async () => {
        const input = await setup({ honestM12: true });
        input.harness.clock.set({ at: input.firstCharge });
        expect(
            (
                await input.harness.fake.readAuthorization({
                    authorizationId: input.principal.authorizationId
                })
            ).snapshot.status
        ).toBe('active');
        const result = await end(input);
        expect(result.resumed).toBe(1);
        expect(input.harness.calls).toEqual([
            `pause:${input.principal.authorizationId}`,
            `read:${input.principal.authorizationId}`,
            `read:${input.principal.authorizationId}`
        ]);
        expect((await status(input.principal.subscriptionId)).row?.status).toBe('ACTIVE');
    });

    it('writes the unchanged reread date when RP10 is disabled by name', async () => {
        const input = await setup({ withoutRP10: true });
        const result = await end(input);
        const provider = await input.harness.fake.readAuthorization({
            authorizationId: input.principal.authorizationId
        });
        expect(result.resumed).toBe(1);
        expect(provider.snapshot.nextChargeAt).toBe(input.firstCharge.toISOString());
        expect(
            (await status(input.principal.subscriptionId)).row?.nextChargeAt?.toISOString()
        ).toBe(input.firstCharge.toISOString());
    });
});
