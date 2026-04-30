/**
 * Tests for TagService.deleteTag and getImpactCount (SPEC-086 T-022).
 *
 * Covers:
 * - Permission matrix per tag type (D-017)
 * - Impact count returned before deletion (D-011)
 * - Hard delete with cascade (DB-level; tested via model mock)
 * - getImpactCount() — view permission required
 */
import { REntityTagModel, TagModel } from '@repo/db';
import { PermissionEnum, TagColorEnum, TagTypeEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectForbiddenError, expectNotFoundError, expectSuccess } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService.deleteTag (T-022, SPEC-086 D-011, D-017)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const systemTag = TagFactoryBuilder.create({
        name: 'Pet-friendly',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        ownerId: null
    });
    const internalTag = TagFactoryBuilder.createInternalTag({
        name: 'Spam',
        color: TagColorEnum.RED
    });
    const ownerId = 'owner-uuid';
    const userTag = TagFactoryBuilder.createUserTag(ownerId, {
        name: 'My Tag',
        color: TagColorEnum.GREEN
    });
    const otherUserTag = TagFactoryBuilder.createUserTag('other-owner', { name: 'Other Tag' });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById', 'hardDelete']);
        relatedModelMock = createTypedModelMock(REntityTagModel, ['countByTagId']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);
    });

    // -------------------------------------------------------------------------
    // INTERNAL tag deletion
    // -------------------------------------------------------------------------
    describe('INTERNAL tag', () => {
        it('should delete INTERNAL tag with TAG_INTERNAL_DELETE and return impactCount', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_INTERNAL_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(internalTag);
            asMock(relatedModelMock.countByTagId).mockResolvedValue(3);
            asMock(tagModelMock.hardDelete).mockResolvedValue(1);

            const result = await service.deleteTag(actor, internalTag.id);

            expectSuccess(result);
            expect(result.data?.deleted).toBe(true);
            expect(result.data?.impactCount).toBe(3);
            expect(asMock(tagModelMock.hardDelete)).toHaveBeenCalled();
        });

        it('should return FORBIDDEN for INTERNAL delete without TAG_INTERNAL_DELETE', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(internalTag);

            const result = await service.deleteTag(actor, internalTag.id);

            expectForbiddenError(result);
        });
    });

    // -------------------------------------------------------------------------
    // SYSTEM tag deletion
    // -------------------------------------------------------------------------
    describe('SYSTEM tag', () => {
        it('should delete SYSTEM tag with TAG_SYSTEM_DELETE and return impactCount', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(systemTag);
            asMock(relatedModelMock.countByTagId).mockResolvedValue(120);
            asMock(tagModelMock.hardDelete).mockResolvedValue(1);

            const result = await service.deleteTag(actor, systemTag.id);

            expectSuccess(result);
            expect(result.data?.deleted).toBe(true);
            expect(result.data?.impactCount).toBe(120);
        });

        it('should return FORBIDDEN for SYSTEM delete without TAG_SYSTEM_DELETE', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_INTERNAL_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(systemTag);

            const result = await service.deleteTag(actor, systemTag.id);

            expectForbiddenError(result);
        });
    });

    // -------------------------------------------------------------------------
    // USER tag deletion — own (TAG_USER_DELETE_OWN)
    // -------------------------------------------------------------------------
    describe('USER tag — own deletion', () => {
        it('should delete own USER tag with TAG_USER_DELETE_OWN and return impactCount', async () => {
            const actor: Actor = createActor({
                id: ownerId,
                permissions: [PermissionEnum.TAG_USER_DELETE_OWN]
            });
            asMock(tagModelMock.findById).mockResolvedValue(userTag);
            asMock(relatedModelMock.countByTagId).mockResolvedValue(4);
            asMock(tagModelMock.hardDelete).mockResolvedValue(1);

            const result = await service.deleteTag(actor, userTag.id);

            expectSuccess(result);
            expect(result.data?.deleted).toBe(true);
            expect(result.data?.impactCount).toBe(4);
        });

        it('should return FORBIDDEN when actor is not the owner (no TAG_USER_DELETE_ANY)', async () => {
            const notOwner: Actor = createActor({
                id: 'not-owner',
                permissions: [PermissionEnum.TAG_USER_DELETE_OWN]
            });
            asMock(tagModelMock.findById).mockResolvedValue(userTag);

            const result = await service.deleteTag(notOwner, userTag.id);

            expectForbiddenError(result);
        });

        it('should return FORBIDDEN with no delete permission at all', async () => {
            const actor: Actor = createActor({ id: ownerId, permissions: [] });
            asMock(tagModelMock.findById).mockResolvedValue(userTag);

            const result = await service.deleteTag(actor, userTag.id);

            expectForbiddenError(result);
        });
    });

    // -------------------------------------------------------------------------
    // USER tag deletion — super-admin moderation (TAG_USER_DELETE_ANY)
    // -------------------------------------------------------------------------
    describe('USER tag — super-admin moderation (TAG_USER_DELETE_ANY)', () => {
        it('should delete any USER tag with TAG_USER_DELETE_ANY', async () => {
            const superAdmin: Actor = createActor({
                id: 'superadmin-uuid',
                permissions: [PermissionEnum.TAG_USER_DELETE_ANY]
            });
            asMock(tagModelMock.findById).mockResolvedValue(otherUserTag);
            asMock(relatedModelMock.countByTagId).mockResolvedValue(0);
            asMock(tagModelMock.hardDelete).mockResolvedValue(1);

            const result = await service.deleteTag(superAdmin, otherUserTag.id);

            expectSuccess(result);
            expect(result.data?.deleted).toBe(true);
            expect(result.data?.impactCount).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // NOT_FOUND
    // -------------------------------------------------------------------------
    describe('not found', () => {
        it('should return NOT_FOUND when tag does not exist', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(null);

            const result = await service.deleteTag(actor, '00000000-0000-4000-a000-000000000099');

            expectNotFoundError(result);
        });
    });

    // -------------------------------------------------------------------------
    // Impact count fetched BEFORE deletion
    // -------------------------------------------------------------------------
    describe('impact count ordering', () => {
        it('should fetch impact count before executing hard delete', async () => {
            const actor: Actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_DELETE] });
            asMock(tagModelMock.findById).mockResolvedValue(systemTag);

            const callOrder: string[] = [];
            asMock(relatedModelMock.countByTagId).mockImplementation(async () => {
                callOrder.push('countByTagId');
                return 7;
            });
            asMock(tagModelMock.hardDelete).mockImplementation(async () => {
                callOrder.push('hardDelete');
                return 1;
            });

            const result = await service.deleteTag(actor, systemTag.id);

            expectSuccess(result);
            expect(callOrder).toEqual(['countByTagId', 'hardDelete']);
        });
    });
});

