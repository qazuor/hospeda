/**
 * gastronomy.projections.test.ts
 *
 * Unit tests for gastronomy public-tier projection helpers (SPEC-239 T-038).
 *
 * Tests verify:
 * - `projectVenuePublic` strips `adminInfo` and `ownerId` without mutating the original.
 * - `projectVenuePublicList` maps the projection across an array.
 * - `projectVenueOwnerAvatar` resolves the correct avatar URL.
 * - `projectVenueOwnerAvatarList` maps the avatar projection across an array.
 */

import type { Venue } from '@repo/schemas';
import { PublicationStatusEnum, VenueTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    projectVenueOwnerAvatar,
    projectVenueOwnerAvatarList,
    projectVenuePublic,
    projectVenuePublicList
} from '../../../src/services/venue/venue.projections';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000002';
const DEST_ID = '00000000-0000-4000-a000-000000000003';

function makeVenue(overrides: Partial<Record<string, unknown>> = {}): Venue {
    return {
        id: BASE_ID,
        name: 'La Parrilla del Centro',
        slug: 'la-parrilla-del-centro',
        type: VenueTypeEnum.PARRILLA,
        destinationId: DEST_ID,
        ownerId: OWNER_ID,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        averageRating: 0,
        reviewsCount: 0,
        adminInfo: { notes: 'internal notes' } as unknown as Venue['adminInfo'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as Venue;
}

// ---------------------------------------------------------------------------
// projectVenuePublic
// ---------------------------------------------------------------------------

describe('projectVenuePublic', () => {
    it('should strip adminInfo from the entity', () => {
        const entity = makeVenue({ adminInfo: { notes: 'secret' } });
        const result = projectVenuePublic(entity);
        expect(result).not.toHaveProperty('adminInfo');
    });

    it('should strip ownerId from the entity', () => {
        const entity = makeVenue({ ownerId: OWNER_ID });
        const result = projectVenuePublic(entity);
        expect(result).not.toHaveProperty('ownerId');
    });

    it('should preserve all other identity fields', () => {
        const entity = makeVenue();
        const result = projectVenuePublic(entity);
        expect(result.id).toBe(BASE_ID);
        expect(result.name).toBe('La Parrilla del Centro');
        expect(result.slug).toBe('la-parrilla-del-centro');
        expect(result.type).toBe(VenueTypeEnum.PARRILLA);
    });

    it('should not mutate the original entity', () => {
        const entity = makeVenue();
        const original = { ...entity };
        projectVenuePublic(entity);
        expect(entity.ownerId).toBe(original.ownerId);
        expect((entity as unknown as Record<string, unknown>).adminInfo).toStrictEqual(
            original.adminInfo
        );
    });

    it('should preserve rating and review aggregate fields', () => {
        const entity = makeVenue({ averageRating: 4.5, reviewsCount: 12 });
        const result = projectVenuePublic(entity);
        expect(result.averageRating).toBe(4.5);
        expect(result.reviewsCount).toBe(12);
    });
});

// ---------------------------------------------------------------------------
// projectVenuePublicList
// ---------------------------------------------------------------------------

describe('projectVenuePublicList', () => {
    it('should apply projection to every entity in the array', () => {
        const entities = [makeVenue(), makeVenue({ id: '00000000-0000-4000-a000-000000000099' })];
        const results = projectVenuePublicList(entities);
        expect(results).toHaveLength(2);
        for (const r of results) {
            expect(r).not.toHaveProperty('adminInfo');
            expect(r).not.toHaveProperty('ownerId');
        }
    });

    it('should return an empty array when input is empty', () => {
        expect(projectVenuePublicList([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// projectVenueOwnerAvatar
// ---------------------------------------------------------------------------

describe('projectVenueOwnerAvatar', () => {
    it('should return null when entity is null', () => {
        expect(projectVenueOwnerAvatar(null)).toBeNull();
    });

    it('should return the entity unchanged when owner relation is absent', () => {
        const entity = makeVenue();
        const result = projectVenueOwnerAvatar(entity);
        expect(result).toBe(entity); // same reference — no copy made
    });

    it('should prefer users.image over profile.avatar', () => {
        const entity = {
            ...makeVenue(),
            owner: {
                id: OWNER_ID,
                image: 'https://cdn.test/photo.jpg',
                profile: { avatar: 'https://cdn.test/old-avatar.jpg' }
            }
        } as unknown as Venue;
        const result = projectVenueOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/photo.jpg');
    });

    it('should fall back to profile.avatar when image is absent', () => {
        const entity = {
            ...makeVenue(),
            owner: {
                id: OWNER_ID,
                image: null,
                profile: { avatar: 'https://cdn.test/fallback.jpg' }
            }
        } as unknown as Venue;
        const result = projectVenueOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/fallback.jpg');
    });

    it('should return null image when both image and profile.avatar are absent', () => {
        const entity = {
            ...makeVenue(),
            owner: { id: OWNER_ID, image: null, profile: null }
        } as unknown as Venue;
        const result = projectVenueOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBeNull();
    });

    it('should treat empty string as absent (fall through to avatar)', () => {
        const entity = {
            ...makeVenue(),
            owner: { id: OWNER_ID, image: '', profile: { avatar: 'https://cdn.test/avatar.jpg' } }
        } as unknown as Venue;
        const result = projectVenueOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/avatar.jpg');
    });
});

// ---------------------------------------------------------------------------
// projectVenueOwnerAvatarList
// ---------------------------------------------------------------------------

describe('projectVenueOwnerAvatarList', () => {
    it('should apply the avatar projection to every entity', () => {
        const withOwner = {
            ...makeVenue(),
            owner: { id: OWNER_ID, image: 'https://cdn.test/a.jpg', profile: null }
        } as unknown as Venue;
        const noOwner = makeVenue({ id: '00000000-0000-4000-a000-000000000099' });
        const results = projectVenueOwnerAvatarList([withOwner, noOwner]);
        expect(results).toHaveLength(2);
        const first = results[0] as unknown as { owner: Record<string, unknown> };
        expect(first?.owner?.image).toBe('https://cdn.test/a.jpg');
    });

    it('should return an empty array when input is empty', () => {
        expect(projectVenueOwnerAvatarList([])).toEqual([]);
    });
});
