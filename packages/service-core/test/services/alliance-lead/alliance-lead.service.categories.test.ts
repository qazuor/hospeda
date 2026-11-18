/**
 * @fileoverview
 * AllianceLeadService.createLead: `categorySlugs` is validated against the
 * ACTIVE catalog (HOS-919 T-025). The form is anonymous, so this is the only
 * gate.
 */

import { HostTradeBenefitTypeEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceLeadService } from '../../../src/services/alliance-lead/alliance-lead.service';
import type { Actor } from '../../../src/types';

const guest: Actor = {
    id: '00000000-0000-4000-a000-000000000011',
    roles: [RoleEnum.GUEST],
    permissions: []
};

const providerInput = {
    kind: 'service_provider' as const,
    contactName: 'Juan Perez',
    email: 'juan@example.com',
    phone: '+5491112345678',
    message: 'Quiero sumarme al directorio.',
    businessName: 'Plomeria Acme',
    destinationId: '00000000-0000-4000-a000-000000000030',
    benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
    benefitValue: 15,
    categorySlugs: ['plomeria', 'destapaciones-desagotes']
};

type Internals = { _model: unknown; _categoryModel: unknown };

describe('AllianceLeadService.createLead — categorySlugs (HOS-919)', () => {
    let service: AllianceLeadService;
    let create: ReturnType<typeof vi.fn>;
    let findActiveBySlugs: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        service = new AllianceLeadService({ logger: undefined });
        create = vi.fn().mockImplementation(async (data: Record<string, unknown>) => ({
            id: '00000000-0000-4000-a000-000000000002',
            status: 'pending',
            adminNote: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: null,
            updatedById: null,
            deletedById: null,
            ...data
        }));
        findActiveBySlugs = vi.fn();
        const internals = service as unknown as Internals;
        internals._model = { create };
        internals._categoryModel = { findActiveBySlugs };
    });

    const active = (...slugs: string[]) => slugs.map((slug) => ({ id: `id-${slug}`, slug }));

    it('should persist the active slugs in category_slugs and never write the legacy category', async () => {
        findActiveBySlugs.mockResolvedValue(active('plomeria', 'destapaciones-desagotes'));

        const result = await service.createLead({
            actor: guest,
            input: { ...providerInput, category: 'PLOMERIA' } as never
        });

        expect(result.error).toBeUndefined();
        const payload = create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.categorySlugs).toEqual(['plomeria', 'destapaciones-desagotes']);
        expect(payload.category).toBeNull();
    });

    it('should refuse a stale (inactive, deleted or unknown) slug naming categorySlugs', async () => {
        findActiveBySlugs.mockResolvedValue(active('plomeria'));

        const result = await service.createLead({ actor: guest, input: providerInput });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.details).toMatchObject({
            field: 'categorySlugs',
            slugs: ['destapaciones-desagotes']
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('should refuse a service provider with no categories', async () => {
        const result = await service.createLead({
            actor: guest,
            input: { ...providerInput, categorySlugs: [] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(findActiveBySlugs).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
    });

    it('should refuse more than 10 slugs', async () => {
        const many = Array.from({ length: 11 }, (_, i) => `categoria-${i}`);

        const result = await service.createLead({
            actor: guest,
            input: { ...providerInput, categorySlugs: many }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(create).not.toHaveBeenCalled();
    });

    it('should reject duplicated slugs at the schema, before the catalog is consulted', async () => {
        const result = await service.createLead({
            actor: guest,
            input: { ...providerInput, categorySlugs: ['plomeria', 'plomeria'] }
        });

        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(findActiveBySlugs).not.toHaveBeenCalled();
    });

    it('should not consult the catalog for kinds that send no categories', async () => {
        const result = await service.createLead({
            actor: guest,
            input: {
                kind: 'sponsor',
                contactName: 'Juan Perez',
                email: 'juan@example.com',
                message: 'Quiero sumarme.'
            }
        });

        expect(result.error).toBeUndefined();
        expect(findActiveBySlugs).not.toHaveBeenCalled();
        expect((create.mock.calls[0]?.[0] as Record<string, unknown>).categorySlugs).toBeNull();
    });
});
