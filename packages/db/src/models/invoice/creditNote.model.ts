import { and, count, eq, gte, isNull, lte, sum } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { getDb } from '../../client';
import { creditNotes } from '../../schemas/payment/creditNote.dbschema';
import { invoices } from '../../schemas/payment/invoice.dbschema';
import { payments } from '../../schemas/payment/payment.dbschema';
import { refunds } from '../../schemas/payment/refund.dbschema';

/**
 * Credit Note entity type from database schema
 */
export type CreditNote = typeof creditNotes.$inferSelect;
export type CreateCreditNote = typeof creditNotes.$inferInsert;

/**
 * Credit Note business logic and database operations
 */
export class CreditNoteModel extends BaseModel<CreditNote> {
    protected table = creditNotes;
    protected entityName = 'credit_note' as const;

    protected getTableName(): string {
        return 'credit_notes';
    }

    /**
     * Generate credit note from refund
     */
    async generateFromRefund(refundId: string, reason?: string): Promise<CreditNote | null> {
        const db = getDb();

        try {
            // Get refund first
            const refund = await db.query.refunds.findFirst({
                where: eq(refunds.id, refundId)
            });

            if (!refund) {
                return null;
            }

            // Get payment
            const payment = await db.query.payments.findFirst({
                where: eq(payments.id, refund.paymentId)
            });

            if (!payment) {
                return null;
            }

            // Get invoice
            const invoice = await db.query.invoices.findFirst({
                where: eq(invoices.id, payment.invoiceId)
            });

            if (!invoice) {
                return null;
            }

            // Create credit note
            const creditNoteData: CreateCreditNote = {
                invoiceId: invoice.id,
                amount: (refund.amountMinor / 100).toString(),
                currency: payment.currency,
                reason: reason || `Credit note generated from refund ${refundId}`,
                issuedAt: new Date()
            };

            const [creditNote] = await db.insert(creditNotes).values(creditNoteData).returning();

            return creditNote || null;
        } catch (error) {
            throw new Error(`Failed to generate credit note from refund: ${error}`);
        }
    }

    /**
     * Apply credit note to invoice
     */
    async applyToInvoice(
        creditNoteId: string
    ): Promise<{ success: boolean; appliedAmount?: number; error?: string }> {
        const db = getDb();

        try {
            // Get credit note
            const creditNote = await db.query.creditNotes.findFirst({
                where: and(eq(creditNotes.id, creditNoteId), isNull(creditNotes.deletedAt))
            });

            if (!creditNote) {
                return { success: false, error: 'Credit note not found' };
            }

            // Get associated invoice
            const invoice = await db.query.invoices.findFirst({
                where: and(eq(invoices.id, creditNote.invoiceId), isNull(invoices.deletedAt))
            });

            if (!invoice) {
                return { success: false, error: 'Associated invoice not found' };
            }

            const creditAmount = Number.parseFloat(creditNote.amount);
            const currentInvoiceAmount = Number.parseFloat(invoice.totalAmount);

            // Calculate new invoice amount
            const newInvoiceAmount = Math.max(0, currentInvoiceAmount - creditAmount);
            const appliedAmount = currentInvoiceAmount - newInvoiceAmount;

            // Update invoice amount
            await db
                .update(invoices)
                .set({
                    totalAmount: newInvoiceAmount.toString(),
                    updatedAt: new Date()
                })
                .where(eq(invoices.id, creditNote.invoiceId));

            return {
                success: true,
                appliedAmount
            };
        } catch {
            return {
                success: false,
                error: 'Failed to apply credit note'
            };
        }
    }

    /**
     * Calculate remaining balance of credit note
     */
    async calculateBalance(creditNoteId: string): Promise<number> {
        const db = getDb();

        try {
            const creditNote = await db.query.creditNotes.findFirst({
                where: and(eq(creditNotes.id, creditNoteId), isNull(creditNotes.deletedAt))
            });

            if (!creditNote) {
                return 0;
            }

            return Number.parseFloat(creditNote.amount);
        } catch {
            return 0;
        }
    }

    /**
     * Find credit notes by invoice
     */
    async findByInvoice(invoiceId: string): Promise<CreditNote[]> {
        const db = getDb();

        return db.query.creditNotes.findMany({
            where: and(eq(creditNotes.invoiceId, invoiceId), isNull(creditNotes.deletedAt)),
            orderBy: (table, { desc }) => [desc(table.createdAt)]
        });
    }

