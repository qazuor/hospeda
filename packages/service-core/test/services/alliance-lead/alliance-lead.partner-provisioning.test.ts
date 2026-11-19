import type { PartnerModel, PartnerTypeModel, SelectAllianceLead } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { LifecycleStatusEnum, PartnerTypeEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    provisionPartnerFromLead,
    resolvePartnerProvisionPlan
} from '../../../src/services/alliance-lead/alliance-lead.partner-provisioning';

/**
 * A partner lead carrying everything a `partners` row needs.
 *
 * Only the fields the planner reads are meaningful; the rest exist to satisfy
 * the row type.
 */
const partnerLead = (overrides: Partial<SelectAllianceLead> = {}): SelectAllianceLead =>
    ({
        id: '00000000-0000-4000-a000-000000000001',
        kind: 'partner',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+5493411234567',
        message: 'Queremos proponer una alianza institucional.',
        status: 'approved',
        adminNote: null,
        applicantUserId: '00000000-0000-4000-a000-000000000009',
        claimToken: null,
        claimExpiresAt: null,
        businessName: 'Fundación Acme',
        partnerType: PartnerTypeEnum.NGO,
        category: null,
        destinationId: null,
        benefitType: null,
        benefitValue: null,
        benefitText: null,
        provisionedHostTradeId: null,
        provisionedPartnerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...overrides
    }) as SelectAllianceLead;

/** A logger that records nothing — the skip paths log, and that is not the assertion. */
const silentLogger = (): ILogger =>
    ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }) as unknown as ILogger;

/** A PartnerModel stub whose `create` echoes back an id, and whose slugs are all free. */
const partnerModelStub = (overrides: { readonly slugTaken?: readonly string[] } = {}) => {
    const taken = new Set(overrides.slugTaken ?? []);
    const create = vi.fn(async (data: Record<string, unknown>) => ({
        id: '00000000-0000-4000-a000-0000000000ff',
        ...data
    }));
    const findOne = vi.fn(async (filters: { slug: string }) =>
        taken.has(filters.slug) ? { id: 'existing' } : null
    );
    return { create, findOne } as unknown as PartnerModel & {
        create: ReturnType<typeof vi.fn>;
        findOne: ReturnType<typeof vi.fn>;
    };
};

/** Catalog ids of the stub types (HOS-2336). */
const NGO_TYPE_ID = '00000000-0000-4000-a000-0000000000b1';
const MEDIA_TYPE_ID = '00000000-0000-4000-a000-0000000000b2';

/**
 * A PartnerTypeModel stub: `ngo` and `media` are ACTIVE; any other slug
 * (deactivated, deleted or unknown) resolves to null, as the real FOR SHARE
 * read does.
 */
const partnerTypeModelStub = (
    active: ReadonlyArray<{ id: string; slug: string }> = [
        { id: NGO_TYPE_ID, slug: 'ngo' },
        { id: MEDIA_TYPE_ID, slug: 'media' }
    ]
) => {
    const findActiveBySlugForShare = vi.fn(
        async (slug: string) => active.find((row) => row.slug === slug) ?? null
    );
    return { findActiveBySlugForShare } as unknown as PartnerTypeModel & {
        findActiveBySlugForShare: ReturnType<typeof vi.fn>;
    };
};

