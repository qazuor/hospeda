/**
 * experience.projections.test.ts
 *
 * Unit tests for experience projection helpers (SPEC-240 T-016).
 *
 * Coverage:
 * - projectExperiencePublic: strips adminInfo + ownerId, preserves other fields.
 * - projectExperiencePublicList: maps over an array correctly.
 * - projectExperienceOwnerAvatar: resolves image/profile.avatar, handles null owner.
 * - projectExperienceOwnerAvatarList: maps over an array.
 *
 * Pure function tests — no DB, no service instances.
 */

import {
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { Experience } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    projectExperienceOwnerAvatar,
    projectExperienceOwnerAvatarList,
    projectExperiencePublic,
    projectExperiencePublicList
} from '../../../src/services/experience/experience.projections';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<Record<string, unknown>> = {}): Experience {
    return {
        id: '00000000-0000-4000-a000-000000000001',
        name: 'River Kayak Adventure',
        slug: 'river-kayak-adventure',
        type: ExperienceTypeEnum.EXCURSION,
        priceFrom: 200000,
        priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
        isPriceOnRequest: false,
        hasActiveSubscription: true,
        destinationId: '00000000-0000-4000-a000-000000000002',
        ownerId: '00000000-0000-4000-a000-000000000003',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        visibility: VisibilityEnum.PUBLIC,
        isFeatured: false,
        averageRating: 4.5,
        reviewsCount: 12,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        adminInfo: { notes: 'Internal notes — must not be public' },
        ...overrides
    } as Experience;
}

// ---------------------------------------------------------------------------
// projectExperiencePublic
// ---------------------------------------------------------------------------

describe('projectExperiencePublic', () => {
    it('should strip adminInfo', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).not.toHaveProperty('adminInfo');
    });

    it('should strip ownerId', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).not.toHaveProperty('ownerId');
    });

    it('should preserve public identity fields (name, slug, type)', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).toHaveProperty('name', 'River Kayak Adventure');
        expect(result).toHaveProperty('slug', 'river-kayak-adventure');
        expect(result).toHaveProperty('type', ExperienceTypeEnum.EXCURSION);
    });

    it('should preserve pricing fields (priceFrom, priceUnit, isPriceOnRequest)', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).toHaveProperty('priceFrom', 200000);
        expect(result).toHaveProperty('priceUnit', ExperiencePriceUnitEnum.PER_PERSON);
        expect(result).toHaveProperty('isPriceOnRequest', false);
    });

    it('should preserve hasActiveSubscription', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).toHaveProperty('hasActiveSubscription', true);
    });

    it('should preserve rating aggregates (averageRating, reviewsCount)', () => {
        const entity = makeEntity();
        const result = projectExperiencePublic(entity);
        expect(result).toHaveProperty('averageRating', 4.5);
        expect(result).toHaveProperty('reviewsCount', 12);
    });

    it('should not mutate the original entity', () => {
        const entity = makeEntity();
        projectExperiencePublic(entity);
        expect(entity).toHaveProperty('adminInfo');
        expect(entity).toHaveProperty('ownerId');
    });
});

// ---------------------------------------------------------------------------
// projectExperiencePublicList
// ---------------------------------------------------------------------------

describe('projectExperiencePublicList', () => {
    it('should apply projectExperiencePublic to each item in the array', () => {
        const entities = [makeEntity(), makeEntity({ id: '00000000-0000-4000-a000-000000000009' })];
        const results = projectExperiencePublicList(entities);
        expect(results).toHaveLength(2);
        for (const r of results) {
            expect(r).not.toHaveProperty('adminInfo');
            expect(r).not.toHaveProperty('ownerId');
        }
    });

    it('should return an empty array when input is empty', () => {
        expect(projectExperiencePublicList([])).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// projectExperienceOwnerAvatar
// ---------------------------------------------------------------------------

describe('projectExperienceOwnerAvatar', () => {
    it('should return null when entity is null', () => {
        expect(projectExperienceOwnerAvatar(null)).toBeNull();
    });

    it('should return entity unchanged when owner relation is absent', () => {
        const entity = makeEntity();
        const result = projectExperienceOwnerAvatar(entity);
        expect(result).toBe(entity); // reference equality — no new object created
    });

    it('should prefer owner.image over profile.avatar', () => {
        const entity = {
            ...makeEntity(),
            owner: {
                id: 'owner-id',
                image: 'https://cdn.example.com/image.jpg',
                profile: { avatar: 'https://cdn.example.com/avatar.jpg' }
            }
        };
        const result = projectExperienceOwnerAvatar(entity as Experience);
        expect((result as Experience & { owner: { image: string } }).owner.image).toBe(
            'https://cdn.example.com/image.jpg'
        );
    });

    it('should fall back to profile.avatar when image is absent', () => {
        const entity = {
            ...makeEntity(),
            owner: {
                id: 'owner-id',
                image: '',
                profile: { avatar: 'https://cdn.example.com/avatar.jpg' }
            }
        };
        const result = projectExperienceOwnerAvatar(entity as Experience);
        expect((result as Experience & { owner: { image: string } }).owner.image).toBe(
            'https://cdn.example.com/avatar.jpg'
        );
    });

    it('should return null for owner.image when neither source is present', () => {
        const entity = {
            ...makeEntity(),
            owner: { id: 'owner-id', image: '', profile: {} }
        };
        const result = projectExperienceOwnerAvatar(entity as Experience);
        expect((result as Experience & { owner: { image: string | null } }).owner.image).toBeNull();
    });

    it('should not mutate the original entity', () => {
        const entity = {
            ...makeEntity(),
            owner: {
                id: 'owner-id',
                image: '',
                profile: { avatar: 'https://cdn.example.com/a.jpg' }
            }
        };
        projectExperienceOwnerAvatar(entity as Experience);
        expect(entity.owner.image).toBe('');
    });
});

// ---------------------------------------------------------------------------
// projectExperienceOwnerAvatarList
// ---------------------------------------------------------------------------

describe('projectExperienceOwnerAvatarList', () => {
    it('should resolve avatars for each entity in the list', () => {
        const entities = [
            {
                ...makeEntity(),
                owner: {
                    id: 'o1',
                    image: '',
                    profile: { avatar: 'https://cdn.example.com/a1.jpg' }
                }
            },
            {
                ...makeEntity({ id: '00000000-0000-4000-a000-000000000009' }),
                owner: { id: 'o2', image: 'https://cdn.example.com/img.jpg', profile: {} }
            }
        ];
        const results = projectExperienceOwnerAvatarList(entities as Experience[]);
        expect(results).toHaveLength(2);
        const first = results[0] as Experience & { owner: { image: string } };
        const second = results[1] as Experience & { owner: { image: string } };
        expect(first?.owner.image).toBe('https://cdn.example.com/a1.jpg');
        expect(second?.owner.image).toBe('https://cdn.example.com/img.jpg');
    });

    it('should return an empty array when input is empty', () => {
        expect(projectExperienceOwnerAvatarList([])).toEqual([]);
    });
});
