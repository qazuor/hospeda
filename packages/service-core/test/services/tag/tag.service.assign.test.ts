/**
 * Tests for TagService assignTag / removeAssignment with entity-access check (SPEC-086 T-021).
 *
 * Acceptance Criteria:
 * - AC-F04: Two users assign same SYSTEM tag to same entity → 2 separate rows (different assignedById).
 * - AC-F07: Regular user assigns INTERNAL tag → FORBIDDEN.
 * - AC-F08: Actor without entity-view permission tries to assign → FORBIDDEN.
 * - USER tag belonging to other user → FORBIDDEN.
 * - Same actor assigns same tag twice to same entity → idempotent (no error, no duplicate row).
 * - removeAssignment of other user's row → FORBIDDEN.
 *
 * References: D-005, D-007, D-008, D-009
 */
import { REntityTagModel, TagModel } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, ServiceErrorCode, TagTypeEnum } from '@repo/schemas';
import type { EntityTag } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    TagAssignInput,
    TagRemoveAssignmentInput
} from '../../../src/services/tag/tag.service';
import { TagService } from '../../../src/services/tag/tag.service';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Mock EntityAccessRegistry so we can control canView per test
// ---------------------------------------------------------------------------

// Default: all entities are accessible (permissive stub behavior).
// Individual tests override this mock for AC-F08.
vi.mock('../../../src/services/tag/entity-access-registry', () => ({
    getCanViewChecker: vi.fn(() => async () => true)
}));

