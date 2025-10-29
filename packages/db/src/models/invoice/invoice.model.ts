import { InvoiceStatusEnum } from '@repo/schemas';
import { and, desc, eq, isNotNull, like, lte, ne, sum } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { invoices } from '../../schemas/payment/invoice.dbschema';
import { invoiceLines } from '../../schemas/payment/invoiceLine.dbschema';
import { payments } from '../../schemas/payment/payment.dbschema';
import { subscriptions } from '../../schemas/subscription/subscription.dbschema';

type Invoice = typeof invoices.$inferSelect;

export class InvoiceModel extends BaseModel<Invoice> {
    protected table = invoices;
    protected entityName = 'invoice';

    protected getTableName(): string {
        return 'invoices';
    }

    /**
     * Generate invoice from subscription for billing cycle
     */
    async generateFromSubscription(
        subscriptionId: string,
        billingPeriodStart: Date,
        billingPeriodEnd: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Invoice | null> {
        const db = this.getClient(tx);

        // Get subscription with client info
        const subscription = await db
            .select({
                id: subscriptions.id,
                clientId: subscriptions.clientId,
                status: subscriptions.status
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1);

        if (!subscription[0]) {
            throw new Error('SUBSCRIPTION_NOT_FOUND');
        }

        // For now, generate a simple invoice with base amount
        // TODO [dc9f225a-7c1a-455e-9928-ef3fec6f53ea]: Get actual pricing from subscription items and pricing plans
        const subtotalAmount = 100; // Temporary fixed amount
        const taxAmount = 10; // Temporary fixed tax
        const totalAmount = subtotalAmount + taxAmount;

        // Generate unique invoice number
        const invoiceNumber = await this.generateInvoiceNumber(db);

        // Create invoice
        const result = await db
            .insert(invoices)
            .values({
                clientId: subscription[0].clientId,
                invoiceNumber,
                status: InvoiceStatusEnum.OPEN,
                subtotalAmount: subtotalAmount.toString(),
                taxAmount: taxAmount.toString(),
                totalAmount: totalAmount.toString(),
                currency: 'USD',
                issuedAt: new Date(),
                dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                metadata: {
                    subscriptionId,
                    billingPeriodStart: billingPeriodStart.toISOString(),
                    billingPeriodEnd: billingPeriodEnd.toISOString()
                }
            })
            .returning();

        return (result[0] as Invoice) || null;
    }

    /**
     * Calculate invoice totals from line items
     */
    async calculateTotals(
        invoiceId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ subtotal: number; tax: number; total: number } | null> {
        const db = this.getClient(tx);

        const totals = await db
            .select({
                subtotal: sum(invoiceLines.unitPrice),
                tax: sum(invoiceLines.taxAmount),
                total: sum(invoiceLines.totalAmount)
            })
            .from(invoiceLines)
            .where(eq(invoiceLines.invoiceId, invoiceId));

        if (!totals[0]) {
            return null;
        }

        return {
            subtotal: Number(totals[0].subtotal) || 0,
            tax: Number(totals[0].tax) || 0,
            total: Number(totals[0].total) || 0
        };
    }

    /**
     * Mark invoice as paid
     */
    async markAsPaid(
        id: string,
        paidAt?: Date,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<Invoice | null> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .update(invoices)
            .set({
                status: InvoiceStatusEnum.PAID,
                paidAt: paidAt || now,
                updatedAt: now
            })
            .where(eq(invoices.id, id))
            .returning();

        return (result[0] as Invoice) || null;
    }

    /**
     * Check if invoice can be marked as paid
     */
    async canMarkPaid(id: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const invoice = await db
            .select({ status: invoices.status })
            .from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice[0]) {
            return false;
        }

        return [InvoiceStatusEnum.OPEN].includes(invoice[0].status as InvoiceStatusEnum);
    }

    /**
     * Check if invoice can be voided
     */
    async canVoid(id: string, tx?: NodePgDatabase<typeof schema>): Promise<boolean> {
        const db = this.getClient(tx);

        const invoice = await db
            .select({ status: invoices.status })
            .from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice[0]) {
            return false;
        }

        return invoice[0].status === InvoiceStatusEnum.OPEN;
    }

    /**
     * Get payment status of invoice
     */
    async getPaymentStatus(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ status: string; amountPaid: number; balance: number } | null> {
        const db = this.getClient(tx);

        const invoice = await db
            .select({
                status: invoices.status,
                totalAmount: invoices.totalAmount
            })
            .from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice[0]) {
            return null;
        }

