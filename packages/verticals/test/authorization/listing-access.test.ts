import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    resolveEntitlementStep,
    UnknownStepKeyError
} from '../../src/authorization/entitlement-step';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';

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
    const effectiveSet = vi.fn(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: granted ? [{ key: 'recover_own_listing', value: 1, strategy: 'MAX' }] : []
            })
    );
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    return { billing, effectiveSet, coverage };
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

    it('reads own listing without step 6', async () => {
        const port = ports(true);
        expect(
            await resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT },
                operation: 'READ_OWN',
                ...port
            })
        ).toEqual({ allowed: true, subjectId: 'owner', evaluatedSteps: [4] });
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
            subjectId: 'suspended-owner',
            evaluatedSteps: [4]
        });
        expect(
            await resolveListingAccess({
                ...common,
                operation: 'READ_OWN_COMMERCIAL',
                step6Key: 'publish_gastronomy'
            })
        ).toEqual({ allowed: false, reason: 'NO_CAPABILITY', key: 'publish_gastronomy' });
        expect(port.coverage).not.toHaveBeenCalled();
        expect(port.effectiveSet).toHaveBeenCalledOnce();
    });

    it('TEST:V5:4 rejects a declared vertical mismatch before coverage', async () => {
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
        expect(port.effectiveSet).not.toHaveBeenCalled();
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
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.ARCHIVED },
                operation,
                ...port
            })
        ).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: operation === 'EXPORT' ? [4, 6] : [4, 5, 6]
        });
        expect(port.coverage).toHaveBeenCalledTimes(operation === 'EXPORT' ? 0 : 1);
        expect(port.effectiveSet).toHaveBeenCalledWith({
            userId: 'owner',
            vertical: VerticalEnum.GASTRONOMY
        });
    });

    it('denies when the effective set does not grant the floor key', async () => {
        const port = ports(false);
        expect(
            await resolveEntitlementStep({
                userId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                keys: ['recover_own_listing'],
                effectiveSet: port.effectiveSet
            })
        ).toEqual({ allowed: false, reason: 'NO_CAPABILITY', key: 'recover_own_listing' });
    });

    it('throws UnknownStepKeyError for an unknown key before reading the set', async () => {
        const port = ports(true);
        await expect(
            resolveEntitlementStep({
                userId: 'owner',
                vertical: VerticalEnum.GASTRONOMY,
                keys: ['unknown_key'],
                effectiveSet: port.effectiveSet
            })
        ).rejects.toBeInstanceOf(UnknownStepKeyError);
        expect(port.effectiveSet).not.toHaveBeenCalled();
    });
});