// ---------------------------------------------------------------------------
// getImpactCount tests
// ---------------------------------------------------------------------------
describe('TagService.getImpactCount (T-022)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const systemTag = TagFactoryBuilder.create({
        name: 'Pet-friendly',
        type: TagTypeEnum.SYSTEM,
        color: TagColorEnum.BLUE,
        ownerId: null
    });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, ['findById']);
        relatedModelMock = createTypedModelMock(REntityTagModel, ['countByTagId']);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);
    });

    it('should return the impact count for a SYSTEM tag (authenticated actor)', async () => {
        // SYSTEM tags are visible to any authenticated actor
        const actor: Actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(systemTag);
        asMock(relatedModelMock.countByTagId).mockResolvedValue(42);

        const result = await service.getImpactCount(actor, systemTag.id);

        expectSuccess(result);
        expect(result.data?.count).toBe(42);
    });

    it('should return NOT_FOUND when tag does not exist', async () => {
        const actor: Actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(null);

        const result = await service.getImpactCount(actor, '00000000-0000-4000-a000-000000000099');

        expectNotFoundError(result);
    });

    it('should return FORBIDDEN for INTERNAL tag when actor lacks TAG_INTERNAL_VIEW', async () => {
        const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });
        // Actor has no TAG_INTERNAL_VIEW — assertCanViewTag will reject
        const actor: Actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(internalTag);

        const result = await service.getImpactCount(actor, internalTag.id);

        expectForbiddenError(result);
    });

    it('should return FORBIDDEN for other USER tag when actor is not owner', async () => {
        const tagOwnerId = 'other-owner';
        const userTag = TagFactoryBuilder.createUserTag(tagOwnerId, { name: 'Other Tag' });
        // Actor is not owner and lacks TAG_VIEW_ALL_USER_TAGS
        const actor: Actor = createActor({ id: 'not-owner', permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(userTag);

        const result = await service.getImpactCount(actor, userTag.id);

        expectForbiddenError(result);
    });

    it('should return count=0 when tag has no assignments', async () => {
        const actor: Actor = createActor({ permissions: [] });
        asMock(tagModelMock.findById).mockResolvedValue(systemTag);
        asMock(relatedModelMock.countByTagId).mockResolvedValue(0);

        const result = await service.getImpactCount(actor, systemTag.id);

        expectSuccess(result);
        expect(result.data?.count).toBe(0);
    });
});