describe('resolvePartnerProvisionPlan', () => {
    it('should plan a partner for a complete partner lead', () => {
        // Arrange
        const lead = partnerLead();

        // Act
        const plan = resolvePartnerProvisionPlan(lead);

        // Assert
        expect(plan.kind).toBe('provision');
        if (plan.kind === 'provision') {
            expect(plan.organizationName).toBe('Fundación Acme');
            expect(plan.typeSlug).toBe('ngo');
        }
    });

    it.each([
        'service_provider',
        'sponsor',
        'editor'
    ] as const)('should skip a %s lead — this action is partner-only', (kind) => {
        const plan = resolvePartnerProvisionPlan(partnerLead({ kind }));

        expect(plan).toEqual({ kind: 'skip', reason: 'not-a-partner' });
    });

    it('should skip a lead that already provisioned a partner', () => {
        // Arrange — pressing the button twice must not mint a second
        // organization: the slug deduplicator would name it `fundacion-acme-2`
        // without erroring, and the directory would show the partner twice.
        const lead = partnerLead({
            provisionedPartnerId: '00000000-0000-4000-a000-000000000003'
        });

        // Act
        const plan = resolvePartnerProvisionPlan(lead);

        // Assert
        expect(plan).toEqual({
            kind: 'skip',
            reason: 'already-provisioned',
            partnerId: '00000000-0000-4000-a000-000000000003'
        });
    });

    it('should degrade a lead with no businessName — the backend schema never required it', () => {
        // Arrange — `REQUIRED_PARTNER_FIELDS` carries `partnerType` alone, so a
        // lead POSTed straight to the API is a valid partner row with no name,
        // and `partners.name` is NOT NULL.
        const lead = partnerLead({ businessName: null });

        // Act
        const plan = resolvePartnerProvisionPlan(lead);

        // Assert
        expect(plan).toEqual({ kind: 'skip', reason: 'legacy-lead-without-typed-fields' });
    });

    it('should degrade a lead whose partnerType is absent', () => {
        const plan = resolvePartnerProvisionPlan(partnerLead({ partnerType: null }));

        expect(plan).toEqual({ kind: 'skip', reason: 'legacy-lead-without-typed-fields' });
    });

    it('should plan a catalog slug that is not a legacy enum value (HOS-2336)', () => {
        // Arrange — `media` exists only in the catalog. Whether it is still
        // ACTIVE is decided at execution, under a lock.
        const plan = resolvePartnerProvisionPlan(partnerLead({ partnerType: 'media' }));

        // Assert
        expect(plan).toEqual({
            kind: 'provision',
            organizationName: 'Fundación Acme',
            typeSlug: 'media'
        });
    });

    it('should degrade a lead whose partnerType is not even a slug', () => {
        // Arrange — a value that cannot be a catalog slug at all.
        const lead = partnerLead({ partnerType: 'Not A Slug' as PartnerTypeEnum });

        // Act
        const plan = resolvePartnerProvisionPlan(lead);

        // Assert
        expect(plan).toEqual({ kind: 'skip', reason: 'legacy-lead-without-typed-fields' });
    });
});

