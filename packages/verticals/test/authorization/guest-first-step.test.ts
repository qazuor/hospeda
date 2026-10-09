/** TEST:V5:19 — the guest fails at step 1 of listing access except READ_PUBLIC. */
import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { readListingAccessFacts } from '../../src/authorization/listing-facts';
import { LISTING_OPERATIONS } from '../../src/authorization/listing-operation';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import type { PlanCatalogReader } from '../../src/plan-catalog/catalog-reader';

// ── Ports (fakes) ──────────────────────────────────────────────────────────────

const source = {
    type: 'BASE' as const,
    reference: { kind: 'PLAN_VERSION' as const, planVersionId: 'floor-version' },
    scope: 'VERTICAL' as const,
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES' as const,
    charged: null,
    floor: null
};

function ports() {
    const coverage = vi.fn(async () => ({ covered: false, sources: [source] }));
    const findPlanVersionEffects = vi.fn(async () => ({
        entitlements: [
            { key: 'recover_own_listing', planQuota: null, aggregationStrategy: 'MAX' as const }
        ],
        limits: []
    }));
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    const catalog: Pick<PlanCatalogReader, 'findPlanVersionEffects'> = { findPlanVersionEffects };
    return { billing, catalog, coverage, findPlanVersionEffects };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const FOREIGN_PUBLISHED: import('../../src/authorization/resource-step').ListingAccessFacts = {
    ownerId: 'owner',
    publicationStatus: PublicationStatusEnum.PUBLISHED
};

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('TEST:V5:19 guest rejects at step 1', () => {
    it.each(
        LISTING_OPERATIONS.filter((op) => op !== 'READ_PUBLIC')
    )('guest (actorId=null) is rejected on %s (READ_PUBLIC excluded)', async (operation) => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation,
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
        expect(port.coverage).not.toHaveBeenCalled();
        expect(port.findPlanVersionEffects).not.toHaveBeenCalled();
    });

    it('TEST:V5:19 WRITE_ABOUT_LISTING on PUBLISHED foreign listing rejects the guest', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'WRITE_ABOUT_LISTING',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('guest on READ_PUBLIC: PUBLISHED foreign listing → allowed', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: true, evaluatedSteps: [4] });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.PURGED
    ] as const)('guest on READ_PUBLIC: non-PUBLISHED foreign (%s) → NOT_FOUND', async (status) => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ownerId: 'owner', publicationStatus: status },
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('guest on READ_PUBLIC: facts=null → NOT_FOUND', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: null,
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});

describe('TEST:V5:19 step 1 reveals nothing about the resource', () => {
    it('WRITE_ABOUT_LISTING: guest returns UNAUTHENTICATED regardless of facts content', async () => {
        const portNone = ports();
        const portArchived = ports();
        const portPublished = ports();

        const resultNull = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: null,
            operation: 'WRITE_ABOUT_LISTING',
            ...portNone
        });
        const resultArchived = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.ARCHIVED },
            operation: 'WRITE_ABOUT_LISTING',
            ...portArchived
        });
        const resultPublished = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'WRITE_ABOUT_LISTING',
            ...portPublished
        });

        expect(resultNull).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
        expect(resultArchived).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
        expect(resultPublished).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
    });
});

describe('TEST:V5:19 empty actorId treated as guest', () => {
    it('actorId="" on WRITE_ABOUT_LISTING → UNAUTHENTICATED', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: '',
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'WRITE_ABOUT_LISTING',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
    });
});

describe('TEST:V5:19 authenticated actors are not affected', () => {
    it("actorId='someone' WRITE_ABOUT_LISTING on PUBLISHED foreign → allowed with step 4", async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: 'someone',
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'WRITE_ABOUT_LISTING',
            ...port
        });
        expect(result).toEqual({ allowed: true, evaluatedSteps: [4] });
    });

    it("actorId='someone' READ_PUBLIC on PUBLISHED foreign → allowed with step 4", async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: 'someone',
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: true, evaluatedSteps: [4] });
    });
});

describe('TEST:V5:19 vertical pre-condition before step 1', () => {
    // Depends on the transitory NULL bridge; HOS-1641 (V6.9b) removes it and this case with it.
    it('TRANSITORY bridge: guest READ_PUBLIC on published row via readListingAccessFacts → allowed', async () => {
        const port = ports();
        const rawEntity = {
            ownerId: 'owner',
            publicationStatus: null,
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC'
        } as const;
        const facts = readListingAccessFacts({ entity: rawEntity });
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts,
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: true, evaluatedSteps: [4] });
    });

    it('TRANSITORY bridge: ownerSuspended=true → NULL status → guest READ_PUBLIC → NOT_FOUND', async () => {
        const port = ports();
        const rawEntity = {
            ownerId: 'owner',
            publicationStatus: null,
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC',
            ownerSuspended: true
        } as const;
        const facts = readListingAccessFacts({ entity: rawEntity });
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.ACCOMMODATION,
            facts,
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('guest with mismatched declared vertical: READ_PUBLIC → NOT_FOUND (vertical check before step 1)', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.GASTRONOMY,
            declaredVertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'READ_PUBLIC',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('guest with mismatched declared vertical: WRITE_ABOUT_LISTING → NOT_FOUND (vertical check before step 1)', async () => {
        const port = ports();
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.GASTRONOMY,
            declaredVertical: VerticalEnum.ACCOMMODATION,
            facts: { ...FOREIGN_PUBLISHED },
            operation: 'WRITE_ABOUT_LISTING',
            ...port
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});