import { getCanViewChecker } from '../../../src/services/tag/entity-access-registry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_ID = getMockId('accommodation');
const ENTITY_TYPE = EntityTypeEnum.ACCOMMODATION;
const USER_A_ID = 'a1b2c3d4-0000-4000-a000-000000000001';
const USER_B_ID = 'a1b2c3d4-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEntityTag(overrides: Partial<EntityTag> = {}): EntityTag {
    return {
        tagId: getMockId('tag'),
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        assignedById: USER_A_ID,
        ...overrides
    } as EntityTag;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('TagService — assignTag / removeAssignment (T-021, SPEC-086)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;

    beforeEach(() => {
        vi.clearAllMocks();

        tagModelMock = createTypedModelMock(TagModel, ['findById', 'findByType']);
        relatedModelMock = createTypedModelMock(REntityTagModel, [
            'findOne',
            'assign',
            'deleteByTagIdEntityUser',
            'countByTagId'
        ]);

        const loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);

        // Default: entity is accessible
        asMock(getCanViewChecker).mockReturnValue(async () => true);
    });

    // =========================================================================
    // assignTag
    // =========================================================================
    describe('assignTag', () => {
        // -----------------------------------------------------------------------
        // Tag not found
        // -----------------------------------------------------------------------
        describe('Tag existence check', () => {
            it('should return NOT_FOUND when tag does not exist', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const tagId = getMockId('tag');
                asMock(tagModelMock.findById).mockResolvedValue(null);

                const params: TagAssignInput = {
                    tagId,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(asMock(relatedModelMock.assign)).not.toHaveBeenCalled();
            });
        });

        // -----------------------------------------------------------------------
        // AC-F07: Regular user assigns INTERNAL tag → FORBIDDEN (D-008)
        // -----------------------------------------------------------------------
        describe('AC-F07: Picker visibility — INTERNAL tag requires TAG_INTERNAL_VIEW', () => {
            it('should return FORBIDDEN when regular user tries to assign INTERNAL tag', async () => {
                // Arrange: actor has no TAG_INTERNAL_VIEW
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                    // No TAG_INTERNAL_VIEW
                });
                const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
                asMock(tagModelMock.findById).mockResolvedValue(internalTag);

                const params: TagAssignInput = {
                    tagId: internalTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                // Act
                const result = await service.assignTag(actor, params);

                // Assert
                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(result.error?.message).toMatch(/TAG_INTERNAL_VIEW/);
                expect(asMock(relatedModelMock.assign)).not.toHaveBeenCalled();
            });

            it('should allow admin with TAG_INTERNAL_VIEW to assign INTERNAL tag', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_INTERNAL_VIEW, PermissionEnum.TAG_ASSIGN_ADD]
                });
                const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
                asMock(tagModelMock.findById).mockResolvedValue(internalTag);
                // No existing assignment
                asMock(relatedModelMock.findOne).mockResolvedValue(null);
                const insertedRow = buildEntityTag({
                    tagId: internalTag.id,
                    assignedById: USER_A_ID
                });
                asMock(relatedModelMock.assign).mockResolvedValue(insertedRow);

                const params: TagAssignInput = {
                    tagId: internalTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.assigned).toBe(true);
                expect(asMock(relatedModelMock.assign)).toHaveBeenCalledOnce();
            });
        });

        // -----------------------------------------------------------------------
        // USER tag belonging to other user → FORBIDDEN (D-008)
        // -----------------------------------------------------------------------
        describe("Cannot assign another user's USER tag (D-008)", () => {
            it('should return FORBIDDEN when actor tries to assign USER tag owned by another user', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                // Tag belongs to USER_B
                const otherUserTag = TagFactoryBuilder.createUserTag(USER_B_ID, {
                    name: "B's private tag"
                });
                asMock(tagModelMock.findById).mockResolvedValue(otherUserTag);

                const params: TagAssignInput = {
                    tagId: otherUserTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(result.error?.message).toMatch(/another user/i);
                expect(asMock(relatedModelMock.assign)).not.toHaveBeenCalled();
            });

            it('should allow actor to assign their own USER tag', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const ownTag = TagFactoryBuilder.createUserTag(USER_A_ID, {
                    name: 'My private tag'
                });
                asMock(tagModelMock.findById).mockResolvedValue(ownTag);
                asMock(relatedModelMock.findOne).mockResolvedValue(null);
                const insertedRow = buildEntityTag({ tagId: ownTag.id, assignedById: USER_A_ID });
                asMock(relatedModelMock.assign).mockResolvedValue(insertedRow);

                const params: TagAssignInput = {
                    tagId: ownTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.assigned).toBe(true);
            });
        });

        // -----------------------------------------------------------------------
        // AC-F08: Actor without entity-view permission → FORBIDDEN (D-009)
        // -----------------------------------------------------------------------
        describe('AC-F08: Entity-level access required (D-009)', () => {
            it('should return FORBIDDEN when entity is not accessible to actor', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);

                // Override canView to deny access for this test
                asMock(getCanViewChecker).mockReturnValue(async () => false);

                const params: TagAssignInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(result.error?.message).toMatch(/entity/i);
                expect(asMock(relatedModelMock.assign)).not.toHaveBeenCalled();
            });
        });

        // -----------------------------------------------------------------------
        // Idempotency: same actor, same tag, same entity → no duplicate
        // -----------------------------------------------------------------------
        describe('Idempotent assign (same actor + tag + entity)', () => {
            it('should return success with wasAlreadyAssigned=true on duplicate attempt', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);

                // Existing row found — actor already assigned this tag
                const existingRow = buildEntityTag({
                    tagId: systemTag.id,
                    assignedById: USER_A_ID
                });
                asMock(relatedModelMock.findOne).mockResolvedValue(existingRow);

                const params: TagAssignInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.assigned).toBe(true);
                expect(result.data?.wasAlreadyAssigned).toBe(true);
                // No new row inserted
                expect(asMock(relatedModelMock.assign)).not.toHaveBeenCalled();
            });

            it('should return wasAlreadyAssigned=false on first assignment', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);
                asMock(relatedModelMock.findOne).mockResolvedValue(null); // no existing row
                const insertedRow = buildEntityTag({
                    tagId: systemTag.id,
                    assignedById: USER_A_ID
                });
                asMock(relatedModelMock.assign).mockResolvedValue(insertedRow);

                const params: TagAssignInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.assignTag(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.assigned).toBe(true);
                expect(result.data?.wasAlreadyAssigned).toBe(false);
                expect(asMock(relatedModelMock.assign)).toHaveBeenCalledOnce();
            });
        });

        // -----------------------------------------------------------------------
        // AC-F04: Two users independently apply same SYSTEM tag → 2 rows
        // -----------------------------------------------------------------------
        describe('AC-F04: Two users assign same SYSTEM tag → separate rows', () => {
            it('should call assign with correct assignedById for each actor independently', async () => {
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);
                asMock(relatedModelMock.findOne).mockResolvedValue(null); // no existing rows
                asMock(relatedModelMock.assign).mockImplementation(async (input) =>
                    buildEntityTag({ tagId: input.tagId, assignedById: input.assignedById })
                );

                const actorA = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const actorB = createActor({
                    id: USER_B_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });

                const params: TagAssignInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                // Both assign independently
                const [resultA, resultB] = await Promise.all([
                    service.assignTag(actorA, params),
                    service.assignTag(actorB, params)
                ]);

                expect(resultA.error).toBeUndefined();
                expect(resultB.error).toBeUndefined();
                expect(resultA.data?.assigned).toBe(true);
                expect(resultB.data?.assigned).toBe(true);

                // Verify assign was called twice with different assignedById
                const calls = asMock(relatedModelMock.assign).mock.calls;
                expect(calls).toHaveLength(2);
                const assignedByIds = calls.map(
                    (c: unknown[]) => (c[0] as { assignedById: string }).assignedById
                );
                expect(assignedByIds).toContain(USER_A_ID);
                expect(assignedByIds).toContain(USER_B_ID);
            });
        });

        // -----------------------------------------------------------------------
        // assignedById injection — NEVER from caller
        // -----------------------------------------------------------------------
        describe('assignedById is always injected from actor (D-005)', () => {
            it('should use actor.id as assignedById regardless of any other value', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);
                asMock(relatedModelMock.findOne).mockResolvedValue(null);
                const insertedRow = buildEntityTag({
                    tagId: systemTag.id,
                    assignedById: USER_A_ID
                });
                asMock(relatedModelMock.assign).mockResolvedValue(insertedRow);

                const params: TagAssignInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                await service.assignTag(actor, params);

                const assignCall = asMock(relatedModelMock.assign).mock.calls[0] as unknown[];
                const callInput = assignCall[0] as { assignedById: string };
                expect(callInput.assignedById).toBe(USER_A_ID);
            });
        });

        // -----------------------------------------------------------------------
        // SYSTEM tag — any authenticated actor can assign
        // -----------------------------------------------------------------------
        describe('SYSTEM tag — any authenticated actor can assign', () => {
            it('should allow regular user to assign SYSTEM tag', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_ADD]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);
                asMock(relatedModelMock.findOne).mockResolvedValue(null);
                const insertedRow = buildEntityTag({
                    tagId: systemTag.id,
                    assignedById: USER_A_ID
                });
                asMock(relatedModelMock.assign).mockResolvedValue(insertedRow);

                const result = await service.assignTag(actor, {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                });

                expect(result.error).toBeUndefined();
                expect(result.data?.assigned).toBe(true);
            });
        });
    });

    // =========================================================================
    // removeAssignment
    // =========================================================================
    describe('removeAssignment', () => {
        // -----------------------------------------------------------------------
        // Successful removal of own assignment
        // -----------------------------------------------------------------------
        describe('Successful removal of own assignment', () => {
            it('should remove assignment when actor is the owner', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_REMOVE]
                });
                const systemTag = TagFactoryBuilder.create({
                    name: 'Pet-friendly',
                    type: TagTypeEnum.SYSTEM
                });
                // deleteByTagIdEntityUser returns count of deleted rows
                asMock(relatedModelMock.deleteByTagIdEntityUser).mockResolvedValue(1);

                const params: TagRemoveAssignmentInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.removeAssignment(actor, params);

                expect(result.error).toBeUndefined();
                expect(result.data?.removed).toBe(true);
                expect(asMock(relatedModelMock.deleteByTagIdEntityUser)).toHaveBeenCalledWith(
                    systemTag.id,
                    ENTITY_ID,
                    ENTITY_TYPE,
                    USER_A_ID,
                    undefined // ctx.tx
                );
            });
        });

        // -----------------------------------------------------------------------
        // removeAssignment of other user's row → FORBIDDEN (D-007)
        // -----------------------------------------------------------------------
        describe("Cannot remove another actor's assignment (D-007)", () => {
            it('should return FORBIDDEN when deleting a row that belongs to another actor', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_REMOVE]
                });
                const systemTag = TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM });

                // 0 rows deleted = no matching row for this actor (assignment belongs to USER_B)
                asMock(relatedModelMock.deleteByTagIdEntityUser).mockResolvedValue(0);

                const params: TagRemoveAssignmentInput = {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                };

                const result = await service.removeAssignment(actor, params);

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(result.error?.message).toMatch(/different actor/i);
            });

            it('should return FORBIDDEN when assignment does not exist at all', async () => {
                const actor = createActor({
                    id: USER_A_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_REMOVE]
                });
                const systemTag = TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM });

                // 0 rows deleted = assignment never existed
                asMock(relatedModelMock.deleteByTagIdEntityUser).mockResolvedValue(0);

                const result = await service.removeAssignment(actor, {
                    tagId: systemTag.id,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                });

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        // -----------------------------------------------------------------------
        // Only actor.id used in the delete predicate
        // -----------------------------------------------------------------------
        describe('Delete predicate scoped to actor.id', () => {
            it('should call deleteByTagIdEntityUser with actor.id as assignedById', async () => {
                const actor = createActor({
                    id: USER_B_ID,
                    permissions: [PermissionEnum.TAG_ASSIGN_REMOVE]
                });
                const tagId = getMockId('tag');
                asMock(relatedModelMock.deleteByTagIdEntityUser).mockResolvedValue(1);

                await service.removeAssignment(actor, {
                    tagId,
                    entityId: ENTITY_ID,
                    entityType: ENTITY_TYPE
                });

                expect(asMock(relatedModelMock.deleteByTagIdEntityUser)).toHaveBeenCalledWith(
                    tagId,
                    ENTITY_ID,
                    ENTITY_TYPE,
                    USER_B_ID, // actor.id — not any other value
                    undefined
                );
            });
        });
    });
});
