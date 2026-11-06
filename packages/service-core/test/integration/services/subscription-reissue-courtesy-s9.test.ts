import { VerticalSchema } from '@repo/billing-verticals-contract';
import {
    and,
    courtesyGrants,
    eq,
    isNull,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveCourtesySources } from '../../../src/services/billing/coverage/courtesy-sources.js';
import { reissueDeferredCourtesy } from '../../../src/services/billing/subscription/reissue-deferred-courtesy.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retireReissueCourtesyCase,
    seedReissueCourtesyCase
} from './support/reissue-courtesy-fixtures.js';

const fixtures: Awaited<ReturnType<typeof seedReissueCourtesyCase>>[] = [];
afterEach(async () => {
    while (fixtures.length) {
        const fixture = fixtures.pop();
        if (fixture) await retireReissueCourtesyCase({ ids: fixture.ids });
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:12 S9 deferred courtesy reissue', () => {
    it('(a, f) moves the same grant, pauses after provider reread, and is idempotent', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const result = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            fixture
        );
        const db = getServiceTestDb();
        const [grant] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        const [successor] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        const pauses = await db
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, fixture.ids.successor.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
        expect(result).toMatchObject({
            outcome: 'REISSUED',
            grantId: fixture.ids.grantId,
            months: 3,
            providerCall: 'CONFIRMED',
            chargeMarksOpened: 0
        });
        expect(grant).toMatchObject({
            id: fixture.ids.grantId,
            subscriptionId: fixture.ids.successor.id,
            balanceMonths: null,
            grantedBy: fixture.ids.userId,
            months: 4,
            reason: 'fixture'
        });
        expect(grant?.startsAt).toEqual(fixture.clock.now());
        expect(grant?.endsAt).toEqual(new Date('2027-02-12T12:00:00.000Z'));
        expect(successor?.status).toBe('PAUSED');
        expect(pauses).toHaveLength(1);
        expect(pauses[0]).toMatchObject({
            reason: 'COURTESY',
            requestedMonths: 3,
            startsAt: fixture.clock.now(),
            expectedEndAt: grant?.endsAt
        });
        expect(
            (
                await fixture.harness.fake.readAuthorization({
                    authorizationId: fixture.authorizationId!
                })
            ).snapshot.status
        ).toBe('paused');
        expect(fixture.harness.calls.filter((call) => call.startsWith('pause:'))).toHaveLength(1);
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: fixture.ids.successor.id },
                fixture
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NO_DEFERRED_COURTESY' });
        expect(fixture.harness.calls.filter((call) => call.startsWith('pause:'))).toHaveLength(1);
    });

    it('(e) reissues a manual payer without a provider call', async () => {
        const fixture = await seedReissueCourtesyCase({ manual: true });
        fixtures.push(fixture);
        const result = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            fixture
        );
        expect(result).toMatchObject({ outcome: 'REISSUED', providerCall: 'NONE', months: 3 });
        expect(fixture.harness.calls).toEqual([]);
        const [successor] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        expect(successor?.status).toBe('PAUSED');
    });

    it('(b) starts the grant after successor credit while opening the pause today', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const creditEndsAt = new Date('2027-01-12T12:00:00.000Z');
        await getServiceTestDb()
            .update(subscriptions)
            .set({ firstChargeAt: creditEndsAt })
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        const result = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            fixture
        );
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        const [pause] = await getServiceTestDb()
            .select()
            .from(subscriptionPauses)
            .where(
                and(
                    eq(subscriptionPauses.subscriptionId, fixture.ids.successor.id),
                    isNull(subscriptionPauses.actualEndAt)
                )
            );
        expect(result).toMatchObject({
            outcome: 'REISSUED',
            startsAt: creditEndsAt,
            endsAt: new Date('2027-04-12T12:00:00.000Z')
        });
        expect(grant?.startsAt).toEqual(creditEndsAt);
        expect(pause).toMatchObject({
            startsAt: fixture.clock.now(),
            expectedEndAt: grant?.endsAt
        });
    });

    it('(c) keeps the grant deferred after an unapplied PUT and succeeds on retry', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const provider = new Proxy(fixture.provider, {
            get(target, property, receiver) {
                if (property === 'pause')
                    return async ({ authorizationId }: { readonly authorizationId: string }) => ({
                        accepted: true as const,
                        resourceId: authorizationId
                    });
                const method = Reflect.get(target, property, receiver);
                return typeof method === 'function' ? method.bind(target) : method;
            }
        });
        const refused = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            { ...fixture, provider }
        );
        const [deferred] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        const [successor] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, fixture.ids.successor.id),
                    eq(reconciliationMarks.reason, 'PAUSA_NO_APLICADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(refused).toEqual({ outcome: 'NOT_APPLIED' });
        expect(deferred).toMatchObject({
            subscriptionId: fixture.ids.predecessor.id,
            balanceMonths: 3
        });
        expect(successor?.status).toBe('ACTIVE');
        expect(marks).toHaveLength(1);
        expect(
            (
                await reissueDeferredCourtesy(
                    { successorSubscriptionId: fixture.ids.successor.id },
                    fixture
                )
            ).outcome
        ).toBe('REISSUED');
    });

    it('(d, k) hangs each credited payment, emits one coverage change, and exposes COURTESY coverage', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const [payment] = await getServiceTestDb()
            .insert(payments)
            .values({
                subscriptionId: fixture.ids.successor.id,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `s9-${crypto.randomUUID()}`,
                factAt: fixture.clock.now()
            })
            .returning({ id: payments.id });
        if (!payment) throw new Error('S9 payment fixture missing');
        const events: unknown[] = [];
        const result = await reissueDeferredCourtesy(
            { successorSubscriptionId: fixture.ids.successor.id },
            {
                ...fixture,
                coverageNotices: {
                    async emitCoverageChanged(event) {
                        events.push(event);
                    }
                }
            }
        );
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, fixture.ids.successor.id),
                    eq(reconciliationMarks.reason, 'COBRO_DURANTE_CORTESIA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        const hung = await getServiceTestDb()
            .select()
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.paymentId, payment.id));
        const coverage = await resolveCourtesySources({
            userId: fixture.ids.userId,
            vertical: VerticalSchema.parse('accommodation'),
            ports: { clock: fixture.clock }
        });
        expect(result).toMatchObject({ outcome: 'REISSUED', chargeMarksOpened: 1 });
        expect(marks).toHaveLength(1);
        expect(hung).toHaveLength(1);
        expect(hung[0]?.markId).toBe(marks[0]?.id);
        expect(events).toEqual([
            {
                userId: fixture.ids.userId,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            }
        ]);
        expect(coverage.sources).toHaveLength(1);
        expect(coverage.sources[0]?.type).toBe('COURTESY');
    });

    it('(g) refuses pending successors and complementary rows before any provider call', async () => {
        const pending = await seedReissueCourtesyCase({ status: 'PENDING_AUTHORIZATION' });
        fixtures.push(pending);
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: pending.ids.successor.id },
                pending
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'SUCCESSOR_NOT_ACTIVE' });
        const complement = await seedReissueCourtesyCase();
        fixtures.push(complement);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO' })
            .where(eq(subscriptions.id, complement.ids.successor.id));
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: complement.ids.successor.id },
                complement
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NOT_PRINCIPAL' });
        expect(pending.harness.calls).toEqual([]);
        expect(complement.harness.calls).toEqual([]);
    });

    it('(h) returns ALREADY_PAUSED without moving the deferred grant', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: fixture.ids.successor.id,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt: fixture.clock.now(),
                expectedEndAt: new Date('2027-01-12T12:00:00.000Z')
            });
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: fixture.ids.successor.id },
                fixture
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'ALREADY_PAUSED' });
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        expect(grant).toMatchObject({
            subscriptionId: fixture.ids.predecessor.id,
            balanceMonths: 3
        });
        expect(fixture.harness.calls).toEqual([]);
    });

    it('(i) excludes closed balances and fails closed on multiple deferred grants', async () => {
        const closed = await seedReissueCourtesyCase();
        fixtures.push(closed);
        await getServiceTestDb()
            .update(courtesyGrants)
            .set({
                balanceClosedAt: closed.clock.now(),
                closeReason: 'CONTRACARGO_DE_LA_PREDECESORA'
            })
            .where(eq(courtesyGrants.id, closed.ids.grantId!));
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: closed.ids.successor.id },
                closed
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'NO_DEFERRED_COURTESY' });
        const multiple = await seedReissueCourtesyCase();
        fixtures.push(multiple);
        await getServiceTestDb()
            .insert(courtesyGrants)
            .values({
                beneficiaryUserId: multiple.ids.userId,
                grantedBy: multiple.ids.userId,
                subscriptionId: multiple.ids.predecessor.id,
                months: 1,
                startsAt: multiple.clock.now(),
                endsAt: new Date('2027-01-12T12:00:00.000Z'),
                reason: 'fixture-second',
                balanceMonths: 1
            });
        await expect(
            reissueDeferredCourtesy(
                { successorSubscriptionId: multiple.ids.successor.id },
                multiple
            )
        ).rejects.toMatchObject({ reason: 'S9_MULTIPLE_DEFERRED_GRANTS' });
        const [successor] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, multiple.ids.successor.id));
        expect(successor?.status).toBe('ACTIVE');
        expect(multiple.harness.calls).toEqual([]);
    });

    it('(j) reports a declared transition when the row changes after the provider pause', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const provider = new Proxy(fixture.provider, {
            get(target, property, receiver) {
                if (property === 'pause')
                    return async ({ authorizationId }: { readonly authorizationId: string }) => {
                        const acknowledgement = await target.pause({ authorizationId });
                        await getServiceTestDb()
                            .update(subscriptions)
                            .set({ status: 'CANCELLED' })
                            .where(eq(subscriptions.id, fixture.ids.successor.id));
                        return acknowledgement;
                    };
                const method = Reflect.get(target, property, receiver);
                return typeof method === 'function' ? method.bind(target) : method;
            }
        });
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: fixture.ids.successor.id },
                { ...fixture, provider }
            )
        ).toEqual({ outcome: 'LOST_RACE' });
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        const marks = await getServiceTestDb()
            .select()
            .from(reconciliationMarks)
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, fixture.ids.successor.id),
                    eq(reconciliationMarks.reason, 'TRANSICION_NO_DECLARADA'),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        expect(grant).toMatchObject({
            subscriptionId: fixture.ids.predecessor.id,
            balanceMonths: 3
        });
        expect(marks).toHaveLength(1);
    });

    it('(j) loses the grant race when its deferred balance closes after the provider pause', async () => {
        const fixture = await seedReissueCourtesyCase();
        fixtures.push(fixture);
        const provider = new Proxy(fixture.provider, {
            get(target, property, receiver) {
                if (property === 'pause')
                    return async ({ authorizationId }: { readonly authorizationId: string }) => {
                        const acknowledgement = await target.pause({ authorizationId });
                        await getServiceTestDb()
                            .update(courtesyGrants)
                            .set({ balanceMonths: null })
                            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
                        return acknowledgement;
                    };
                const method = Reflect.get(target, property, receiver);
                return typeof method === 'function' ? method.bind(target) : method;
            }
        });
        expect(
            await reissueDeferredCourtesy(
                { successorSubscriptionId: fixture.ids.successor.id },
                { ...fixture, provider }
            )
        ).toEqual({ outcome: 'LOST_RACE' });
        const [grant] = await getServiceTestDb()
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.id, fixture.ids.grantId!));
        const [successor] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.ids.successor.id));
        expect(grant).toMatchObject({
            subscriptionId: fixture.ids.predecessor.id,
            balanceMonths: null
        });
        expect(successor?.status).toBe('ACTIVE');
    });
});
