import type { SelectAllianceLead } from '@repo/db';
import { HostTradeBenefitTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveProvisionPlan } from '../../../src/services/alliance-lead/alliance-lead.provisioning';

/**
 * A service-provider lead carrying everything a listing needs.
 *
 * Only the fields `resolveProvisionPlan` reads are meaningful; the rest exist
 * to satisfy the row type.
 */
const providerLead = (overrides: Partial<SelectAllianceLead> = {}): SelectAllianceLead =>
    ({
        id: '00000000-0000-4000-a000-000000000001',
        kind: 'service_provider',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+5493411234567',
        message: 'Quiero sumarme al directorio.',
        status: 'approved',
        adminNote: null,
        applicantUserId: '00000000-0000-4000-a000-000000000009',
        claimToken: null,
        claimExpiresAt: null,
        businessName: 'Plomería Acme',
        category: null,
        categorySlugs: ['plomeria', 'destapaciones-desagotes'],
        destinationId: '00000000-0000-4000-a000-000000000002',
        benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
        benefitValue: 15,
        benefitText: 'No acumulable.',
        provisionedHostTradeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...overrides
    }) as SelectAllianceLead;

describe('resolveProvisionPlan', () => {
    it('should plan a listing for a complete service-provider lead', () => {
        // Arrange
        const lead = providerLead();

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan.kind).toBe('provision');
        if (plan.kind === 'provision') {
            expect(plan.businessName).toBe('Plomería Acme');
            expect(plan.categorySlugs).toEqual(['plomeria', 'destapaciones-desagotes']);
            expect(plan.destinationId).toBe('00000000-0000-4000-a000-000000000002');
            expect(plan.benefitType).toBe(HostTradeBenefitTypeEnum.PERCENTAGE);
        }
    });

    it.each([
        'partner',
        'sponsor',
        'editor'
    ] as const)('should skip a %s lead — NG-1 still holds for the other three programs', (kind) => {
        const plan = resolveProvisionPlan(providerLead({ kind }));

        expect(plan).toEqual({ kind: 'skip', reason: 'not-a-service-provider' });
    });

    it('should skip a lead that already provisioned a listing', () => {
        // Arrange — re-approving must not mint a second listing: the slug
        // deduplicator would name it `plomeria-acme-2` without erroring, and
        // the directory would show the provider twice.
        const lead = providerLead({
            provisionedHostTradeId: '00000000-0000-4000-a000-000000000003'
        });

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan.kind).toBe('skip');
        if (plan.kind === 'skip') {
            expect(plan.reason).toBe('already-provisioned');
            expect(plan.hostTradeId).toBe('00000000-0000-4000-a000-000000000003');
        }
    });

    it.each([
        'businessName',
        'categorySlugs',
        'destinationId'
    ] as const)('should skip a legacy lead with no %s instead of failing the approval', (field) => {
        // Arrange — leads submitted under HOS-277 NG-3 kept their answers
        // as prose inside `message`. Refusing to approve them would strand
        // every provider lead already sitting in the admin inbox.
        const lead = providerLead({ [field]: null } as Partial<SelectAllianceLead>);

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan).toEqual({
            kind: 'skip',
            reason: 'legacy-lead-without-typed-fields'
        });
    });

    it('should skip a lead with an empty categorySlugs array', () => {
        const plan = resolveProvisionPlan(providerLead({ categorySlugs: [] }));

        expect(plan).toEqual({ kind: 'skip', reason: 'legacy-lead-without-typed-fields' });
    });

    it('should treat a lead with only the legacy category as legacy and never read it (HOS-919)', () => {
        // Arrange — `category` throws if touched: the plan must not read it.
        const lead = providerLead({ categorySlugs: null });
        Object.defineProperty(lead, 'category', {
            get() {
                throw new Error('legacy category must not be read');
            }
        });

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan).toEqual({ kind: 'skip', reason: 'legacy-lead-without-typed-fields' });
    });

    it('should skip a lead whose benefitType is not a value the listing enum accepts', () => {
        const lead = providerLead({ benefitType: 'HALF_PRICE_TUESDAYS' });

        const plan = resolveProvisionPlan(lead);

        expect(plan).toEqual({
            kind: 'skip',
            reason: 'legacy-lead-without-typed-fields'
        });
    });

    it('should plan a listing when the benefit carries no type at all', () => {
        // Arrange — benefitType is nullish-tolerant: the three required fields
        // are the ones `host_trades` declares NOT NULL, and benefit_type is not
        // one of them.
        const lead = providerLead({ benefitType: null, benefitValue: null });

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan.kind).toBe('provision');
        if (plan.kind === 'provision') {
            expect(plan.benefitType).toBeNull();
        }
    });

    it('should plan a listing for an unclaimed applicant', () => {
        // Arrange — an anonymous submission whose email already had an account
        // stays unlinked until the owner redeems the claim token. The listing
        // is still created; the claim backfills the owner later.
        const lead = providerLead({ applicantUserId: null });

        // Act
        const plan = resolveProvisionPlan(lead);

        // Assert
        expect(plan.kind).toBe('provision');
    });
});
