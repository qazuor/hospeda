import { readFileSync } from 'node:fs';
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

    it('keeps response field inventories out of the projector implementation', () => {
        const source = readFileSync(
            new URL('../../src/utils/public-listing-projector.ts', import.meta.url),
            'utf8'
        );
        for (const field of [
            'menuFileUrl',
            'menuFileKind',
            'menuSections',
            'dailySpecials',
            'venueEvents'
        ]) {
            expect(source).not.toContain(field);
        }
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

    it('fails closed and signals the route to disable caching when a set read fails', async () => {
        mocks.effectiveSet.mockRejectedValueOnce(new Error('billing unavailable'));
        const noStore = vi.fn();
        const [listing] = await projectPublicListings({
            vertical: 'venue',
            listings: [{ id: '1', ownerId: 'a', businessLines: ['food'], menuUrl: 'https://menu' }],
            onEffectiveSetFailure: noStore
        });
        expect(listing).not.toHaveProperty('menuUrl');
        expect(noStore).toHaveBeenCalledOnce();
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

    it('projects null files and empty or missing menu sections for a paid owner', () => {
        const state = resolveListingSections({
            vertical: 'venue',
            businessLines: ['food'],
            effective: effective([{ key: 'manage_venue_menu', value: 1 }]),
            userId: 'owner'
        });
        for (const menuSections of [[], undefined]) {
            const result = projectPublicListing({
                vertical: 'venue',
                states: state.sections,
                listing: { menuFileUrl: null, menuFileKind: null, menuSections, menuUrl: null }
            });
            expect(result).toHaveProperty('menuFileUrl', null);
            expect(result).toHaveProperty('menuSections', menuSections);
        }
    });

    it('projects menu photos and translations independently and strips photoPublicId', () => {
        const sections = [
            {
                nameI18n: { es: 'Entradas' },
                descriptionI18n: { es: 'D' },
                items: [
                    {
                        nameI18n: { es: 'Empanada' },
                        descriptionI18n: { es: 'Rellena' },
                        photoUrl: 'photo',
                        photoAlt: 'alt',
                        photoPublicId: 'private-id'
                    }
                ]
            }
        ];
        const project = (photos: string, translations: string) =>
            projectPublicListing({
                vertical: 'venue',
                states: new Map([
                    [
                        'menu',
                        {
                            state: 'available',
                            traits: new Map([
                                ['itemPhotos', photos],
                                ['translations', translations]
                            ])
                        }
                    ]
                ]),
                listing: { menuSections: sections }
            });
        const photosOnly = project('available', 'locked').menuSections as typeof sections;
        const photosSection = photosOnly[0]!;
        const photosItem = photosSection.items[0]!;
        expect(photosSection.nameI18n).toBeNull();
        expect(photosItem.photoUrl).toBe('photo');
        expect(photosItem).not.toHaveProperty('photoPublicId');
        const translationsOnly = project('locked', 'available').menuSections as typeof sections;
        const translationsSection = translationsOnly[0]!;
        const translationsItem = translationsSection.items[0]!;
        expect(translationsSection.nameI18n).toEqual({ es: 'Entradas' });
        expect(translationsItem.nameI18n).toEqual({ es: 'Empanada' });
        expect(translationsItem.photoUrl).toBeNull();
        const neither = project('locked', 'locked').menuSections as typeof sections;
        const neitherItem = neither[0]!.items[0]!;
        expect(neitherItem.nameI18n).toBeNull();
        expect(neitherItem.photoAlt).toBeNull();
    });

    it('removes catalog read-only fields whenever their section is unavailable', () => {
        const result = projectPublicListing({
            vertical: 'venue',
            states: new Map(),
            listing: {
                menuSections: [],
                menuFileUrl: 'x',
                menuFileKind: 'pdf',
                dailySpecials: [],
                venueEvents: [],
                intact: 1
            }
        });
        expect(result).not.toHaveProperty('menuSections');
        expect(result).not.toHaveProperty('dailySpecials');
        expect(result).not.toHaveProperty('venueEvents');
        expect(result.intact).toBe(1);
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

    it('keeps directions false with a granted key and absent instructions, and preserves the card shape', async () => {
        mocks.effectiveSet.mockResolvedValueOnce(
            effective([{ key: 'manage_experience_directions', value: 1 }], VerticalEnum.EXPERIENCE)
        );
        const [cardRaw] = await projectPublicListings({
            vertical: 'experience',
            listings: [
                {
                    id: 'exp',
                    ownerId: 'owner',
                    businessLines: ['standard'],
                    meetingPoint: 'Muelle',
                    meetingPointDirections: null,
                    meetingPointLat: -32.4,
                    meetingPointLong: -58.2,
                    name: 'Card'
                }
            ]
        });
        const card = cardRaw as
            | (typeof cardRaw & { meetingPointDirectionsEnabled: boolean })
            | undefined;
        expect(card).toBeDefined();
        expect(card!).toHaveProperty('meetingPointDirectionsEnabled', true);
        expect(card!).toHaveProperty('meetingPointDirections', null);
        expect(card!).toMatchObject({
            id: 'exp',
            meetingPoint: 'Muelle',
            meetingPointLat: -32.4,
            meetingPointLong: -58.2,
            name: 'Card'
        });
        expect(await projectPublicListings({ vertical: 'experience', listings: [] })).toEqual([]);
    });

    it('handles an omitted directions column without changing other page fields', async () => {
        mocks.effectiveSet.mockResolvedValueOnce(effective([], VerticalEnum.EXPERIENCE));
        const [raw] = await projectPublicListings({
            vertical: 'experience',
            listings: [
                {
                    id: 'exp',
                    ownerId: 'owner',
                    businessLines: ['standard'],
                    meetingPoint: 'Plaza',
                    meetingPointLat: 1,
                    meetingPointLong: 2,
                    name: 'Card'
                }
            ]
        });
        const card = raw as (typeof raw & { meetingPointDirectionsEnabled: boolean }) | undefined;
        expect(card).toBeDefined();
        expect(card).not.toHaveProperty('meetingPointDirections');
        expect(card).toMatchObject({
            id: 'exp',
            meetingPoint: 'Plaza',
            meetingPointLat: 1,
            meetingPointLong: 2,
            name: 'Card',
            meetingPointDirectionsEnabled: false
        });
    });
});
