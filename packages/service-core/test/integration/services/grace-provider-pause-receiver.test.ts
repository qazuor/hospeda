import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    coverageLosses,
    domainEvent,
    eq,
    isNull,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import { createProviderNoticeMirrorDelegates } from '../../../src/services/billing/notice/provider-notice-delegates.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { graceExpiredOccurrenceId } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import type { SuccessionCloser } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireCommittedOrphanRows,
    seedCommittedOrphans
} from './support/addon-orphan-fixtures.js';
import { graceFixture, graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { providerPauseFixture } from './support/provider-pause-fixtures.js';
import {
    authorizationDelivery,
    paymentFor,
    predecessorInGrace,
    retainInOwnTransaction,
    retentionsOf,
    retireSuccessionCases,
    seedLiveSuccessor
} from './support/succession-retention-fixtures.js';
import {
    arrearsMails,
    retireSuccessorGraceRows,
    row,
    type SeededSuccessorCase
} from './support/successor-grace-fixtures.js';

afterAll(closeServiceTestPool);
const seeded: SeededSuccessorCase[] = [];
const orphaned: { readonly subscriptionId: string; readonly userId: string }[] = [];
afterEach(async () => {
    const cases = seeded.splice(0);
    await retireSuccessionCases(cases);
    await retireSuccessorGraceRows(cases);
    for (const orphan of orphaned.splice(0))
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: orphan.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, orphan.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    await retireCommittedOrphanRows();
});

function receiver(
    fixture: Awaited<ReturnType<typeof graceFixture>>,
    delivery = authorizationDelivery(fixture.started.authorizationId),
    deliver = true,
    coverageNotices = fixture.coverageNotices,
    successionCloser?: SuccessionCloser
) {
    const ports = {
        provider: fixture.provider,
        clock: fixture.clock,
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver }),
        payments: creditedPaymentsFromLedger,
        planPolicy: fixture.planPolicy,
        coverageNotices
    };
    return processProviderNotice(
        { channel: 'WEBHOOKS', delivery },
        {
            ...ports,
            ...(successionCloser ? { successionCloser } : {}),
            delegates: createProviderNoticeMirrorDelegates({
                ...ports,
                ...(successionCloser ? { successionCloser } : {})
            })
        }
    );
}

