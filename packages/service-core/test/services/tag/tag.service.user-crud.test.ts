/**
 * Tests for TagService user-tag own CRUD (SPEC-086 T-023).
 *
 * Acceptance Criteria:
 * - AC-003-01: listOwnTags returns only actor's USER tags (not other users').
 * - AC-003-04 / D-022: list returns ACTIVE + INACTIVE + ARCHIVED.
 * - updateOwnTag of other user's tag → FORBIDDEN.
 * - updateOwnTag rejecting type change → VALIDATION.
 * - AC-003-03: getQuotaStatus returns correct used and limit.
 * - getOwnTagImpactCount counts only actor's own assignments.
 * - createUserTag forces type=USER and ownerId=actor.id.
 *
 * References: D-022, AC-003-01..04
 */
import { REntityTagModel, TagModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    TagColorEnum,
    TagTypeEnum
} from '@repo/schemas';
import type { EntityTag, Tag } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Mock @repo/db to intercept withTransaction (needed for createUserTag → create)
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
            const fakeTx = {
                execute: vi.fn().mockResolvedValue([])
            };
            return callback(fakeTx);
        }),
        sql: actual.sql
    };
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER_ID = 'a1b2c3d4-0000-4000-a000-000000000001';
const OTHER_USER_ID = 'a1b2c3d4-0000-4000-a000-000000000002';
const DEFAULT_QUOTA = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserTag(ownerId: string, overrides: Partial<Tag> = {}): Tag {
    return TagFactoryBuilder.createUserTag(ownerId, overrides);
}

