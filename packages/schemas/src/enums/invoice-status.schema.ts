import { z } from 'zod';
import { InvoiceStatusEnum } from './invoice-status.enum.js';

/**
 * Invoice status enum schema for validation
 */
export const InvoiceStatusEnumSchema = z.nativeEnum(InvoiceStatusEnum, {
    message: 'zodError.enums.invoiceStatus.invalid'
});
export type InvoiceStatusSchema = z.infer<typeof InvoiceStatusEnumSchema>;
