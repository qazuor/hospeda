/**
 * resolveListingPhotoAllowance (HOS-2495 AC-5, AC-6, AC-9, AC-16).
 *
 * The cap comes from the same ports step 7 reads; the breakdown is dropped
 * whenever it does not add up to that cap.
 */
import { PublicationStatusEnum, UNLIMITED_LIMIT_VALUE, VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    effectiveLimit: { value: undefined as number | undefined },
    preTrialDraftLimits: vi.fn(),
    limitBreakdown: vi.fn(),
    findByVenue: vi.fn(),
    findByExperience: vi.fn(),
    findByAccommodation: vi.fn(),
    warn: vi.fn()
}));

vi.mock('@repo/db', () => ({
    venueMediaModel: { findByVenue: mocks.findByVenue },
    experienceMediaModel: { findByExperience: mocks.findByExperience },
    accommodationMediaModel: { findByAccommodation: mocks.findByAccommodation }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: mocks.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: async () => ({ limits: { get: () => mocks.effectiveLimit.value } }),
        preTrialDraftLimits: mocks.preTrialDraftLimits,
        limitBreakdown: mocks.limitBreakdown
    })
}));

import { resolveListingPhotoAllowance } from '../../../src/utils/listing-access/photo-allowance';

const OWNER = 'owner-1';
const LISTING = 'listing-1';

/** `approved` APPROVED gallery rows, plus `pending` PENDING rows mixed in first. */
function gallery({
    approved,
    pending = 0
}: {
    readonly approved: number;
    readonly pending?: number;
}) {
    const items = [
        ...Array.from({ length: pending }, () => ({ moderationState: 'PENDING' })),
        ...Array.from({ length: approved }, () => ({ moderationState: 'APPROVED' }))
    ];
    return { items, total: items.length };
}

const resolveVenue = (publicationStatus = PublicationStatusEnum.PUBLISHED) =>
    resolveListingPhotoAllowance({
        vertical: VerticalEnum.VENUE,
        listingId: LISTING,
        ownerId: OWNER,
        publicationStatus
    });

beforeEach(() => {
    vi.clearAllMocks();
    mocks.effectiveLimit.value = undefined;
    mocks.findByVenue.mockResolvedValue(gallery({ approved: 0 }));
    mocks.preTrialDraftLimits.mockResolvedValue(new Map());
    mocks.limitBreakdown.mockResolvedValue(new Map());
});

