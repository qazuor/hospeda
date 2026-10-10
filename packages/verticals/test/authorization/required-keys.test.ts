import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
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

describe('AC:V5:26 route capabilities on the subject', () => {
    it('EDIT on PUBLISHED fails without the required key', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey]);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'can_use_calendar'
        });
    });

    it('EDIT on PUBLISHED passes when all required keys are present', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey, 'can_use_calendar']);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [4, 5, 6]
        });
    });

    it('EDIT on DRAFT without the required key still fails', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const port = ports(vertical);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.DRAFT
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'can_use_calendar'
        });
    });

    it('EDIT on DRAFT passes when the required key is present', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const port = ports(vertical, ['can_use_calendar']);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.DRAFT
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [4, 5, 6]
        });
    });

    it('multiple required keys: missing the second returns that key', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey, 'can_use_calendar']);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar', 'can_use_rich_description'],
            ...port
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'can_use_rich_description'
        });
    });

    it('required key present but limit exhausted returns LIMIT_REACHED', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey, 'can_use_calendar']);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            limit: { key: 'max_photos_per_accommodation', requested: 2 },
            effectiveSet: vi.fn(async ({ userId }: { userId: string }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    entries: [
                        { key: editKey, value: 1, strategy: 'MAX' as const },
                        { key: 'can_use_calendar', value: 1, strategy: 'MAX' as const },
                        { key: 'max_photos_per_accommodation', value: 1, strategy: 'MAX' as const }
                    ]
                })
            ),
            billing: port.billing
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: 'max_photos_per_accommodation',
            max: 1,
            requested: 2
        });
    });

    it('missing required key takes priority over limit reached', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey]);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: ['can_use_calendar'],
            limit: { key: 'max_photos_per_accommodation', requested: 2 },
            effectiveSet: vi.fn(async ({ userId }: { userId: string }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    entries: [
                        { key: editKey, value: 1, strategy: 'MAX' as const },
                        { key: 'max_photos_per_accommodation', value: 1, strategy: 'MAX' as const }
                    ]
                })
            ),
            billing: port.billing
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'can_use_calendar'
        });
    });

    it('admin action 15: effectiveSet receives only the owner id', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const owner = 'owner-id';
        const admin = 'admin-id';
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey], [source]);
        const result = await resolveListingAccess({
            actorId: admin,
            vertical,
            facts: { ownerId: owner, publicationStatus: PublicationStatusEnum.PUBLISHED },
            operation: 'EDIT',
            adminAction: { permitted: true, isSystemActor: false },
            requiredKeys: [],
            ...port
        });
        expect(result).toEqual({
            allowed: true,
            subjectId: owner,
            evaluatedSteps: [3, 4, 5, 6]
        });
        // The effectiveSet port was called with the OWNER's id, not admin's
        expect(port.effectiveSet).toHaveBeenCalledWith({ userId: owner, vertical });
    });

    it('admin required key uses the owner id, never the actor id', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const owner = 'owner-id';
        const admin = 'admin-id';
        const port = ports(vertical, ['can_use_calendar']);
        const result = await resolveListingAccess({
            actorId: admin,
            vertical,
            facts: { ownerId: owner, publicationStatus: PublicationStatusEnum.DRAFT },
            operation: 'EDIT',
            adminAction: { permitted: true, isSystemActor: false },
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: true,
            subjectId: owner,
            evaluatedSteps: [3, 4, 5, 6]
        });
        expect(port.effectiveSet).toHaveBeenCalledWith({ userId: owner, vertical });
        expect(port.effectiveSet).not.toHaveBeenCalledWith({ userId: admin, vertical });
    });

    it('READ_OWN_COMMERCIAL with step6Key + requiredKeys checks both', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const port = ports(vertical, ['edit_accommodation_info']);
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'READ_OWN_COMMERCIAL',
            step6Key: 'edit_accommodation_info',
            requiredKeys: ['can_use_calendar'],
            ...port
        });
        expect(result).toEqual({
            allowed: false,
            reason: 'NO_CAPABILITY',
            key: 'can_use_calendar'
        });
        // Verify evaluatedSteps has 6 once
        const grantedPort = ports(vertical, ['edit_accommodation_info', 'can_use_calendar']);
        const granted = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'READ_OWN_COMMERCIAL',
            step6Key: 'edit_accommodation_info',
            requiredKeys: ['can_use_calendar'],
            ...grantedPort
        });
        expect(granted).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [4, 6]
        });
    });

    it('non-existent catalog key throws UnknownStepKeyError', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const port = ports(vertical, [editKey]);
        await expect(
            resolveListingAccess({
                actorId: 'owner',
                vertical,
                facts: {
                    ownerId: 'owner',
                    publicationStatus: PublicationStatusEnum.PUBLISHED
                },
                operation: 'EDIT',
                requiredKeys: ['this_key_does_not_exist'],
                ...port
            })
        ).rejects.toThrow('Unknown step key');
    });

    it('empty requiredKeys: identical result to omitting requiredKeys', async () => {
        const vertical = VerticalEnum.ACCOMMODATION;
        const editKey = 'edit_accommodation_info';
        const withEmpty = ports(vertical, [editKey]);
        const withEmptyResult = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            requiredKeys: [],
            ...withEmpty
        });

        const without = ports(vertical, [editKey]);
        const withoutResult = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            facts: {
                ownerId: 'owner',
                publicationStatus: PublicationStatusEnum.PUBLISHED
            },
            operation: 'EDIT',
            ...without
        });

        expect(withEmptyResult).toEqual(withoutResult);
    });
});
