import { type PaymentProviderEnum, PaymentStatusEnum } from '@repo/schemas';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { invoices } from '../../schemas/payment/invoice.dbschema';
import { payments } from '../../schemas/payment/payment.dbschema';

type Payment = typeof payments.$inferSelect;

export class PaymentModel extends BaseModel<Payment> {
    protected table = payments;
    protected entityName = 'payment';

    protected getTableName(): string {
        return 'payments';
    }

    /**
     * Process payment with provider
     */
    async processWithProvider(
        data: {
            invoiceId: string;
            amount: number;
            currency?: string;
            provider: PaymentProviderEnum;
            providerPaymentId?: string;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const { invoiceId, amount, currency = 'USD', provider, providerPaymentId } = data;

        // Validate invoice exists
        const invoice = await db
            .select({ id: invoices.id })
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .limit(1);

        if (!invoice[0]) {
            throw new Error('INVOICE_NOT_FOUND');
        }

        // Create payment record
        const result = await db
            .insert(payments)
            .values({
                invoiceId,
                amount: amount.toString(),
                currency,
                provider,
                status: PaymentStatusEnum.PENDING,
                providerPaymentId
            })
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Handle webhook from payment provider
     */
    async handleWebhook(
        providerPaymentId: string,
        newStatus: PaymentStatusEnum,
        _webhookData?: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        // Find payment by provider ID
        const payment = await db
            .select()
            .from(payments)
            .where(eq(payments.providerPaymentId, providerPaymentId))
            .limit(1);

        if (!payment[0]) {
            throw new Error('PAYMENT_NOT_FOUND');
        }

        // Update payment status
        const updateData: Partial<Payment> = {
            status: newStatus,
            updatedAt: new Date()
        };

        // Set paidAt if payment is approved
        if (newStatus === PaymentStatusEnum.APPROVED) {
            updateData.paidAt = new Date();
        }

        // Note: Webhook data would be stored in a separate audit table in production

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, payment[0].id))
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Sync payment status with provider
     */
    async syncStatus(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Payment | null> {
        const db = this.getClient(tx);

        // In a real implementation, this would call the payment provider API
        // For now, we'll just update the timestamp
        const updateData: Partial<Payment> = {
            updatedAt: new Date()
        };

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Find payments by invoice
     */
    async findByInvoice(invoiceId: string, tx?: NodePgDatabase<typeof schema>): Promise<Payment[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return result as Payment[];
    }

    /**
     * Find payments by provider
     */
    async findByProvider(
        provider: PaymentProviderEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .where(eq(payments.provider, provider))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return result as Payment[];
    }

    /**
     * Find pending payments
     */
    async findPending(tx?: NodePgDatabase<typeof schema>): Promise<Payment[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .where(eq(payments.status, PaymentStatusEnum.PENDING))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return result as Payment[];
    }

    /**
     * Mark payment as approved
     */
    async markApproved(
        id: string,
        paidAt?: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const result = await db
            .update(payments)
            .set({
                status: PaymentStatusEnum.APPROVED,
                paidAt: paidAt || new Date(),
                updatedAt: new Date()
            })
            .where(eq(payments.id, id))
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Mark payment as rejected
     */
    async markRejected(
        id: string,
        _reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const updateData: Partial<Payment> = {
            status: PaymentStatusEnum.REJECTED,
            updatedAt: new Date()
        };

        // Note: In production, rejection reason would be stored in audit table

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Retry failed payment
     */
    async retryPayment(
        id: string,
        newProviderPaymentId?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        // Check if payment can be retried
        const payment = await db
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.id, id))
            .limit(1);

        if (!payment[0]) {
            throw new Error('PAYMENT_NOT_FOUND');
        }

        if (
            ![PaymentStatusEnum.REJECTED, PaymentStatusEnum.CANCELLED].includes(
                payment[0].status as PaymentStatusEnum
            )
        ) {
            throw new Error('PAYMENT_CANNOT_BE_RETRIED');
        }

        const updateData: Partial<Payment> = {
            status: PaymentStatusEnum.PENDING,
            updatedAt: new Date()
        };

        if (newProviderPaymentId) {
            updateData.providerPaymentId = newProviderPaymentId;
        }

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return (result[0] as Payment) || null;
    }

    /**
     * Check if payment is successful
     */
    async isSuccessful(id: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const payment = await db
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.id, id))
            .limit(1);

        if (!payment[0]) {
            return false;
        }

        return [PaymentStatusEnum.APPROVED, PaymentStatusEnum.AUTHORIZED].includes(
            payment[0].status as PaymentStatusEnum
        );
    }

    /**
     * Check if payment is pending
     */
    async isPending(id: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const payment = await db
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.id, id))
            .limit(1);

        if (!payment[0]) {
            return false;
        }

        return [
            PaymentStatusEnum.PENDING,
            PaymentStatusEnum.IN_PROCESS,
            PaymentStatusEnum.IN_MEDIATION
        ].includes(payment[0].status as PaymentStatusEnum);
    }

    /**
     * Check if payment can be refunded
     */
    async canBeRefunded(id: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const payment = await db
            .select({ status: payments.status, amount: payments.amount })
            .from(payments)
            .where(eq(payments.id, id))
            .limit(1);

        if (!payment[0]) {
            return false;
        }

        // Can only refund approved/authorized payments
        if (
            ![PaymentStatusEnum.APPROVED, PaymentStatusEnum.AUTHORIZED].includes(
                payment[0].status as PaymentStatusEnum
            )
        ) {
            return false;
        }

        // TODO: Check if there are already refunds and calculate remaining refundable amount
        return true;
    }

    /**
     * Get total successful payments for invoice
     */
    async getTotalSuccessfulForInvoice(
        invoiceId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);

        const successfulPayments = await db
            .select()
            .from(payments)
            .where(
                and(
                    eq(payments.invoiceId, invoiceId),
                    ne(payments.status, PaymentStatusEnum.REJECTED),
                    ne(payments.status, PaymentStatusEnum.CANCELLED)
                )
            );

        return successfulPayments.reduce((total, payment) => {
            return total + Number(payment.amount);
        }, 0);
    }

    /**
     * Get payment with invoice data
     */
    async withInvoice(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<(Payment & { invoice: typeof invoices.$inferSelect }) | null> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(eq(payments.id, id))
            .limit(1);

        if (!result[0]) {
            return null;
        }

        return {
            ...result[0].payments,
            invoice: result[0].invoices
        } as Payment & { invoice: typeof invoices.$inferSelect };
    }

    /**
     * Cancel payment
     */
    async cancel(
        id: string,
        _reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const updateData: Partial<Payment> = {
            status: PaymentStatusEnum.CANCELLED,
            updatedAt: new Date()
        };

        // Note: In production, cancellation reason would be stored in audit table

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return (result[0] as Payment) || null;
    }
}
