import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { InvoiceStatusEnum } from '../../src/enums/index.js';
import { InvoiceStatusEnumSchema } from '../../src/enums/invoice-status.schema.js';

describe('InvoiceStatusEnumSchema', () => {
    it('should validate valid invoice status values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(InvoiceStatusEnum).forEach((status) => {
            expect(() => InvoiceStatusEnumSchema.parse(status)).not.toThrow();
        });
    });

    it('should validate OPEN invoice status', () => {
        expect(() => InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.OPEN)).not.toThrow();
    });

    it('should validate PAID invoice status', () => {
        expect(() => InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.PAID)).not.toThrow();
    });

    it('should validate VOID invoice status', () => {
        expect(() => InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.VOID)).not.toThrow();
    });

    it('should reject invalid invoice status values', () => {
        const invalidStatuses = [
            'invalid-status',
            'PENDING', // Not in invoice status
            'CANCELLED',
            'DRAFT',
            'SENT',
            'OVERDUE',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidStatuses.forEach((status) => {
            expect(() => InvoiceStatusEnumSchema.parse(status)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            InvoiceStatusEnumSchema.parse('invalid-status');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.invoiceStatus.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validStatus = InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.OPEN);

        // TypeScript should infer this as InvoiceStatusEnum
        expect(typeof validStatus).toBe('string');
        expect(Object.values(InvoiceStatusEnum)).toContain(validStatus);
    });

    it('should have all required invoice statuses for business model', () => {
        const requiredStatuses = ['open', 'paid', 'void'];

        const enumValues = Object.values(InvoiceStatusEnum);
        expect(enumValues).toHaveLength(requiredStatuses.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredStatuses.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support invoice lifecycle transitions', () => {
        // Test invoice status transitions for business logic
        const openStatus = InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.OPEN);
        const paidStatus = InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.PAID);
        const voidStatus = InvoiceStatusEnumSchema.parse(InvoiceStatusEnum.VOID);

        expect(openStatus).toBe('open');
        expect(paidStatus).toBe('paid');
        expect(voidStatus).toBe('void');

        // These represent the complete invoice lifecycle
        const lifecycle = [openStatus, paidStatus, voidStatus];
        expect(lifecycle).toHaveLength(3);

        // biome-ignore lint/complexity/noForEach: <explanation>
        lifecycle.forEach((status) => {
            expect(typeof status).toBe('string');
            expect(status.length).toBeGreaterThan(0);
        });
    });

    it('should differentiate invoice states correctly', () => {
        // OPEN: Invoice created and sent
        expect(InvoiceStatusEnum.OPEN).toBe('open');

        // PAID: Invoice has been paid
        expect(InvoiceStatusEnum.PAID).toBe('paid');

        // VOID: Invoice has been voided/cancelled
        expect(InvoiceStatusEnum.VOID).toBe('void');
    });
});
