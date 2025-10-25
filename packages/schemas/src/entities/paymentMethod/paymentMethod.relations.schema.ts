import { z } from 'zod';
import { PaymentMethodSchema } from './paymentMethod.schema.js';

// Simplified relation schemas to avoid circular dependencies
const ClientRelationSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email().optional(),
    name: z.string().min(1).max(200),
    companyName: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

const PaymentRelationSchema = z.object({
    id: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string(),
    status: z.string(),
    type: z.string(),
    processedAt: z.date().optional(),
    createdAt: z.date(),
    updatedAt: z.date()
});

/**
 * Payment Method With Client Relation Schema
 *
 * Schema for payment method entities that include the related client information.
 */
export const PaymentMethodWithClientSchema = PaymentMethodSchema.extend({
    client: ClientRelationSchema.optional()
});

/**
 * Payment Method With Payments Relation Schema
 *
 * Schema for payment method entities that include the related payments.
 */
export const PaymentMethodWithPaymentsSchema = PaymentMethodSchema.extend({
    payments: z.array(PaymentRelationSchema).optional()
});

/**
 * Payment Method Full Relations Schema
 *
 * Schema for payment method entities that include all possible relations.
 */
export const PaymentMethodFullRelationsSchema = PaymentMethodSchema.extend({
    client: ClientRelationSchema.optional(),
    payments: z.array(PaymentRelationSchema).optional()
});

/**
 * Type exports for Payment Method relation operations
 */
export type PaymentMethodWithClient = z.infer<typeof PaymentMethodWithClientSchema>;
export type PaymentMethodWithPayments = z.infer<typeof PaymentMethodWithPaymentsSchema>;
export type PaymentMethodFullRelations = z.infer<typeof PaymentMethodFullRelationsSchema>;
