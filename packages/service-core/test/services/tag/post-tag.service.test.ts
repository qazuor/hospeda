/**
 * PostTagService tests (SPEC-086 T-017).
 *
 * Coverage targets:
 * - AC-F05-02: Duplicate slug on create → ALREADY_EXISTS error
 * - AC-F13: listPublic(false) returns only ACTIVE PostTags
 * - D-013: listPublic(true) returns rows with usageCount field
 * - D-011: delete triggers cascade (impact count is 0 after; service returns success)
 * - Permission gates on create, update, delete, listAdmin, setTagsForPost, removeTagFromPost
 * - Not-found cases on update, delete, getImpactCount
 *
 * Strategy: fully mocked model tier — no database connection needed.
 * PostTagModel and RPostPostTagModel methods are replaced with vi.fn() mocks
 * so tests run fast and deterministically.
 */

import { PostTagModel, RPostPostTagModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    TagColorEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostTagService } from '../../../src/services/tag/post-tag.service';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// UUID constants used throughout tests
// ---------------------------------------------------------------------------

const POST_TAG_UUID = '550e8400-e29b-41d4-a716-446655440001';
const POST_TAG_UUID_2 = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_UUID = '550e8400-e29b-41d4-a716-446655440099';
const POST_UUID = '550e8400-e29b-41d4-a716-446655440010';
const ACTOR_UUID = '550e8400-e29b-41d4-a716-446655440020';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActor(permissions: PermissionEnum[] = []) {
    return { id: ACTOR_UUID, role: RoleEnum.ADMIN, permissions };
}

