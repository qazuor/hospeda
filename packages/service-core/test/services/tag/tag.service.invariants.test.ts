/**
 * Tests for TagService type invariants and cross-type name collision (SPEC-086 T-018).
 *
 * Acceptance Criteria:
 * - AC-F01: type=USER with no ownerId → VALIDATION_ERROR
 * - AC-F02: type=INTERNAL or SYSTEM with non-null ownerId → VALIDATION_ERROR
 * - AC-F03: USER tag with name colliding with INTERNAL or SYSTEM → ALREADY_EXISTS
 */
import { REntityTagModel, TagModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    TagColorEnum,
    TagTypeEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Intercept withTransaction so USER tag quota enforcement works without a real DB.
// AC-F03 tests create USER tags which trigger quota check inside a transaction.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
            const fakeTx = { execute: vi.fn().mockResolvedValue([]) };
            return callback(fakeTx);
        })
    };
});
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { expectSuccess, expectValidationError } from '../../helpers/assertions';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

describe('TagService — type invariants (T-018, SPEC-086 D-018)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    const systemTag = TagFactoryBuilder.create({
        name: 'Pet-friendly',
        type: TagTypeEnum.SYSTEM,
        ownerId: null
    });
    const internalTag = TagFactoryBuilder.createInternalTag({ name: 'Spam' });

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, [
            'create',
            'findByType',
            'countActiveByOwner'
        ]);
        relatedModelMock = createTypedModelMock(REntityTagModel, []);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);

        // Default: no collision candidates
        asMock(tagModelMock.findByType).mockResolvedValue([]);
    });

    // -------------------------------------------------------------------------
    // AC-F01: USER tag with no ownerId → VALIDATION_ERROR
    // -------------------------------------------------------------------------
    describe('AC-F01: USER tag requires ownerId', () => {
        let actor: Actor;

        beforeEach(() => {
            actor = createActor({ permissions: [PermissionEnum.TAG_USER_CREATE] });
        });

        it('should return VALIDATION_ERROR when creating USER tag without ownerId (null)', async () => {
            const result = await service.create(actor, {
                name: 'My Tag',
                type: TagTypeEnum.USER,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: null
            });

            expectValidationError(result);
        });
    });

    // -------------------------------------------------------------------------
    // AC-F02: INTERNAL/SYSTEM tag must not have ownerId
    // -------------------------------------------------------------------------
    describe('AC-F02: INTERNAL and SYSTEM tags must not have ownerId', () => {
        it('should return VALIDATION_ERROR when creating INTERNAL tag with non-null ownerId', async () => {
            const actor = createActor({ permissions: [PermissionEnum.TAG_INTERNAL_CREATE] });

            const result = await service.create(actor, {
                name: 'Spam',
                type: TagTypeEnum.INTERNAL,
                color: TagColorEnum.RED,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: 'some-user-id'
            });

            expectValidationError(result);
        });

        it('should return VALIDATION_ERROR when creating SYSTEM tag with non-null ownerId', async () => {
            const actor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_CREATE] });

            const result = await service.create(actor, {
                name: 'Pet-friendly',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.GREEN,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: 'some-user-id'
            });

            expectValidationError(result);
        });
    });

    // -------------------------------------------------------------------------
    // AC-F03: Cross-type name collision — USER vs INTERNAL/SYSTEM
    // -------------------------------------------------------------------------
    describe('AC-F03: USER tag name must not collide with INTERNAL or SYSTEM', () => {
        let actor: Actor;
        // Must be a valid UUID — Zod validates ownerId as UUID
        const ownerActorId = 'a1b2c3d4-0000-4000-a000-000000000001';

        beforeEach(() => {
            actor = createActor({
                id: ownerActorId,
                permissions: [PermissionEnum.TAG_USER_CREATE]
            });
            // USER tag quota enforcement: countActiveByOwner returns 0 (below quota).
            // AC-F03 tests focus on name collision, not quota limits.
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
        });

        it('should return ALREADY_EXISTS when USER tag name matches existing SYSTEM tag name', async () => {
            // Simulate INTERNAL returns empty, SYSTEM returns a match
            asMock(tagModelMock.findByType)
                .mockResolvedValueOnce([]) // INTERNAL check — no collision
                .mockResolvedValueOnce([systemTag]); // SYSTEM check — collision

            const result = await service.create(actor, {
                name: 'Pet-friendly',
                type: TagTypeEnum.USER,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: ownerActorId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect(result.error?.message).toMatch(/reserved/i);
        });

        it('should return ALREADY_EXISTS when USER tag name matches existing INTERNAL tag name', async () => {
            // Simulate INTERNAL check returns a match
            asMock(tagModelMock.findByType).mockResolvedValueOnce([internalTag]); // INTERNAL — collision

            const result = await service.create(actor, {
                name: 'Spam',
                type: TagTypeEnum.USER,
                color: TagColorEnum.ORANGE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: ownerActorId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        });

        it('should succeed when USER tag name does not match any INTERNAL or SYSTEM tag', async () => {
            asMock(tagModelMock.findByType).mockResolvedValue([]); // No collision
            const createdTag = TagFactoryBuilder.createUserTag(ownerActorId, {
                name: 'My Private Tag',
                color: TagColorEnum.PURPLE
            });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, {
                name: 'My Private Tag',
                type: TagTypeEnum.USER,
                color: TagColorEnum.PURPLE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: ownerActorId
            });

            expectSuccess(result);
        });

        it('should be case-insensitive — "pet-friendly" collides with "Pet-friendly"', async () => {
            const lowerSystemTag = { ...systemTag, name: 'pet-friendly' };
            asMock(tagModelMock.findByType)
                .mockResolvedValueOnce([]) // INTERNAL — no collision
                .mockResolvedValueOnce([lowerSystemTag]); // SYSTEM — collision (case-insensitive)

            const result = await service.create(actor, {
                name: 'Pet-Friendly',
                type: TagTypeEnum.USER,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: ownerActorId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        });

        it('should NOT check collision when creating SYSTEM tag (only USER tags are checked)', async () => {
            const sysActor = createActor({ permissions: [PermissionEnum.TAG_SYSTEM_CREATE] });
            const createdTag = TagFactoryBuilder.create({
                name: 'Unique System Tag',
                type: TagTypeEnum.SYSTEM
            });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(sysActor, {
                name: 'Unique System Tag',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: null
            });

            // findByType should NOT be called for SYSTEM tags (no cross-type check needed)
            expect(asMock(tagModelMock.findByType)).not.toHaveBeenCalled();
            expectSuccess(result);
        });
    });

    // -------------------------------------------------------------------------
    // Update — type is immutable, cross-type collision re-checked on name change
    // -------------------------------------------------------------------------
    describe('update: type immutability and collision re-check', () => {
        it('should reject name change for USER tag if new name collides with SYSTEM', async () => {
            const updateOwnerId = 'a1b2c3d4-0000-4000-a000-000000000002';
            const actor = createActor({
                id: updateOwnerId,
                permissions: [PermissionEnum.TAG_USER_UPDATE_OWN]
            });
            const userTag = TagFactoryBuilder.createUserTag(updateOwnerId, { name: 'Old Name' });

            asMock(tagModelMock.findById).mockResolvedValue(userTag);
            // Collision on name change
            asMock(tagModelMock.findByType)
                .mockResolvedValueOnce([]) // INTERNAL — no collision
                .mockResolvedValueOnce([systemTag]); // SYSTEM — collision

            const result = await service.update(actor, userTag.id, { name: 'Pet-friendly' });

            expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        });

        it('should allow update when name is unchanged (no collision check)', async () => {
            const updateOwnerId = 'a1b2c3d4-0000-4000-a000-000000000003';
            const actor = createActor({
                id: updateOwnerId,
                permissions: [PermissionEnum.TAG_USER_UPDATE_OWN]
            });
            const userTag = TagFactoryBuilder.createUserTag(updateOwnerId, { name: 'My Tag' });

            asMock(tagModelMock.findById).mockResolvedValue(userTag);
            asMock(tagModelMock.update).mockResolvedValue({ ...userTag, description: 'New desc' });

            // Only description changes — no name, so no collision check
            const result = await service.update(actor, userTag.id, { description: 'New desc' });

            // findByType should not be called (name did not change)
            expect(asMock(tagModelMock.findByType)).not.toHaveBeenCalled();
            expectSuccess(result);
        });
    });
});
