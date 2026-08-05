import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AllianceLeadAdminListQuerySchema } from '../../../src/entities/alliance-lead/alliance-lead.admin-search.schema.js';
import {
    AllianceLeadAdminUpdateInputSchema,
    AllianceLeadCreateInputSchema,
    AllianceLeadDeleteInputSchema,
    AllianceLeadMarkHandledSchema,
    AllianceLeadSubmissionSchema
} from '../../../src/entities/alliance-lead/alliance-lead.crud.schema.js';
import { AllianceLeadSchema } from '../../../src/entities/alliance-lead/alliance-lead.schema.js';
import { HostTradeBenefitTypeEnum } from '../../../src/enums/host-trade-benefit-type.enum.js';
import { HostTradeCategoryEnum } from '../../../src/enums/host-trade-category.enum.js';

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

describe('AllianceLeadSubmissionSchema — per-kind requirement (HOS-278)', () => {
    /** A `service_provider` submission carrying every field its kind requires. */
    const validProviderSubmission = () => ({
        kind: 'service_provider' as const,
        contactName: 'Test Provider',
        email: 'provider@example.com',
        message: 'Quiero sumar mi servicio al directorio de proveedores.',
        category: HostTradeCategoryEnum.PLOMERIA,
        destinationId: faker.string.uuid(),
        benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
        benefitValue: 15,
        benefitText: 'No acumulable con otras promociones.'
    });

    it('should accept a complete service_provider submission', () => {
        expect(() => AllianceLeadSubmissionSchema.parse(validProviderSubmission())).not.toThrow();
    });

    it.each([
        'category',
        'destinationId',
        'benefitType'
    ] as const)('should reject a service_provider submission missing %s', (field) => {
        const { [field]: _omitted, ...data } = validProviderSubmission();
        expect(() => AllianceLeadSubmissionSchema.parse(data)).toThrow(ZodError);
    });

    it.each([
        'category',
        'destinationId',
        'benefitType'
    ] as const)('should point the %s error at that exact field', (field) => {
        const { [field]: _omitted, ...data } = validProviderSubmission();
        const result = AllianceLeadSubmissionSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((issue) => issue.path.join('.'));
            expect(paths).toContain(field);
        }
    });

    it.each([
        'partner',
        'sponsor',
        'editor'
    ] as const)('should accept a %s submission with none of the provider fields', (kind) => {
        // Arrange — the other three programs never collect provider data;
        // requiring it from them would break three live public forms.
        const data = {
            kind,
            contactName: 'Test Applicant',
            email: 'applicant@example.com',
            message: 'Quiero sumarme al programa de aliados.'
        };

        // Act + Assert
        expect(() => AllianceLeadSubmissionSchema.parse(data)).not.toThrow();
    });

    it('should still enforce the benefit value/type pairing on a provider', () => {
        // Arrange — a PERCENTAGE with no value: the benefit rule is delegated,
        // and this proves the delegation is actually wired, not just written.
        const { benefitValue: _v, ...data } = validProviderSubmission();

        // Act
        const result = AllianceLeadSubmissionSchema.safeParse(data);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((issue) => issue.message);
            expect(messages).toContain('zodError.hostTrade.benefitValue.required');
        }
    });

    it('should reject a provider benefit above 100%', () => {
        const data = { ...validProviderSubmission(), benefitValue: 101 };
        const result = AllianceLeadSubmissionSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((issue) => issue.message);
            expect(messages).toContain('zodError.hostTrade.benefitValue.percentageMax');
        }
    });

    it('should accept a 2x1 provider benefit with no numeric value', () => {
        const { benefitValue: _v, ...rest } = validProviderSubmission();
        const data = { ...rest, benefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE };

        expect(() => AllianceLeadSubmissionSchema.parse(data)).not.toThrow();
    });

    it('should leave the plain create-input object unrefined, so .extend() keeps working', () => {
        // Arrange — the HTTP layer extends this object with a honeypot field and
        // OpenAPI generates from it; neither survives a superRefine wrapper. An
        // incomplete provider payload passing HERE is the intended split, with
        // the service as the enforcing choke point.
        const {
            category: _c,
            destinationId: _d,
            benefitType: _b,
            ...data
        } = validProviderSubmission();

        // Act + Assert
        expect(() => AllianceLeadCreateInputSchema.parse(data)).not.toThrow();
        expect(AllianceLeadCreateInputSchema.shape).toBeDefined();
    });
});
