/**
 * gastronomy.projections.test.ts
 *
 * Unit tests for gastronomy public-tier projection helpers (SPEC-239 T-038).
 *
 * Tests verify:
 * - `projectGastronomyPublic` strips `adminInfo` and `ownerId` without mutating the original.
 * - `projectGastronomyPublicList` maps the projection across an array.
 * - `projectGastronomyOwnerAvatar` resolves the correct avatar URL.
 * - `projectGastronomyOwnerAvatarList` maps the avatar projection across an array.
 */

import {
    GastronomyTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { Gastronomy } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    projectGastronomyOwnerAvatar,
    projectGastronomyOwnerAvatarList,
    projectGastronomyPublic,
    projectGastronomyPublicList
} from '../../../src/services/gastronomy/gastronomy.projections';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000002';
const DEST_ID = '00000000-0000-4000-a000-000000000003';

function makeGastronomy(overrides: Partial<Record<string, unknown>> = {}): Gastronomy {
    return {
        id: BASE_ID,
        name: 'La Parrilla del Centro',
        slug: 'la-parrilla-del-centro',
        type: GastronomyTypeEnum.PARRILLA,
        destinationId: DEST_ID,
        ownerId: OWNER_ID,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        visibility: VisibilityEnum.PUBLIC,
        isFeatured: false,
        averageRating: 0,
        reviewsCount: 0,
        adminInfo: { notes: 'internal notes' } as unknown as Gastronomy['adminInfo'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as Gastronomy;
}

// ---------------------------------------------------------------------------
// projectGastronomyPublic
// ---------------------------------------------------------------------------

describe('projectGastronomyPublic', () => {
    it('should strip adminInfo from the entity', () => {
        const entity = makeGastronomy({ adminInfo: { notes: 'secret' } });
        const result = projectGastronomyPublic(entity);
        expect(result).not.toHaveProperty('adminInfo');
    });

    it('should strip ownerId from the entity', () => {
        const entity = makeGastronomy({ ownerId: OWNER_ID });
        const result = projectGastronomyPublic(entity);
        expect(result).not.toHaveProperty('ownerId');
    });

    it('should preserve all other identity fields', () => {
        const entity = makeGastronomy();
        const result = projectGastronomyPublic(entity);
        expect(result.id).toBe(BASE_ID);
        expect(result.name).toBe('La Parrilla del Centro');
        expect(result.slug).toBe('la-parrilla-del-centro');
        expect(result.type).toBe(GastronomyTypeEnum.PARRILLA);
    });

    it('should not mutate the original entity', () => {
        const entity = makeGastronomy();
        const original = { ...entity };
        projectGastronomyPublic(entity);
        expect(entity.ownerId).toBe(original.ownerId);
        expect((entity as unknown as Record<string, unknown>).adminInfo).toStrictEqual(
            original.adminInfo
        );
    });

    it('should preserve rating and review aggregate fields', () => {
        const entity = makeGastronomy({ averageRating: 4.5, reviewsCount: 12 });
        const result = projectGastronomyPublic(entity);
        expect(result.averageRating).toBe(4.5);
        expect(result.reviewsCount).toBe(12);
    });
});

// ---------------------------------------------------------------------------
// projectGastronomyPublicList
// ---------------------------------------------------------------------------

describe('projectGastronomyPublicList', () => {
    it('should apply projection to every entity in the array', () => {
        const entities = [
            makeGastronomy(),
            makeGastronomy({ id: '00000000-0000-4000-a000-000000000099' })
        ];
        const results = projectGastronomyPublicList(entities);
        expect(results).toHaveLength(2);
        for (const r of results) {
            expect(r).not.toHaveProperty('adminInfo');
            expect(r).not.toHaveProperty('ownerId');
        }
    });

    it('should return an empty array when input is empty', () => {
        expect(projectGastronomyPublicList([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// projectGastronomyOwnerAvatar
// ---------------------------------------------------------------------------

describe('projectGastronomyOwnerAvatar', () => {
    it('should return null when entity is null', () => {
        expect(projectGastronomyOwnerAvatar(null)).toBeNull();
    });

    it('should return the entity unchanged when owner relation is absent', () => {
        const entity = makeGastronomy();
        const result = projectGastronomyOwnerAvatar(entity);
        expect(result).toBe(entity); // same reference — no copy made
    });

    it('should prefer users.image over profile.avatar', () => {
        const entity = {
            ...makeGastronomy(),
            owner: {
                id: OWNER_ID,
                image: 'https://cdn.test/photo.jpg',
                profile: { avatar: 'https://cdn.test/old-avatar.jpg' }
            }
        } as unknown as Gastronomy;
        const result = projectGastronomyOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/photo.jpg');
    });

    it('should fall back to profile.avatar when image is absent', () => {
        const entity = {
            ...makeGastronomy(),
            owner: {
                id: OWNER_ID,
                image: null,
                profile: { avatar: 'https://cdn.test/fallback.jpg' }
            }
        } as unknown as Gastronomy;
        const result = projectGastronomyOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/fallback.jpg');
    });

    it('should return null image when both image and profile.avatar are absent', () => {
        const entity = {
            ...makeGastronomy(),
            owner: { id: OWNER_ID, image: null, profile: null }
        } as unknown as Gastronomy;
        const result = projectGastronomyOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBeNull();
    });

    it('should treat empty string as absent (fall through to avatar)', () => {
        const entity = {
            ...makeGastronomy(),
            owner: { id: OWNER_ID, image: '', profile: { avatar: 'https://cdn.test/avatar.jpg' } }
        } as unknown as Gastronomy;
        const result = projectGastronomyOwnerAvatar(entity) as unknown as {
            owner: Record<string, unknown>;
        };
        expect(result?.owner?.image).toBe('https://cdn.test/avatar.jpg');
    });
});

// ---------------------------------------------------------------------------
// projectGastronomyOwnerAvatarList
// ---------------------------------------------------------------------------

describe('projectGastronomyOwnerAvatarList', () => {
    it('should apply the avatar projection to every entity', () => {
        const withOwner = {
            ...makeGastronomy(),
            owner: { id: OWNER_ID, image: 'https://cdn.test/a.jpg', profile: null }
        } as unknown as Gastronomy;
        const noOwner = makeGastronomy({ id: '00000000-0000-4000-a000-000000000099' });
        const results = projectGastronomyOwnerAvatarList([withOwner, noOwner]);
        expect(results).toHaveLength(2);
        const first = results[0] as unknown as { owner: Record<string, unknown> };
        expect(first?.owner?.image).toBe('https://cdn.test/a.jpg');
    });

    it('should return an empty array when input is empty', () => {
        expect(projectGastronomyOwnerAvatarList([])).toEqual([]);
    });
});
