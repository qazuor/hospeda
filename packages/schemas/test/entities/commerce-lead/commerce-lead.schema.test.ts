import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    CommerceLeadAdminUpdateInputSchema,
    CommerceLeadCreateInputSchema,
    CommerceLeadDeleteInputSchema
} from '../../../src/entities/commerce-lead/commerce-lead.crud.schema.js';
import { CommerceLeadSchema } from '../../../src/entities/commerce-lead/commerce-lead.schema.js';

const validLeadBase = () => ({
    id: faker.string.uuid(),
    domain: 'gastronomy',
    businessName: 'La Parrilla de Juan',
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+549341234567',
    destinationId: faker.string.uuid(),
    message: 'Quiero listar mi parrilla en la plataforma.',
    status: 'pending' as const,
    handledAt: null,
    handledById: null,
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null
});

describe('CommerceLeadSchema', () => {
    it('should validate a valid lead', () => {
        const data = validLeadBase();
        expect(() => CommerceLeadSchema.parse(data)).not.toThrow();
    });

    it('should default status to pending', () => {
        const { status: _s, ...data } = validLeadBase();
        const result = CommerceLeadSchema.parse(data);
        expect(result.status).toBe('pending');
    });

    it('should validate all workflow status values', () => {
        for (const status of ['pending', 'reviewing', 'approved', 'rejected']) {
            const data = { ...validLeadBase(), status };
            expect(() => CommerceLeadSchema.parse(data), `status=${status}`).not.toThrow();
        }
    });

    it('should accept nullish phone', () => {
        const data = { ...validLeadBase(), phone: null };
        expect(() => CommerceLeadSchema.parse(data)).not.toThrow();
    });

    it('should accept nullish destinationId', () => {
        const data = { ...validLeadBase(), destinationId: null };
        expect(() => CommerceLeadSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
        const data = { ...validLeadBase(), email: 'not-an-email' };
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject businessName shorter than 2 characters', () => {
        const data = { ...validLeadBase(), businessName: 'A' };
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject message shorter than 10 characters', () => {
        const data = { ...validLeadBase(), message: 'Short' };
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid id format', () => {
        const data = { ...validLeadBase(), id: 'not-a-uuid' };
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing businessName', () => {
        const { businessName: _b, ...data } = validLeadBase();
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing email', () => {
        const { email: _e, ...data } = validLeadBase();
        expect(() => CommerceLeadSchema.parse(data)).toThrow(ZodError);
    });
});

describe('CommerceLeadCreateInputSchema', () => {
    it('should validate a minimal create input', () => {
        const data = {
            domain: 'gastronomy',
            businessName: 'El Café',
            contactName: 'María García',
            email: 'maria@example.com'
        };
        expect(() => CommerceLeadCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should not include id or status in create input', () => {
        const keys = Object.keys(CommerceLeadCreateInputSchema.shape ?? {});
        expect(keys).not.toContain('id');
        expect(keys).not.toContain('status');
        expect(keys).not.toContain('handledAt');
        expect(keys).not.toContain('handledById');
        expect(keys).not.toContain('adminNote');
    });

    it('should reject when email is missing', () => {
        const data = { domain: 'gastronomy', businessName: 'Test', contactName: 'Test Person' };
        expect(() => CommerceLeadCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject when businessName is missing', () => {
        const data = {
            domain: 'gastronomy',
            contactName: 'Test Person',
            email: 'test@example.com'
        };
        expect(() => CommerceLeadCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('CommerceLeadAdminUpdateInputSchema', () => {
    it('should validate a valid admin update (status transition)', () => {
        const data = {
            id: faker.string.uuid(),
            status: 'reviewing' as const
        };
        expect(() => CommerceLeadAdminUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should validate an approval with handledAt and handledById', () => {
        const data = {
            id: faker.string.uuid(),
            status: 'approved' as const,
            handledAt: new Date(),
            handledById: faker.string.uuid(),
            adminNote: 'Approved — listing looks great.'
        };
        expect(() => CommerceLeadAdminUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing id', () => {
        expect(() => CommerceLeadAdminUpdateInputSchema.parse({ status: 'approved' })).toThrow(
            ZodError
        );
    });

    it('should reject invalid status value', () => {
        const data = { id: faker.string.uuid(), status: 'accepted' };
        expect(() => CommerceLeadAdminUpdateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('CommerceLeadDeleteInputSchema', () => {
    it('should validate a valid delete input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => CommerceLeadDeleteInputSchema.parse(data)).not.toThrow();
    });

    it('should default force to false', () => {
        const result = CommerceLeadDeleteInputSchema.parse({ id: faker.string.uuid() });
        expect(result.force).toBe(false);
    });

    it('should accept force: true', () => {
        const result = CommerceLeadDeleteInputSchema.parse({
            id: faker.string.uuid(),
            force: true
        });
        expect(result.force).toBe(true);
    });

    it('should reject invalid id', () => {
        expect(() => CommerceLeadDeleteInputSchema.parse({ id: 'bad' })).toThrow(ZodError);
    });
});
