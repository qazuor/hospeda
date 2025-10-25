import { z } from 'zod';
import { InvoiceSchema } from './invoice.schema.js';

// Import related schemas for relations
// Note: Using simplified schemas to avoid circular dependencies
const ClientRelationSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().optional(),
    name: z.string().min(1).max(200),
    companyName: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid()
});

const InvoiceLineRelationSchema = z.object({
    id: z.string().uuid(),
    invoiceId: z.string().uuid(),
    description: z.string().min(1).max(500),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    total: z.number().nonnegative(),
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid()
});

const PaymentRelationSchema = z.object({
    id: z.string().uuid(),
    invoiceId: z.string().uuid().optional(),
    amount: z.number().positive(),
    currency: z.string(),
    status: z.string(),
    method: z.string(),
    processedAt: z.date().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: z.string().uuid(),
    updatedById: z.string().uuid()
});

/**
 * Invoice With Client Relation Schema
 *
 * Schema for invoice entities that include the related client information.
 */
export const InvoiceWithClientSchema = InvoiceSchema.extend({
    client: ClientRelationSchema.optional()
});

/**
 * Invoice With Lines Relation Schema
 *
 * Schema for invoice entities that include the related invoice lines.
 */
export const InvoiceWithLinesSchema = InvoiceSchema.extend({
    lines: z.array(InvoiceLineRelationSchema).optional()
});

/**
 * Invoice With Payments Relation Schema
 *
 * Schema for invoice entities that include the related payments.
 */
export const InvoiceWithPaymentsSchema = InvoiceSchema.extend({
    payments: z.array(PaymentRelationSchema).optional()
});

/**
 * Invoice Full Relations Schema
 *
 * Schema for invoice entities that include all possible relations.
 */
export const InvoiceFullRelationsSchema = InvoiceSchema.extend({
    client: ClientRelationSchema.optional(),
    lines: z.array(InvoiceLineRelationSchema).optional(),
    payments: z.array(PaymentRelationSchema).optional()
});

/**
 * Type exports for Invoice relation operations
 */
export type InvoiceWithClient = z.infer<typeof InvoiceWithClientSchema>;
export type InvoiceWithLines = z.infer<typeof InvoiceWithLinesSchema>;
export type InvoiceWithPayments = z.infer<typeof InvoiceWithPaymentsSchema>;
export type InvoiceFullRelations = z.infer<typeof InvoiceFullRelationsSchema>;
