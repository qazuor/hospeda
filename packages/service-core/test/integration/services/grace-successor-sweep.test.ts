// TEST:B7:2 — the successor of a paying predecessor in grace (AC:B7:4), second half: the sweep
// re-reads its preapproval by id every day and, read `cancelled` (fifth event) or `paused`
// (second event), S6 suspends it. The receiver's half is `grace-successor-receiver.test.ts`.
import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import {
    createGraceExpiryCheck,
    graceExpiredOccurrenceId,
    successorProviderCancelledOccurrenceId
} from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { createSuccessorGraceCheck } from '../../../src/services/billing/reconciliation/sweep/successor-grace-check.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import {
    arrearsMails,
    instrument,
    lossesOf,
    retireSuccessorGraceRows,
    row,
    type SeededSuccessorCase,
    successorInGrace,
    sweepInput
} from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const seeded: SeededSuccessorCase[] = [];

afterEach(async () => {
    await retireSuccessorGraceRows(seeded.splice(0));
});

describe("TEST:B7:2 — the sweep re-reads the successor's preapproval every day (AC:B7:4)", () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'h — PA-6, the provider cancelled the preapproval: the next day S6 suspends (fifth event) without our cancel',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            const successor = await row(s.fixture.successorId);
            expect(successor.status).toBe('SUSPENDED');
            expect(successor.graceStartedAt).toEqual(s.graceStartedAt);
            expect(s.cancel).not.toHaveBeenCalled();
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                subscriptionId: s.fixture.successorId,
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: successorProviderCancelledOccurrenceId({
                    subscriptionId: s.fixture.successorId,
                    graceStartedAt: s.graceStartedAt
                })
            });
            const mails = await arrearsMails(s.fixture.user.id);
            expect(mails).toHaveLength(1);
            expect(mails[0]?.payload).toMatchObject({
                subscriptionId: s.fixture.successorId,
                paymentMethod: 'CARD'
            });
            expect(await lossesOf(s.fixture.user.id)).toEqual([{ vertical: 'accommodation' }]);
            expect(s.coverage).toHaveLength(1);
            expect(s.coverage[0]).toEqual({
                event: {
                    userId: s.fixture.user.id,
                    vertical: 'accommodation',
                    sourceType: 'SUBSCRIPTION',
                    change: 'REMOVED'
                },
                statusCommitted: 'SUSPENDED'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'i — the provider paused the preapproval: S6 (second event) notices first, then cancels once',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(s.sequence).toEqual(['notice', 'cancel']);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                kind: 'ARREARS_SUSPENSION',
                occurrenceId: `${s.fixture.successorId}:provider-pause-observed:${s.graceStartedAt.toISOString()}`
            });
            expect(await s.authorizationStatus()).toBe('cancelled');
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'j — an authorized preapproval: nothing happens, the grace keeps its clock',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert
            const successor = await row(s.fixture.successorId);
            expect(successor.status).toBe('GRACE_PERIOD');
            expect(successor.graceStartedAt).toEqual(s.graceStartedAt);
            expect(successor.graceEndsAt).toEqual(s.graceEndsAt);
            expect(s.beforeCancel).not.toHaveBeenCalled();
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await arrearsMails(s.fixture.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'k — a clock that already ran out with a cancelled preapproval is the first event, not this check (D-12)',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.successorAuthorizationId
            });
            s.fixture.clock.advance({
                ms: s.graceEndsAt.getTime() + HOUR_MS - s.fixture.clock.now().getTime()
            });

            // Act
            await s.runCheck();

            // Assert: this check did not act.
            expect((await row(s.fixture.successorId)).status).toBe('GRACE_PERIOD');
            expect(s.beforeCancel).not.toHaveBeenCalled();

            // And the expiry check takes it by its first event.
            await createGraceExpiryCheck({
                provider: s.provider,
                clock: s.fixture.clock,
                beforeCancelNotice: s.beforeCancelNotice,
                payments: creditedPaymentsFromLedger,
                planPolicy: s.fixture.planPolicy,
                coverageNotices: s.coverageNotices
            })(await sweepInput(s.fixture.successorId, s.provider, s.fixture.clock));
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.beforeCancel).toHaveBeenCalledTimes(1);
            expect(s.beforeCancel.mock.calls[0]?.[0]).toMatchObject({
                occurrenceId: graceExpiredOccurrenceId({
                    subscriptionId: s.fixture.successorId,
                    graceEndsAt: s.graceEndsAt
                })
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'l — a normal row in grace (a payment of its own) with a cancelled preapproval is left alone',
        async () => {
            // Arrange
            const normal = await graceWithFailedCycle();
            seeded.push({
                subscriptionIds: [normal.started.subscriptionId],
                userId: normal.user.id
            });
            await normal.provider.cancel({ authorizationId: normal.started.authorizationId });
            normal.clock.advance({ ms: DAY_MS });
            const tools = instrument({
                real: normal.provider,
                subscriptionId: normal.started.subscriptionId,
                deliver: true
            });

            // Act
            await createSuccessorGraceCheck({
                provider: tools.provider,
                clock: normal.clock,
                beforeCancelNotice: tools.beforeCancelNotice,
                payments: creditedPaymentsFromLedger,
                coverageNotices: tools.coverageNotices
            })(await sweepInput(normal.started.subscriptionId, tools.provider, normal.clock));

            // Assert
            expect((await row(normal.started.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(tools.beforeCancel).not.toHaveBeenCalled();
            expect(await arrearsMails(normal.user.id)).toEqual([]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'm — a notice not yet sent defers S6; the next run with the notice sent suspends',
        async () => {
            // Arrange
            const s = await successorInGrace({ seeded, deliver: false });
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });

            // Act
            await s.runCheck();

            // Assert: deferred, nothing called, nothing written.
            expect((await row(s.fixture.successorId)).status).toBe('GRACE_PERIOD');
            expect(s.cancel).not.toHaveBeenCalled();
            expect(await s.authorizationStatus()).toBe('paused');

            // Next run, the notice delivered.
            s.setDeliver(true);
            s.fixture.clock.advance({ ms: DAY_MS });
            await s.runCheck();
            expect((await row(s.fixture.successorId)).status).toBe('SUSPENDED');
            expect(s.cancel).toHaveBeenCalledTimes(1);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'p — the row leaves grace before S6 writes: LOST_RACE, nothing written; a row already out of grace is NOT_IN_GRACE',
        async () => {
            // Arrange: the notice double moves the row out of grace, as S5 would.
            const s = await successorInGrace({ seeded });
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });
            s.beforeNotice(async () => {
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ status: 'ACTIVE', graceStartedAt: null, graceEndsAt: null })
                    .where(eq(subscriptions.id, s.fixture.successorId));
            });
            const ports = {
                provider: s.provider,
                clock: s.fixture.clock,
                beforeCancelNotice: s.beforeCancelNotice,
                coverageNotices: s.coverageNotices
            };

            // Act
            const raced = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'PROVIDER_PAUSE_OBSERVED',
                    occurrenceId: `${s.fixture.successorId}:provider-pause-observed:${s.graceStartedAt.toISOString()}`
                },
                ports
            );

            // Assert
            expect(raced).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' });
            expect((await row(s.fixture.successorId)).status).toBe('ACTIVE');
            expect(await lossesOf(s.fixture.user.id)).toEqual([]);
            expect(s.coverage).toEqual([]);

            // A row already out of grace: the fifth event does not apply and writes nothing.
            const outOfGrace = await suspendForArrears(
                {
                    subscriptionId: s.fixture.successorId,
                    event: 'SUCCESSOR_PROVIDER_CANCELLED',
                    occurrenceId: successorProviderCancelledOccurrenceId({
                        subscriptionId: s.fixture.successorId,
                        graceStartedAt: s.graceStartedAt
                    })
                },
                ports
            );
            expect(outOfGrace).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' });
            expect((await row(s.fixture.successorId)).status).toBe('ACTIVE');
            expect(await lossesOf(s.fixture.user.id)).toEqual([]);
        }
    );
});
