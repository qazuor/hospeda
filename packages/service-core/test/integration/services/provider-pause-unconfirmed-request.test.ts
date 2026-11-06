import { randomUUID } from 'node:crypto';
import { and, eq, isNull, reconciliationMarks } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { handleProviderPauseIsArrears } from '../../../src/services/billing/notice/provider-pause-arrears.js';
import { liftReconciliationMark } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { createGraceExpiryCheck } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { suspendForArrears } from '../../../src/services/billing/subscription/suspend-for-arrears.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    arrearsMails,
    retireSuccessorGraceRows,
    row,
    type SeededSuccessorCase,
    successorInGrace,
    sweepInput
} from './support/successor-grace-fixtures.js';
import { allowsPause, unconfirmedPauseFixture } from './support/unconfirmed-pause-fixtures.js';

const seeded: SeededSuccessorCase[] = [];
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireSuccessorGraceRows(seeded.splice(0));
});

async function openReasons(subscriptionId: string) {
    const marks = await getServiceTestDb()
        .select({ reason: reconciliationMarks.reason })
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                isNull(reconciliationMarks.liftedAt)
            )
        );
    return marks.map(({ reason }) => reason).sort();
}
async function markFor(
    subscriptionId: string,
    reason: 'PAUSA_NO_APLICADA' | 'REANUDACION_NO_APLICADA'
) {
    const [mark] = await getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                eq(reconciliationMarks.reason, reason),
                isNull(reconciliationMarks.liftedAt)
            )
        );
    if (!mark) throw new Error(`Expected open ${reason}`);
    return mark;
}
function ownCancels(
    calls: readonly (readonly [{ readonly authorizationId: string }])[],
    authorizationId: string
) {
    return calls.filter(([call]) => call.authorizationId === authorizationId);
}
async function pending22() {
    const s = await unconfirmedPauseFixture();
    seeded.push({ subscriptionIds: [s.subscriptionId], userId: s.fixture.user.id });
    expect(await s.pause(true)).toEqual({ outcome: 'NOT_APPLIED' });
    expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
    expect(await openReasons(s.subscriptionId)).toEqual(['PAUSA_NO_APLICADA']);
    await s.prepareUnpaidCycle();
    await s.applyLatePause();
    return s;
}

