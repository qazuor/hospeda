import { describe, expect, it } from 'vitest';
import {
    CreateCreditNoteHTTPSchema,
    CreditNoteQueryHTTPSchema
} from '../creditNote/http.schema.js';
import { CreateRefundHTTPSchema, RefundQueryHTTPSchema } from '../refund/http.schema.js';
import { RefundReasonEnum } from '../refund/refund.schema.js';

describe('Billing System HTTP Coercion Tests', () => {
    describe('Amount Conversions', () => {
        it('should convert string amounts to numbers across entities', () => {
            // Credit Note
            const creditNoteData = {
                invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                creditNoteNumber: 'CN-2024-001',
                amount: '25.75',
                currency: 'USD',
                reason: 'Billing error correction',
                issueDate: '2024-01-20T00:00:00Z'
            };
            const parsedCreditNote = CreateCreditNoteHTTPSchema.parse(creditNoteData);
            expect(parsedCreditNote.amount).toBe(25.75);

            // Refund
            const refundData = {
                paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                refundNumber: 'REF-2024-001',
                amount: '50.25',
                currency: 'USD',
                reason: RefundReasonEnum.CUSTOMER_REQUEST
            };
            const parsedRefund = CreateRefundHTTPSchema.parse(refundData);
            expect(parsedRefund.amount).toBe(50.25);
        });

        it('should handle amount range queries with string coercion', () => {
            // Credit Note Query
            const creditNoteQuery = {
                amountMin: '5.00',
                amountMax: '500.00'
            };
            const parsedCreditNoteQuery = CreditNoteQueryHTTPSchema.parse(creditNoteQuery);
            expect(parsedCreditNoteQuery.amountMin).toBe(5.0);
            expect(parsedCreditNoteQuery.amountMax).toBe(500.0);

            // Refund Query
            const refundQuery = {
                amountMin: '1.00',
                amountMax: '100.00'
            };
            const parsedRefundQuery = RefundQueryHTTPSchema.parse(refundQuery);
            expect(parsedRefundQuery.amountMin).toBe(1.0);
            expect(parsedRefundQuery.amountMax).toBe(100.0);
        });

        it('should reject invalid amount strings across entities', () => {
            expect(() => {
                CreateCreditNoteHTTPSchema.parse({
                    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    creditNoteNumber: 'CN-2024-001',
                    amount: 'not-a-number',
                    currency: 'USD',
                    reason: 'Billing error correction',
                    issueDate: '2024-01-20T00:00:00Z'
                });
            }).toThrow();

            expect(() => {
                CreateRefundHTTPSchema.parse({
                    paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    refundNumber: 'REF-2024-001',
                    amount: 'abc123',
                    currency: 'USD',
                    reason: RefundReasonEnum.CUSTOMER_REQUEST
                });
            }).toThrow();
        });
    });

    describe('Date Conversions', () => {
        it('should convert string dates to Date objects across entities', () => {
            // Credit Note
            const creditNoteData = {
                invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                creditNoteNumber: 'CN-2024-001',
                amount: 25.0,
                currency: 'USD',
                reason: 'Billing error correction',
                issueDate: '2024-01-20T00:00:00Z'
            };
            const parsedCreditNote = CreateCreditNoteHTTPSchema.parse(creditNoteData);
            expect(parsedCreditNote.issueDate).toBeInstanceOf(Date);
        });

        it('should handle date range queries with string coercion', () => {
            // Credit Note Query with date ranges
            const creditNoteQuery = {
                issueDateFrom: '2024-01-01T00:00:00Z',
                issueDateTo: '2024-12-31T23:59:59Z',
                appliedAtFrom: '2024-01-01T00:00:00Z',
                appliedAtTo: '2024-12-31T23:59:59Z'
            };
            const parsedCreditNoteQuery = CreditNoteQueryHTTPSchema.parse(creditNoteQuery);
            expect(parsedCreditNoteQuery.issueDateFrom).toBeInstanceOf(Date);
            expect(parsedCreditNoteQuery.issueDateTo).toBeInstanceOf(Date);
            expect(parsedCreditNoteQuery.appliedAtFrom).toBeInstanceOf(Date);
            expect(parsedCreditNoteQuery.appliedAtTo).toBeInstanceOf(Date);

            // Refund Query with date ranges
            const refundQuery = {
                processedAtFrom: '2024-01-01T00:00:00Z',
                processedAtTo: '2024-12-31T23:59:59Z'
            };
            const parsedRefundQuery = RefundQueryHTTPSchema.parse(refundQuery);
            expect(parsedRefundQuery.processedAtFrom).toBeInstanceOf(Date);
            expect(parsedRefundQuery.processedAtTo).toBeInstanceOf(Date);
        });

        it('should reject invalid date strings across entities', () => {
            expect(() => {
                CreditNoteQueryHTTPSchema.parse({
                    issueDateFrom: 'not-a-date',
                    issueDateTo: '2024-12-31T23:59:59Z'
                });
            }).toThrow();

            expect(() => {
                RefundQueryHTTPSchema.parse({
                    processedAtFrom: '2024-01-01T00:00:00Z',
                    processedAtTo: 'invalid-date'
                });
            }).toThrow();
        });
    });

    describe('Cross-Entity Validation Rules', () => {
        it('should enforce amount range validations consistently', () => {
            // All entities should reject invalid ranges where min > max
            expect(() => {
                CreditNoteQueryHTTPSchema.parse({
                    amountMin: '100.00',
                    amountMax: '50.00'
                });
            }).toThrow('amountMin must be less than or equal to amountMax');

            expect(() => {
                RefundQueryHTTPSchema.parse({
                    amountMin: '100.00',
                    amountMax: '50.00'
                });
            }).toThrow('amountMin must be less than or equal to amountMax');
        });

        it('should enforce date range validations consistently', () => {
            // All entities should reject invalid date ranges where from > to
            expect(() => {
                CreditNoteQueryHTTPSchema.parse({
                    issueDateFrom: '2024-12-31T00:00:00Z',
                    issueDateTo: '2024-01-01T00:00:00Z'
                });
            }).toThrow();

            expect(() => {
                RefundQueryHTTPSchema.parse({
                    processedAtFrom: '2024-12-31T00:00:00Z',
                    processedAtTo: '2024-01-01T00:00:00Z'
                });
            }).toThrow();
        });

        it('should enforce positive amount validations consistently', () => {
            expect(() => {
                CreateCreditNoteHTTPSchema.parse({
                    invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    creditNoteNumber: 'CN-2024-001',
                    amount: '0',
                    currency: 'USD',
                    reason: 'Billing error correction',
                    issueDate: '2024-01-20T00:00:00Z'
                });
            }).toThrow();

            expect(() => {
                CreateRefundHTTPSchema.parse({
                    paymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    refundNumber: 'REF-2024-001',
                    amount: '-50.00',
                    currency: 'USD',
                    reason: RefundReasonEnum.CUSTOMER_REQUEST
                });
            }).toThrow();
        });
    });
});
