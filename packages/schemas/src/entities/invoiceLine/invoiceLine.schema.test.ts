import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceLineSchema } from './invoiceLine.schema.js';

describe('InvoiceLineSchema', () => {
    const validInvoiceLineData = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
        description: 'Consulting services - Web development',
        quantity: 2,
        unitPrice: 150.5,
        total: 301.0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d482'
    };

    describe('Valid invoice line validation', () => {
        it('should validate a complete valid invoice line', () => {
            expect(() => InvoiceLineSchema.parse(validInvoiceLineData)).not.toThrow();
        });

        it('should validate invoice line with minimum required fields', () => {
            const minimalInvoiceLine = {
                id: validInvoiceLineData.id,
                invoiceId: validInvoiceLineData.invoiceId,
                description: validInvoiceLineData.description,
                quantity: validInvoiceLineData.quantity,
                unitPrice: validInvoiceLineData.unitPrice,
                total: validInvoiceLineData.total,
                createdAt: validInvoiceLineData.createdAt,
                updatedAt: validInvoiceLineData.updatedAt,
                createdById: validInvoiceLineData.createdById,
                updatedById: validInvoiceLineData.updatedById
            };

            expect(() => InvoiceLineSchema.parse(minimalInvoiceLine)).not.toThrow();
        });
    });

    describe('Quantity validations', () => {
        it('should validate positive quantities', () => {
            const positiveQuantityLine = {
                ...validInvoiceLineData,
                quantity: 5,
                total: 752.5
            };
            expect(() => InvoiceLineSchema.parse(positiveQuantityLine)).not.toThrow();
        });

        it('should validate decimal quantities', () => {
            const decimalQuantityLine = {
                ...validInvoiceLineData,
                quantity: 1.5,
                total: 225.75
            };
            expect(() => InvoiceLineSchema.parse(decimalQuantityLine)).not.toThrow();
        });

        it('should reject zero quantity', () => {
            const zeroQuantityLine = { ...validInvoiceLineData, quantity: 0 };
            expect(() => InvoiceLineSchema.parse(zeroQuantityLine)).toThrow(ZodError);
        });

        it('should reject negative quantity', () => {
            const negativeQuantityLine = { ...validInvoiceLineData, quantity: -1 };
            expect(() => InvoiceLineSchema.parse(negativeQuantityLine)).toThrow(ZodError);
        });
    });

    describe('Price and amount validations', () => {
        it('should validate positive unit prices', () => {
            const positiveUnitPriceLine = {
                ...validInvoiceLineData,
                unitPrice: 200.0,
                total: 400.0
            };
            expect(() => InvoiceLineSchema.parse(positiveUnitPriceLine)).not.toThrow();
        });

        it('should validate zero unit price (free items)', () => {
            const zeroUnitPriceLine = {
                ...validInvoiceLineData,
                unitPrice: 0,
                total: 0
            };
            expect(() => InvoiceLineSchema.parse(zeroUnitPriceLine)).not.toThrow();
        });

        it('should validate positive total', () => {
            const positiveTotalLine = {
                ...validInvoiceLineData,
                total: 1000.5
            };
            expect(() => InvoiceLineSchema.parse(positiveTotalLine)).not.toThrow();
        });

        it('should validate zero total', () => {
            const zeroTotalLine = {
                ...validInvoiceLineData,
                unitPrice: 0,
                total: 0
            };
            expect(() => InvoiceLineSchema.parse(zeroTotalLine)).not.toThrow();
        });

        it('should reject negative unit price', () => {
            const negativeUnitPriceLine = { ...validInvoiceLineData, unitPrice: -10 };
            expect(() => InvoiceLineSchema.parse(negativeUnitPriceLine)).toThrow(ZodError);
        });

        it('should reject negative total', () => {
            const negativeTotalLine = { ...validInvoiceLineData, total: -10 };
            expect(() => InvoiceLineSchema.parse(negativeTotalLine)).toThrow(ZodError);
        });
    });

    describe('Description validation', () => {
        it('should validate different description formats', () => {
            const validDescriptions = [
                'Consulting services',
                'Web development - Frontend React application',
                'Product: Widget ABC (Model: 12345)',
                'Service delivery for Q1 2024',
                'Training session: Advanced JavaScript concepts'
            ];

            for (const description of validDescriptions) {
                const lineWithDescription = { ...validInvoiceLineData, description };
                expect(() => InvoiceLineSchema.parse(lineWithDescription)).not.toThrow();
            }
        });

        it('should reject empty description', () => {
            const emptyDescriptionLine = { ...validInvoiceLineData, description: '' };
            expect(() => InvoiceLineSchema.parse(emptyDescriptionLine)).toThrow(ZodError);
        });

        it('should reject too long description', () => {
            const longDescriptionLine = {
                ...validInvoiceLineData,
                description: 'A'.repeat(1001)
            };
            expect(() => InvoiceLineSchema.parse(longDescriptionLine)).toThrow(ZodError);
        });
    });

    describe('Optional fields validation', () => {
        it('should validate with optional product reference', () => {
            const withProductRefLine = {
                ...validInvoiceLineData,
                productReference: 'PROD-2024-001'
            };
            expect(() => InvoiceLineSchema.parse(withProductRefLine)).not.toThrow();
        });

        it('should validate with optional tax amount', () => {
            const withTaxAmountLine = {
                ...validInvoiceLineData,
                taxAmount: 63.21
            };
            expect(() => InvoiceLineSchema.parse(withTaxAmountLine)).not.toThrow();
        });

        it('should validate with optional tax rate', () => {
            const withTaxRateLine = {
                ...validInvoiceLineData,
                taxRate: 21.0
            };
            expect(() => InvoiceLineSchema.parse(withTaxRateLine)).not.toThrow();
        });

        it('should validate with optional discount amount', () => {
            const withDiscountLine = {
                ...validInvoiceLineData,
                discountAmount: 25.0,
                total: 276.0 // Adjusted for discount
            };
            expect(() => InvoiceLineSchema.parse(withDiscountLine)).not.toThrow();
        });

        it('should validate with optional notes', () => {
            const withNotesLine = {
                ...validInvoiceLineData,
                notes: 'Includes setup and configuration'
            };
            expect(() => InvoiceLineSchema.parse(withNotesLine)).not.toThrow();
        });
    });

    describe('ID validations', () => {
        it('should validate valid UUID for invoice line ID', () => {
            const validUuidLine = {
                ...validInvoiceLineData,
                id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
            };
            expect(() => InvoiceLineSchema.parse(validUuidLine)).not.toThrow();
        });

        it('should validate valid UUID for invoice ID reference', () => {
            const validInvoiceIdLine = {
                ...validInvoiceLineData,
                invoiceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d999'
            };
            expect(() => InvoiceLineSchema.parse(validInvoiceIdLine)).not.toThrow();
        });

        it('should reject invalid invoice line ID', () => {
            const invalidIdLine = { ...validInvoiceLineData, id: 'invalid-id' };
            expect(() => InvoiceLineSchema.parse(invalidIdLine)).toThrow(ZodError);
        });

        it('should reject invalid invoice ID reference', () => {
            const invalidInvoiceIdLine = { ...validInvoiceLineData, invoiceId: 'invalid-id' };
            expect(() => InvoiceLineSchema.parse(invalidInvoiceIdLine)).toThrow(ZodError);
        });
    });

    describe('Type inference', () => {
        it('should infer correct TypeScript type', () => {
            const invoiceLine = InvoiceLineSchema.parse(validInvoiceLineData);

            // Type assertions to ensure correct inference
            expect(typeof invoiceLine.id).toBe('string');
            expect(typeof invoiceLine.invoiceId).toBe('string');
            expect(typeof invoiceLine.description).toBe('string');
            expect(typeof invoiceLine.quantity).toBe('number');
            expect(typeof invoiceLine.unitPrice).toBe('number');
            expect(typeof invoiceLine.total).toBe('number');
            expect(invoiceLine.createdAt).toBeInstanceOf(Date);
            expect(invoiceLine.updatedAt).toBeInstanceOf(Date);
        });
    });
});
