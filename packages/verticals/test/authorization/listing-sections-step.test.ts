import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';

const effective = async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
    rehydrateEffectiveSet({
        version: 1,
        userId,
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: [{ key: 'edit_venue_info', value: 1, strategy: 'MAX' }]
    });
const billing: Pick<BillingForVerticals, 'coverage'> = {
    coverage: vi.fn(async () => ({
        covered: true,
        sources: [
            {
                type: 'BASE' as const,
                reference: { kind: 'PLAN_VERSION' as const, planVersionId: 'x' },
                scope: 'VERTICAL' as const,
                target: null,
                since: new Date(),
                until: 'NEVER_EXPIRES' as const,
                charged: null,
                floor: null
            }
        ]
    }))
};
const facts = {
    ownerId: 'owner',
    publicationStatus: PublicationStatusEnum.PUBLISHED,
    businessLines: ['nightlife']
};
const sectionArgs = (intent: 'read' | 'write' | 'delete', line = 'nightlife') => ({
    requested: [{ id: 'menu', intent }],
    resultingBusinessLines: [line as 'food' | 'nightlife']
});
const base = {
    vertical: VerticalEnum.VENUE,
    operation: 'EDIT' as const,
    facts,
    billing,
    effectiveSet: effective
};

describe('TEST:3.2:1 listing section step 4b', () => {
    it('runs between resource and coverage with owner/foreign and intent rules', async () => {
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'owner',
                sections: sectionArgs('write')
            })
        ).toMatchObject({ allowed: false, reason: 'SECTION_ABSENT', section: 'menu' });
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'other',
                sections: sectionArgs('write')
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'owner',
                operation: 'READ_OWN',
                sections: sectionArgs('read')
            })
        ).toMatchObject({ allowed: true, evaluatedSteps: [4, '4b'] });
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'owner',
                sections: sectionArgs('delete')
            })
        ).toMatchObject({ allowed: true });
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'support',
                adminAction: { action: 'ACC_15', permitted: true, isSystemActor: false },
                sections: sectionArgs('delete')
            })
        ).toMatchObject({ allowed: false, reason: 'SECTION_ABSENT' });
    });

    it('gates writes on section and trait keys, while delete bypasses capability keys', async () => {
        const locked = { ...base, facts: { ...facts, businessLines: ['food'] } };
        expect(
            await resolveListingAccess({
                ...locked,
                actorId: 'owner',
                sections: sectionArgs('write', 'food')
            })
        ).toMatchObject({ allowed: false, reason: 'NO_CAPABILITY', key: 'manage_venue_menu' });
        expect(
            await resolveListingAccess({
                ...locked,
                actorId: 'owner',
                sections: sectionArgs('delete', 'food')
            })
        ).toMatchObject({ allowed: true });
        const grantSection = async ({
            userId,
            vertical
        }: {
            userId: string;
            vertical: VerticalEnum;
        }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [
                    { key: 'edit_venue_info', value: 1, strategy: 'MAX' },
                    { key: 'manage_venue_menu', value: 1, strategy: 'MAX' }
                ]
            });
        expect(
            await resolveListingAccess({
                ...locked,
                effectiveSet: grantSection,
                actorId: 'owner',
                sections: {
                    requested: [{ id: 'menu', intent: 'write', traits: ['itemPhotos'] }],
                    resultingBusinessLines: ['food']
                }
            })
        ).toMatchObject({ allowed: false, reason: 'NO_CAPABILITY', key: 'menu_item_photos' });
    });

    it('runs on CREATE without step 4 and leaves legacy calls unchanged', async () => {
        expect(
            await resolveListingAccess({
                ...base,
                actorId: 'owner',
                facts: null,
                operation: 'CREATE',
                sections: sectionArgs('write')
            })
        ).toMatchObject({ allowed: false, reason: 'SECTION_ABSENT' });
        expect(
            await resolveListingAccess({ ...base, actorId: 'owner', sections: undefined })
        ).toMatchObject({ allowed: true, evaluatedSteps: [4, 5, 6] });
    });

    it('keeps NO_COVERAGE before capability checks for an expired owner', async () => {
        const expiredBilling: Pick<BillingForVerticals, 'coverage'> = {
            coverage: vi.fn(async () => ({ covered: false, sources: [] }))
        };
        expect(
            await resolveListingAccess({
                ...base,
                billing: expiredBilling,
                actorId: 'owner',
                sections: sectionArgs('write', 'food'),
                facts: { ...facts, businessLines: ['food'] }
            })
        ).toEqual({ allowed: false, reason: 'NO_COVERAGE' });
    });
});
