import type { InvoiceLine } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import type * as schema from '../../schemas/index.js';
import { invoices } from '../../schemas/payment/invoice.dbschema';
import { invoiceLines } from '../../schemas/payment/invoiceLine.dbschema';

export class InvoiceLineModel extends BaseModel<InvoiceLine> {
    protected table = invoiceLines;
    protected entityName = 'invoiceLine';

    protected getTableName(): string {
        return 'invoice_lines';
    }

    /**
     * Calculate line total including tax and discounts
     */
    async calculateLineTotal(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<{ lineAmount: number; taxAmount: number; totalAmount: number } | null> {
        const db = this.getClient(tx);

        const line = await db
            .select({
                quantity: invoiceLines.quantity,
                unitPrice: invoiceLines.unitPrice,
                taxRate: invoiceLines.taxRate,
                discountRate: invoiceLines.discountRate,
                discountAmount: invoiceLines.discountAmount
            })
            .from(invoiceLines)
            .where(eq(invoiceLines.id, id))
            .limit(1);

        if (!line[0]) {
            return null;
        }

        const { quantity, unitPrice, taxRate, discountRate, discountAmount } = line[0];

        // Calculate line amount (quantity * unit price) - values already numbers from Zod
        const lineAmount = quantity * unitPrice;

        // Apply discount (either rate or fixed amount)
        let discountedAmount = lineAmount;
        if (discountRate && discountRate > 0) {
            discountedAmount = lineAmount * (1 - discountRate);
        } else if (discountAmount && discountAmount > 0) {
            discountedAmount = lineAmount - discountAmount;
        }

        // Calculate tax on discounted amount
        const taxAmount = discountedAmount * (taxRate || 0);

        // Total amount including tax
        const totalAmount = discountedAmount + taxAmount;

        return {
            lineAmount: discountedAmount,
            taxAmount,
            totalAmount
        };
    }

    /**
     * Apply discounts to line item
     */
    async applyDiscounts(
        id: string,
        discountRate?: number,
        discountAmount?: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine | null> {
        const db = this.getClient(tx);

        const updateData: Partial<InvoiceLine> = {
            updatedAt: new Date()
        };

        if (discountRate !== undefined) {
            updateData.discountRate = discountRate;
            updateData.discountAmount = 0; // Reset fixed discount when using rate
        }

        if (discountAmount !== undefined) {
            updateData.discountAmount = discountAmount;
            updateData.discountRate = 0; // Reset rate when using fixed amount
        }

        // Recalculate totals
        const calculations = await this.calculateLineTotal(id, tx);
        if (calculations) {
            updateData.taxAmount = calculations.taxAmount;
            updateData.total = calculations.totalAmount;
        }

        const result = await db
            .update(invoiceLines)
            .set(updateData)
            .where(eq(invoiceLines.id, id))
            .returning();

        return (result[0] as InvoiceLine) || null;
    }

    /**
     * Calculate tax for line item
     */
    async calculateTax(
        id: string,
        taxRate: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine | null> {
        const db = this.getClient(tx);

        const line = await db
            .select({
                quantity: invoiceLines.quantity,
                unitPrice: invoiceLines.unitPrice,
                discountRate: invoiceLines.discountRate,
                discountAmount: invoiceLines.discountAmount
            })
            .from(invoiceLines)
            .where(eq(invoiceLines.id, id))
            .limit(1);

        if (!line[0]) {
            return null;
        }

        const { quantity, unitPrice, discountRate, discountAmount } = line[0];

        // Calculate base amount
        const lineAmount = quantity * Number(unitPrice);

        // Apply discount
        let discountedAmount = lineAmount;
        if (discountRate && Number(discountRate) > 0) {
            discountedAmount = lineAmount * (1 - Number(discountRate));
        } else if (discountAmount && Number(discountAmount) > 0) {
            discountedAmount = lineAmount - Number(discountAmount);
        }

        // Calculate tax
        const taxAmount = discountedAmount * taxRate;
        const totalAmount = discountedAmount + taxAmount;

        const result = await db
            .update(invoiceLines)
            .set({
                taxRate: taxRate,
                taxAmount: taxAmount,
                total: totalAmount,
                updatedAt: new Date()
            })
            .where(eq(invoiceLines.id, id))
            .returning();

        return (result[0] as InvoiceLine) || null;
    }

    /**
     * Find line items by invoice
     */
    async findByInvoice(
        invoiceId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(invoiceLines)
            .where(eq(invoiceLines.invoiceId, invoiceId))
            .limit(100);

        return result as InvoiceLine[];
    }

    /**
     * Find line items by subscription item
     */
    async findBySubscriptionItem(
        subscriptionItemId: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine[]> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(invoiceLines)
            .where(eq(invoiceLines.subscriptionItemId, subscriptionItemId))
            .limit(100);

        return result as InvoiceLine[];
    }

    /**
     * Update quantity and recalculate totals
     */
    async updateQuantity(
        id: string,
        quantity: number,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine | null> {
        if (quantity <= 0) {
            throw new Error('INVALID_QUANTITY');
        }

        const db = this.getClient(tx);

        // Get current line data
        const line = await db
            .select({
                unitPrice: invoiceLines.unitPrice,
                taxRate: invoiceLines.taxRate,
                discountRate: invoiceLines.discountRate,
                discountAmount: invoiceLines.discountAmount
            })
            .from(invoiceLines)
            .where(eq(invoiceLines.id, id))
            .limit(1);

        if (!line[0]) {
            return null;
        }

        const { unitPrice, taxRate, discountRate, discountAmount } = line[0];

        // Calculate new amounts
        const lineAmount = quantity * Number(unitPrice);

        // Apply discount
        let discountedAmount = lineAmount;
        if (discountRate && Number(discountRate) > 0) {
            discountedAmount = lineAmount * (1 - Number(discountRate));
        } else if (discountAmount && Number(discountAmount) > 0) {
            discountedAmount = lineAmount - Number(discountAmount);
        }

        // Calculate tax
        const taxAmountCalc = discountedAmount * Number(taxRate || 0);
        const totalAmount = discountedAmount + taxAmountCalc;

        const result = await db
            .update(invoiceLines)
            .set({
                quantity,
                taxAmount: taxAmountCalc,
                total: totalAmount,
                updatedAt: new Date()
            })
            .where(eq(invoiceLines.id, id))
            .returning();

        return (result[0] as InvoiceLine) || null;
    }

    /**
     * Create a new invoice line with calculations
     */
    async createWithCalculations(
        data: {
            invoiceId: string;
            description: string;
            quantity: number;
            unitPrice: number;
            taxRate?: number;
            discountRate?: number;
            discountAmount?: number;
            pricingPlanId?: string;
            subscriptionItemId?: string;
            periodStart?: Date;
            periodEnd?: Date;
            metadata?: Record<string, unknown>;
        },
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine | null> {
        const db = this.getClient(tx);

        const {
            invoiceId,
            description,
            quantity,
            unitPrice,
            taxRate = 0,
            discountRate = 0,
            discountAmount = 0,
            pricingPlanId,
            subscriptionItemId,
            periodStart,
            periodEnd,
            metadata
        } = data;

        // Calculate amounts
        const lineAmount = quantity * unitPrice;

        // Apply discount
        let discountedAmount = lineAmount;
        if (discountRate > 0) {
            discountedAmount = lineAmount * (1 - discountRate);
        } else if (discountAmount > 0) {
            discountedAmount = lineAmount - discountAmount;
        }

        // Calculate tax
        const taxAmountCalc = discountedAmount * taxRate;
        const totalAmount = discountedAmount + taxAmountCalc;

        const result = await db
            .insert(invoiceLines)
            .values({
                invoiceId,
                description,
                quantity,
                unitPrice: unitPrice,
                taxRate: taxRate,
                taxAmount: taxAmountCalc,
                discountRate: discountRate,
                discountAmount: discountAmount,
                total: totalAmount,
                pricingPlanId,
                subscriptionItemId,
                periodStart,
                periodEnd,
                metadata
            })
            .returning();

        return (result[0] as InvoiceLine) || null;
    }

    /**
     * Get line items with their related invoice data
     */
    async withInvoice(
        id: string,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<(InvoiceLine & { invoice: typeof invoices.$inferSelect }) | null> {
        const db = this.getClient(tx);

        const result = await db
            .select()
            .from(invoiceLines)
            .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
            .where(eq(invoiceLines.id, id))
            .limit(1);

        if (!result[0]) {
            return null;
        }

        return {
            ...result[0].invoice_lines,
            invoice: result[0].invoices
        } as InvoiceLine & { invoice: typeof invoices.$inferSelect };
    }

    /**
     * Bulk update quantities for multiple line items
     */
    async bulkUpdateQuantities(
        updates: Array<{ id: string; quantity: number }>,
        tx?: NodePgDatabase<typeof schema>
    ): Promise<InvoiceLine[]> {
        const results: InvoiceLine[] = [];

        for (const update of updates) {
            const result = await this.updateQuantity(update.id, update.quantity, tx);
            if (result) {
                results.push(result);
            }
        }

        return results;
    }
}
