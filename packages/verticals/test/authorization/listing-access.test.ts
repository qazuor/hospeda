import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { NonBaseKeyError, resolveEntitlementStep } from '../../src/authorization/entitlement-step';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import type { PlanCatalogReader } from '../../src/plan-catalog/catalog-reader';

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

function ports(granted: boolean) {
    const coverage = vi.fn(async () => ({ covered: false, sources: [source] }));
    const findPlanVersionEffects = vi.fn(async () => ({
        entitlements: granted
            ? [{ key: 'recover_own_listing', planQuota: null, aggregationStrategy: 'MAX' as const }]
            : [],
        limits: []
    }));
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    const catalog: Pick<PlanCatalogReader, 'findPlanVersionEffects'> = { findPlanVersionEffects };
    return { billing, catalog, coverage, findPlanVersionEffects };
}

describe('listing access orchestration', () => {
    it('stops before billing for absent, foreign and inadmissible resources', async () => {
        const port = ports(true);
        const common = {
            actorId: 'owner',
            vertical: VerticalEnum.GASTRONOMY,
            operation: 'REACTIVATE' as const,
            ...port
        };
        expect(await resolveListingAccess({ ...common, facts: null })).toEqual({
            allowed: false,
            reason: 'NOT_FOUND'
        });
        expect(
            await resolveListingAccess({
                ...common,
                facts: { ownerId: 'other', publicationStatus: PublicationStatusEnum.ARCHIVED }
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        expect(
            await resolveListingAccess({
                ...common,
                operation: 'EDIT',
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.ARCHIVED }
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('reads own listing without step 6, and refuses PENDING without billing', async () => {
        const port = ports(true);
        const common = {
            actorId: 'owner',
            vertical: VerticalEnum.GASTRONOMY,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT },
            ...port
        };
        expect(await resolveListingAccess({ ...common, operation: 'READ_OWN' })).toEqual({
            allowed: true,
            evaluatedSteps: [4]
        });
        for (const operation of ['EDIT', 'PUBLISH', 'READ_OWN_COMMERCIAL'] as const) {
            expect(await resolveListingAccess({ ...common, operation })).toEqual({
                allowed: false,
                reason: 'NO_CAPABILITY'
            });
        }
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('TEST:V5:7 lets a suspended owner read without coverage and sends commercial reading through step 6', async () => {
        const port = ports(true);
        const common = {
            actorId: 'suspended-owner',
            vertical: VerticalEnum.GASTRONOMY,
            facts: {
                ownerId: 'suspended-owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            ...port
        };
        expect(await resolveListingAccess({ ...common, operation: 'READ_OWN' })).toEqual({
            allowed: true,
            evaluatedSteps: [4]
        });
        expect(await resolveListingAccess({ ...common, operation: 'READ_OWN_COMMERCIAL' })).toEqual(
            {
                allowed: false,
                reason: 'NO_CAPABILITY'
            }
        );
        expect(port.coverage).not.toHaveBeenCalled();
        expect(port.findPlanVersionEffects).not.toHaveBeenCalled();
    });

    it('TEST:V5:4 rejects a declared vertical mismatch before coverage or catalog', async () => {
        const port = ports(true);
        expect(
            await resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                declaredVertical: VerticalEnum.ACCOMMODATION,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.ARCHIVED },
                operation: 'REACTIVATE',
                ...port
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        expect(port.coverage).not.toHaveBeenCalled();
        expect(port.findPlanVersionEffects).not.toHaveBeenCalled();
    });

    it.each([
        'EXPORT',
        'REACTIVATE',
        'DELETE'
    ] as const)('%s needs the floor key', async (operation) => {
        const port = ports(true);
        expect(
            await resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                facts: {
                    ownerId: 'owner',
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                },
                operation,
                ...port
            })
        ).toEqual({ allowed: true, evaluatedSteps: [4, 6] });
        expect(port.coverage).toHaveBeenCalledOnce();
        expect(port.findPlanVersionEffects).toHaveBeenCalledWith({ id: 'floor-version' });
    });

    it('denies when the floor does not grant the key', async () => {
        const port = ports(false);
        expect(
            await resolveEntitlementStep({
                userId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                key: 'recover_own_listing',
                ...port
            })
        ).toEqual({ allowed: false, reason: 'NO_CAPABILITY' });
    });

    it.each([
        'publish_gastronomy',
        'unknown_key'
    ])('throws NonBaseKeyError for %s before coverage', async (key) => {
        const port = ports(true);
        await expect(
            resolveEntitlementStep({
                userId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                key,
                ...port
            })
        ).rejects.toBeInstanceOf(NonBaseKeyError);
        expect(port.coverage).not.toHaveBeenCalled();
    });
});