function buildEntityTagRow(tagId: string, assignedById: string): EntityTag {
    return {
        tagId,
        entityId: getMockId('accommodation'),
        entityType: 'ACCOMMODATION' as EntityTag['entityType'],
        assignedById
    } as EntityTag;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('TagService — user-tag own CRUD (T-023, SPEC-086)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, [
            'findByOwner',
            'findById',
            'findByType',
            'create',
            'update',
            'countActiveByOwner'
        ]);
        relatedModelMock = createTypedModelMock(REntityTagModel, [
            'findAllWithEntities',
            'countByTagId'
        ]);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);

        actor = createActor({
            id: OWNER_ID,
            permissions: [
                PermissionEnum.TAG_USER_VIEW_OWN,
                PermissionEnum.TAG_USER_CREATE,
                PermissionEnum.TAG_USER_UPDATE_OWN,
                PermissionEnum.TAG_USER_DELETE_OWN
            ]
        });

        // Default: no cross-type collision
        asMock(tagModelMock.findByType).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // listOwnTags
    // =========================================================================
    describe('listOwnTags', () => {
        // -----------------------------------------------------------------------
        // AC-003-01: Returns only actor's USER tags
        // -----------------------------------------------------------------------
        describe("AC-003-01: Returns only actor's USER tags", () => {
            it("should return only the actor's own USER tags", async () => {
                const ownTags = [
                    buildUserTag(OWNER_ID, {
                        name: 'A Tag',
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    }),
                    buildUserTag(OWNER_ID, {
                        name: 'B Tag',
                        lifecycleState: LifecycleStatusEnum.DRAFT
                    })
                ];
                asMock(tagModelMock.findByOwner).mockResolvedValue(ownTags);

                const result = await service.listOwnTags(actor);

                expect(result.error).toBeUndefined();
                expect(asMock(tagModelMock.findByOwner)).toHaveBeenCalledWith(OWNER_ID, undefined);
                expect(result.data?.tags).toHaveLength(2);
                expect(result.data?.tags.every((t: Tag) => t.ownerId === OWNER_ID)).toBe(true);
            });

            it('should NOT include tags from other users (model scopes by ownerId)', async () => {
                const ownTags = [buildUserTag(OWNER_ID, { name: 'Mine' })];
                // findByOwner returns only OWNER_ID tags (model-level scoping)
                asMock(tagModelMock.findByOwner).mockResolvedValue(ownTags);

                const result = await service.listOwnTags(actor);

                expect(result.data?.tags).toHaveLength(1);
                expect(result.data?.tags[0]?.ownerId).toBe(OWNER_ID);
                // Verify the call was made with the actor's ID, not another user's
                expect(asMock(tagModelMock.findByOwner)).not.toHaveBeenCalledWith(
                    OTHER_USER_ID,
                    expect.anything()
                );
            });

            it('should return empty array when actor has no USER tags', async () => {
                asMock(tagModelMock.findByOwner).mockResolvedValue([]);

                const result = await service.listOwnTags(actor);

                expect(result.error).toBeUndefined();
                expect(result.data?.tags).toEqual([]);
            });
        });

        // -----------------------------------------------------------------------
        // AC-003-04 / D-022: Returns all lifecycle states
        // -----------------------------------------------------------------------
        describe('AC-003-04 / D-022: Returns ACTIVE + DRAFT + ARCHIVED by default', () => {
            it('should return tags in all lifecycle states when no filter is given', async () => {
                const allStateTags = [
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.ACTIVE }),
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.DRAFT }),
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.ARCHIVED })
                ];
                asMock(tagModelMock.findByOwner).mockResolvedValue(allStateTags);

                const result = await service.listOwnTags(actor);

                expect(result.data?.tags).toHaveLength(3);
                const states = result.data?.tags.map((t: Tag) => t.lifecycleState);
                expect(states).toContain(LifecycleStatusEnum.ACTIVE);
                expect(states).toContain(LifecycleStatusEnum.DRAFT);
                expect(states).toContain(LifecycleStatusEnum.ARCHIVED);
            });

            it('should filter by lifecycleState when query.lifecycleState is provided', async () => {
                const allTags = [
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.ACTIVE }),
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.DRAFT }),
                    buildUserTag(OWNER_ID, { lifecycleState: LifecycleStatusEnum.ARCHIVED })
                ];
                asMock(tagModelMock.findByOwner).mockResolvedValue(allTags);

                const result = await service.listOwnTags(actor, {
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                });

                expect(result.data?.tags).toHaveLength(1);
                expect(result.data?.tags[0]?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
            });
        });

        // -----------------------------------------------------------------------
        // Name search filter (D-014, AC-F23)
        // -----------------------------------------------------------------------
        describe('Name search filter (D-014, AC-F23)', () => {
            it('should filter by name substring (case-insensitive)', async () => {
                const allTags = [
                    buildUserTag(OWNER_ID, { name: 'Read Later' }),
                    buildUserTag(OWNER_ID, { name: 'VIP Client' }),
                    buildUserTag(OWNER_ID, { name: 'read-focused-study' })
                ];
                asMock(tagModelMock.findByOwner).mockResolvedValue(allTags);

                const result = await service.listOwnTags(actor, { search: 'read' });

                expect(result.data?.tags).toHaveLength(2);
                const names = result.data?.tags.map((t: Tag) => t.name);
                expect(names).toContain('Read Later');
                expect(names).toContain('read-focused-study');
            });

            it('should return all tags when search is empty string', async () => {
                const allTags = [
                    buildUserTag(OWNER_ID, { name: 'Tag A' }),
                    buildUserTag(OWNER_ID, { name: 'Tag B' })
                ];
                asMock(tagModelMock.findByOwner).mockResolvedValue(allTags);

                const result = await service.listOwnTags(actor, { search: '' });

                expect(result.data?.tags).toHaveLength(2);
            });
        });

        // -----------------------------------------------------------------------
        // Permission check
        // -----------------------------------------------------------------------
        describe('Permission check', () => {
            it('should return FORBIDDEN when actor lacks TAG_USER_VIEW_OWN', async () => {
                const noViewActor = createActor({
                    id: OWNER_ID,
                    permissions: [] // no TAG_USER_VIEW_OWN
                });

                const result = await service.listOwnTags(noViewActor);

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(asMock(tagModelMock.findByOwner)).not.toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // createUserTag
    // =========================================================================
    describe('createUserTag', () => {
        it('should force type=USER and ownerId=actor.id regardless of input', async () => {
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
            const createdTag = buildUserTag(OWNER_ID, { name: 'New Tag' });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.createUserTag(
                { name: 'New Tag', color: TagColorEnum.BLUE },
                actor
            );

            expect(result.error).toBeUndefined();
            expect(result.data?.type).toBe(TagTypeEnum.USER);
            expect(result.data?.ownerId).toBe(OWNER_ID);

            // Verify model.create was called with forced type+ownerId
            const createCall = asMock(tagModelMock.create).mock.calls[0] as unknown[];
            const callInput = createCall[0] as { type: string; ownerId: string };
            expect(callInput.type).toBe(TagTypeEnum.USER);
            expect(callInput.ownerId).toBe(OWNER_ID);
        });

        it('should go through quota enforcement', async () => {
            // At quota — should be rejected
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(DEFAULT_QUOTA);

            const result = await service.createUserTag(
                { name: 'Overflow Tag', color: TagColorEnum.RED },
                actor
            );

            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(asMock(tagModelMock.create)).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // updateOwnTag
    // =========================================================================
    describe('updateOwnTag', () => {
        // -----------------------------------------------------------------------
        // Cannot update other user's tag
        // -----------------------------------------------------------------------
        describe("updateOwnTag of other user's tag → FORBIDDEN", () => {
            it('should return FORBIDDEN when tag belongs to another user', async () => {
                const otherUserTag = buildUserTag(OTHER_USER_ID, { name: "Other's Tag" });
                asMock(tagModelMock.findById).mockResolvedValue(otherUserTag);

                const result = await service.updateOwnTag(
                    otherUserTag.id,
                    { name: 'Hacked Name' },
                    actor
                );

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
                expect(asMock(tagModelMock.update)).not.toHaveBeenCalled();
            });

            it('should return FORBIDDEN when tag is SYSTEM (not USER)', async () => {
                const systemTag = TagFactoryBuilder.create({ name: 'System Tag' });
                asMock(tagModelMock.findById).mockResolvedValue(systemTag);

                const result = await service.updateOwnTag(
                    systemTag.id,
                    { name: 'New Name' },
                    actor
                );

                expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            });
        });

        // -----------------------------------------------------------------------
        // Type change rejected
        // -----------------------------------------------------------------------
        describe('Rejecting type change → VALIDATION', () => {
            it('should return VALIDATION_ERROR when input contains type field', async () => {
                const ownTag = buildUserTag(OWNER_ID, { name: 'My Tag' });
                asMock(tagModelMock.findById).mockResolvedValue(ownTag);

                const result = await service.updateOwnTag(
                    ownTag.id,
                    { type: TagTypeEnum.SYSTEM } as unknown as Parameters<
                        typeof service.updateOwnTag
                    >[1],
                    actor
                );

                expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(result.error?.message).toMatch(/immutable/i);
                expect(asMock(tagModelMock.update)).not.toHaveBeenCalled();
            });

            it('should return VALIDATION_ERROR when input contains ownerId field', async () => {
                const ownTag = buildUserTag(OWNER_ID, { name: 'My Tag' });
                asMock(tagModelMock.findById).mockResolvedValue(ownTag);

                const result = await service.updateOwnTag(
                    ownTag.id,
                    {
                        ownerId: OTHER_USER_ID
                    } as unknown as Parameters<typeof service.updateOwnTag>[1],
                    actor
                );

                expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
                expect(result.error?.message).toMatch(/ownerId/i);
            });
        });

        // -----------------------------------------------------------------------
        // Successful update
        // -----------------------------------------------------------------------
        describe('Successful update of own tag', () => {
            it('should update patchable fields for own USER tag', async () => {
                const ownTag = buildUserTag(OWNER_ID, { name: 'Old Name' });
                asMock(tagModelMock.findById).mockResolvedValue(ownTag);
                const updatedTag = { ...ownTag, name: 'New Name' };
                asMock(tagModelMock.update).mockResolvedValue(updatedTag);

                const result = await service.updateOwnTag(ownTag.id, { name: 'New Name' }, actor);

                expect(result.error).toBeUndefined();
                expect(result.data?.name).toBe('New Name');
            });

            it('should NOT call update when tag is not found', async () => {
                asMock(tagModelMock.findById).mockResolvedValue(null);

                const result = await service.updateOwnTag(getMockId('tag'), { name: 'X' }, actor);

                expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
                expect(asMock(tagModelMock.update)).not.toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // getOwnTagImpactCount
    // =========================================================================
    describe('getOwnTagImpactCount', () => {
        it("should count only actor's own assignments for a given tag", async () => {
            const ownTag = buildUserTag(OWNER_ID, { name: 'My Tag' });
            asMock(tagModelMock.findById).mockResolvedValue(ownTag);

            // 3 assignments total, but only 2 by actor (OWNER_ID)
            const rows: EntityTag[] = [
                buildEntityTagRow(ownTag.id, OWNER_ID),
                buildEntityTagRow(ownTag.id, OWNER_ID),
                buildEntityTagRow(ownTag.id, OTHER_USER_ID) // another user's assignment
            ];
            asMock(relatedModelMock.findAllWithEntities).mockResolvedValue(rows);

            const result = await service.getOwnTagImpactCount(ownTag.id, actor);

            expect(result.error).toBeUndefined();
            // Only actor's 2 rows are counted
            expect(result.data?.count).toBe(2);
        });

        it('should return FORBIDDEN when tag belongs to another user', async () => {
            const otherTag = buildUserTag(OTHER_USER_ID, { name: "Other's tag" });
            asMock(tagModelMock.findById).mockResolvedValue(otherTag);

            const result = await service.getOwnTagImpactCount(otherTag.id, actor);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(asMock(relatedModelMock.findAllWithEntities)).not.toHaveBeenCalled();
        });

        it('should return FORBIDDEN when tag is not a USER tag (e.g. SYSTEM)', async () => {
            const systemTag = TagFactoryBuilder.create({ type: TagTypeEnum.SYSTEM });
            asMock(tagModelMock.findById).mockResolvedValue(systemTag);

            const result = await service.getOwnTagImpactCount(systemTag.id, actor);

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });

        it('should return NOT_FOUND when tag does not exist', async () => {
            asMock(tagModelMock.findById).mockResolvedValue(null);

            const result = await service.getOwnTagImpactCount(getMockId('tag'), actor);

            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });

        it('should return 0 when actor has no assignments for the tag', async () => {
            const ownTag = buildUserTag(OWNER_ID, { name: 'Unused Tag' });
            asMock(tagModelMock.findById).mockResolvedValue(ownTag);
            asMock(relatedModelMock.findAllWithEntities).mockResolvedValue([]);

            const result = await service.getOwnTagImpactCount(ownTag.id, actor);

            expect(result.error).toBeUndefined();
            expect(result.data?.count).toBe(0);
        });
    });

    // =========================================================================
    // getQuotaStatus — AC-003-03
    // =========================================================================
    describe('getQuotaStatus (AC-003-03)', () => {
        it('should return correct used and limit from countActiveByOwner and getUserTagQuota', async () => {
            // Arrange: actor has 38 ACTIVE USER tags out of default quota 50
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(38);
            // Default quota = 50 (env var not set)
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = undefined;

            const result = await service.getQuotaStatus(actor);

            expect(result.error).toBeUndefined();
            expect(result.data?.used).toBe(38);
            expect(result.data?.limit).toBe(DEFAULT_QUOTA);
            expect(asMock(tagModelMock.countActiveByOwner)).toHaveBeenCalledWith(
                OWNER_ID,
                undefined
            );
        });

        it('should reflect custom quota from env var', async () => {
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = '25';
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(10);

            const result = await service.getQuotaStatus(actor);

            expect(result.data?.used).toBe(10);
            expect(result.data?.limit).toBe(25);

            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = undefined;
        });

        it('should return 0 used when actor has no active USER tags', async () => {
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);

            const result = await service.getQuotaStatus(actor);

            expect(result.data?.used).toBe(0);
            expect(result.data?.limit).toBe(DEFAULT_QUOTA);
        });

        it('should return used=limit when at quota boundary', async () => {
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(DEFAULT_QUOTA);

            const result = await service.getQuotaStatus(actor);

            expect(result.data?.used).toBe(DEFAULT_QUOTA);
            expect(result.data?.limit).toBe(DEFAULT_QUOTA);
        });
    });
});
