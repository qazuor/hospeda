import type { Payment, PaymentTypeEnum } from '@repo/schemas';
import { PaymentStatusEnum } from '@repo/schemas';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { pricingPlans } from '../../schemas/catalog/pricingPlan.dbschema';
import type * as schema from '../../schemas/index.js';
import { invoices } from '../../schemas/payment/invoice.dbschema';
import { payments } from '../../schemas/payment/payment.dbschema';
import { users } from '../../schemas/user/user.dbschema';

export class PaymentModel extends BaseModel<Payment> {
    protected table = payments;
    protected entityName = 'payment';

    protected getTableName(): string {
        return 'payments';
    }

    /**
     * Transform DB result to Payment type (converts amount from string to number)
     */
    private transformToPayment(dbResult: typeof payments.$inferSelect): Payment {
        return {
            ...dbResult,
            amount: dbResult.amount
        } as Payment;
    }

    /**
     * Transform array of DB results to Payment array
     */
    private transformToPayments(dbResults: (typeof payments.$inferSelect)[]): Payment[] {
        return dbResults.map((result) => this.transformToPayment(result));
    }

    /**
     * Create payment for user and plan
     */
    async createPayment(
        data: {
            userId: string;
            paymentPlanId: string | null;
            type: PaymentTypeEnum;
            amount: number;
            currency?: string;
            paymentMethod?: string;
            mercadoPagoPaymentId?: string;
            description?: string;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const {
            userId,
            paymentPlanId,
            type,
            amount,
            currency = 'USD',
            paymentMethod,
            mercadoPagoPaymentId,
            description
        } = data;

        // Validate user exists
        const user = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user[0]) {
            throw new Error('USER_NOT_FOUND');
        }

        // Validate plan exists if provided
        if (paymentPlanId) {
            const plan = await db
                .select({ id: pricingPlans.id })
                .from(pricingPlans)
                .where(eq(pricingPlans.id, paymentPlanId))
                .limit(1);

            if (!plan[0]) {
                throw new Error('PRICING_PLAN_NOT_FOUND');
            }
        }

        // Create payment record
        const result = await db
            .insert(payments)
            .values({
                userId,
                paymentPlanId,
                type,
                amount,
                currency,
                paymentMethod,
                status: PaymentStatusEnum.PENDING,
                mercadoPagoPaymentId,
                description
            })
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Handle webhook from Mercado Pago
     */
    async handleMercadoPagoWebhook(
        mercadoPagoPaymentId: string,
        newStatus: PaymentStatusEnum,
        webhookData?: Record<string, unknown>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        // Find payment by Mercado Pago ID
        const payment = await db
            .select()
            .from(payments)
            .where(eq(payments.mercadoPagoPaymentId, mercadoPagoPaymentId))
            .limit(1);

        if (!payment[0]) {
            throw new Error('PAYMENT_NOT_FOUND');
        }

        // Update payment status
        const updateData: Record<string, unknown> = {
            status: newStatus,
            updatedAt: new Date(),
            mercadoPagoResponse: webhookData || payment[0].mercadoPagoResponse
        };

        // Set processedAt if payment is approved
        if (newStatus === PaymentStatusEnum.APPROVED) {
            updateData.processedAt = new Date();
        }

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, payment[0].id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Find payments by user
     */
    async findByUser(userId: string, tx?: NodePgDatabase<typeof schema>): Promise<Payment[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .where(eq(payments.userId, userId))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return this.transformToPayments(result);
    }

    /**
     * Find payments by pricing plan
     */
    async findByPricingPlan(
        planId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .where(eq(payments.paymentPlanId, planId))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return this.transformToPayments(result);
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

        return this.transformToPayments(result);
    }

    /**
     * Mark payment as approved
     */
    async markApproved(
        id: string,
        processedAt?: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const result = await db
            .update(payments)
            .set({
                status: PaymentStatusEnum.APPROVED,
                processedAt: processedAt || new Date(),
                updatedAt: new Date()
            })
            .where(eq(payments.id, id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Mark payment as rejected
     */
    async markRejected(
        id: string,
        reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const updateData: Record<string, unknown> = {
            status: PaymentStatusEnum.REJECTED,
            failureReason: reason,
            updatedAt: new Date()
        };

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Retry failed payment
     */
    async retryPayment(
        id: string,
        newMercadoPagoPaymentId?: string,
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

        const updateData: Record<string, unknown> = {
            status: PaymentStatusEnum.PENDING,
            failureReason: null,
            updatedAt: new Date()
        };

        if (newMercadoPagoPaymentId) {
            updateData.mercadoPagoPaymentId = newMercadoPagoPaymentId;
        }

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
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
     * Get total successful payments for user
     */
    async getTotalSuccessfulForUser(
        userId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<number> {
        const db = this.getClient(tx);

        const successfulPayments = await db
            .select()
            .from(payments)
            .where(and(eq(payments.userId, userId), ne(payments.isDeleted, true)));

        // Filter by approved/authorized status and sum amounts
        return successfulPayments
            .filter(
                (p) =>
                    p.status === PaymentStatusEnum.APPROVED ||
                    p.status === PaymentStatusEnum.AUTHORIZED
            )
            .reduce((total, payment) => {
                return total + Number(payment.amount);
            }, 0);
    }

    /**
     * Get payment with user and plan data
     */
    async withRelations(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<
        | (Payment & {
              user: typeof users.$inferSelect;
              pricingPlan: typeof pricingPlans.$inferSelect | null;
          })
        | null
    > {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(payments)
            .innerJoin(users, eq(payments.userId, users.id))
            .leftJoin(pricingPlans, eq(payments.paymentPlanId, pricingPlans.id))
            .where(eq(payments.id, id))
            .limit(1);

        if (!result[0]) {
            return null;
        }

        return {
            ...this.transformToPayment(result[0].payments),
            user: result[0].users,
            pricingPlan: result[0].pricing_plans || null
        } as Payment & {
            user: typeof users.$inferSelect;
            pricingPlan: typeof pricingPlans.$inferSelect | null;
        };
    }

    /**
     * Cancel payment
     */
    async cancel(
        id: string,
        reason?: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        const updateData: Record<string, unknown> = {
            status: PaymentStatusEnum.CANCELLED,
            failureReason: reason,
            updatedAt: new Date()
        };

        const result = await db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Process payment with provider - Create payment for invoice
     */
    async processWithProvider(
        data: {
            invoiceId: string;
            amount: number;
            provider: string;
            providerPaymentId?: string;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        const db = this.getClient(tx);

        // Validate invoice exists
        const invoice = await db
            .select({ id: invoices.id, clientId: invoices.clientId })
            .from(invoices)
            .where(eq(invoices.id, data.invoiceId))
            .limit(1);

        if (!invoice[0]) {
            throw new Error('INVOICE_NOT_FOUND');
        }

        // Create payment record
        const result = await db
            .insert(payments)
            .values({
                invoiceId: data.invoiceId,
                userId: invoice[0].clientId, // Use clientId as userId
                amount: data.amount,
                currency: 'USD',
                status: PaymentStatusEnum.PENDING,
                type: 'subscription',
                mercadoPagoPaymentId: data.providerPaymentId
            })
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
    }

    /**
     * Handle webhook - Shorter version of handleMercadoPagoWebhook
     */
    async handleWebhook(
        providerPaymentId: string,
        newStatus: PaymentStatusEnum,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment | null> {
        return this.handleMercadoPagoWebhook(providerPaymentId, newStatus, undefined, tx);
    }

    /**
     * Sync payment status - Re-fetch and update status
     */
    async syncStatus(id: string, tx?: NodePgDatabase<typeof schema>): Promise<Payment | null> {
        const db = this.getClient(tx);

        // For now, just update the updatedAt timestamp
        // In a real implementation, this would fetch status from payment provider
        const result = await db
            .update(payments)
            .set({
                updatedAt: new Date()
            })
            .where(eq(payments.id, id))
            .returning();

        return result[0] ? this.transformToPayment(result[0]) : null;
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

        return this.transformToPayments(result);
    }

    /**
     * Find payments by provider
     * NOTE: This uses mercadoPagoPaymentId as proxy since 'provider' field doesn't exist in schema
     */
    async findByProvider(
        _provider: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Payment[]> {
        const db = this.getClient(tx);

        // Since 'provider' field doesn't exist in schema, we filter by payments that have
        // mercadoPagoPaymentId (indicating they're from Mercado Pago)
        // This is a workaround until the schema is updated with a 'provider' field
        const result = await db
            .select()
            .from(payments)
            .where(isNotNull(payments.mercadoPagoPaymentId))
            .orderBy(desc(payments.createdAt))
            .limit(100);

        return this.transformToPayments(result);
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
            .where(eq(payments.invoiceId, invoiceId));

        // Filter by approved/authorized status and sum amounts
        return successfulPayments
            .filter(
                (p) =>
                    p.status === PaymentStatusEnum.APPROVED ||
                    p.status === PaymentStatusEnum.AUTHORIZED
            )
            .reduce((total, payment) => {
                return total + Number(payment.amount);
            }, 0);
    }

    /**
     * Get payment with invoice data
     */
    async withInvoice(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<
        | (Payment & {
              invoice: typeof invoices.$inferSelect;
          })
        | null
    > {
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
            ...this.transformToPayment(result[0].payments),
            invoice: result[0].invoices
        } as Payment & {
            invoice: typeof invoices.$inferSelect;
        };
    }
}