        const amountPaid = await this.getAmountPaid(id, tx);
        const totalAmount = Number(invoice[0].totalAmount);
        const balance = totalAmount - amountPaid;

        return {
            status: invoice[0].status,
            amountPaid,
            balance
        };
    }

    /**
     * Find overdue invoices
     */
    async findOverdue(tx?: NodePgDatabase<typeof schema>): Promise<Invoice[]> {
        const db = this.getClient(tx);
        const now = new Date();

        const result = await db
            .select()
            .from(invoices)
            .where(
                and(
                    eq(invoices.status, InvoiceStatusEnum.OPEN),
                    lte(invoices.dueAt, now),
                    isNotNull(invoices.dueAt)
                )
            )
            .orderBy(desc(invoices.dueAt))
            .limit(100);

        return result as Invoice[];
    }

    /**
     * Find invoices by client
     */
    async findByClient(clientId: string, tx?: NodePgDatabase<typeof schema>): Promise<Invoice[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(invoices)
            .where(eq(invoices.clientId, clientId))
            .orderBy(desc(invoices.createdAt))
            .limit(100);

        return result as Invoice[];
    }

    /**
     * Get invoice with line items
     */
    async withLines(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<(Invoice & { lines: (typeof invoiceLines.$inferSelect)[] }) | null> {
        const db = this.getClient(tx);

        const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

        if (!invoice[0]) {
            return null;
        }

        const lines = await db
            .select()
            .from(invoiceLines)
            .where(eq(invoiceLines.invoiceId, id))
            .limit(100);

        return {
            ...invoice[0],
            lines
        } as Invoice & { lines: (typeof invoiceLines.$inferSelect)[] };
    }

    /**
     * Get invoice with payments
     */
    async withPayments(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<(Invoice & { payments: (typeof payments.$inferSelect)[] }) | null> {
        const db = this.getClient(tx);

        const invoice = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);

        if (!invoice[0]) {
            return null;
        }

        const invoicePayments = await db
            .select()
            .from(payments)
            .where(eq(payments.invoiceId, id))
            .limit(100);

        return {
            ...invoice[0],
            payments: invoicePayments
        } as Invoice & { payments: (typeof payments.$inferSelect)[] };
    }

    /**
     * Get total amount due for invoice
     */
    async getTotalDue(id: string, tx?: NodePgDatabase<typeof schema>): Promise<number> {
        const db = this.getClient(tx);

        const invoice = await db
            .select({ totalAmount: invoices.totalAmount })
            .from(invoices)
            .where(eq(invoices.id, id))
            .limit(1);

        if (!invoice[0]) {
            return 0;
        }

        return Number(invoice[0].totalAmount) || 0;
    }

    /**
     * Get amount paid for invoice
     */
    async getAmountPaid(id: string, tx?: NodePgDatabase<typeof schema>): Promise<number> {
        const db = this.getClient(tx);

        const paidPayments = await db
            .select({ amount: sum(payments.amount) })
            .from(payments)
            .where(
                and(
                    eq(payments.invoiceId, id),
                    ne(payments.status, 'FAILED'),
                    ne(payments.status, 'CANCELLED')
                )
            );

        return Number(paidPayments[0]?.amount) || 0;
    }

    /**
     * Get remaining balance for invoice
     */
    async getBalance(id: string, tx?: NodePgDatabase<typeof schema>): Promise<number> {
        const totalDue = await this.getTotalDue(id, tx);
        const amountPaid = await this.getAmountPaid(id, tx);
        return totalDue - amountPaid;
    }

    /**
     * Generate unique invoice number
     */
    private async generateInvoiceNumber(db: NodePgDatabase<typeof schema>): Promise<string> {
        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;

        // Get the latest invoice number for this year
        const latestInvoice = await db
            .select({ invoiceNumber: invoices.invoiceNumber })
            .from(invoices)
            .where(like(invoices.invoiceNumber, `${prefix}%`))
            .orderBy(desc(invoices.invoiceNumber))
            .limit(1);

        let nextNumber = 1;
        if (latestInvoice[0]) {
            const parts = latestInvoice[0].invoiceNumber.split('-');
            if (parts.length >= 3 && parts[2]) {
                const lastNumber = parts[2];
                nextNumber = Number.parseInt(lastNumber, 10) + 1;
            }
        }

        return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
    }
}