    /**
     * Get total credit notes amount for an invoice
     */
    async getTotalCreditForInvoice(invoiceId: string): Promise<number> {
        const db = getDb();

        try {
            const result = await db
                .select({
                    totalCredit: sum(creditNotes.amount)
                })
                .from(creditNotes)
                .where(and(eq(creditNotes.invoiceId, invoiceId), isNull(creditNotes.deletedAt)));

            const total = result[0]?.totalCredit;
            return total ? Number.parseFloat(total.toString()) : 0;
        } catch {
            return 0;
        }
    }

    /**
     * Find credit notes issued within a date range
     */
    async findByDateRange(startDate: Date, endDate: Date): Promise<CreditNote[]> {
        const db = getDb();

        return db.query.creditNotes.findMany({
            where: and(
                gte(creditNotes.issuedAt, startDate),
                lte(creditNotes.issuedAt, endDate),
                isNull(creditNotes.deletedAt)
            ),
            orderBy: (table, { desc }) => [desc(table.issuedAt)]
        });
    }

    /**
     * Get credit notes summary for reporting
     */
    async getCreditNotesSummary(
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        totalAmount: number;
        count: number;
        averageAmount: number;
    }> {
        const db = getDb();

        try {
            const whereConditions = [isNull(creditNotes.deletedAt)];

            if (startDate) {
                whereConditions.push(gte(creditNotes.issuedAt, startDate));
            }

            if (endDate) {
                whereConditions.push(lte(creditNotes.issuedAt, endDate));
            }

            const result = await db
                .select({
                    totalAmount: sum(creditNotes.amount),
                    count: count(creditNotes.id)
                })
                .from(creditNotes)
                .where(and(...whereConditions));

            const data = result[0];
            const totalAmount = data?.totalAmount
                ? Number.parseFloat(data.totalAmount.toString())
                : 0;
            const countValue = data?.count || 0;

            return {
                totalAmount,
                count: countValue,
                averageAmount: countValue > 0 ? totalAmount / countValue : 0
            };
        } catch {
            return {
                totalAmount: 0,
                count: 0,
                averageAmount: 0
            };
        }
    }

    /**
     * Validate credit note amount against invoice
     */
    async validateCreditAmount(
        invoiceId: string,
        amount: number
    ): Promise<{ valid: boolean; reason?: string; maxAllowed?: number }> {
        if (amount <= 0) {
            return { valid: false, reason: 'AMOUNT_MUST_BE_POSITIVE' };
        }

        const db = getDb();

        try {
            // Get invoice details
            const invoice = await db.query.invoices.findFirst({
                where: and(eq(invoices.id, invoiceId), isNull(invoices.deletedAt))
            });

            if (!invoice) {
                return { valid: false, reason: 'INVOICE_NOT_FOUND' };
            }

            const invoiceAmount = Number.parseFloat(invoice.totalAmount);
            const existingCredits = await this.getTotalCreditForInvoice(invoiceId);
            const maxAllowed = invoiceAmount - existingCredits;

            if (amount > maxAllowed) {
                return {
                    valid: false,
                    reason: 'AMOUNT_EXCEEDS_INVOICE_BALANCE',
                    maxAllowed
                };
            }

            return { valid: true };
        } catch {
            return { valid: false, reason: 'VALIDATION_ERROR' };
        }
    }

    /**
     * Create credit note with validation
     */
    async createWithValidation(data: {
        invoiceId: string;
        amount: number;
        currency: string;
        reason?: string;
    }): Promise<{ success: boolean; creditNote?: CreditNote; error?: string }> {
        try {
            // Validate amount
            const validation = await this.validateCreditAmount(data.invoiceId, data.amount);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.reason || 'Invalid credit amount'
                };
            }

            // Create credit note
            const creditNoteData: CreateCreditNote = {
                invoiceId: data.invoiceId,
                amount: data.amount.toString(),
                currency: data.currency,
                reason: data.reason,
                issuedAt: new Date()
            };

            const creditNote = await this.create(creditNoteData);

            return {
                success: true,
                creditNote
            };
        } catch {
            return {
                success: false,
                error: 'Failed to create credit note'
            };
        }
    }

    /**
     * Cancel/void a credit note
     */
    async cancel(creditNoteId: string, reason?: string): Promise<CreditNote | null> {
        const db = getDb();

        try {
            const [canceledNote] = await db
                .update(creditNotes)
                .set({
                    deletedAt: new Date(),
                    reason: reason ? `CANCELED: ${reason}` : 'CANCELED',
                    updatedAt: new Date()
                })
                .where(and(eq(creditNotes.id, creditNoteId), isNull(creditNotes.deletedAt)))
                .returning();

            return canceledNote || null;
        } catch (error) {
            throw new Error(`Failed to cancel credit note: ${error}`);
        }
    }
}

export { creditNotes } from '../../schemas/payment/creditNote.dbschema';
