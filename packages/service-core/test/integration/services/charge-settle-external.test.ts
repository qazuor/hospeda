import { coveredPeriods, eq, payments, providerLinks, receipts, subscriptions } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { settleExternalCharge } from '../../../src/services/billing/payment/settle-external-charge.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    coverageOfPayment,
    paymentFactsOf,
    receiptsOfPayment,
    retireChargeSettlementRows,
    unrecordedApprovedCharge
} from './support/charge-settle-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireChargeSettlementRows);

const admin = (): Actor => ({
    id: crypto.randomUUID(),
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
});
const portsFor = (fixture: Awaited<ReturnType<typeof unrecordedApprovedCharge>>['fixture']) => ({
    provider: fixture.provider,
    clock: fixture.clock,
    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
    coverageNotices: { emitCoverageChanged: async () => undefined }
});

describe('TEST:B5:6 AC:B5:11 admin action 14 settles an unrecorded charge (motive 19)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a) P1 creates the payment, coverage, receipt, and post-commit notice',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            const statusesAtNotice: string[] = [];
            const ports = {
                ...portsFor(seeded.fixture),
                coverageNotices: {
                    emitCoverageChanged: async () => {
                        const rows = await getServiceTestDb()
                            .select({ status: payments.status })
                            .from(payments)
                            .where(eq(payments.providerFactId, seeded.chargeId));
                        statusesAtNotice.push(rows[0]?.status ?? 'MISSING');
                    }
                }
            };

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: seeded.chargeId },
                ports
            );

            // Assert
            expect(result).toMatchObject({
                credit: 'CREDITED',
                coverage: 'WRITTEN',
                reception: 'P1'
            });
            const facts = await paymentFactsOf(seeded.chargeId);
            expect(facts).toHaveLength(1);
            expect(facts[0]).toMatchObject({ id: result.paymentId, status: 'SUCCEEDED' });
            expect(facts[0]?.factAt).toEqual(seeded.createdAt);
            expect(await coverageOfPayment(result.paymentId)).toHaveLength(1);
            const receiptRows = await receiptsOfPayment(result.paymentId);
            expect(receiptRows).toHaveLength(1);
            expect(receiptRows[0]?.receiptNumber).toBeGreaterThan(0);
            expect(statusesAtNotice).toEqual(['SUCCEEDED']);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b) an existing PENDING fact is credited in place',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: seeded.fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: seeded.fixture.link.provider,
                    providerFactId: seeded.chargeId,
                    factAt: seeded.createdAt
                })
                .returning();
            if (!pending) throw new Error('Pending payment missing');

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: seeded.chargeId },
                portsFor(seeded.fixture)
            );

            // Assert
            const facts = await paymentFactsOf(seeded.chargeId);
            expect(result.paymentId).toBe(pending.id);
            expect(facts).toHaveLength(1);
            expect(facts[0]).toMatchObject({ id: pending.id, status: 'SUCCEEDED' });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c) a repeated settlement rejects without duplicating payment or receipt',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            const actor = admin();
            const ports = portsFor(seeded.fixture);
            const first = await settleExternalCharge({ actor, chargeId: seeded.chargeId }, ports);

            // Act / Assert
            await expect(
                settleExternalCharge({ actor, chargeId: seeded.chargeId }, ports)
            ).rejects.toMatchObject({ code: 'ALREADY_EXISTS', reason: 'CHARGE_ALREADY_RECORDED' });
            expect(await paymentFactsOf(seeded.chargeId)).toHaveLength(1);
            expect(await receiptsOfPayment(first.paymentId)).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(d) a rejected charge cannot enter grace or create a payment',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            const { chargeId } = await seeded.fixture.provider.declineCharge({
                authorizationId: seeded.fixture.started.authorizationId,
                declineReason: 'issuer declined'
            });
            const [before] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));

            // Act / Assert
            await expect(
                settleExternalCharge({ actor: admin(), chargeId }, portsFor(seeded.fixture))
            ).rejects.toMatchObject({ code: 'ALREADY_EXISTS', reason: 'CHARGE_NOT_APPROVED' });
            expect(await paymentFactsOf(chargeId)).toHaveLength(0);
            const [after] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(after?.status).toBe(before?.status);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(e) card validation and fully refunded charges are not settleable',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge({ withCardValidation: true });
            const validation = await seeded.fixture.provider.changeCard({
                authorizationId: seeded.fixture.started.authorizationId,
                passes: true
            });
            if (!validation) throw new Error('Fake card validation was not available');
            const fullRefund = await seeded.fixture.provider.charge({
                authorizationId: seeded.fixture.started.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.fixture.started.subscriptionId
            });
            await seeded.fixture.provider.refund({
                chargeId: fullRefund.chargeId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: `full-${crypto.randomUUID()}`
            });

            // Act / Assert
            for (const chargeId of [validation.chargeId, fullRefund.chargeId]) {
                await expect(
                    settleExternalCharge({ actor: admin(), chargeId }, portsFor(seeded.fixture))
                ).rejects.toMatchObject({
                    code: 'VALIDATION_ERROR',
                    reason: 'CHARGE_NOT_SETTLEABLE'
                });
                expect(await paymentFactsOf(chargeId)).toHaveLength(0);
            }
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(f) unknown and unlinked charge ids reject before insertion',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            await getServiceTestDb()
                .delete(providerLinks)
                .where(eq(providerLinks.subscriptionId, seeded.fixture.started.subscriptionId));

            // Act / Assert
            await expect(
                settleExternalCharge(
                    { actor: admin(), chargeId: 'unknown-charge-id' },
                    portsFor(seeded.fixture)
                )
            ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'CHARGE_NOT_FOUND' });
            await expect(
                settleExternalCharge(
                    { actor: admin(), chargeId: seeded.chargeId },
                    portsFor(seeded.fixture)
                )
            ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'CHARGE_NOT_LINKED' });
            expect(await paymentFactsOf(seeded.chargeId)).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(g) neighboring permission, system actor, and subscription owner are forbidden before writes',
        async () => {
            // Arrange
            const seeded = await unrecordedApprovedCharge();
            const actors: Actor[] = [
                {
                    id: crypto.randomUUID(),
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
                },
                {
                    id: crypto.randomUUID(),
                    roles: [RoleEnum.SYSTEM],
                    permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL],
                    _isSystemActor: true
                },
                {
                    id: seeded.fixture.user.id,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
                }
            ];

            // Act / Assert
            for (const actor of actors) {
                await expect(
                    settleExternalCharge(
                        { actor, chargeId: seeded.chargeId },
                        portsFor(seeded.fixture)
                    )
                ).rejects.toMatchObject({
                    code: 'FORBIDDEN',
                    reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
                });
                expect(await paymentFactsOf(seeded.chargeId)).toHaveLength(0);
                expect(
                    await getServiceTestDb()
                        .select({ id: receipts.id })
                        .from(receipts)
                        .innerJoin(payments, eq(payments.id, receipts.paymentId))
                        .where(eq(payments.providerFactId, seeded.chargeId))
                ).toHaveLength(0);
                expect(
                    await getServiceTestDb()
                        .select({ id: coveredPeriods.id })
                        .from(coveredPeriods)
                        .innerJoin(payments, eq(payments.id, coveredPeriods.paymentId))
                        .where(eq(payments.providerFactId, seeded.chargeId))
                ).toHaveLength(0);
            }
        }
    );
});
