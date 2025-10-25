import { z } from 'zod';
import { InvoiceLineSchema } from './invoiceLine.schema.js';

// Simplified relation schemas to avoid circular dependencies
const InvoiceRelationSchema = z.object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    invoiceNumber: z.string().min(1).max(100),
    status: z.string(),
    subtotal: z.number().nonnegative(),
    taxes: z.number().nonnegative(),
    total: z.number().nonnegative(),
    currency: z.string(),
    issueDate: z.date(),
    dueDate: z.date(),
    createdAt: z.date(),
    updatedAt: z.date()
});

const ProductRelationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    reference: z.string().optional(),
    description: z.string().optional(),
    unitPrice: z.number().nonnegative(),
    createdAt: z.date(),
    updatedAt: z.date()
});

/**
 * Invoice Line With Invoice Relation Schema
 *
 * Schema for invoice line entities that include the related invoice information.
 */
export const InvoiceLineWithInvoiceSchema = InvoiceLineSchema.extend({
    invoice: InvoiceRelationSchema.optional()
});

/**
 * Invoice Line With Product Relation Schema
 *
 * Schema for invoice line entities that include the related product information.
 */
export const InvoiceLineWithProductSchema = InvoiceLineSchema.extend({
    product: ProductRelationSchema.optional()
});

/**
 * Invoice Line Full Relations Schema
 *
 * Schema for invoice line entities that include all possible relations.
 */
export const InvoiceLineFullRelationsSchema = InvoiceLineSchema.extend({
    invoice: InvoiceRelationSchema.optional(),
    product: ProductRelationSchema.optional()
});

/**
 * Type exports for Invoice Line relation operations
 */
export type InvoiceLineWithInvoice = z.infer<typeof InvoiceLineWithInvoiceSchema>;
export type InvoiceLineWithProduct = z.infer<typeof InvoiceLineWithProductSchema>;
export type InvoiceLineFullRelations = z.infer<typeof InvoiceLineFullRelationsSchema>;
