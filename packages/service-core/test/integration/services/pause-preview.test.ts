import { courtesyGrants, eq, getDb, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { previewPause } from '../../../src/services/billing/subscription/pause-preview.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    providerHarness,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import {
    pausePlanPolicy,
    retirePauseRows,
    seedClosedPause,
    seedPausePrincipal
} from './support/pause-fixtures.js';

const clock = { now: () => complementNow };
const emptyComplements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon');
    },
    listing: async () => {
        throw new Error('Unexpected listing');
    }
};
const ports = (allowsPause = true) => ({
    clock,
    planPolicy: pausePlanPolicy(allowsPause),
    complements: emptyComplements
});
afterEach(async () => {
    await retireComplementRows();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:25 read-only pause preview', () => {
    it('offers the same end S8 writes and names vertical and account addons', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const complements = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeTypes: ['VERTICAL_SUBSCRIPTION', 'USER']
        });
        const preview = await previewPause(
            { subscriptionId: principal.subscriptionId, userId: principal.userId },
            { clock, planPolicy: pausePlanPolicy(), complements: complements.policy }
        );
        expect(preview.offered).toBe(true);
        if (!preview.offered) throw new Error('Expected offer');
        expect(preview.months).toEqual({ min: 1, max: 4 });
        expect(preview.quota).toEqual({ pausesLeft: 3, monthsLeft: 8 });
        expect(preview.addons.vertical).toHaveLength(1);
        expect(preview.addons.account).toMatchObject([{ pauses: true }]);
        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            {
                ...ports(),
                complements: complements.policy,
                provider: harness.provider,
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );
        expect(result.outcome).toBe('PAUSED');
        if (result.outcome !== 'PAUSED') throw new Error('Expected S8 pause');
        expect(preview.expectedEndAtByMonths[2]).toBe(result.expectedEndAt.toISOString());
    });

    it('keeps an account addon on another compatible active vertical', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const complements = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeType: 'USER',
            otherStatus: 'ACTIVE'
        });
        const preview = await previewPause(
            { subscriptionId: principal.subscriptionId },
            { clock, planPolicy: pausePlanPolicy(), complements: complements.policy }
        );
        expect(preview.offered).toBe(true);
        if (!preview.offered) throw new Error('Expected offer');
        expect(preview.addons.account).toMatchObject([{ pauses: false }]);
    });

    it('reports NOT_PRINCIPAL for a real recurring complement', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const complement = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
        expect(
            await previewPause(
                { subscriptionId: complement.complementId },
                { clock, planPolicy: pausePlanPolicy(), complements: complement.policy }
            )
        ).toEqual({ offered: false, reason: 'NOT_PRINCIPAL' });
    });

    it.each([
        ['NOT_ACTIVE', { status: 'PAUSED' }],
        ['MANUAL_PAYER', { paymentMethod: 'MANUAL' }],
        ['NOT_MONTHLY', { cycle: 'annual' }]
    ] as const)('reports %s from canPause', async (reason, seed) => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness, ...seed });
        expect(await previewPause({ subscriptionId: principal.subscriptionId }, ports())).toEqual({
            offered: false,
            reason
        });
    });

    it('reports plan policy refusal', async () => {
        const principal = await seedPausePrincipal({ harness: providerHarness() });
        expect(
            await previewPause({ subscriptionId: principal.subscriptionId }, ports(false))
        ).toEqual({ offered: false, reason: 'PLAN_DISALLOWS_PAUSE' });
    });

    it('reports courtesy with its own end date', async () => {
        const principal = await seedPausePrincipal({ harness: providerHarness() });
        const endsAt = new Date('2026-11-19T12:00:00.000Z');
        await getDb().insert(courtesyGrants).values({
            subscriptionId: principal.subscriptionId,
            beneficiaryUserId: principal.userId,
            grantedBy: principal.userId,
            reason: 'Preview fixture',
            startsAt: complementNow,
            endsAt,
            months: 1
        });
        expect(await previewPause({ subscriptionId: principal.subscriptionId }, ports())).toEqual({
            offered: false,
            reason: 'COURTESY_IN_FORCE',
            courtesyEndsAt: endsAt.toISOString()
        });
    });

    it('reports exhausted count and accumulated months', async () => {
        const principal = await seedPausePrincipal({ harness: providerHarness() });
        for (const [start, end, months] of [
            ['2026-02-01', '2026-06-01', 4],
            ['2026-06-01', '2026-10-01', 4],
            ['2026-10-01', '2026-10-02', 1]
        ] as const)
            await seedClosedPause({
                subscriptionId: principal.subscriptionId,
                startsAt: new Date(`${start}T12:00:00.000Z`),
                actualEndAt: new Date(`${end}T12:00:00.000Z`),
                requestedMonths: months
            });
        expect(await previewPause({ subscriptionId: principal.subscriptionId }, ports())).toEqual({
            offered: false,
            reason: 'PAUSE_COUNT_EXHAUSTED'
        });
        const pauses = await getDb()
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId));
        await getDb().delete(subscriptionPauses).where(eq(subscriptionPauses.id, pauses[2]!.id));
        expect(await previewPause({ subscriptionId: principal.subscriptionId }, ports())).toEqual({
            offered: false,
            reason: 'MONTHS_EXHAUSTED'
        });
    });

    it('hides a subscription owned by someone else', async () => {
        const principal = await seedPausePrincipal({ harness: providerHarness() });
        expect(
            await previewPause(
                { subscriptionId: principal.subscriptionId, userId: crypto.randomUUID() },
                ports()
            )
        ).toEqual({ offered: false, reason: 'NOT_PRINCIPAL' });
        const [row] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(row?.status).toBe('ACTIVE');
    });
});
