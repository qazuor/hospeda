import { PaymentStatusEnum } from '@repo/schemas';
import { and, desc, eq, gte, isNull, lte, sum } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { payments } from '../../schemas/payment/payment.dbschema';
import { refunds } from '../../schemas/payment/refund.dbschema';

type Refund = typeof refunds.$inferSelect;

export class RefundModel extends BaseModel<Refund> {
    protected table = refunds;
    protected entityName = 'refund';

    protected getTableName(): string {
        return 'refunds';
    }

    /**
     * Process refund for a payment
     */
    async processRefund(
        paymentId: string,
        amount: number,
        reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Refund | null> {
        const db = this.getClient(tx);

        // Validate payment exists and can be refunded
        const payment = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                status: payments.status
            })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (!payment[0]) {
            throw new Error('PAYMENT_NOT_FOUND');
        }

        // Check if payment can be refunded
        if (
            ![PaymentStatusEnum.APPROVED, PaymentStatusEnum.AUTHORIZED].includes(
                payment[0].status as PaymentStatusEnum
            )
        ) {
            throw new Error('PAYMENT_NOT_REFUNDABLE');
        }

        // Check if refund amount is valid
        const paymentAmount = Number(payment[0].amount);
        if (amount <= 0 || amount > paymentAmount) {
            throw new Error('INVALID_REFUND_AMOUNT');
        }

        // Check if there's enough remaining amount to refund
        const totalRefunded = await this.getTotalRefundedForPayment(paymentId, tx);
        const remainingAmount = paymentAmount - totalRefunded;

        if (amount > remainingAmount) {
            throw new Error('REFUND_AMOUNT_EXCEEDS_REMAINING');
        }

        // Convert amount to minor units (cents)
        const amountMinor = Math.round(amount * 100);

        // Create refund record
        const result = await db
            .insert(refunds)
            .values({
                paymentId,
                amountMinor,
                reason,
                refundedAt: new Date()
            })
            .returning();

