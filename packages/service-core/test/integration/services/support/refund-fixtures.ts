import {
    coveredPeriods,
    eq,
    manualPayments,
    payments,
    refunds,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { creditPayment } from '../../../../src/services/billing/payment/credit-payment.service.js';
import {
    type SettleExternalRefundInput,
    settleExternalRefund
} from '../../../../src/services/billing/refund/settle-external-refund.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { paymentFixture } from './payment-fixtures.js';

/** A payment credited through P1, with its `covered_period` (molde of TEST:B5:4). */
export async function creditedPayment(amount = 10000) {
    const fixture = await paymentFixture();
    const [pending] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `b53-refund-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!pending) throw new Error('refund fixture payment missing');
    await creditPayment(
        { paymentId: pending.id, chargeCreatedAt: fixture.clock.now() },
        { clock: fixture.clock }
    );
    return { fixture, payment: pending };
}

/** A pending (not credited) payment on a fresh subscription. */
export async function pendingPayment(amount = 10000) {
    const fixture = await paymentFixture();
    const [pending] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `b53-pending-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!pending) throw new Error('refund fixture pending payment missing');
    return { fixture, payment: pending };
}

/** A manual payment in the given status; a REGISTERED one gets its open `covered_period`. */
export async function manualPaymentWithCoverage(status: 'REGISTERED' | 'AWAITING' = 'REGISTERED') {
    const fixture = await paymentFixture();
    const registered = status === 'REGISTERED';
    const [manual] = await getServiceTestDb()
        .insert(manualPayments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            periodStart: new Date('2027-03-01T03:00:00.000Z'),
            status,
            registeredBy: registered ? fixture.user.id : null,
            registeredAt: registered ? fixture.clock.now() : null
        })
        .returning();
    if (!manual) throw new Error('refund fixture manual payment missing');
    let coverageId: string | null = null;
    if (registered) {
        const [coverage] = await getServiceTestDb()
            .insert(coveredPeriods)
            .values({
                subscriptionId: fixture.started.subscriptionId,
                periodStart: manual.periodStart,
                manualPaymentId: manual.id,
                creditedAt: fixture.clock.now()
            })
            .returning();
        coverageId = coverage?.id ?? null;
    }
    return { fixture, manual, coverageId };
}

/** Seed a user to act as the admin of action 14 (settled_by is a FK to users). */
export async function seedAdminActor(
    permissions: readonly PermissionEnum[] = [PermissionEnum.BILLING_SETTLE_EXTERNAL]
): Promise<Actor> {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `b53-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'B5.3 admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('refund fixture admin missing');
    return { id: user.id, roles: [RoleEnum.ADMIN], permissions: [...permissions] };
}

/** Every refund row of one provider payment, oldest first. */
export async function refundsOfPayment(paymentId: string) {
    return getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.paymentId, paymentId))
        .orderBy(refunds.createdAt, refunds.id);
}

/** Every refund row of one manual payment. */
export async function refundsOfManualPayment(manualPaymentId: string) {
    return getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.manualPaymentId, manualPaymentId));
}

/** One refund row by id. */
export async function refundById(id: string) {
    const [row] = await getServiceTestDb().select().from(refunds).where(eq(refunds.id, id));
    return row;
}

/** The payment row (status, accumulation, version). */
export async function paymentRow(paymentId: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId));
    return row;
}

/** The state RF1 must not move: payment, subscription and coverage of one payment. */
export async function moneySnapshot(input: {
    readonly paymentId?: string;
    readonly manualPaymentId?: string;
    readonly subscriptionId: string;
}) {
    const db = getServiceTestDb();
    const payment = input.paymentId
        ? (
              await db
                  .select({
                      status: payments.status,
                      refundedAmount: payments.refundedAmount,
                      version: payments.version,
                      updatedAt: payments.updatedAt
                  })
                  .from(payments)
                  .where(eq(payments.id, input.paymentId))
          )[0]
        : null;
    const manual = input.manualPaymentId
        ? (
              await db
                  .select({ status: manualPayments.status, updatedAt: manualPayments.updatedAt })
                  .from(manualPayments)
                  .where(eq(manualPayments.id, input.manualPaymentId))
          )[0]
        : null;
    const [subscription] = await db
        .select({ status: subscriptions.status, updatedAt: subscriptions.updatedAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
    const coverage = await db
        .select({ id: coveredPeriods.id, releasedAt: coveredPeriods.releasedAt })
        .from(coveredPeriods)
        .where(eq(coveredPeriods.subscriptionId, input.subscriptionId))
        .orderBy(coveredPeriods.id);
    return { payment, manual, subscription, coverage };
}

/** A credited payment fixture as returned by `creditedPayment`. */
export type CreditedPayment = Awaited<ReturnType<typeof creditedPayment>>;

/** RF4 on a credited payment: 10000 by bank transfer unless overridden. */
export function settleOnPayment(
    actor: Actor,
    credited: CreditedPayment,
    overrides: Partial<SettleExternalRefundInput> = {}
) {
    return settleExternalRefund(
        {
            actor,
            source: { kind: 'PAYMENT', id: credited.payment.id },
            amount: 10000,
            channel: 'BANK_TRANSFER',
            reference: `op-${crypto.randomUUID()}`,
            reason: 'OUT_OF_FLOW_REFUND',
            ...overrides
        },
        { clock: credited.fixture.clock }
    );
}