describe('HOS-1559 TEST:B7:6 AC:B7:9 AC:B7:11 — el receptor de pausa del proveedor', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a) paused × ACTIVE corre S6 y la repetición se descarta',
        async () => {
            const f = await graceFixture();
            const id = f.started.subscriptionId;
            seeded.push({ subscriptionIds: [id], userId: f.user.id });
            await f.provider.failChargeCycle({
                authorizationId: f.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            await f.provider.pause({ authorizationId: f.started.authorizationId });
            const delivery = authorizationDelivery(f.started.authorizationId);
            const committedEvents: { event: CoverageChangedEvent; status: string | undefined }[] =
                [];
            const coverageNotices = {
                async emitCoverageChanged(event: CoverageChangedEvent) {
                    const [committed] = await getServiceTestDb()
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, id));
                    committedEvents.push({ event, status: committed?.status });
                }
            };
            const first = await receiver(f, delivery, true, coverageNotices);
            const second = await receiver(f, delivery, true, coverageNotices);
            expect(first).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect(second).toEqual({ ack: 'OK', outcome: 'DISCARDED_OLD_VERSION' });
            expect((await row(id)).status).toBe('SUSPENDED');
            expect(await arrearsMails(f.user.id)).toHaveLength(1);
            expect(committedEvents).toContainEqual({
                event: expect.objectContaining({ change: 'REMOVED' }),
                status: 'SUSPENDED'
            });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coverageLosses)
                    .where(eq(coverageLosses.userId, f.user.id))
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, id))
            ).toEqual([]);
            const events = await getServiceTestDb()
                .select({ eventType: domainEvent.eventType })
                .from(domainEvent)
                .where(eq(domainEvent.entityId, id));
            expect(events.map((event) => event.eventType)).not.toContain(
                'subscription.provider_cancelled_after_rejection'
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(a2) el receptor y el barrido comparten una sola ocurrencia',
        async () => {
            const s = await providerPauseFixture({ deliver: false });
            seeded.push(s.seeded);
            await s.pause();
            const first = await receiver(
                s.fixture,
                authorizationDelivery(s.fixture.started.authorizationId),
                false
            );
            // The receiver's public outcome remains DELEGATED; S6's internal result is DEFERRED.
            expect(first).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            s.setDeliver(true);
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b) paused × GRACE_PERIOD sin vencer corre S6',
        async () => {
            const f = await graceWithFailedCycle();
            const id = f.started.subscriptionId;
            seeded.push({ subscriptionIds: [id], userId: f.user.id });
            await f.provider.pause({ authorizationId: f.started.authorizationId });
            const result = await receiver(f);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(id)).status).toBe('SUSPENDED');
            expect(await arrearsMails(f.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c) cancelled × grace with expired clock uses S6, not the mirror',
        async () => {
            const f = await graceWithFailedCycle();
            const id = f.started.subscriptionId;
            seeded.push({ subscriptionIds: [id], userId: f.user.id });
            const current = await row(id);
            if (current.graceEndsAt === null) throw new Error('Expected grace expiry');
            f.clock.advance({ ms: current.graceEndsAt.getTime() - f.clock.now().getTime() + 1 });
            await f.provider.cancel({ authorizationId: f.started.authorizationId });
            const result = await receiver(f);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(id)).status).toBe('SUSPENDED');
            expect(await arrearsMails(f.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c2) correo de GRACE_EXPIRED ya encolado no se repite al llegar cancelled',
        async () => {
            const f = await graceWithFailedCycle();
            const id = f.started.subscriptionId;
            seeded.push({ subscriptionIds: [id], userId: f.user.id });
            const current = await row(id);
            if (current.graceEndsAt === null) throw new Error('Expected grace expiry');
            f.clock.advance({ ms: current.graceEndsAt.getTime() - f.clock.now().getTime() + 1 });
            const provider: PaymentProvider = new Proxy(f.provider, {
                get(target, property, receiver) {
                    if (property === 'cancel')
                        return async () => {
                            throw new Error('cancel unavailable');
                        };
                    const value = Reflect.get(target, property, receiver);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            const first = await suspendForArrears(
                {
                    subscriptionId: id,
                    event: 'GRACE_EXPIRED',
                    occurrenceId: graceExpiredOccurrenceId({
                        subscriptionId: id,
                        graceEndsAt: current.graceEndsAt
                    })
                },
                {
                    ...f.ports,
                    provider,
                    clock: f.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: f.coverageNotices
                }
            );
            expect(first).toMatchObject({ outcome: 'DEFERRED', reason: 'CANCEL_FAILED' });
            expect((await row(id)).status).toBe('GRACE_PERIOD');
            expect(await arrearsMails(f.user.id)).toHaveLength(1);
            await f.provider.cancel({ authorizationId: f.started.authorizationId });
            const result = await receiver(f);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(id)).status).toBe('SUSPENDED');
            expect(await arrearsMails(f.user.id)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(d) H-7: cancelled sobre predecesora viva en grace conserva el espejo',
        async () => {
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            s.expireClock();
            await s.fixture.provider.cancel({
                authorizationId: s.fixture.started.authorizationId
            });
            const called: string[] = [];
            const closer: SuccessionCloser = {
                async closeSuccession(input) {
                    called.push(input.predecessorSubscriptionId);
                }
            };
            const result = await receiver(
                s.fixture,
                authorizationDelivery(s.fixture.started.authorizationId),
                true,
                s.fixture.coverageNotices,
                closer
            );
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(s.subscriptionId)).status).toBe('CANCELLED');
            expect(called).toEqual([s.subscriptionId]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(e) una sucesora viva mantiene ACTIVE ante paused',
        async () => {
            const f = await graceWithFailedCycle();
            const id = f.started.subscriptionId;
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'ACTIVE', graceStartedAt: null, graceEndsAt: null })
                .where(eq(subscriptions.id, id));
            const successor = await seedLiveSuccessor(f, id);
            seeded.push({ subscriptionIds: [id, successor.id], userId: f.user.id });
            await f.provider.pause({ authorizationId: f.started.authorizationId });
            const result = await receiver(f);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(id)).status).toBe('ACTIVE');
            expect(await arrearsMails(f.user.id)).toHaveLength(0);
            expect(
                (await f.provider.readAuthorization({ authorizationId: f.started.authorizationId }))
                    .snapshot.status
            ).toBe('paused');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(f) S19 mantiene GRACE_PERIOD y la retención abierta ante paused',
        async () => {
            const s = await predecessorInGrace();
            seeded.push(s.seeded);
            const payment = await paymentFor(s.fixture.initialChargeId);
            await retainInOwnTransaction({
                subscriptionId: s.subscriptionId,
                paymentId: payment.id,
                unpaidSince: s.graceStartedAt,
                now: s.fixture.clock.now()
            });
            await s.fixture.provider.pause({
                authorizationId: s.fixture.started.authorizationId
            });
            const result = await receiver(s.fixture);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect(
                (await retentionsOf(s.subscriptionId)).some(
                    (retention) => retention.releasedAt === null
                )
            ).toBe(true);
            expect(await arrearsMails(s.fixture.user.id)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(h) DEC-1 abre TRANSICION_NO_DECLARADA para complemento y no escribe su fila',
        async () => {
            const f = await graceFixture();
            seeded.push({ subscriptionIds: [f.started.subscriptionId], userId: f.user.id });
            const fixture = await seedCommittedOrphans({ fake: f.provider });
            const addon = fixture.addons[0];
            if (!addon) throw new Error('Expected one addon orphan fixture');
            orphaned.push({ subscriptionId: addon.complementId, userId: fixture.userId });
            await f.provider.pause({ authorizationId: addon.authorizationId });
            const result = await receiver(f, authorizationDelivery(addon.authorizationId));
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect((await row(addon.complementId)).status).toBe('ACTIVE');
            const marks = await getServiceTestDb()
                .select({
                    reason: reconciliationMarks.reason,
                    liftedAt: reconciliationMarks.liftedAt
                })
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, addon.complementId));
            expect(marks).toHaveLength(1);
            expect(marks[0]).toMatchObject({
                reason: 'TRANSICION_NO_DECLARADA',
                liftedAt: null
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(i) la relectura por id descarta una pausa que ya volvió a authorized',
        async () => {
            const f = await graceFixture();
            const id = f.started.subscriptionId;
            seeded.push({ subscriptionIds: [id], userId: f.user.id });
            await f.provider.failChargeCycle({
                authorizationId: f.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            await f.provider.pause({ authorizationId: f.started.authorizationId });
            const originalRead = f.provider.readAuthorization.bind(f.provider);
            let reads = 0;
            vi.spyOn(f.provider, 'readAuthorization').mockImplementation(async (input) => {
                reads += 1;
                if (reads === 2)
                    await f.provider.resume({ authorizationId: f.started.authorizationId });
                return originalRead(input);
            });
            const result = await receiver(f);
            expect(result).toEqual({ ack: 'OK', outcome: 'DELEGATED' });
            expect(reads).toBe(2);
            expect((await row(id)).status).toBe('ACTIVE');
            expect(await arrearsMails(f.user.id)).toHaveLength(0);
        }
    );
});
