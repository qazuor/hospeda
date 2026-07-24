import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AllianceLeadAdminListQuerySchema } from '../../../src/entities/alliance-lead/alliance-lead.admin-search.schema.js';
import {
    AllianceLeadAdminUpdateInputSchema,
    AllianceLeadCreateInputSchema,
    AllianceLeadDeleteInputSchema,
    AllianceLeadMarkHandledSchema
} from '../../../src/entities/alliance-lead/alliance-lead.crud.schema.js';
import { AllianceLeadSchema } from '../../../src/entities/alliance-lead/alliance-lead.schema.js';

const validLeadBase = () => ({
    id: faker.string.uuid(),
    kind: 'partner' as const,
    contactName: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+549341234567',
    message: 'Quiero sumarme como aliado de la plataforma.',
    status: 'pending' as const,
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
});

describe('AllianceLeadSchema', () => {
    it('should validate a valid lead', () => {
        const data = validLeadBase();
        expect(() => AllianceLeadSchema.parse(data)).not.toThrow();
    });

    it('should default status to pending', () => {
        const { status: _s, ...data } = validLeadBase();
        const result = AllianceLeadSchema.parse(data);
        expect(result.status).toBe('pending');
    });

    it('should validate all four kind values', () => {
        for (const kind of ['partner', 'sponsor', 'editor', 'service_provider']) {
            const data = { ...validLeadBase(), kind };
            expect(() => AllianceLeadSchema.parse(data), `kind=${kind}`).not.toThrow();
        }
    });

    it('should reject a kind outside the closed enum', () => {
        const data = { ...validLeadBase(), kind: 'affiliate' };
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should validate all workflow status values', () => {
        for (const status of ['pending', 'reviewing', 'approved', 'rejected']) {
            const data = { ...validLeadBase(), status };
            expect(() => AllianceLeadSchema.parse(data), `status=${status}`).not.toThrow();
        }
    });

    it('should reject a status outside the closed enum', () => {
        const data = { ...validLeadBase(), status: 'accepted' };
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should accept nullish phone', () => {
        const data = { ...validLeadBase(), phone: null };
        expect(() => AllianceLeadSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
        const data = { ...validLeadBase(), email: 'not-an-email' };
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject message shorter than 10 characters', () => {
        const data = { ...validLeadBase(), message: 'Short' };
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject invalid id format', () => {
        const data = { ...validLeadBase(), id: 'not-a-uuid' };
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing kind', () => {
        const { kind: _k, ...data } = validLeadBase();
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing email', () => {
        const { email: _e, ...data } = validLeadBase();
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject missing message', () => {
        const { message: _m, ...data } = validLeadBase();
        expect(() => AllianceLeadSchema.parse(data)).toThrow(ZodError);
    });
});

describe('AllianceLeadCreateInputSchema', () => {
    it('should validate a minimal create input', () => {
        const data = {
            kind: 'sponsor',
            contactName: 'María García',
            email: 'maria@example.com',
            message: 'Quiero patrocinar contenido de la plataforma.'
        };
        expect(() => AllianceLeadCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should accept the honeypot-adjacent optional phone field', () => {
        const data = {
            kind: 'service_provider',
            contactName: 'Test Provider',
            email: 'provider@example.com',
            phone: '+5493411234567',
            message: 'Quiero sumar mi servicio al directorio de proveedores.'
        };
        expect(() => AllianceLeadCreateInputSchema.parse(data)).not.toThrow();
    });

    it('should not include id, status, or adminNote in create input', () => {
        const keys = Object.keys(AllianceLeadCreateInputSchema.shape ?? {});
        expect(keys).not.toContain('id');
        expect(keys).not.toContain('status');
        expect(keys).not.toContain('adminNote');
        expect(keys).not.toContain('createdAt');
        expect(keys).not.toContain('deletedAt');
    });

    it('should reject when email is missing', () => {
        const data = { kind: 'editor', contactName: 'Test', message: 'A valid message here.' };
        expect(() => AllianceLeadCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject when kind is missing', () => {
        const data = {
            contactName: 'Test Person',
            email: 'test@example.com',
            message: 'A valid message here.'
        };
        expect(() => AllianceLeadCreateInputSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject an invalid kind value', () => {
        const data = {
            kind: 'affiliate',
            contactName: 'Test Person',
            email: 'test@example.com',
            message: 'A valid message here.'
        };
        expect(() => AllianceLeadCreateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('AllianceLeadMarkHandledSchema', () => {
    it('should validate an approval', () => {
        const data = { status: 'approved', adminNote: 'Looks great, approved.' };
        expect(() => AllianceLeadMarkHandledSchema.parse(data)).not.toThrow();
    });

    it('should validate a rejection without a note', () => {
        const data = { status: 'rejected' };
        expect(() => AllianceLeadMarkHandledSchema.parse(data)).not.toThrow();
    });

    it('should reject a non-terminal status (pending)', () => {
        const data = { status: 'pending' };
        expect(() => AllianceLeadMarkHandledSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject a non-terminal status (reviewing)', () => {
        const data = { status: 'reviewing' };
        expect(() => AllianceLeadMarkHandledSchema.parse(data)).toThrow(ZodError);
    });

    it('should reject an invalid status value', () => {
        const data = { status: 'accepted' };
        expect(() => AllianceLeadMarkHandledSchema.parse(data)).toThrow(ZodError);
    });
});

describe('AllianceLeadAdminUpdateInputSchema', () => {
    it('should validate a valid admin update (status transition)', () => {
        const data = { id: faker.string.uuid(), status: 'reviewing' as const };
        expect(() => AllianceLeadAdminUpdateInputSchema.parse(data)).not.toThrow();
    });

    it('should reject missing id', () => {
        expect(() => AllianceLeadAdminUpdateInputSchema.parse({ status: 'approved' })).toThrow(
            ZodError
        );
    });

    it('should reject invalid status value', () => {
        const data = { id: faker.string.uuid(), status: 'accepted' };
        expect(() => AllianceLeadAdminUpdateInputSchema.parse(data)).toThrow(ZodError);
    });
});

describe('AllianceLeadDeleteInputSchema', () => {
    it('should validate a valid delete input', () => {
        const data = { id: faker.string.uuid() };
        expect(() => AllianceLeadDeleteInputSchema.parse(data)).not.toThrow();
    });

    it('should default force to false', () => {
        const result = AllianceLeadDeleteInputSchema.parse({ id: faker.string.uuid() });
        expect(result.force).toBe(false);
    });

    it('should reject invalid id', () => {
        expect(() => AllianceLeadDeleteInputSchema.parse({ id: 'bad' })).toThrow(ZodError);
    });
});

describe('AllianceLeadAdminListQuerySchema', () => {
    it('should default page and pageSize when omitted', () => {
        const result = AllianceLeadAdminListQuerySchema.parse({});
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(20);
    });

    it('should coerce string query params for page/pageSize', () => {
        const result = AllianceLeadAdminListQuerySchema.parse({ page: '2', pageSize: '50' });
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(50);
    });

    it('should accept kind and status filters', () => {
        const result = AllianceLeadAdminListQuerySchema.parse({
            kind: 'sponsor',
            status: 'reviewing'
        });
        expect(result.kind).toBe('sponsor');
        expect(result.status).toBe('reviewing');
    });

    it('should reject an invalid kind filter', () => {
        expect(() => AllianceLeadAdminListQuerySchema.parse({ kind: 'affiliate' })).toThrow(
            ZodError
        );
    });

    it('should reject an invalid status filter', () => {
        expect(() => AllianceLeadAdminListQuerySchema.parse({ status: 'accepted' })).toThrow(
            ZodError
        );
    });

    it('should reject pageSize above the max of 100', () => {
        expect(() => AllianceLeadAdminListQuerySchema.parse({ pageSize: 101 })).toThrow(ZodError);
    });
});