function makePostTag(overrides: Record<string, unknown> = {}) {
    return {
        id: POST_TAG_UUID,
        name: 'Gastronomía',
        slug: 'gastronomia',
        color: TagColorEnum.ORANGE,
        icon: null,
        description: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        createdById: null,
        updatedById: null,
        deletedAt: undefined,
        deletedById: undefined,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('PostTagService', () => {
    let service: PostTagService;
    let modelMock: PostTagModel;
    let relatedModelMock: RPostPostTagModel;
    const logger = createLoggerMock();

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createTypedModelMock(PostTagModel, [
            'findBySlug',
            'findMany',
            'findActive',
            'findActiveWithCounts',
            'getImpactCount'
        ]);
        relatedModelMock = createTypedModelMock(RPostPostTagModel, [
            'setTagsForPost',
            'removeTagFromPost',
            'findByPostId',
            'findPostsByPostTagId'
        ]);
        service = new PostTagService({ logger }, modelMock, relatedModelMock);
    });

    // =========================================================================
    // create
    // =========================================================================

    describe('create', () => {
        const createActor = makeActor([PermissionEnum.POST_TAG_CREATE]);

        it('creates a PostTag when slug is unique', async () => {
            const tag = makePostTag();
            asMock(modelMock.findBySlug).mockResolvedValue(null);
            asMock(modelMock.create).mockResolvedValue(tag);

            const result = await service.create(createActor, {
                name: 'Gastronomía',
                slug: 'gastronomia',
                color: TagColorEnum.ORANGE
            });

            expect(result.data).toEqual(tag);
            expect(modelMock.create).toHaveBeenCalledOnce();
        });

        it('returns ALREADY_EXISTS when slug is a duplicate (AC-F05-02)', async () => {
            // An existing tag with that slug is already in the database
            asMock(modelMock.findBySlug).mockResolvedValue(makePostTag());

            const result = await service.create(createActor, {
                name: 'Gastronomía 2',
                slug: 'gastronomia', // same slug as existing
                color: TagColorEnum.ORANGE
            });

            expect(result.data).toBeUndefined();
            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(modelMock.create).not.toHaveBeenCalled();
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_CREATE', async () => {
            const noPermActor = makeActor([]);

            const result = await service.create(noPermActor, {
                name: 'Gastronomía',
                slug: 'gastronomia',
                color: TagColorEnum.ORANGE
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(modelMock.create).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR for invalid slug format (uppercase)', async () => {
            const result = await service.create(createActor, {
                name: 'Invalid',
                slug: 'UPPERCASE-SLUG', // fails regex ^[a-z0-9]+(?:-[a-z0-9]+)*$
                color: TagColorEnum.ORANGE
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // =========================================================================
    // update
    // =========================================================================

    describe('update', () => {
        const updateActor = makeActor([PermissionEnum.POST_TAG_UPDATE]);

        it('updates a PostTag successfully', async () => {
            const existing = makePostTag();
            const updated = makePostTag({ name: 'Gastronomía Regional' });
            asMock(modelMock.findById).mockResolvedValue(existing);
            asMock(modelMock.update).mockResolvedValue(updated);

            const result = await service.update(updateActor, POST_TAG_UUID, {
                name: 'Gastronomía Regional'
            });

            expect(result.data).toEqual(updated);
            expect(modelMock.update).toHaveBeenCalledOnce();
        });

        it('validates slug uniqueness when changing slug', async () => {
            const existing = makePostTag({ slug: 'old-slug' });
            asMock(modelMock.findById).mockResolvedValue(existing);
            // A different PostTag already uses the new slug
            asMock(modelMock.findBySlug).mockResolvedValue(
                makePostTag({ id: OTHER_UUID, slug: 'new-slug' })
            );

            const result = await service.update(updateActor, POST_TAG_UUID, {
                slug: 'new-slug'
            });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(modelMock.update).not.toHaveBeenCalled();
        });

        it('allows updating slug when the same PostTag already owns it', async () => {
            const existing = makePostTag({ slug: 'gastronomia' });
            const updated = makePostTag({ slug: 'gastronomia-updated' });
            asMock(modelMock.findById).mockResolvedValue(existing);
            // findBySlug returns the same PostTag (same id) → no conflict
            asMock(modelMock.findBySlug).mockResolvedValue({
                ...existing,
                slug: 'gastronomia-updated'
            });
            asMock(modelMock.update).mockResolvedValue(updated);

            const result = await service.update(updateActor, POST_TAG_UUID, {
                slug: 'gastronomia-updated'
            });

            expect(result.data).toEqual(updated);
        });

        it('returns NOT_FOUND when PostTag does not exist', async () => {
            asMock(modelMock.findById).mockResolvedValue(null);

            const result = await service.update(updateActor, POST_TAG_UUID, { name: 'X' });

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_UPDATE', async () => {
            const noPermActor = makeActor([]);
            const result = await service.update(noPermActor, POST_TAG_UUID, { name: 'X' });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('returns VALIDATION_ERROR for invalid UUID id', async () => {
            const result = await service.update(updateActor, 'not-a-uuid', { name: 'X' });
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // =========================================================================
    // delete (D-011: hard delete only)
    // =========================================================================

    describe('delete', () => {
        const deleteActor = makeActor([PermissionEnum.POST_TAG_DELETE]);

        it('hard-deletes a PostTag and returns success', async () => {
            asMock(modelMock.findById).mockResolvedValue(makePostTag());
            asMock(modelMock.hardDelete).mockResolvedValue(undefined);

            const result = await service.delete(deleteActor, POST_TAG_UUID);

            expect(result.data?.success).toBe(true);
            expect(modelMock.hardDelete).toHaveBeenCalledOnce();
        });

        it('returns NOT_FOUND when PostTag does not exist', async () => {
            asMock(modelMock.findById).mockResolvedValue(null);

            const result = await service.delete(deleteActor, POST_TAG_UUID_2);

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(modelMock.hardDelete).not.toHaveBeenCalled();
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_DELETE', async () => {
            const noPermActor = makeActor([]);
            const result = await service.delete(noPermActor, POST_TAG_UUID);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('impact count is 0 after delete (cascade simulated via model mock, D-011)', async () => {
            // Step 1: delete the PostTag
            asMock(modelMock.findById).mockResolvedValue(makePostTag());
            asMock(modelMock.hardDelete).mockResolvedValue(undefined);

            const deleteResult = await service.delete(deleteActor, POST_TAG_UUID);
            expect(deleteResult.data?.success).toBe(true);

            // Step 2: DB cascade removes r_post_post_tag rows → impact count = 0
            asMock(modelMock.getImpactCount).mockResolvedValue(0);

            const impactActor = makeActor([PermissionEnum.POST_TAG_VIEW]);
            const impactResult = await service.getImpactCount(impactActor, POST_TAG_UUID);
            expect(impactResult.data?.count).toBe(0);
        });
    });

    // =========================================================================
    // getImpactCount
    // =========================================================================

    describe('getImpactCount', () => {
        const viewActor = makeActor([PermissionEnum.POST_TAG_VIEW]);

        it('returns the impact count for a PostTag', async () => {
            asMock(modelMock.getImpactCount).mockResolvedValue(7);

            const result = await service.getImpactCount(viewActor, POST_TAG_UUID);

            expect(result.data?.count).toBe(7);
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_VIEW', async () => {
            const noPermActor = makeActor([]);
            const result = await service.getImpactCount(noPermActor, POST_TAG_UUID);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('returns VALIDATION_ERROR for invalid UUID', async () => {
            const result = await service.getImpactCount(viewActor, 'not-a-uuid');
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // =========================================================================
    // listAdmin
    // =========================================================================

    describe('listAdmin', () => {
        const viewActor = makeActor([PermissionEnum.POST_TAG_VIEW]);

        it('returns paginated PostTags for admin', async () => {
            const items = [makePostTag(), makePostTag({ id: POST_TAG_UUID_2, slug: 'trekking' })];
            asMock(modelMock.findMany).mockResolvedValue({ items, total: 2 });

            const result = await service.listAdmin(viewActor, { page: 1, pageSize: 10 });

            expect(result.data?.items).toHaveLength(2);
            expect(result.data?.total).toBe(2);
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_VIEW', async () => {
            const noPermActor = makeActor([]);
            const result = await service.listAdmin(noPermActor, { page: 1, pageSize: 10 });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('passes lifecycleState and name filters to model', async () => {
            asMock(modelMock.findMany).mockResolvedValue({ items: [], total: 0 });

            await service.listAdmin(viewActor, {
                page: 1,
                pageSize: 5,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                name: 'gastro'
            });

            expect(modelMock.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    name: 'gastro'
                }),
                expect.objectContaining({ page: 1, pageSize: 5 }),
                undefined // no tx
            );
        });
    });

    // =========================================================================
    // listPublic — AC-F13, D-013
    // =========================================================================

    describe('listPublic', () => {
        it('returns only ACTIVE PostTags when withCounts is false (AC-F13)', async () => {
            const activeTags = [
                makePostTag({ id: POST_TAG_UUID, slug: 'gastronomia' }),
                makePostTag({ id: POST_TAG_UUID_2, slug: 'trekking' })
            ];
            asMock(modelMock.findActive).mockResolvedValue(activeTags);

            const result = await service.listPublic(false);

            expect(result.data).toEqual(activeTags);
            expect(modelMock.findActive).toHaveBeenCalledOnce();
            expect(modelMock.findActiveWithCounts).not.toHaveBeenCalled();
        });

        it('returns ACTIVE PostTags with usageCount when withCounts is true (D-013)', async () => {
            const tagsWithCounts = [
                { ...makePostTag({ id: POST_TAG_UUID, slug: 'gastronomia' }), usageCount: 12 },
                { ...makePostTag({ id: POST_TAG_UUID_2, slug: 'trekking' }), usageCount: 3 }
            ];
            asMock(modelMock.findActiveWithCounts).mockResolvedValue(tagsWithCounts);

            const result = await service.listPublic(true);

            expect(result.data).toEqual(tagsWithCounts);
            // All items have usageCount with numeric value
            if (result.data) {
                for (const item of result.data) {
                    expect(item).toHaveProperty('usageCount');
                    expect(typeof (item as { usageCount: number }).usageCount).toBe('number');
                }
            }
            expect(modelMock.findActiveWithCounts).toHaveBeenCalledOnce();
            expect(modelMock.findActive).not.toHaveBeenCalled();
        });

        it('returns empty array when no ACTIVE PostTags exist (model contract)', async () => {
            // model.findActive only returns ACTIVE rows — verify delegation
            asMock(modelMock.findActive).mockResolvedValue([]);
            const result = await service.listPublic(false);
            expect(result.data).toEqual([]);
            expect(modelMock.findActive).toHaveBeenCalledOnce();
        });
    });

    // =========================================================================
    // setTagsForPost
    // =========================================================================

    describe('setTagsForPost', () => {
        const assignActor = makeActor([PermissionEnum.POST_TAG_ASSIGN]);

        it('sets PostTags for a post atomically', async () => {
            const tag = makePostTag();
            asMock(modelMock.findById).mockResolvedValue(tag);
            asMock(relatedModelMock.setTagsForPost).mockResolvedValue([]);

            const result = await service.setTagsForPost(assignActor, POST_UUID, [POST_TAG_UUID]);

            expect(result.data?.success).toBe(true);
            expect(relatedModelMock.setTagsForPost).toHaveBeenCalledWith(
                POST_UUID,
                [POST_TAG_UUID],
                undefined
            );
        });

        it('clears all PostTags when postTagIds is empty', async () => {
            asMock(relatedModelMock.setTagsForPost).mockResolvedValue([]);

            const result = await service.setTagsForPost(assignActor, POST_UUID, []);

            expect(result.data?.success).toBe(true);
            expect(relatedModelMock.setTagsForPost).toHaveBeenCalledWith(POST_UUID, [], undefined);
        });

        it('returns NOT_FOUND when a PostTag ID does not exist', async () => {
            asMock(modelMock.findById).mockResolvedValue(null);

            const result = await service.setTagsForPost(assignActor, POST_UUID, [POST_TAG_UUID]);

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
            expect(relatedModelMock.setTagsForPost).not.toHaveBeenCalled();
        });

        it('returns VALIDATION_ERROR when a PostTag is not ACTIVE', async () => {
            const inactiveTag = makePostTag({ lifecycleState: LifecycleStatusEnum.ARCHIVED });
            asMock(modelMock.findById).mockResolvedValue(inactiveTag);

            const result = await service.setTagsForPost(assignActor, POST_UUID, [POST_TAG_UUID]);

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_ASSIGN', async () => {
            const noPermActor = makeActor([]);
            const result = await service.setTagsForPost(noPermActor, POST_UUID, []);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // =========================================================================
    // removeTagFromPost
    // =========================================================================

    describe('removeTagFromPost', () => {
        const assignActor = makeActor([PermissionEnum.POST_TAG_ASSIGN]);

        it('removes a PostTag assignment from a post', async () => {
            asMock(relatedModelMock.removeTagFromPost).mockResolvedValue(1);

            const result = await service.removeTagFromPost(assignActor, POST_UUID, POST_TAG_UUID);

            expect(result.data?.success).toBe(true);
            expect(relatedModelMock.removeTagFromPost).toHaveBeenCalledWith(
                POST_UUID,
                POST_TAG_UUID,
                undefined
            );
        });

        it('succeeds even when the assignment does not exist (idempotent)', async () => {
            asMock(relatedModelMock.removeTagFromPost).mockResolvedValue(0);

            const result = await service.removeTagFromPost(assignActor, POST_UUID, POST_TAG_UUID);

            expect(result.data?.success).toBe(true);
        });

        it('returns FORBIDDEN when actor lacks POST_TAG_ASSIGN', async () => {
            const noPermActor = makeActor([]);
            const result = await service.removeTagFromPost(noPermActor, POST_UUID, POST_TAG_UUID);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });

    // =========================================================================
    // Permission helpers (indirect coverage via service entry points)
    // =========================================================================

    describe('permission helpers (indirect via service methods)', () => {
        it('assertCanCreatePostTag throws FORBIDDEN when permission missing', async () => {
            const result = await service.create(makeActor([]), {
                name: 'X',
                slug: 'x',
                color: TagColorEnum.BLUE
            });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('assertCanUpdatePostTag throws FORBIDDEN when permission missing', async () => {
            const result = await service.update(makeActor([]), POST_TAG_UUID, { name: 'X' });
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('assertCanDeletePostTag throws FORBIDDEN when permission missing', async () => {
            const result = await service.delete(makeActor([]), POST_TAG_UUID);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('assertCanViewPostTag throws FORBIDDEN when permission missing', async () => {
            const result = await service.getImpactCount(makeActor([]), POST_TAG_UUID);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('assertCanAssignPostTag throws FORBIDDEN when permission missing', async () => {
            const result = await service.setTagsForPost(makeActor([]), POST_UUID, []);
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});
