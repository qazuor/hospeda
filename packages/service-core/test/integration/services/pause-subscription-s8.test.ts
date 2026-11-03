import {
    and,
    coverageLosses,
    eq,
    isNull,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
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
        throw new Error('No addon expected');
    },
    listing: async () => {
        throw new Error('No listing expected');
    }
};
const db = () => getServiceTestDb();
afterEach(async () => {
    await retireComplementRows();
    await retirePauseRows();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:1 S8 and its failure branch', () => {
    it('pauses a monthly principal, its vertical complement, and records coverage loss', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const seeded = await seedCommittedComplement({
            fake: harness.fake,
            principalStatus: 'ACTIVE',
            principal: { userId: principal.userId, principalId: principal.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });

        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            {
                provider: harness.provider,
                clock,
                planPolicy: pausePlanPolicy(),
                complements: seeded.policy,
                coverageNotices: { emitCoverageChanged: async () => {} }
            }
        );

        expect(result.outcome).toBe('PAUSED');
        if (result.outcome !== 'PAUSED') throw new Error('S8 did not pause');
        expect(result.complements.results).toMatchObject([{ outcome: 'PAUSED' }]);
        const rows = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, principal.subscriptionId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.status).toBe('PAUSED');
        const pauses = await db()
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId));
        expect(pauses).toHaveLength(1);
        expect(pauses[0]).toMatchObject({
            reason: 'CUSTOMER_REQUEST',
            requestedMonths: 2,
            startsAt: complementNow,
            expectedEndAt: new Date('2026-12-14T12:00:00.000Z')
        });
        const complement = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.complementId));
        expect(complement[0]?.status).toBe('PAUSED');
        const complementPauses = await db()
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, seeded.complementId));
        expect(complementPauses).toHaveLength(1);
        expect(complementPauses[0]?.expectedEndAt).toEqual(pauses[0]?.expectedEndAt);
        expect(
            (await harness.fake.readAuthorization({ authorizationId: principal.authorizationId }))
                .snapshot.status
        ).toBe('paused');
        const losses = await db()
            .select()
            .from(coverageLosses)
            .where(
                and(
                    eq(coverageLosses.userId, principal.userId),
                    eq(coverageLosses.vertical, 'accommodation')
                )
            );
        expect(losses).toHaveLength(1);
        expect(losses[0]?.lostAt).toEqual(complementNow);
    });

    it('refuses an annual plan before touching its authorization', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness, cycle: 'annual' });
        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            {
                provider: harness.provider,
                clock,
                planPolicy: pausePlanPolicy(),
                complements: emptyComplements
            }
        );
        expect(result).toEqual({ outcome: 'REFUSED', reason: 'NOT_MONTHLY' });
        expect(
            (
                await db()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, principal.subscriptionId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(
            await db()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId))
        ).toHaveLength(0);
        expect(
            (await harness.fake.readAuthorization({ authorizationId: principal.authorizationId }))
                .snapshot.status
        ).toBe('active');
    });

    it('reads allowsPause from the contract with the anchored version ID', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const planPolicy = vi.fn(pausePlanPolicy(false));
        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            { provider: harness.provider, clock, planPolicy, complements: emptyComplements }
        );
        expect(result).toEqual({ outcome: 'REFUSED', reason: 'PLAN_DISALLOWS_PAUSE' });
        expect(planPolicy).toHaveBeenCalledWith({ planVersionId: principal.planVersionId });
    });

    it('refuses a fourth pause in the moving window and accepts one after the oldest expires', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        for (const day of [1, 2, 3])
            await seedClosedPause({
                subscriptionId: principal.subscriptionId,
                startsAt: new Date(`2026-09-0${day}T12:00:00.000Z`),
                actualEndAt: new Date(`2026-09-1${day}T12:00:00.000Z`)
            });
        const ports = {
            provider: harness.provider,
            clock,
            planPolicy: pausePlanPolicy(),
            complements: emptyComplements,
            coverageNotices: { emitCoverageChanged: async () => {} }
        };
        expect(
            await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 1 },
                ports
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'PAUSE_COUNT_EXHAUSTED' });
        const [oldest] = await db()
            .select({ id: subscriptionPauses.id })
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, principal.subscriptionId),
                    eq(subscriptionPauses.startsAt, new Date('2026-09-01T12:00:00.000Z'))
                )
            );
        if (!oldest) throw new Error('Oldest pause missing');
        await db()
            .update(subscriptionPauses)
            .set({
                startsAt: new Date('2025-09-01T12:00:00.000Z'),
                actualEndAt: new Date('2025-09-11T12:00:00.000Z')
            })
            .where(eq(subscriptionPauses.id, oldest.id));
        expect(
            (
                await pauseSubscription(
                    { subscriptionId: principal.subscriptionId, requestedMonths: 1 },
                    ports
                )
            ).outcome
        ).toBe('PAUSED');
    });

    it('enforces whole months and the accumulated month limit', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness });
        const ports = {
            provider: harness.provider,
            clock,
            planPolicy: pausePlanPolicy(),
            complements: emptyComplements,
            coverageNotices: { emitCoverageChanged: async () => {} }
        };
        expect(
            await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 5 },
                ports
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'MONTHS_OUT_OF_RANGE' });
        for (const start of ['2026-02-01', '2026-06-01'])
            await seedClosedPause({
                subscriptionId: principal.subscriptionId,
                startsAt: new Date(`${start}T12:00:00.000Z`),
                actualEndAt: new Date(
                    start === '2026-02-01' ? '2026-05-01T12:00:00.000Z' : '2026-09-01T12:00:00.000Z'
                )
            });
        expect(
            await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 3 },
                ports
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'MONTHS_EXHAUSTED' });
        expect(
            (
                await pauseSubscription(
                    { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
                    ports
                )
            ).outcome
        ).toBe('PAUSED');
    });

    it('keeps ACTIVE and opens mark 22 when the reread remains authorized', async () => {
        const harness = providerHarness({ pauseAcknowledgesOnly: true });
        const principal = await seedPausePrincipal({ harness });
        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            {
                provider: harness.provider,
                clock,
                planPolicy: pausePlanPolicy(),
                complements: emptyComplements
            }
        );
        expect(result).toEqual({ outcome: 'NOT_APPLIED' });
        expect(
            (
                await db()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, principal.subscriptionId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(
            await db()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId))
        ).toHaveLength(0);
        const marks = await db()
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, principal.subscriptionId),
                    eq(reconciliationMarks.reason, 'PAUSA_NO_APLICADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(marks).toHaveLength(1);
    });

    it('keeps usage across cancellation and resubscription of the same user and vertical', async () => {
        const harness = providerHarness();
        const previous = await seedPausePrincipal({ harness, status: 'CANCELLED' });
        const current = await seedPausePrincipal({ harness, userId: previous.userId });
        for (const day of [1, 2])
            await seedClosedPause({
                subscriptionId: previous.subscriptionId,
                startsAt: new Date(`2026-09-0${day}T12:00:00.000Z`),
                actualEndAt: new Date(`2026-09-1${day}T12:00:00.000Z`)
            });
        await seedClosedPause({
            subscriptionId: current.subscriptionId,
            startsAt: new Date('2026-09-03T12:00:00.000Z'),
            actualEndAt: new Date('2026-09-13T12:00:00.000Z')
        });
        expect(
            await pauseSubscription(
                { subscriptionId: current.subscriptionId, requestedMonths: 1 },
                {
                    provider: harness.provider,
                    clock,
                    planPolicy: pausePlanPolicy(),
                    complements: emptyComplements
                }
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'PAUSE_COUNT_EXHAUSTED' });
    });

    it('refuses manual payers without a provider call', async () => {
        const harness = providerHarness();
        const principal = await seedPausePrincipal({ harness, paymentMethod: 'MANUAL' });
        expect(
            await pauseSubscription(
                { subscriptionId: principal.subscriptionId, requestedMonths: 1 },
                {
                    provider: harness.provider,
                    clock,
                    planPolicy: pausePlanPolicy(),
                    complements: emptyComplements
                }
            )
        ).toEqual({ outcome: 'REFUSED', reason: 'MANUAL_PAYER' });
        expect(harness.calls).toHaveLength(0);
    });

    it('marks a lost race without opening a pause', async () => {
        let subscriptionId = '';
        const harness = providerHarness({
            onPause: async () => {
                await db()
                    .update(subscriptions)
                    .set({ status: 'CANCELLED' })
                    .where(eq(subscriptions.id, subscriptionId));
            }
        });
        const principal = await seedPausePrincipal({ harness });
        subscriptionId = principal.subscriptionId;
        const result = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 1 },
            {
                provider: harness.provider,
                clock,
                planPolicy: pausePlanPolicy(),
                complements: emptyComplements
            }
        );
        expect(result).toEqual({ outcome: 'LOST_RACE' });
        expect(
            await db()
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, principal.subscriptionId))
        ).toHaveLength(0);
        const marks = await db()
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, principal.subscriptionId),
                    eq(reconciliationMarks.reason, 'TRANSICION_NO_DECLARADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(marks).toHaveLength(1);
    });
});
