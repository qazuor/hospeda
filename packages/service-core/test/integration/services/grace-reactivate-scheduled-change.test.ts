import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { graceExpiredOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange,
    spyScheduledChangeApplier
} from './support/scheduled-change-fixtures.js';
import {
    expireSuccessorWindow,
    predecessorInGrace,
    retireSuccessionCases,
    runS3,
    type SeededSuccession,
    seedLiveSuccessor,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof graceWithFailedCycle>>;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const seeded: SeededSuccession[] = [];

/** Queue entries first (they point at the rows), then retentions, marks, outbox and rows. */
afterEach(async () => {
    const cases = seeded.splice(0);
    await deleteScheduledChanges(cases.flatMap((c) => c.subscriptionIds));
    await retireSuccessionCases(cases);
});

function track(fixture: Fixture, ...extra: string[]): void {
    seeded.push({
        subscriptionIds: [fixture.started.subscriptionId, ...extra],
        userId: fixture.user.id
    });
}

/** A coverage listener that records each event it receives. */
function coverageSpy() {
    const seen: CoverageChangedEvent[] = [];
    const coverageNotices: CoverageNotices = {
        async emitCoverageChanged(event) {
            seen.push(event);
        }
    };
    return { coverageNotices, added: () => seen.filter((event) => event.change === 'ADDED') };
}

/**
 * A card principal moved from GRACE_PERIOD to SUSPENDED the way S6 leaves it (clock kept),
 * with its authorization still `active` at the provider (molde: `suspendedByHand` of
 * `grace-reactivate-suspended.test.ts`): S7 returns it to `ACTIVE`.
 */
async function suspendedByHand() {
    const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
    track(fixture);
    const subscriptionId = fixture.started.subscriptionId;
    await getServiceTestDb()
        .update(subscriptions)
        .set({ status: 'SUSPENDED' })
        .where(eq(subscriptions.id, subscriptionId));
    const coverage = coverageSpy();
    const ports = { ...fixture.ports, coverageNotices: coverage.coverageNotices };
    return { fixture, subscriptionId, coverage, ports };
}

/** One day before the case's clock: a date that passed while the row was suspended. */
const overdue = (fixture: Fixture) => new Date(fixture.clock.now().getTime() - DAY_MS);

describe('TEST:B7:16 — S7 calls S38 through its internal interface (AC:B7:28)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — back to ACTIVE with an overdue change: S38 is called once, inside S7, and the queue entry is left as is',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            s.fixture.advanceToAttempt(2);
            const change = await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: overdue(s.fixture)
            });
            const spy = spyScheduledChangeApplier();

            // Act
            const result = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                { ...s.ports, scheduledChangeApplier: spy.applier }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
            });
            expect(spy.seen).toEqual([
                {
                    subscriptionId: s.subscriptionId,
                    statusInTx: 'ACTIVE',
                    statusCommitted: 'SUSPENDED'
                }
            ]);
            expect(await scheduledChangesOf(s.subscriptionId)).toEqual([change]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — back to CANCEL_SCHEDULED (charge in flight at S6) with an overdue change: S38 is called inside S7',
        async () => {
            // Arrange: grace by a failed cycle that the provider approves on attempt 3.
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
            track(fixture);
            const subscriptionId = fixture.started.subscriptionId;
            const inGrace = await subscriptionRow(subscriptionId);
            if (!inGrace.graceEndsAt) throw new Error('Grace clock missing');
            const graceEndsAt = inGrace.graceEndsAt;
            fixture.clock.advance({
                ms: graceEndsAt.getTime() + HOUR_MS - fixture.clock.now().getTime()
            });
            const coverage = coverageSpy();
            const suspension = await suspendForArrears(
                {
                    subscriptionId,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: graceExpiredOccurrenceId({ subscriptionId, graceEndsAt })
                },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices: coverage.coverageNotices
                }
            );
            expect(suspension).toMatchObject({ outcome: 'SUSPENDED', cancelCall: 'SENT' });
            fixture.advanceToAttempt(3);
            await seedScheduledChange({ subscriptionId, effectiveAt: overdue(fixture) });
            const spy = spyScheduledChangeApplier();

            // Act
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    ...fixture.ports,
                    coverageNotices: coverage.coverageNotices,
                    scheduledChangeApplier: spy.applier
                }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
            });
            expect(spy.seen).toEqual([
                { subscriptionId, statusInTx: 'CANCEL_SCHEDULED', statusCommitted: 'SUSPENDED' }
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — a change dated in the future is not handed to S38',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            s.fixture.advanceToAttempt(2);
            await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: new Date(s.fixture.clock.now().getTime() + DAY_MS)
            });
            const spy = spyScheduledChangeApplier();

            // Act
            const result = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                { ...s.ports, scheduledChangeApplier: spy.applier }
            );

            // Assert
            expect(result).toMatchObject({ reactivation: { outcome: 'REACTIVATED' } });
            expect(spy.seen).toEqual([]);
            expect(spy.applier.applyScheduledChange).not.toHaveBeenCalled();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — without a scheduled change, the default applier is never reached',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            s.fixture.advanceToAttempt(2);

            // Act
            const result = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
            });
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('ACTIVE');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — edge: a change effective exactly at the act instant is handed to S38',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            s.fixture.advanceToAttempt(2);
            await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: s.fixture.clock.now()
            });
            const spy = spyScheduledChangeApplier();

            // Act
            const result = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                { ...s.ports, scheduledChangeApplier: spy.applier }
            );

            // Assert
            expect(result).toMatchObject({ reactivation: { outcome: 'REACTIVATED' } });
            expect(spy.seen).toEqual([
                {
                    subscriptionId: s.subscriptionId,
                    statusInTx: 'ACTIVE',
                    statusCommitted: 'SUSPENDED'
                }
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — an overdue change with S38 unregistered fails S7 closed: still SUSPENDED with its grace clock, no ADDED',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            const before = await subscriptionRow(s.subscriptionId);
            s.fixture.advanceToAttempt(2);
            await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: overdue(s.fixture)
            });

            // Act
            const act = recordChargeFact({ chargeId: s.fixture.chargeId }, s.ports);

            // Assert
            await expect(act).rejects.toMatchObject({
                reason: 'SCHEDULED_CHANGE_APPLIER_NOT_REGISTERED'
            });
            const row = await subscriptionRow(s.subscriptionId);
            expect(row.status).toBe('SUSPENDED');
            expect(row.graceStartedAt).toEqual(before.graceStartedAt);
            expect(row.graceEndsAt).toEqual(before.graceEndsAt);
            expect(s.coverage.added()).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'g — S7 does not write (predecessor of a live succession, retained for S19): S38 is not called',
        async () => {
            // Arrange
            const s = await suspendedByHand();
            const successor = await seedLiveSuccessor(s.fixture, s.subscriptionId);
            seeded.push({ subscriptionIds: [successor.id], userId: s.fixture.user.id });
            s.fixture.advanceToAttempt(2);
            await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: overdue(s.fixture)
            });
            const spy = spyScheduledChangeApplier();

            // Act
            const result = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                { ...s.ports, scheduledChangeApplier: spy.applier }
            );

            // Assert
            expect(result).toMatchObject({
                reactivation: { outcome: 'RETAINED_FOR_S19', subscriptionId: s.subscriptionId }
            });
            expect(spy.applier.applyScheduledChange).not.toHaveBeenCalled();
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('SUSPENDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'h — by S3 (branch 2): S7 brings the retained predecessor back and calls S38 inside its act',
        async () => {
            // Arrange: a predecessor suspended by hand (clock kept) whose late quota S19 retains.
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, s.subscriptionId));
            s.fixture.advanceToAttempt(2);
            const retained = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                s.chargePorts
            );
            expect(retained).toMatchObject({ reactivation: { outcome: 'RETAINED_FOR_S19' } });
            await seedScheduledChange({
                subscriptionId: s.subscriptionId,
                effectiveAt: overdue(s.fixture)
            });
            await expireSuccessorWindow(s);
            const spy = spyScheduledChangeApplier();

            // Act
            const summary = await runS3(s, { scheduledChangeApplier: spy.applier });

            // Assert
            expect(summary).toMatchObject({ retainedReevaluated: 1 });
            expect(spy.seen).toEqual([
                {
                    subscriptionId: s.subscriptionId,
                    statusInTx: 'ACTIVE',
                    statusCommitted: 'SUSPENDED'
                }
            ]);
        }
    );
});
