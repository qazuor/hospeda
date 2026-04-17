/**
 * Tests for concurrent create with same slug / unique constraint (SPEC-059 GAP-056).
 *
 * Simulates two concurrent `create` calls where the model rejects the second
 * with a unique-constraint error.  The base.service.ts error-handling path
 * re-throws errors with `name === 'DbError'` so callers can map them to HTTP 409.
 *
 * This test verifies:
 * - The first create succeeds when the model call succeeds.
 * - The second create causes a rejection (DbError re-thrown) when the model
 *   throws a unique-constraint DbError — it does NOT silently return `{ data }`.
 * - The first result is not contaminated by the second failure.
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { type TestEntity, TestService } from './base/base.service.test.setup';
import '../setupTest';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeActor = (): Actor => ({
    id: 'actor-id-001',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_ANY]
});

const makeEntity = (id: string): TestEntity => ({
    id,
    name: 'Test Entity',
    value: 42,
    visibility: VisibilityEnum.PUBLIC,
    ownerId: 'actor-id-001',
    createdById: 'actor-id-001',
    updatedById: 'actor-id-001',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null
});

/**
 * Minimal unique-constraint error that matches the base.service.ts DbError check.
 * The service re-throws any error whose `name` property is `'DbError'`.
 */
function makeUniqueConstraintDbError(): Error {
    const err = new Error('duplicate key value violates unique constraint "entity_slug_key"');
    err.name = 'DbError';
    return err;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCrudService: concurrent create with unique constraint (SPEC-059 GAP-056)', () => {
    let modelMock: BaseModelDB<TestEntity>;
    let service: TestService;
    const actor = makeActor();

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
    });

    it('first create succeeds when model.create resolves normally', async () => {
        // Arrange
        const entity = makeEntity('entity-id-001');
        asMock(modelMock.create).mockResolvedValue(entity);

        // Act
        const result = await service.create(actor, { name: entity.name, value: entity.value });

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.data?.name).toBe(entity.name);
    });

    it('second create re-throws DbError when model rejects with unique constraint', async () => {
        // Arrange — first call succeeds, second call throws a unique-constraint DbError
        const entity = makeEntity('entity-id-001');
        const dbError = makeUniqueConstraintDbError();
        asMock(modelMock.create)
            .mockResolvedValueOnce(entity) // first concurrent call succeeds
            .mockRejectedValueOnce(dbError); // second concurrent call hits unique constraint

        // Act — run both concurrently to simulate a race condition
        const [first, secondPromise] = await Promise.allSettled([
            service.create(actor, { name: entity.name, value: entity.value }),
            service.create(actor, { name: entity.name, value: entity.value })
        ]);

        // Assert — first call succeeded
        expect(first.status).toBe('fulfilled');
        if (first.status === 'fulfilled') {
            expect(first.value.data).toBeDefined();
        }

        // Assert — second call rejected with the original DbError (not wrapped)
        expect(secondPromise.status).toBe('rejected');
        if (secondPromise.status === 'rejected') {
            expect(secondPromise.reason).toBe(dbError);
            expect((secondPromise.reason as Error).name).toBe('DbError');
        }
    });

    it('concurrent creates both succeed when model handles them without error', async () => {
        // Arrange — model succeeds for all calls (no constraint violation)
        const entity1 = makeEntity('entity-id-001');
        const entity2 = makeEntity('entity-id-002');
        asMock(modelMock.create).mockResolvedValueOnce(entity1).mockResolvedValueOnce(entity2);

        // Act
        const [result1, result2] = await Promise.all([
            service.create(actor, { name: 'Entity One', value: 1 }),
            service.create(actor, { name: 'Entity Two', value: 2 })
        ]);

        // Assert — both succeed without interference
        expect(result1.data).toBeDefined();
        expect(result2.data).toBeDefined();
        expect(asMock(modelMock.create)).toHaveBeenCalledTimes(2);
    });
});
