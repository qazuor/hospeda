import { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet, resolveListingSections } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ effectiveSet: vi.fn() }));
vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mocks.effectiveSet })
}));

import {
    projectPublicListing,
    projectPublicListings
} from '../../src/utils/public-listing-projector';

function effective(entries: { key: string; value: number }[] = [], vertical = VerticalEnum.VENUE) {
    return rehydrateEffectiveSet({
        version: 1,
        userId: 'owner',
        vertical,
        hasLiveNonTrialTitle: false,
        inheritsTouristVip: false,
        entries: entries.map(({ key, value }) => ({ key, value, strategy: 'MAX' as const }))
    });
}

describe('projectPublicListing', () => {
    beforeEach(() => {
        mocks.effectiveSet.mockReset().mockImplementation(({ userId, vertical }) =>
            Promise.resolve(
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: []
                })
            )
        );
    });

    it('reads the effective set once per owner for a page', async () => {
        const items = await projectPublicListings({
            vertical: 'venue',
            listings: [
                { id: '1', ownerId: 'a', businessLines: ['food'], menuUrl: 'a' },
                { id: '2', ownerId: 'b', businessLines: ['food'], menuUrl: 'b' },
                { id: '3', ownerId: 'a', businessLines: ['nightlife'], menuUrl: 'c' }
            ]
        });
        expect(items).toHaveLength(3);
        expect(mocks.effectiveSet).toHaveBeenCalledTimes(2);
    });

    it('publishes catalog menu fields only for a granted food listing', () => {
        const state = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food'],
            effective: effective([{ key: 'manage_venue_menu', value: 1 }]),
            userId: 'owner'
        });
        const result = projectPublicListing({
            vertical: 'venue',
            states: state.sections,
            listing: {
                menuUrl: 'https://menu',
                menuFileUrl: '/menu.pdf',
                menuSections: [{ id: 's' }],
                untouched: true
            }
        });
        expect(result).toHaveProperty('menuUrl', 'https://menu');
        expect(result).toHaveProperty('menuFileUrl', '/menu.pdf');
        expect(result).toHaveProperty('menuSections');
    });

    it('removes fields for absent and locked sections and unavailable traits, preserving unrelated fields', () => {
        const state = resolveListingSections({
            vertical: 'venue',
            businessLines: ['nightlife'],
            effective: effective(),
            userId: 'owner'
        });
        const result = projectPublicListing({
            vertical: 'venue',
            states: state.sections,
            listing: {
                menuUrl: 'https://menu',
                menuFileUrl: '/menu.pdf',
                openingHours: [],
                contactInfo: {},
                unrelated: 'keep'
            }
        });
        expect(result).not.toHaveProperty('menuUrl');
        expect(result).not.toHaveProperty('menuFileUrl');
        expect(result).toHaveProperty('unrelated', 'keep');

        const lockedState = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food'],
            effective: effective(),
            userId: 'owner'
        });
        const locked = projectPublicListing({
            vertical: 'venue',
            states: lockedState.sections,
            listing: {
                menuUrl: 'https://menu',
                menuFileUrl: '/menu.pdf',
                menuSections: [],
                unrelated: true
            }
        });
        expect(locked).not.toHaveProperty('menuUrl');
        expect(locked).not.toHaveProperty('menuSections');
        expect(locked).toHaveProperty('unrelated', true);
    });

    it('removes unavailable trait fields while keeping fields owned by the section', () => {
        const state = new Map([
            ['meetingPoint', { state: 'available', traits: new Map([['directions', 'locked']]) }]
        ]);
        const result = projectPublicListing({
            vertical: 'experience',
            states: state,
            listing: { meetingPoint: 'Plaza', meetingPointDirections: ['walk north'], untouched: 1 }
        });
        expect(result).toHaveProperty('meetingPoint', 'Plaza');
        expect(result).not.toHaveProperty('meetingPointDirections');
        expect(result).toHaveProperty('untouched', 1);
    });

    it('preserves the experience directions contract when the trait is granted or withheld', async () => {
        const listing = {
            id: 'exp',
            ownerId: 'owner',
            businessLines: ['standard'],
            meetingPoint: 'Muelle 3',
            meetingPointLat: -32.48,
            meetingPointLong: -58.23,
            meetingPointDirections: ['Caminá al muelle']
        };
        mocks.effectiveSet.mockResolvedValueOnce(effective([], VerticalEnum.EXPERIENCE));
        const withheld = (
            await projectPublicListings({ vertical: 'experience', listings: [listing] })
        )[0] as Record<string, unknown>;
        expect(withheld).not.toHaveProperty('meetingPointDirections');
        expect(withheld.meetingPointDirectionsEnabled).toBe(false);

        mocks.effectiveSet.mockResolvedValueOnce(
            effective([{ key: 'manage_experience_directions', value: 1 }], VerticalEnum.EXPERIENCE)
        );
        const granted = (
            await projectPublicListings({ vertical: 'experience', listings: [listing] })
        )[0] as Record<string, unknown>;
        expect(granted.meetingPointDirections).toEqual(['Caminá al muelle']);
        expect(granted.meetingPointDirectionsEnabled).toBe(true);
        expect(granted.meetingPointLat).toBe(-32.48);
        expect(granted.meetingPointLong).toBe(-58.23);
    });
});
