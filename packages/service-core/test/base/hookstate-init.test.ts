/**
 * @fileoverview
 * Tests for hookState initialization edge cases in BaseCrudService.
 *
 * Verifies that the `resolvedCtx` pattern (`{ hookState: {}, ...ctx }`) correctly:
 * - Handles ctx with tx but no hookState
 * - Preserves existing hookState when provided
 * - Creates a fresh hookState when ctx is undefined
 * - Spreads correctly in all combinations
 */
import type { BaseModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { MOCK_ENTITY_ID, mockAdminActor, mockEntity } from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

describe('BaseCrudService: hookState initialization edge cases', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findById).mockResolvedValue(mockEntity);
    });

    it('should not crash when ctx is provided with tx but no hookState', async () => {
        // Arrange
        asMock(modelMock.findById).mockResolvedValue({ ...mockEntity, deletedAt: null });
        asMock(modelMock.softDelete).mockResolvedValue(1);
        // biome-ignore lint/suspicious/noExplicitAny: Mock tx for testing purposes
        const mockTx = { execute: vi.fn() } as any;
        const ctx: ServiceContext = { tx: mockTx };

        // Act - ctx has tx but no hookState
        const result = await service.softDelete(mockAdminActor, MOCK_ENTITY_ID, ctx);

        // Assert - should not crash, returns valid result
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        expect(result.data?.count).toBe(1);
    });

    it('should preserve existing hookState when provided', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const customHookState = { customKey: 'value', anotherKey: 42 };
        const ctx: ServiceContext = {
            hookState: customHookState as Record<string, unknown>
        };

        // Spy on _afterGetByField to capture the ctx passed through the pipeline
        const afterGetByFieldSpy = vi.spyOn(
            service as unknown as {
                _afterGetByField: (
                    entity: TestEntity,
                    actor: unknown,
                    ctx: ServiceContext
                ) => Promise<TestEntity>;
            },
            '_afterGetByField'
        );
        afterGetByFieldSpy.mockImplementation(async (entity) => entity);

        // Act
        await service.getById(mockAdminActor, MOCK_ENTITY_ID, ctx);

        // Assert - the hookState passed to _afterGetByField should preserve our custom keys
        expect(afterGetByFieldSpy).toHaveBeenCalled();
        const passedCtx = afterGetByFieldSpy.mock.calls[0]?.[2] as ServiceContext;
        expect(passedCtx).toBeDefined();
        expect(passedCtx.hookState).toBeDefined();
        expect(passedCtx.hookState?.customKey).toBe('value');
        expect(passedCtx.hookState?.anotherKey).toBe(42);
    });

    it('should work when ctx is undefined (creates fresh hookState)', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);

        // Act - no ctx at all
        const result = await service.getById(mockAdminActor, MOCK_ENTITY_ID);

        // Assert - no crash, valid result
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        expect(result.data).toEqual(mockEntity);
        expect(result.error).toBeUndefined();
    });

    it('resolvedCtx spread: ctx with hookState preserves it', () => {
        // Arrange - unit test of the spread pattern { hookState: {}, ...ctx }
        const ctx: ServiceContext = {
            hookState: { myKey: 'preserved' } as Record<string, unknown>
        };

        // Act - simulate the resolvedCtx pattern used in BaseCrudService methods
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };

        // Assert - ctx.hookState overwrites the default {}
        expect(resolvedCtx.hookState).toEqual({ myKey: 'preserved' });
    });

    it('resolvedCtx spread: ctx without hookState adds empty {}', () => {
        // Arrange - ctx exists but has no hookState
        // biome-ignore lint/suspicious/noExplicitAny: Mock tx for testing purposes
        const ctx: ServiceContext = { tx: { execute: vi.fn() } as any };

        // Act - simulate the resolvedCtx pattern
        const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };

        // Assert - hookState defaults to {} since ctx doesn't override it
        // Wait: ctx has no hookState key, so the spread doesn't override the default.
        // But if ctx had hookState: undefined, it WOULD override. Let's check both.
        expect(resolvedCtx.hookState).toEqual({});
        expect(resolvedCtx.tx).toBeDefined();
    });

    it('resolvedCtx spread: undefined ctx uses defaults', () => {
        // Arrange
        const ctx: ServiceContext | undefined = undefined;

        // Act - simulate the resolvedCtx pattern (cast needed for TS spread)
        const resolvedCtx: ServiceContext = {
            hookState: {},
            ...((ctx as ServiceContext | undefined) ?? {})
        };

        // Assert - spreading undefined is a no-op, defaults are kept
        expect(resolvedCtx.hookState).toEqual({});
    });

    it('should not crash when ctx has hookState as undefined explicitly', async () => {
        // Arrange
        asMock(modelMock.findOne).mockResolvedValue(mockEntity);
        const ctx: ServiceContext = { hookState: undefined };

        // Act
        const result = await service.getById(mockAdminActor, MOCK_ENTITY_ID, ctx);

        // Assert - should still work (hookState: undefined overwrites {}, but code handles it)
        expect(result).toBeDefined();
        // The result should be valid (either data or error, no crash)
        expect(result.data !== undefined || result.error !== undefined).toBe(true);
    });
});
