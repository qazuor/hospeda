import {
    coveredPeriods,
    emailOutbox,
    eq,
    manualPayments,
    payments,
    providerLinks,
    receipts,
    subscriptions,
    users
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { nextReceiptNumber } from '../../../src/services/billing/payment/issue-receipt.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

describe('TEST:B5:1 P1 receipt', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 stores the payer copy and links the credited email',
        async () => {
            const fixture = await paymentFixture();
            await getServiceTestDb()
                .update(users)
                .set({ firstName: 'Ada', lastName: 'Lovelace', displayName: 'A. Lovelace' })
                .where(eq(users.id, fixture.user.id));
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
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
            expect(result.outcome).toBe('CREDITED');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            const [receipt] = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, payment!.id));
            expect(receipt).toMatchObject({
                payerName: 'Ada Lovelace',
                payerEmail: fixture.user.email
            });
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            const creditedMail = mail.find(
                (row) =>
                    row.template === 'billing.payment-credited' &&
                    (row.payload as { paymentId?: string }).paymentId === payment!.id
            );
            expect(creditedMail?.payload).toMatchObject({
                receiptId: receipt!.id,
                receiptNumber: receipt!.receiptNumber
            });
            await getServiceTestDb()
                .update(users)
                .set({
                    firstName: 'Changed',
                    lastName: 'Person',
                    displayName: 'Changed',
                    email: `changed-${crypto.randomUUID()}@example.test`
                })
                .where(eq(users.id, fixture.user.id));
            const [after] = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.id, receipt!.id));
            expect(after).toMatchObject({
                payerName: 'Ada Lovelace',
                payerEmail: fixture.user.email
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 anonymized payer receives a nameless receipt and no email',
        async () => {
            const fixture = await paymentFixture();
            await getServiceTestDb()
                .update(users)
                .set({
                    firstName: 'Deleted',
                    lastName: 'Account',
                    displayName: 'Deleted',
                    email: `deleted-${crypto.randomUUID()}@example.test`,
                    deletedAt: fixture.clock.now()
                })
                .where(eq(users.id, fixture.user.id));
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 100,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `deleted-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            const [paid] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(paid?.status).toBe('SUCCEEDED');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, pending!.id))
            ).toHaveLength(1);
            const [receipt] = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, pending!.id));
            expect(receipt).toMatchObject({ payerName: null, payerEmail: null });
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(
                mail.filter(
                    (row) =>
                        row.template === 'billing.payment-credited' &&
                        (row.payload as { paymentId?: string }).paymentId === pending!.id
                )
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 tombstone credit emits only a nameless receipt',
        async () => {
            const fixture = await paymentFixture();
            const { subscriptionId, paymentId } = await getServiceTestDb().transaction(
                async (tx) => {
                    const [subscription] = await tx
                        .insert(subscriptions)
                        .values({ status: 'CANCELLED', class: 'LAPIDA' })
                        .returning();
                    await tx.insert(providerLinks).values({
                        subscriptionId: subscription!.id,
                        provider: 'MERCADO_PAGO',
                        providerId: `tombstone-${crypto.randomUUID()}`
                    });
                    const [payment] = await tx
                        .insert(payments)
                        .values({
                            subscriptionId: subscription!.id,
                            amount: 100,
                            currency: 'ARS',
                            status: 'PENDING',
                            provider: 'MERCADO_PAGO',
                            providerFactId: `tombstone-${crypto.randomUUID()}`,
                            factAt: fixture.clock.now()
                        })
                        .returning();
                    return { subscriptionId: subscription!.id, paymentId: payment!.id };
                }
            );
            await creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            const [paid] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, paymentId));
            expect(paid?.status).toBe('SUCCEEDED');
            const [receipt] = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, paymentId));
            expect(receipt).toMatchObject({ payerName: null, payerEmail: null });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.subscriptionId, subscriptionId))
            ).toHaveLength(0);
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mail.filter((row) => row.template === 'billing.payment-credited')).toHaveLength(
                0
            );
            expect(fixture.coverageEvents).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 emits an addon receipt and email for its owner',
        async () => {
            const fixture = await paymentFixture();
            const ids = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon (slug, name) VALUES ($1, 'Receipt addon') RETURNING id",
                    [`receipt-addon-${crypto.randomUUID()}`]
                )
            ).rows[0]?.id;
            const version = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_version (addon_id, validity, validity_days, scope_type) VALUES ($1, 'FIXED_DAYS', 30, 'USER') RETURNING id",
                    [ids]
                )
            ).rows[0]?.id;
            const product = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_product (version_id, addon_id, price, currency, charge_kind, compatible_verticals) VALUES ($1, $2, 100, 'ARS', 'UNA_VEZ', ARRAY['accommodation']) RETURNING id",
                    [version, ids]
                )
            ).rows[0]?.id;
            const instance = (
                await getServiceTestPool().query<{ id: string }>(
                    "INSERT INTO addon_instance (product_id, addon_version_id, owner_id, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id",
                    [product, version, fixture.user.id]
                )
            ).rows[0]?.id;
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    addonInstanceId: instance!,
                    amount: 100,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `addon-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            const [receipt] = await getServiceTestDb()
                .select()
                .from(receipts)
                .where(eq(receipts.paymentId, pending!.id));
            expect(receipt).toMatchObject({
                payerName: 'Payment test',
                payerEmail: fixture.user.email
            });
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(
                mail.find(
                    (row) =>
                        row.template === 'billing.payment-credited' &&
                        (row.payload as { paymentId?: string }).paymentId === pending!.id
                )?.payload
            ).toMatchObject({ addonInstanceId: instance, receiptId: receipt!.id });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 is idempotent, serializes concurrent receipts and rolls back counter savepoints',
        async () => {
            const fixture = await paymentFixture();
            const paymentRows = await Promise.all(
                Array.from({ length: 5 }, async () => {
                    const [row] = await getServiceTestDb()
                        .insert(payments)
                        .values({
                            subscriptionId: fixture.started.subscriptionId,
                            amount: 100,
                            currency: 'ARS',
                            status: 'PENDING',
                            provider: fixture.link.provider,
                            providerFactId: `concurrent-${crypto.randomUUID()}`,
                            factAt: fixture.clock.now()
                        })
                        .returning();
                    await creditPayment(
                        { paymentId: row!.id, chargeCreatedAt: fixture.clock.now() },
                        { clock: fixture.clock }
                    );
                    return row!;
                })
            );
            const numbers: number[] = [];
            for (const payment of paymentRows) {
                const [receipt] = await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id));
                expect(receipt).toBeDefined();
                numbers.push(receipt!.receiptNumber);
                await creditPayment(
                    { paymentId: payment.id, chargeCreatedAt: fixture.clock.now() },
                    { clock: fixture.clock }
                );
                expect(
                    await getServiceTestDb()
                        .select()
                        .from(receipts)
                        .where(eq(receipts.paymentId, payment.id))
                ).toHaveLength(1);
                const recipientMail = await getServiceTestDb()
                    .select()
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, fixture.user.id));
                expect(
                    recipientMail.filter(
                        (row) =>
                            row.template === 'billing.payment-credited' &&
                            (row.payload as { paymentId?: string }).paymentId === payment.id
                    )
                ).toHaveLength(1);
            }
            expect(new Set(numbers).size).toBe(5);
            await getServiceTestDb().transaction(async (tx) => {
                const first = await nextReceiptNumber({ tx });
                await expect(
                    tx.transaction(async (savepoint) => {
                        await nextReceiptNumber({ tx: savepoint });
                        throw new Error('rollback counter savepoint');
                    })
                ).rejects.toThrow('rollback counter savepoint');
                expect(await nextReceiptNumber({ tx })).toBe(first + 1);
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:1 rolls the receipt back when duplicate-period marking fails',
        async () => {
            const fixture = await paymentFixture();
            const [manual] = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: fixture.clock.now(),
                    status: 'REGISTERED',
                    registeredBy: fixture.user.id,
                    registeredAt: fixture.clock.now()
                })
                .returning();
            await getServiceTestDb().insert(coveredPeriods).values({
                subscriptionId: fixture.started.subscriptionId,
                periodStart: fixture.clock.now(),
                manualPaymentId: manual!.id,
                creditedAt: fixture.clock.now()
            });
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 100,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `receipt-atomic-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            await expect(
                creditPayment(
                    { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                    {
                        clock: fixture.clock,
                        markPayments: {
                            hang: async () => {
                                throw new Error('receipt atomicity failure');
                            },
                            countUnresolved: async () => 0
                        }
                    }
                )
            ).rejects.toThrow('receipt atomicity failure');
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(after?.status).toBe('PENDING');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, pending!.id))
            ).toHaveLength(0);
        }
    );
});