describe('resolveListingPhotoAllowance', () => {
    it('answers LIMITED with plan + packs that add up to the enforced cap', async () => {
        // Arrange: venue-pro (30) + one pack (+20), 52 approved photos.
        mocks.effectiveLimit.value = 50;
        mocks.findByVenue.mockResolvedValue(gallery({ approved: 52 }));
        mocks.limitBreakdown.mockResolvedValue(
            new Map([
                [
                    'max_photos_per_venue',
                    {
                        total: 50,
                        contributions: [
                            { kind: 'PLAN', value: 30, sources: 1 },
                            { kind: 'ADDON', value: 20, sources: 1 }
                        ]
                    }
                ]
            ])
        );

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance).toEqual({
            limitKey: 'max_photos_per_venue',
            status: 'LIMITED',
            cap: 50,
            source: 'EFFECTIVE_SET',
            used: 52,
            hiddenCount: 2,
            coverAllowed: true,
            breakdown: {
                contributions: [
                    { kind: 'PLAN', value: 30, sources: 1 },
                    { kind: 'ADDON', value: 20, sources: 1 }
                ]
            }
        });
        expect(mocks.findByVenue.mock.calls).toEqual([
            [{ venueId: LISTING, state: 'visible', isFeatured: false, pageSize: 200 }]
        ]);
        expect(mocks.limitBreakdown.mock.calls).toEqual([
            [{ userId: OWNER, vertical: VerticalEnum.VENUE, keys: ['max_photos_per_venue'] }]
        ]);
    });

    it('drops the breakdown and warns when the fresh fold disagrees with the cached cap', async () => {
        // Arrange: the snapshot still says 30, the fresh fold already sees the pack.
        mocks.effectiveLimit.value = 30;
        mocks.limitBreakdown.mockResolvedValue(
            new Map([
                [
                    'max_photos_per_venue',
                    {
                        total: 50,
                        contributions: [
                            { kind: 'PLAN', value: 30, sources: 1 },
                            { kind: 'ADDON', value: 20, sources: 1 }
                        ]
                    }
                ]
            ])
        );

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance.cap).toBe(30);
        expect(allowance.breakdown).toBeNull();
        expect(mocks.warn.mock.calls).toEqual([
            [
                {
                    vertical: VerticalEnum.VENUE,
                    listingId: LISTING,
                    cap: 30,
                    breakdownTotal: 50
                },
                'Photo allowance breakdown disagrees with the enforced cap'
            ]
        ]);
    });

    it('drops a breakdown whose parts do not sum to its total', async () => {
        // Arrange
        mocks.effectiveLimit.value = 30;
        mocks.limitBreakdown.mockResolvedValue(
            new Map([
                [
                    'max_photos_per_venue',
                    { total: 30, contributions: [{ kind: 'PLAN', value: 15, sources: 1 }] }
                ]
            ])
        );

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance.breakdown).toBeNull();
        expect(mocks.warn).toHaveBeenCalledTimes(1);
    });

    it('answers a null breakdown, never a 500, when the fold throws', async () => {
        // Arrange
        mocks.effectiveLimit.value = 15;
        mocks.limitBreakdown.mockRejectedValue(new Error('coverage down'));

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance.status).toBe('LIMITED');
        expect(allowance.cap).toBe(15);
        expect(allowance.breakdown).toBeNull();
        expect(mocks.warn.mock.calls[0]?.[1]).toBe(
            'Photo allowance breakdown could not be resolved'
        );
    });

    it('answers NONE with cap 0 for an owner whose set carries no photo key', async () => {
        // Arrange: 3 approved photos stay listed, all over a cap of 0.
        mocks.findByVenue.mockResolvedValue(gallery({ approved: 3 }));
        mocks.limitBreakdown.mockResolvedValue(
            new Map([['max_photos_per_venue', { total: 0, contributions: [] }]])
        );

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance).toEqual({
            limitKey: 'max_photos_per_venue',
            status: 'NONE',
            cap: 0,
            source: 'EFFECTIVE_SET',
            used: 3,
            hiddenCount: 3,
            coverAllowed: false,
            breakdown: { contributions: [] }
        });
        expect(mocks.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('uses the pre-trial DRAFT fallback on a DRAFT, with one PRE_TRIAL_DRAFT contribution', async () => {
        // Arrange
        mocks.preTrialDraftLimits.mockResolvedValue(new Map([['max_photos_per_venue', 15]]));

        // Act
        const allowance = await resolveVenue(PublicationStatusEnum.DRAFT);

        // Assert
        expect(allowance).toEqual({
            limitKey: 'max_photos_per_venue',
            status: 'LIMITED',
            cap: 15,
            source: 'PRE_TRIAL_DRAFT',
            used: 0,
            hiddenCount: 0,
            coverAllowed: true,
            breakdown: { contributions: [{ kind: 'PRE_TRIAL_DRAFT', value: 15, sources: 1 }] }
        });
        expect(mocks.preTrialDraftLimits.mock.calls).toEqual([
            [{ userId: OWNER, vertical: VerticalEnum.VENUE }]
        ]);
        expect(mocks.limitBreakdown).not.toHaveBeenCalled();
    });

    it('answers NONE for the same pre-trial owner on a listing that is not a DRAFT', async () => {
        // Arrange
        mocks.preTrialDraftLimits.mockResolvedValue(new Map([['max_photos_per_venue', 15]]));

        // Act
        const allowance = await resolveVenue(PublicationStatusEnum.PUBLISHED);

        // Assert
        expect(allowance.status).toBe('NONE');
        expect(allowance.cap).toBe(0);
        expect(mocks.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('answers UNLIMITED with cap null and hides nothing', async () => {
        // Arrange
        mocks.effectiveLimit.value = UNLIMITED_LIMIT_VALUE;
        mocks.findByVenue.mockResolvedValue(gallery({ approved: 120 }));
        mocks.limitBreakdown.mockResolvedValue(
            new Map([
                [
                    'max_photos_per_venue',
                    {
                        total: UNLIMITED_LIMIT_VALUE,
                        contributions: [{ kind: 'PERMANENT_GRANT', value: 'unlimited', sources: 1 }]
                    }
                ]
            ])
        );

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance).toEqual({
            limitKey: 'max_photos_per_venue',
            status: 'UNLIMITED',
            cap: null,
            source: 'EFFECTIVE_SET',
            used: 120,
            hiddenCount: 0,
            coverAllowed: true,
            breakdown: {
                contributions: [{ kind: 'PERMANENT_GRANT', value: 'unlimited', sources: 1 }]
            }
        });
    });

    it('never counts a PENDING photo as hidden: only approved rows are public', async () => {
        // Arrange: cap 15, 2 PENDING rows first, then 16 approved.
        mocks.effectiveLimit.value = 15;
        mocks.findByVenue.mockResolvedValue(gallery({ approved: 16, pending: 2 }));

        // Act
        const allowance = await resolveVenue();

        // Assert
        expect(allowance.used).toBe(18);
        expect(allowance.hiddenCount).toBe(1);
    });

    it('reads the accommodation and experience galleries from their own models', async () => {
        // Arrange
        mocks.effectiveLimit.value = 70;
        mocks.findByAccommodation.mockResolvedValue(gallery({ approved: 4 }));
        mocks.findByExperience.mockResolvedValue(gallery({ approved: 2 }));

        // Act
        const accommodation = await resolveListingPhotoAllowance({
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: LISTING,
            ownerId: OWNER,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });
        const experience = await resolveListingPhotoAllowance({
            vertical: VerticalEnum.EXPERIENCE,
            listingId: LISTING,
            ownerId: OWNER,
            publicationStatus: PublicationStatusEnum.PUBLISHED
        });

        // Assert
        expect([accommodation.limitKey, accommodation.used]).toEqual([
            'max_photos_per_accommodation',
            4
        ]);
        expect([experience.limitKey, experience.used]).toEqual(['max_photos_per_experience', 2]);
        expect(mocks.findByVenue).not.toHaveBeenCalled();
    });
});
