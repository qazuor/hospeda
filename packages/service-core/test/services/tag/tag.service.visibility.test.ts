/**
 * Tests for TagService picker visibility and entity-tag scoping (SPEC-086 T-020).
 *
 * Acceptance Criteria:
 * - AC-F07: Regular user picker excludes INTERNAL tags.
 * - AC-F05: User A's entity-tag list does not include user B's assignments.
 * - AC-F06: Super-admin with TAG_VIEW_ALL_ASSIGNMENTS sees all assignments with attribution.
 * - Picker without auth → UNAUTHORIZED.
 */
import { REntityTagModel, TagModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, ServiceErrorCode, TagTypeEnum } from '@repo/schemas';
import type { EntityTag, Tag } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import { createActor, createGuestActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEntityTag(
    tagId: string,
    entityId: string,
    entityType: EntityTypeEnum,
    assignedById: string,
    tag?: Partial<Tag>
): EntityTag {
    return {
        tagId,
        entityId,
        entityType,
        assignedById,
        tag: TagFactoryBuilder.create({ id: tagId, ...tag }) as Tag
    } as unknown as EntityTag;
}

const ENTITY_ID = getMockId('accommodation');
const ENTITY_TYPE = EntityTypeEnum.ACCOMMODATION;
const USER_A_ID = 'a1b2c3d4-0000-4000-a000-000000000001';
const USER_B_ID = 'a1b2c3d4-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('TagService — picker visibility and entity-tag scoping (T-020, SPEC-086)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, [
            'findPickerTags',
            'findByType',
            'countActiveByOwner'
        ]);
        relatedModelMock = createTypedModelMock(REntityTagModel, [
            'findByEntityAndActor',
            'findByEntityAll'
        ]);
        const loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);
    });

    // =========================================================================
    // getPickerTags
    // =========================================================================
    describe('getPickerTags', () => {
        // -----------------------------------------------------------------------
        // AC-F07: Regular user picker excludes INTERNAL tags
        // -----------------------------------------------------------------------
        describe('AC-F07: Regular user does not see INTERNAL tags in picker', () => {
            it('should call findPickerTags with hasInternalView=false for regular user', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_USER_VIEW_OWN]
                });

                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                const userTag = TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'My Tag' });
                asMock(tagModelMock.findPickerTags).mockResolvedValue([systemTag, userTag]);

                const result = await service.getPickerTags(actor);

                expect(result.error).toBeUndefined();
                expect(asMock(tagModelMock.findPickerTags)).toHaveBeenCalledWith(
                    expect.objectContaining({ hasInternalView: false }),
                    undefined
                );
                // Tags returned include only what findPickerTags returned (SYSTEM + own USER)
                expect(result.data?.tags).toHaveLength(2);
                const types = result.data?.tags.map((t) => t.type);
                expect(types).not.toContain(TagTypeEnum.INTERNAL);
            });

            it('should call findPickerTags with hasInternalView=true for admin with TAG_INTERNAL_VIEW', async () => {
                const adminActor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_INTERNAL_VIEW, PermissionEnum.TAG_SYSTEM_VIEW]
                });

                const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
                const systemTag = TagFactoryBuilder.create({ name: 'Pet-friendly' });
                asMock(tagModelMock.findPickerTags).mockResolvedValue([internalTag, systemTag]);

                const result = await service.getPickerTags(adminActor);

                expect(result.error).toBeUndefined();
                expect(asMock(tagModelMock.findPickerTags)).toHaveBeenCalledWith(
                    expect.objectContaining({ hasInternalView: true }),
                    undefined
                );
                expect(result.data?.tags).toHaveLength(2);
            });
        });

        // -----------------------------------------------------------------------
        // Picker without auth → UNAUTHORIZED
        // -----------------------------------------------------------------------
        describe('Picker requires authentication', () => {
            it('should return UNAUTHORIZED for anonymous actor (no id)', async () => {
                const guest = createGuestActor();

                const result = await service.getPickerTags(guest);

                expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
                expect(asMock(tagModelMock.findPickerTags)).not.toHaveBeenCalled();
            });

            it('should return UNAUTHORIZED for actor with empty id', async () => {
                const actor = createActor({ id: '' });

                const result = await service.getPickerTags(actor);

                expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
            });
        });

        // -----------------------------------------------------------------------
        // actorId is forwarded to findPickerTags
        // -----------------------------------------------------------------------
        describe('actorId is passed to model', () => {
            it('should forward actor.id as actorId to findPickerTags', async () => {
                const actor = createActor({ id: USER_A_ID, permissions: [] });
                asMock(tagModelMock.findPickerTags).mockResolvedValue([]);

                await service.getPickerTags(actor);

                expect(asMock(tagModelMock.findPickerTags)).toHaveBeenCalledWith(
                    expect.objectContaining({ actorId: USER_A_ID }),
                    undefined
                );
            });
        });

        // -----------------------------------------------------------------------
        // Name search forwarded
        // -----------------------------------------------------------------------
        describe('Search query is forwarded to findPickerTags', () => {
            it('should forward search query as nameQuery', async () => {
                const actor = createActor({ id: USER_A_ID, permissions: [] });
                asMock(tagModelMock.findPickerTags).mockResolvedValue([]);

                await service.getPickerTags(actor, { search: 'pet' });

                expect(asMock(tagModelMock.findPickerTags)).toHaveBeenCalledWith(
                    expect.objectContaining({ nameQuery: 'pet' }),
                    undefined
                );
            });

            it('should pass undefined nameQuery when no search provided', async () => {
                const actor = createActor({ id: USER_A_ID, permissions: [] });
                asMock(tagModelMock.findPickerTags).mockResolvedValue([]);

                await service.getPickerTags(actor);

                expect(asMock(tagModelMock.findPickerTags)).toHaveBeenCalledWith(
                    expect.objectContaining({ nameQuery: undefined }),
                    undefined
                );
            });
        });
    });

    // =========================================================================
    // getTagsForEntity
    // =========================================================================
    describe('getTagsForEntity', () => {
        const params = { entityId: ENTITY_ID, entityType: ENTITY_TYPE as unknown as string };

        // -----------------------------------------------------------------------
        // AC-F05: User A does not see user B's assignments
        // -----------------------------------------------------------------------
        describe('AC-F05: Authenticated user sees only own assignments', () => {
            it('should call findByEntityAndActor with actor.id for regular user', async () => {
                const actorA = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_VIEW]
                });

                const tagA = TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'A Tag' });
                const entityTagA = buildEntityTag(tagA.id, ENTITY_ID, ENTITY_TYPE, USER_A_ID, {
                    name: 'A Tag'
                });
                asMock(relatedModelMock.findByEntityAndActor).mockResolvedValue([entityTagA]);

                const result = await service.getTagsForEntity(actorA, params);

                expect(result.error).toBeUndefined();
                // Must call the actor-scoped method (not findByEntityAll)
                expect(asMock(relatedModelMock.findByEntityAndActor)).toHaveBeenCalledWith(
                    ENTITY_ID,
                    ENTITY_TYPE,
                    USER_A_ID,
                    undefined
                );
                expect(asMock(relatedModelMock.findByEntityAll)).not.toHaveBeenCalled();
                expect(result.data?.tags).toHaveLength(1);
            });

            it("should not include user B's assignments in user A's result", async () => {
                const actorA = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_VIEW]
                });

                // findByEntityAndActor is scoped to actorA — returns only A's tags
                const tagA = TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'A Only' });
                asMock(relatedModelMock.findByEntityAndActor).mockResolvedValue([
                    buildEntityTag(tagA.id, ENTITY_ID, ENTITY_TYPE, USER_A_ID, { name: 'A Only' })
                ]);

                const result = await service.getTagsForEntity(actorA, params);

                expect(result.data?.tags).toHaveLength(1);
                expect(result.data?.tags[0]?.name).toBe('A Only');
            });
        });

        // -----------------------------------------------------------------------
        // AC-F06: Super-admin sees all assignments with attribution
        // -----------------------------------------------------------------------
        describe('AC-F06: Super-admin with TAG_VIEW_ALL_ASSIGNMENTS sees all', () => {
            it('should call findByEntityAll for actor with TAG_VIEW_ALL_ASSIGNMENTS', async () => {
                const superAdmin = createActor({
                    id: 'super-admin-uuid-0000-4000-a000-super000001',
                    permissions: [PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS]
                });

                const tagA = TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'Tag A' });
                const tagB = TagFactoryBuilder.createUserTag(USER_B_ID, { name: 'Tag B' });
                const entityTagA = buildEntityTag(tagA.id, ENTITY_ID, ENTITY_TYPE, USER_A_ID, {
                    name: 'Tag A'
                });
                const entityTagB = buildEntityTag(tagB.id, ENTITY_ID, ENTITY_TYPE, USER_B_ID, {
                    name: 'Tag B'
                });
                asMock(relatedModelMock.findByEntityAll).mockResolvedValue([
                    entityTagA,
                    entityTagB
                ]);

                const result = await service.getTagsForEntity(superAdmin, params);

                expect(result.error).toBeUndefined();
                expect(asMock(relatedModelMock.findByEntityAll)).toHaveBeenCalledWith(
                    ENTITY_ID,
                    ENTITY_TYPE,
                    undefined
                );
                expect(asMock(relatedModelMock.findByEntityAndActor)).not.toHaveBeenCalled();
                // Both users' assignments are returned
                expect(result.data?.tags).toHaveLength(2);
            });
        });

        // -----------------------------------------------------------------------
        // Anonymous returns empty (D-007)
        // -----------------------------------------------------------------------
        describe('Anonymous actor returns empty array (D-007)', () => {
            it('should return empty tags array for anonymous actor', async () => {
                const guest = createGuestActor();

                const result = await service.getTagsForEntity(guest, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.tags).toEqual([]);
                expect(asMock(relatedModelMock.findByEntityAndActor)).not.toHaveBeenCalled();
                expect(asMock(relatedModelMock.findByEntityAll)).not.toHaveBeenCalled();
            });

            it('should return empty tags array for actor with empty id', async () => {
                const actor = createActor({ id: '' });

                const result = await service.getTagsForEntity(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.tags).toEqual([]);
            });
        });
    });

    // =========================================================================
    // getPopularTags — SYSTEM filter
    // =========================================================================
    describe('getPopularTags — filters to SYSTEM tags only (D-001)', () => {
        it('should exclude INTERNAL tags from popular tags result', async () => {
            const actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_VIEW] });

            const systemTag = TagFactoryBuilder.create({
                name: 'Pet-friendly',
                type: TagTypeEnum.SYSTEM
            });
            const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Internal Op Tag' });

            asMock(relatedModelMock.findPopularTags).mockResolvedValue([
                { tag: systemTag, usageCount: 10 },
                { tag: internalTag, usageCount: 5 }
            ]);

            const result = await service.getPopularTags(actor, { limit: 10 });

            expect(result.error).toBeUndefined();
            // Only the SYSTEM tag should pass the filter
            expect(result.data?.tags).toHaveLength(1);
            expect(result.data?.tags[0]?.type).toBe(TagTypeEnum.SYSTEM);
        });

        it('should exclude USER tags from popular tags result', async () => {
            const actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_VIEW] });

            const systemTag = TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM });
            const userTag = TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'Private' });

            asMock(relatedModelMock.findPopularTags).mockResolvedValue([
                { tag: systemTag, usageCount: 8 },
                { tag: userTag, usageCount: 3 }
            ]);

            const result = await service.getPopularTags(actor, { limit: 10 });

            expect(result.data?.tags.every((t) => t.type === TagTypeEnum.SYSTEM)).toBe(true);
        });

        it('should return only SYSTEM tags when model returns mixed types', async () => {
            const actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_VIEW] });

            // Simulate model returning all types (model doesn't filter by type)
            const tags = [
                {
                    tag: TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM, name: 'S1' }),
                    usageCount: 20
                },
                { tag: TagFactoryBuilder.createInternalTag({ name: 'I1' }), usageCount: 15 },
                {
                    tag: TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM, name: 'S2' }),
                    usageCount: 10
                },
                { tag: TagFactoryBuilder.createUserTag(USER_A_ID, { name: 'U1' }), usageCount: 5 }
            ];
            asMock(relatedModelMock.findPopularTags).mockResolvedValue(tags);

            const result = await service.getPopularTags(actor, { limit: 10 });

            expect(result.data?.tags).toHaveLength(2);
            expect(result.data?.tags.every((t) => t.type === TagTypeEnum.SYSTEM)).toBe(true);
        });
    });
});