// AC:2003:1 and TEST:2003:6 share the exact open-mark assertion.
describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:2003:1 TEST:2003:6 — S8 unconfirmed, sweep observes late pause',
    () => {
        it('keeps ACTIVE, one mark, clock, provider and all irreversible outputs untouched', async () => {
            const s = await pending22();
            const before = await row(s.subscriptionId);
            const coverageBefore = [...s.fixture.coverageEvents];
            await s.runPauseCheck();
            const after = await row(s.subscriptionId);
            expect(after.status).toBe('ACTIVE');
            expect([after.graceStartedAt, after.graceEndsAt]).toEqual([
                before.graceStartedAt,
                before.graceEndsAt
            ]);
            expect([after.graceStartedAt, after.graceEndsAt]).toEqual([null, null]);
            expect(await openReasons(s.subscriptionId)).toEqual(['PAUSA_NO_APLICADA']);
            expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([]);
            expect(
                (await s.provider.readAuthorization({ authorizationId: s.authorizationId }))
                    .snapshot.status
            ).toBe('paused');
            expect(
                s.beforeCancel.mock.calls.filter(
                    ([notice]) => notice.subscriptionId === s.subscriptionId
                )
            ).toEqual([]);
            expect(await arrearsMails(s.fixture.user.id)).toEqual([]);
            expect(s.fixture.coverageEvents).toEqual(coverageBefore);
            expect(
                s.facts.filter(
                    (fact) =>
                        fact.kind === 'SUSPENDED_FOR_ARREARS' &&
                        fact.subscriptionId === s.subscriptionId
                )
            ).toEqual([]);
            expect(
                await suspendForArrears(
                    {
                        subscriptionId: s.subscriptionId,
                        event: 'PROVIDER_PAUSE_OBSERVED',
                        occurrenceId: randomUUID()
                    },
                    s.ports
                )
            ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'PAUSE_REQUEST_UNCONFIRMED' });
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:2003:2 — receiver observes late S8 pause',
    () => {
        it('preserves the principal and open mark without notice or cancel', async () => {
            const s = await pending22();
            await handleProviderPauseIsArrears(
                { subscriptionId: s.subscriptionId, readAt: s.fixture.clock.now() },
                s.ports
            );
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(await openReasons(s.subscriptionId)).toEqual(['PAUSA_NO_APLICADA']);
            expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([]);
            expect(
                s.beforeCancel.mock.calls.filter(
                    ([notice]) => notice.subscriptionId === s.subscriptionId
                )
            ).toEqual([]);
            expect(await arrearsMails(s.fixture.user.id)).toEqual([]);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:2003:3 — S10 mark remains after successful retry',
    () => {
        it('protects an ACTIVE principal with mark 8 from a later paused read', async () => {
            const s = await unconfirmedPauseFixture();
            seeded.push({ subscriptionIds: [s.subscriptionId], userId: s.fixture.user.id });
            expect((await s.pause(false)).outcome).toBe('PAUSED');
            expect((await s.resume(true)).outcome).toBe('NOT_APPLIED');
            expect((await row(s.subscriptionId)).status).toBe('PAUSED');
            expect(await openReasons(s.subscriptionId)).toEqual(['REANUDACION_NO_APLICADA']);
            expect((await s.resume(false)).outcome).toBe('RESUMED');
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            const coverageBefore = [...s.fixture.coverageEvents];
            await s.prepareUnpaidCycle();
            await s.applyLatePause();
            await s.runPauseCheck();
            expect((await row(s.subscriptionId)).status).toBe('ACTIVE');
            expect(await openReasons(s.subscriptionId)).toEqual(['REANUDACION_NO_APLICADA']);
            expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([]);
            expect(await arrearsMails(s.fixture.user.id)).toEqual([]);
            expect(s.fixture.coverageEvents).toEqual(coverageBefore);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:2003:4 — successor in grace with open mark',
    () => {
        it('keeps its grace clock and authorization when S6 sees paused', async () => {
            const s = await successorInGrace({ seeded });
            const id = s.fixture.successorId;
            const opened = await openReconciliationMark({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: id },
                reason: 'PAUSA_NO_APLICADA',
                actor: { type: 'job' },
                correlationId: randomUUID()
            });
            expect(opened.outcome).toBe('OPENED');
            await s.fixture.provider.pause({ authorizationId: s.fixture.successorAuthorizationId });
            s.fixture.clock.advance({ ms: DAY_MS });
            await s.runCheck();
            const after = await row(id);
            expect(after.status).toBe('GRACE_PERIOD');
            expect([after.graceStartedAt, after.graceEndsAt]).toEqual([
                s.graceStartedAt,
                s.graceEndsAt
            ]);
            expect(await openReasons(id)).toEqual(['PAUSA_NO_APLICADA']);
            expect(await s.authorizationStatus()).toBe('paused');
            expect(ownCancels(s.cancel.mock.calls, s.fixture.successorAuthorizationId)).toEqual([]);
            expect(
                s.beforeCancel.mock.calls.filter(([notice]) => notice.subscriptionId === id)
            ).toEqual([]);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())('TEST:2003:5 — narrow exception controls', () => {
    it('(a) no open request mark: second event suspends and cancels once', async () => {
        const s = await unconfirmedPauseFixture();
        seeded.push({ subscriptionIds: [s.subscriptionId], userId: s.fixture.user.id });
        await s.prepareUnpaidCycle();
        await s.applyLatePause();
        await s.runPauseCheck();
        expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
        expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([
            [{ authorizationId: s.authorizationId }]
        ]);
        expect(await openReasons(s.subscriptionId)).toEqual([]);
    });
    it('(b) S15 lifts mark 22: second event suspends and cancels once', async () => {
        const s = await pending22();
        const mark = await markFor(s.subscriptionId, 'PAUSA_NO_APLICADA');
        expect(
            (
                await liftReconciliationMark(
                    { markId: mark.id, expectedVersion: mark.version, liftedBy: s.fixture.user.id },
                    { clock: s.fixture.clock }
                )
            ).outcome
        ).toBe('LIFTED');
        await s.runPauseCheck();
        expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
        expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([
            [{ authorizationId: s.authorizationId }]
        ]);
        expect(await openReasons(s.subscriptionId)).toEqual([]);
    });
    it('(c) another open reason does not block the second event', async () => {
        const s = await unconfirmedPauseFixture();
        seeded.push({ subscriptionIds: [s.subscriptionId], userId: s.fixture.user.id });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: s.subscriptionId },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'job' },
            correlationId: randomUUID()
        });
        await s.prepareUnpaidCycle();
        await s.applyLatePause();
        await s.runPauseCheck();
        expect((await row(s.subscriptionId)).status).toBe('SUSPENDED');
        expect(ownCancels(s.cancel.mock.calls, s.authorizationId)).toEqual([
            [{ authorizationId: s.authorizationId }]
        ]);
        expect(await openReasons(s.subscriptionId)).toEqual(['TRANSICION_NO_DECLARADA']);
    });
    it('(d) expired grace uses the first event despite open mark 22', async () => {
        const f = await graceWithFailedCycle({
            planPolicy: allowsPause,
            beforeS4: async (fixture) => {
                const provider = new Proxy(fixture.provider, {
                    get(target, property, receiver) {
                        if (property === 'pause')
                            return async () => ({
                                accepted: true as const,
                                resourceId: fixture.started.authorizationId
                            });
                        const method = Reflect.get(target, property, receiver);
                        return typeof method === 'function' ? method.bind(target) : method;
                    }
                }) satisfies PaymentProvider;
                const result = await pauseSubscription(
                    { subscriptionId: fixture.started.subscriptionId, requestedMonths: 2 },
                    {
                        provider,
                        clock: fixture.clock,
                        planPolicy: allowsPause,
                        complements: {
                            addonPolicy: async () => {
                                throw new Error('Unexpected addon');
                            },
                            listing: async () => {
                                throw new Error('Unexpected listing');
                            }
                        }
                    }
                );
                expect(result).toEqual({ outcome: 'NOT_APPLIED' });
            }
        });
        seeded.push({ subscriptionIds: [f.started.subscriptionId], userId: f.user.id });
        const id = f.started.subscriptionId;
        expect(await openReasons(id)).toEqual(['PAUSA_NO_APLICADA']);
        await f.provider.pause({ authorizationId: f.started.authorizationId });
        const before = await row(id);
        if (!before.graceEndsAt) throw new Error('Expected grace end');
        f.clock.advance({ ms: before.graceEndsAt.getTime() + HOUR_MS - f.clock.now().getTime() });
        const cancel = vi.fn<PaymentProvider['cancel']>((input) => f.provider.cancel(input));
        const provider = new Proxy(f.provider, {
            get(target, property, receiver) {
                if (property === 'cancel') return cancel;
                const method = Reflect.get(target, property, receiver);
                return typeof method === 'function' ? method.bind(target) : method;
            }
        }) satisfies PaymentProvider;
        await createGraceExpiryCheck({
            ...f.ports,
            provider,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true })
        })(await sweepInput(id, provider, f.clock));
        expect((await row(id)).status).toBe('SUSPENDED');
        expect(ownCancels(cancel.mock.calls, f.started.authorizationId)).toEqual([
            [{ authorizationId: f.started.authorizationId }]
        ]);
        expect(await openReasons(id)).toEqual(['PAUSA_NO_APLICADA']);
    });
});
