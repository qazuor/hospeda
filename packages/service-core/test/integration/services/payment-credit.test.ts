import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    coveredPeriods,
    emailOutbox,
    eq,
    payments,
    promoCodes,
    promoRedemptions,
    subscriptions
} from '@repo/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { BillingFact } from '../../../src/services/billing/facts/billing-fact-sink.js';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { paymentFixture, setNextChargeAt } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

describe('TEST:B5:1 P1 payment credit', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1878:6 emits one principal charge fact after commit and none when the transaction rolls back after preparing it',
        async () => {
            const fixture = await paymentFixture();
            const [payment] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `fact-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const facts: BillingFact[] = [];
            const billingFacts = { emit: (fact: BillingFact) => facts.push(fact) };
            const result = await creditPayment(
                { paymentId: payment!.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock, billingFacts }
            );
            expect(result.outcome).toBe('CREDITED');
            expect(
                facts.filter((fact) => fact.subscriptionId === fixture.started.subscriptionId)
            ).toHaveLength(1);
            const repeated = await creditPayment(
                { paymentId: payment!.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock, billingFacts }
            );
            expect(repeated.outcome).toBe('ALREADY_CREDITED');
            expect(
                facts.filter((fact) => fact.subscriptionId === fixture.started.subscriptionId)
            ).toHaveLength(1);

            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `rollback-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const before = facts.filter(
                (fact) => fact.subscriptionId === fixture.started.subscriptionId
            ).length;
            await expect(
                creditPayment(
                    { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                    {
                        clock: fixture.clock,
                        billingFacts,
                        beforeCommit: async () => {
                            throw new Error('transaction failure before commit');
                        }
                    }
                )
            ).rejects.toThrow('transaction failure before commit');
            const [rolledBack] = await getServiceTestDb()
                .select({ status: payments.status })
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(rolledBack?.status).toBe('PENDING');
            expect(
                facts.filter((fact) => fact.subscriptionId === fixture.started.subscriptionId)
            ).toHaveLength(before);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 credits by the charge record instant and emits coverage after commit',
        async () => {
            const fixture = await paymentFixture();
            const nextChargeAt = new Date('2026-11-01T00:00:00.000Z');
            await setNextChargeAt(fixture.started.subscriptionId, nextChargeAt);
            const createdAt = fixture.clock.now();
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const readCharge = vi.spyOn(fixture.provider, 'readCharge');
            const observedCommittedStatus: string[] = [];
            const coverageNotices = {
                emitCoverageChanged: async (event: CoverageChangedEvent) => {
                    expect(event).toMatchObject({
                        userId: fixture.user.id,
                        vertical: 'accommodation',
                        sourceType: 'SUBSCRIPTION',
                        change: 'CHANGED'
                    });
                    const committed = (
                        await getServiceTestPool().query<{ status: string }>(
                            "SELECT status FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED'",
                            [fixture.started.subscriptionId]
                        )
                    ).rows[0];
                    observedCommittedStatus.push(committed?.status ?? 'MISSING');
                    fixture.coverageEvents.push(event);
                }
            };
            const output = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices
                }
            );
            expect(output.outcome).toBe('CREDITED');
            expect(readCharge).toHaveBeenCalledWith({ chargeId });
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(payment).toMatchObject({ status: 'SUCCEEDED', version: 2, factAt: createdAt });
            expect(observedCommittedStatus).toEqual(['SUCCEEDED']);
            expect(payment?.factAt.getTime()).not.toBe(nextChargeAt.getTime());
            const coverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, payment?.id ?? ''));
            expect(coverage).toHaveLength(1);
            expect(coverage[0]?.periodStart.getTime()).toBe(createdAt.getTime());
            expect(coverage[0]?.periodStart.getTime()).not.toBe(nextChargeAt.getTime());
            expect(fixture.coverageEvents).toEqual([
                {
                    userId: fixture.user.id,
                    vertical: 'accommodation',
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                }
            ]);
            const committed = (
                await getServiceTestPool().query<{ status: string }>(
                    'SELECT status FROM payment WHERE id = $1',
                    [payment?.id]
                )
            ).rows[0];
            expect(committed?.status).toBe('SUCCEEDED');
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mail.filter((row) => row.template === 'billing.payment-credited')).toHaveLength(
                1
            );
            await creditPayment(
                { paymentId: payment!.id, chargeCreatedAt: createdAt },
                { clock: fixture.clock, coverageNotices }
            );
            const mailAfterRepeat = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(
                mailAfterRepeat.filter((row) => row.template === 'billing.payment-credited')
            ).toHaveLength(1);
            expect(observedCommittedStatus).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 keeps a late charge pending until reread approval and applies P1 to its original row',
        async () => {
            const fixture = await paymentFixture({ honestM8: false });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            const first = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(first.outcome).toBe('RECORDED_PENDING');
            const [pending] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(pending?.status).toBe('PENDING');
            fixture.clock.advance({ ms: 2 * 60 * 60 * 1000 });
            const second = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(second.outcome).toBe('CREDITED');
            const rows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ id: pending?.id, status: 'SUCCEEDED', version: 2 });
            const coverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, pending?.id ?? ''));
            expect(coverage[0]?.periodStart.toISOString()).toBe('2026-10-01T03:00:00.000Z');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 credits an addon without subscription coverage or notice',
        async () => {
            const fixture = await paymentFixture();
            const addonId = (
                await getServiceTestPool().query<{ id: string }>(
                    'INSERT INTO addon (slug, name) VALUES ($1, $2) RETURNING id',
                    [`payment-addon-${crypto.randomUUID()}`, 'Payment addon']
                )
            ).rows[0]?.id;
            const versionId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
                    [addonId]
                )
            ).rows[0]?.id;
            const productId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
                    [versionId, addonId]
                )
            ).rows[0]?.id;
            const addonInstanceId = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
                    [productId, versionId, fixture.user.id]
                )
            ).rows[0]?.id;
            if (!addonInstanceId) throw new Error('payment addon instance missing');
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    addonInstanceId,
                    amount: 100,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `addon-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const result = await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                {
                    clock: fixture.clock,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(result).toMatchObject({ outcome: 'CREDITED', coverage: 'NOT_APPLICABLE' });
            const [credited] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(credited).toMatchObject({ status: 'SUCCEEDED', version: 2 });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, pending!.id))
            ).toHaveLength(0);
            expect(fixture.coverageEvents).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 decrements only discounted finite redemptions and runs S30 after commit',
        async () => {
            const cases = [
                { remaining: 2, discounted: true, expected: 1 },
                { remaining: 2, discounted: false, expected: 2 },
                { remaining: 1, discounted: true, expected: 0 },
                { remaining: null, discounted: true, expected: null }
            ] as const;
            const redemptions: { id: string; expected: number | null }[] = [];
            for (const [index, item] of cases.entries()) {
                const fixture = await paymentFixture();
                const [code] = await getServiceTestDb()
                    .insert(promoCodes)
                    .values({
                        code: `PAYMENT-${crypto.randomUUID()}`,
                        discountKind: 'PERCENTAGE',
                        value: 10,
                        allVerticals: true,
                        verticals: null,
                        totalQuota: 10,
                        validFrom: new Date('2026-01-01T00:00:00.000Z'),
                        validUntil: new Date('2027-01-01T00:00:00.000Z'),
                        stackable: false,
                        usableWithAnotherActive: false,
                        durationKind: 'N_CHARGES',
                        durationCharges: 3
                    })
                    .returning();
                const [redemption] = await getServiceTestDb()
                    .insert(promoRedemptions)
                    .values({
                        promoCodeId: code!.id,
                        userId: fixture.user.id,
                        subscriptionId: fixture.started.subscriptionId,
                        redeemedAt: fixture.clock.now(),
                        remainingCharges: item.remaining
                    })
                    .returning();
                redemptions.push({ id: redemption!.id, expected: item.expected });
                const [pending] = await getServiceTestDb()
                    .insert(payments)
                    .values({
                        subscriptionId: fixture.started.subscriptionId,
                        amount: 250000,
                        currency: 'ARS',
                        status: 'PENDING',
                        provider: fixture.link.provider,
                        providerFactId: `promo-${crypto.randomUUID()}`,
                        factAt: new Date(fixture.clock.now().getTime() + index * 60_000)
                    })
                    .returning();
                const checks: string[] = [];
                const exhausted: string[] = [];
                await creditPayment(
                    {
                        paymentId: pending!.id,
                        chargeCreatedAt: new Date(fixture.clock.now().getTime() + index * 60_000)
                    },
                    {
                        clock: fixture.clock,
                        promoCharges: {
                            chargedWithDiscount: async ({ redemptionId }) => {
                                checks.push(redemptionId);
                                return item.discounted;
                            }
                        },
                        promoExhaustion: {
                            runS30: async ({ redemptionId }) => {
                                const committed = (
                                    await getServiceTestPool().query<{
                                        status: string;
                                    }>('SELECT status FROM payment WHERE id = $1', [pending!.id])
                                ).rows[0];
                                expect(committed?.status).toBe('SUCCEEDED');
                                exhausted.push(redemptionId);
                            }
                        }
                    }
                );
                const [after] = await getServiceTestDb()
                    .select({ remainingCharges: promoRedemptions.remainingCharges })
                    .from(promoRedemptions)
                    .where(eq(promoRedemptions.id, redemption!.id));
                expect(after?.remainingCharges).toBe(item.expected);
                expect(checks).toEqual(item.remaining === null ? [] : [redemption!.id]);
                expect(exhausted).toEqual(
                    item.remaining === 1 && item.discounted ? [redemption!.id] : []
                );
            }
            expect(redemptions).toHaveLength(cases.length);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 fails a rejected first charge by P8 and delegates S16 without P1 effects',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'declined'
            });
            const result = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(result.outcome).toBe('DECLINED');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            // AC:1734:1 — P8 fails the rejected first charge after S16.
            expect(payment).toMatchObject({ status: 'FAILED', version: 2 });
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(subscription?.status).toBe('CHARGE_DECLINED');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment!.id))
            ).toHaveLength(0);
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mail.filter((row) => row.template === 'billing.payment-credited')).toHaveLength(
                0
            );
        }
    );
});