        return (result[0] as Refund) || null;
    }

    /**
     * Find refunds by payment
     */
    async findByPayment(paymentId: string, tx?: NodePgDatabase<typeof schema>): Promise<Refund[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(refunds)
            .where(eq(refunds.paymentId, paymentId))
            .orderBy(desc(refunds.createdAt))
            .limit(100);

        return result as Refund[];
    }

    /**
     * Calculate refundable amount for payment
     */
    async calculateRefundable(
        paymentId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);

        // Get payment amount
        const payment = await db
            .select({ amount: payments.amount })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (!payment[0]) {
            return 0;
        }

        const paymentAmount = Number(payment[0].amount);
        const totalRefunded = await this.getTotalRefundedForPayment(paymentId, tx);

        return Math.max(0, paymentAmount - totalRefunded);
    }

    /**
     * Get total refunded amount for payment
     */
    async getTotalRefundedForPayment(
        paymentId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);

        const result = await db
            .select({ totalMinor: sum(refunds.amountMinor) })
            .from(refunds)
            .where(eq(refunds.paymentId, paymentId));

        const totalMinor = Number(result[0]?.totalMinor) || 0;
        return totalMinor / 100; // Convert from minor units to major units
    }

    /**
     * Check if payment can be refunded
     */
    async canRefund(
        paymentId: string,
        amount?: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<boolean> {
        const db = this.getClient(tx);

        // Check payment status
        const payment = await db
            .select({ status: payments.status, amount: payments.amount })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (!payment[0]) {
            return false;
        }

        // Check if payment status allows refunds
        if (
            ![PaymentStatusEnum.APPROVED, PaymentStatusEnum.AUTHORIZED].includes(
                payment[0].status as PaymentStatusEnum
            )
        ) {
            return false;
        }

        // If specific amount is provided, check if it's refundable
        if (amount !== undefined) {
            const refundableAmount = await this.calculateRefundable(paymentId, tx);
            return amount > 0 && amount <= refundableAmount;
        }

        return true;
    }

    /**
     * Validate refund amount
     */
    async validateRefundAmount(
        paymentId: string,
        amount: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ valid: boolean; reason?: string; refundableAmount?: number }> {
        if (amount <= 0) {
            return { valid: false, reason: 'AMOUNT_MUST_BE_POSITIVE' };
        }

        const refundableAmount = await this.calculateRefundable(paymentId, tx);

        if (amount > refundableAmount) {
            return {
                valid: false,
                reason: 'AMOUNT_EXCEEDS_REFUNDABLE',
                refundableAmount: refundableAmount
            };
        }

        return { valid: true };
    }

    /**
     * Check refund policy
     */
    async checkRefundPolicy(
        paymentId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ allowed: boolean; reason?: string }> {
        const db = this.getClient(tx);

        // Get payment creation date
        const payment = await db
            .select({ createdAt: payments.createdAt, status: payments.status })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

        if (!payment[0]) {
            return { allowed: false, reason: 'PAYMENT_NOT_FOUND' };
        }

        // Check if payment is in refundable status
        if (
            ![PaymentStatusEnum.APPROVED, PaymentStatusEnum.AUTHORIZED].includes(
                payment[0].status as PaymentStatusEnum
            )
        ) {
            return { allowed: false, reason: 'PAYMENT_STATUS_NOT_REFUNDABLE' };
        }

        // Check refund time limit (e.g., 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (payment[0].createdAt < thirtyDaysAgo) {
            return { allowed: false, reason: 'REFUND_PERIOD_EXPIRED' };
        }

        return { allowed: true };
    }

    /**
     * Get refund with payment data
     */
    async withPayment(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<(Refund & { payment: typeof payments.$inferSelect }) | null> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(refunds)
            .innerJoin(payments, eq(refunds.paymentId, payments.id))
            .where(eq(refunds.id, id))
            .limit(1);

        if (!result[0]) {
            return null;
        }

        return {
            ...result[0].refunds,
            payment: result[0].payments
        } as Refund & { payment: typeof payments.$inferSelect };
    }

    /**
     * Get refund amount in major currency units
     */
    getAmountFromMinor(refund: Refund): number {
        return refund.amountMinor / 100;
    }

    /**
     * Get refunds within date range
     */
    async findByDateRange(
        startDate: Date,
        endDate: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Refund[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(refunds)
            .where(
                and(
                    isNull(refunds.deletedAt),
                    gte(refunds.refundedAt, startDate),
                    lte(refunds.refundedAt, endDate)
                )
            )
            .orderBy(desc(refunds.refundedAt))
            .limit(1000);

        return result as Refund[];
    }

    /**
     * Get refund statistics for payment
     */
    async getRefundStats(
        paymentId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{
        totalRefunded: number;
        refundCount: number;
        remainingRefundable: number;
    }> {
        const totalRefunded = await this.getTotalRefundedForPayment(paymentId, tx);
        const remainingRefundable = await this.calculateRefundable(paymentId, tx);

        const refundsList = await this.findByPayment(paymentId, tx);
        const refundCount = refundsList.length;

        return {
            totalRefunded,
            refundCount,
            remainingRefundable
        };
    }

    /**
     * Reverse/cancel a refund (if supported by provider)
     */
    async reverseRefund(
        id: string,
        reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Refund | null> {
        const db = this.getClient(tx);

        // In a real implementation, this would also call the payment provider
        // to reverse the refund. For now, we'll mark it as soft-deleted.

        const result = await db
            .update(refunds)
            .set({
                deletedAt: new Date(),
                updatedAt: new Date(),
                adminInfo: {
                    notes: reason ? `Reversed: ${reason}` : 'Refund reversed',
                    favorite: false
                }
            })
            .where(eq(refunds.id, id))
            .returning();

        return (result[0] as Refund) || null;
    }
}
