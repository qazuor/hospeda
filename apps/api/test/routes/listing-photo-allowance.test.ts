/**
 * GET /api/v1/protected/{accommodations|venues|experiences}/:id/photo-allowance
 * (HOS-2495 T-020, AC-5/6/9).
 *
 * The routes are thin: listing access READ_OWN, then the allowance util. These
 * tests prove the handler is reached (status + body), that another owner's
 * listing is a 404 (never 403), that a malformed id is a 400, and that a no-plan
 * owner gets an answer instead of a 403.
 *
 * @module test/routes/listing-photo-allowance
 */
import { experienceMediaModel, venueMediaModel } from '@repo/db';
import { ListingPhotoAllowanceSchema, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    status: 'PUBLISHED' as string,
    photoCap: undefined as number | undefined,
    draftCap: undefined as number | undefined,
    covered: true
}));

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_ID = '00000000-0000-4000-8000-000000000001';

vi.mock('../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        loadFacts: async () => ({
            facts: { ownerId: state.ownerId, publicationStatus: state.status },
            ownerId: state.ownerId
        }),
        billing: {
            coverage: async () =>
                state.covered
                    ? { covered: true, sources: [{ type: 'BASE' }] }
                    : { covered: false, sources: [] }
        },
        effectiveSet: async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: state.covered,
                inheritsTouristVip: false,
                entries:
                    state.photoCap === undefined
                        ? []
                        : [
                              {
                                  key: `max_photos_per_${vertical}`,
                                  value: state.photoCap,
                                  strategy: 'SUM'
                              }
                          ]
            }),
        preTrialDraftLimits: async ({ vertical }: { vertical: VerticalEnum }) =>
            new Map(
                state.draftCap === undefined
                    ? []
                    : [[`max_photos_per_${vertical}`, state.draftCap] as const]
            ),
        limitBreakdown: async ({ vertical }: { vertical: VerticalEnum }) =>
            new Map([
                [
                    `max_photos_per_${vertical}`,
                    {
                        total: state.photoCap ?? 0,
                        contributions:
                            state.photoCap === undefined
                                ? []
                                : [{ kind: 'PLAN', value: state.photoCap, sources: 1 }]
                    }
                ]
            ])
    })
}));

import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

const HEADERS = {
    'user-agent': 'vitest',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'HOST',
    'x-mock-actor-permissions': JSON.stringify([
        'accommodation.update.own',
        'venue.editOwn',
        'experience.editOwn'
    ])
};

const CASES = [
    {
        vertical: VerticalEnum.ACCOMMODATION,
        plural: 'accommodations',
        key: 'max_photos_per_accommodation'
    },
    { vertical: VerticalEnum.VENUE, plural: 'venues', key: 'max_photos_per_venue' },
    { vertical: VerticalEnum.EXPERIENCE, plural: 'experiences', key: 'max_photos_per_experience' }
] as const;

describe.each(CASES)('GET /protected/$plural/:id/photo-allowance', (c) => {
    let app: AppOpenAPI;
    const url = (id: string = LISTING_ID) => `/api/v1/protected/${c.plural}/${id}/photo-allowance`;

    beforeEach(() => {
        vi.clearAllMocks();
        state.ownerId = OWNER_ID;
        state.status = PublicationStatusEnum.PUBLISHED;
        state.photoCap = 30;
        state.draftCap = undefined;
        state.covered = true;
        app = initApp();
    });

    it('answers the allowance of the own listing, valid against the schema', async () => {
        // Act
        const res = await app.request(url(), { headers: HEADERS });
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect(body.data).toEqual({
            limitKey: c.key,
            status: 'LIMITED',
            cap: 30,
            source: 'EFFECTIVE_SET',
            used: 0,
            hiddenCount: 0,
            coverAllowed: true,
            breakdown: { contributions: [{ kind: 'PLAN', value: 30, sources: 1 }] }
        });
        expect(ListingPhotoAllowanceSchema.safeParse(body.data).success).toBe(true);
    });

    it('answers NONE (not a 403) to a no-plan owner', async () => {
        // Arrange
        state.photoCap = undefined;
        state.covered = false;

        // Act
        const res = await app.request(url(), { headers: HEADERS });
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect([body.data.status, body.data.cap, body.data.coverAllowed]).toEqual([
            'NONE',
            0,
            false
        ]);
    });

    it('answers the pre-trial DRAFT cap on a DRAFT listing', async () => {
        // Arrange
        state.photoCap = undefined;
        state.covered = false;
        state.draftCap = 15;
        state.status = PublicationStatusEnum.DRAFT;

        // Act
        const res = await app.request(url(), { headers: HEADERS });
        const body = await res.json();

        // Assert
        expect(res.status).toBe(200);
        expect([body.data.status, body.data.cap, body.data.source]).toEqual([
            'LIMITED',
            15,
            'PRE_TRIAL_DRAFT'
        ]);
    });

    it("answers 404 for another owner's listing, never 403", async () => {
        // Arrange
        state.ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

        // Act
        const res = await app.request(url(), { headers: HEADERS });

        // Assert
        expect(res.status).toBe(404);
    });

    it('answers 400 for a malformed id', async () => {
        // Act
        const res = await app.request(url('not-a-uuid'), { headers: HEADERS });

        // Assert
        expect(res.status).toBe(400);
    });
});

describe('the allowance counts the listing gallery', () => {
    it('reads the venue and experience gallery models', async () => {
        // Arrange
        state.ownerId = OWNER_ID;
        state.photoCap = 15;
        state.status = PublicationStatusEnum.PUBLISHED;
        vi.mocked(venueMediaModel.findByVenue).mockResolvedValueOnce({
            items: [],
            total: 9
        } as never);
        vi.mocked(experienceMediaModel.findByExperience).mockResolvedValueOnce({
            items: [],
            total: 4
        } as never);
        const app = initApp();

        // Act
        const venue = await (
            await app.request(`/api/v1/protected/venues/${LISTING_ID}/photo-allowance`, {
                headers: HEADERS
            })
        ).json();
        const experience = await (
            await app.request(`/api/v1/protected/experiences/${LISTING_ID}/photo-allowance`, {
                headers: HEADERS
            })
        ).json();

        // Assert
        expect([venue.data.used, experience.data.used]).toEqual([9, 4]);
    });
});
