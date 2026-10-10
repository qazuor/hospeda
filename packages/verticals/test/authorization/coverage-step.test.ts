import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { getCatalogKey, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { ListingVertical } from '../../src/authorization/listing-operation';
import { OPERATION_STEP6_KEY } from '../../src/authorization/listing-operation';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';

const source = {
    type: 'BASE' as const,
    reference: { kind: 'PLAN_VERSION' as const, planVersionId: 'base' },
    scope: 'VERTICAL' as const,
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES' as const,
    charged: null,
    floor: null
};

function ports(
    vertical: VerticalEnum,
    keys: readonly string[] = [],
    sources: (typeof source)[] = [source]
) {
    const coverage = vi.fn(async () => ({ covered: false, sources }));
    const effectiveSet = vi.fn(async ({ userId }: { userId: string; vertical: VerticalEnum }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: false,
            entries: keys.map((key) => ({ key, value: 1, strategy: 'MAX' as const }))
        })
    );
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    return { billing, effectiveSet, coverage };
}

const editKeys: Record<ListingVertical, string> = {
    [VerticalEnum.ACCOMMODATION]: 'edit_accommodation_info',
    [VerticalEnum.GASTRONOMY]: 'edit_gastronomy_info',
    [VerticalEnum.EXPERIENCE]: 'edit_experience_info'
};

describe('AC:V5:9 / TEST:V5:10 coverage and capability steps', () => {
    it.each([
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.GASTRONOMY,
        VerticalEnum.EXPERIENCE
    ] as const)('passes BASE coverage but checks %s EDIT capability', async (vertical) => {
        const base = {
            actorId: 'owner',
            vertical,
            operation: 'EDIT' as const,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED }
        };
        const absent = ports(vertical);
        expect(await resolveListingAccess({ ...base, ...absent })).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: editKeys[vertical]
        });
        expect(absent.coverage).toHaveBeenCalledWith({ userId: 'owner', vertical });
        const granted = ports(vertical, [editKeys[vertical]]);
        expect(await resolveListingAccess({ ...base, ...granted })).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [4, 5, 6]
        });
    });

    it('AC:V5:9 allows draft editing and pre-trial activation, but rejects publishing without either key', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const base = {
            actorId: 'owner',
            vertical,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT }
        };
        const absent = ports(vertical);
        expect(await resolveListingAccess({ ...base, operation: 'EDIT', ...absent })).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [4, 5]
        });
        expect(await resolveListingAccess({ ...base, operation: 'PUBLISH', ...absent })).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'publish_accommodations'
        });
        const activated = ports(vertical, ['activate_trial']);
        expect(await resolveListingAccess({ ...base, operation: 'PUBLISH', ...activated })).toEqual(
            { allowed: true, subjectId: 'owner', evaluatedSteps: [4, 5, 6] }
        );
    });

    it('AC:V5:9 checks CREATE coverage without a listing or capability', async () => {
        const port = ports(VerticalEnum.ACCOMMODATION);
        expect(
            await resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                facts: null,
                operation: 'CREATE',
                ...port
            })
        ).toEqual({ allowed: true, subjectId: 'owner', evaluatedSteps: [5] });
        expect(port.effectiveSet).not.toHaveBeenCalled();
        await expect(
            resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT },
                operation: 'CREATE',
                ...port
            })
        ).rejects.toThrow();
    });

    it('AC:V5:9 rejects zero sources before reading the effective set', async () => {
        const port = ports(VerticalEnum.ACCOMMODATION, ['edit_accommodation_info'], []);
        expect(
            await resolveListingAccess({
                actorId: 'owner',
                vertical: VerticalEnum.ACCOMMODATION,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
                operation: 'EDIT',
                ...port
            })
        ).toEqual({ allowed: false, reason: 'NO_COVERAGE' });
        expect(port.effectiveSet).not.toHaveBeenCalled();
    });

    it('AC:V5:9 requires a caller key for commercial reads', async () => {
        const port = ports(VerticalEnum.ACCOMMODATION, ['edit_accommodation_info']);
        const base = {
            actorId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION,
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            operation: 'READ_OWN_COMMERCIAL' as const,
            ...port
        };
        await expect(resolveListingAccess(base)).rejects.toThrow('step6Key');
        expect(
            await resolveListingAccess({ ...base, step6Key: 'edit_accommodation_info' })
        ).toEqual({ allowed: true, subjectId: 'owner', evaluatedSteps: [4, 6] });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it.each([
        'READ_OWN',
        'READ_PUBLIC',
        'WRITE_ABOUT_LISTING'
    ] as const)('AC:V5:9 keeps %s outside coverage', async (operation) => {
        const port = ports(VerticalEnum.ACCOMMODATION);
        const actorId = operation === 'READ_OWN' ? 'owner' : 'other';
        expect(
            await resolveListingAccess({
                actorId,
                vertical: VerticalEnum.ACCOMMODATION,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
                operation,
                ...port
            })
        ).toEqual({ allowed: true, subjectId: actorId, evaluatedSteps: [4] });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('AC:V5:9 declares only catalog keys and no PENDING requirement', () => {
        for (const requirement of Object.values(OPERATION_STEP6_KEY)) {
            expect(requirement.kind).not.toBe('PENDING');
            if (requirement.kind === 'KEY')
                expect(getCatalogKey({ key: requirement.key })).toBeDefined();
            if (requirement.kind === 'VERTICAL_KEY' || requirement.kind === 'ANY_OF_VERTICAL') {
                for (const value of Object.values(requirement.keys)) {
                    for (const key of typeof value === 'string' ? [value] : value)
                        expect(getCatalogKey({ key })).toBeDefined();
                }
            }
        }
    });
});