describe('provisionPartnerFromLead', () => {
    it('creates the partner DORMANT without removed commercial fields', async () => {
        // Arrange
        const partnerModel = partnerModelStub();

        // Act
        const result = await provisionPartnerFromLead({
            lead: partnerLead(),
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert
        expect(result).toEqual({
            provisioned: true,
            partnerId: '00000000-0000-4000-a000-0000000000ff'
        });

        const inserted = partnerModel.create.mock.calls[0]?.[0] as Record<string, unknown>;

        // Dormant: public visibility needs ACTIVE **and** active together, so a
        // provisioned partner is invisible until it pays.
        expect(inserted.lifecycleState).toBe(LifecycleStatusEnum.DRAFT);

        // The whole point of making the column nullable (HOS-278 D1). Asserted
        // as absent rather than "not today", because writing ANY date here is
        // the invented value the change exists to stop.
        expect(Object.keys(inserted).sort()).toEqual([
            'createdById',
            'lifecycleState',
            'name',
            'ownerUserId',
            'slug',
            'type',
            'typeId',
            'updatedById'
        ]);

        expect(inserted.name).toBe('Fundación Acme');
        // Dual-write (HOS-2336 release N): catalog id plus the legacy value.
        expect(inserted.typeId).toBe(NGO_TYPE_ID);
        expect(inserted.type).toBe(PartnerTypeEnum.NGO);
        expect(inserted.createdById).toBe('00000000-0000-4000-a000-00000000000a');
    });

    it('should carry the applicant across as the owner', async () => {
        // Arrange
        const partnerModel = partnerModelStub();

        // Act
        await provisionPartnerFromLead({
            lead: partnerLead(),
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert
        const inserted = partnerModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.ownerUserId).toBe('00000000-0000-4000-a000-000000000009');
    });

    it('should create an UNOWNED partner for an anonymous applicant', async () => {
        // Arrange — an anonymous submission whose email already had an account
        // stays unlinked until the owner redeems the claim token. The partner is
        // still created; until then the ownership filter matches nobody.
        const partnerModel = partnerModelStub();

        // Act
        const result = await provisionPartnerFromLead({
            lead: partnerLead({ applicantUserId: null }),
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert
        expect(result.provisioned).toBe(true);
        const inserted = partnerModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.ownerUserId).toBeNull();
    });

    it('should deduplicate the slug against partners that already exist', async () => {
        // Arrange
        const partnerModel = partnerModelStub({ slugTaken: ['fundacion-acme'] });

        // Act
        await provisionPartnerFromLead({
            lead: partnerLead(),
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert
        const inserted = partnerModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.slug).not.toBe('fundacion-acme');
        expect(partnerModel.findOne).toHaveBeenCalled();
    });

    it.each([
        ['not-a-partner', partnerLead({ kind: 'sponsor' })],
        ['legacy-lead-without-typed-fields', partnerLead({ businessName: null })]
    ] as const)('should write nothing when the plan skips with %s', async (reason, lead) => {
        // Arrange
        const partnerModel = partnerModelStub();

        // Act
        const result = await provisionPartnerFromLead({
            lead,
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert
        expect(result).toEqual({ provisioned: false, reason, partnerId: undefined });
        expect(partnerModel.create).not.toHaveBeenCalled();
    });

    it('should report the existing partner id when already provisioned', async () => {
        // Arrange
        const partnerModel = partnerModelStub();
        const lead = partnerLead({
            provisionedPartnerId: '00000000-0000-4000-a000-000000000003'
        });

        // Act
        const result = await provisionPartnerFromLead({
            lead,
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert — idempotent: the caller learns which partner the lead already
        // points at instead of getting a second one.
        expect(result).toEqual({
            provisioned: false,
            reason: 'already-provisioned',
            partnerId: '00000000-0000-4000-a000-000000000003'
        });
        expect(partnerModel.create).not.toHaveBeenCalled();
    });

    it('should write a NULL legacy type for a catalog-only type (HOS-2336)', async () => {
        // Arrange
        const partnerModel = partnerModelStub();

        // Act
        const result = await provisionPartnerFromLead({
            lead: partnerLead({ partnerType: 'media' }),
            partnerModel,
            partnerTypeModel: partnerTypeModelStub(),
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger: silentLogger()
        });

        // Assert — `media` has no enum value, so only `type_id` carries it.
        expect(result.provisioned).toBe(true);
        const inserted = partnerModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.typeId).toBe(MEDIA_TYPE_ID);
        expect(inserted.type).toBeNull();
    });

    it('should skip with no-active-partner-type when the type was deactivated after submission (AC-2.2)', async () => {
        // Arrange — the stub has no ACTIVE `ngo`: it was deactivated or deleted
        // between submission and approval.
        const partnerModel = partnerModelStub();
        const partnerTypeModel = partnerTypeModelStub([{ id: MEDIA_TYPE_ID, slug: 'media' }]);
        const logger = silentLogger();

        // Act
        const result = await provisionPartnerFromLead({
            lead: partnerLead(),
            partnerModel,
            partnerTypeModel,
            actorId: '00000000-0000-4000-a000-00000000000a',
            logger
        });

        // Assert
        expect(result).toEqual({ provisioned: false, reason: 'no-active-partner-type' });
        expect(partnerTypeModel.findActiveBySlugForShare).toHaveBeenCalledWith('ngo', undefined);
        expect(partnerModel.create).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                leadId: '00000000-0000-4000-a000-000000000001',
                partnerTypeSlug: 'ngo'
            }),
            expect.any(String)
        );
    });
});
