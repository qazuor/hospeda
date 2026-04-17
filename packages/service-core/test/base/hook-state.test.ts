/**
 * @fileoverview
 * Tests for hookState undefined guard in BaseCrudService write operations.
 *
 * Verifies that when `ctx` is provided without a `hookState` field, the base
 * class initializes hookState to `{}` before invoking lifecycle hooks — so
 * hooks never receive an undefined hookState and cannot crash with
 * "Cannot read property of undefined".
 *
 * Covers SPEC-059 gap: hookState initialization correctness in the create path.
 */

import type { BaseModel } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { mockAdminActor, mockEntity } from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

describe('BaseCrudService: hookState undefined guard — create path (SPEC-059)', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.create).mockResolvedValue(mockEntity);
    });

    it('completes successfully when ctx = {} (no hookState field)', async () => {
        // Arrange
        const ctx: ServiceContext = {};

        // Act — must not throw "Cannot read property of undefined"
        const result = await service.create(mockAdminActor, { name: 'New Entity', value: 1 }, ctx);

        // Assert
        expect(result).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.data).toEqual(mockEntity);
    });

    it('passes execCtx with hookState initialized to {} when hooks are called', async () => {
        // Arrange
        const ctx: ServiceContext = {};
        let capturedHookState: Record<string, unknown> | undefined;

        const beforeCreateSpy = vi.spyOn(
            service as unknown as {
                _beforeCreate: (
                    data: unknown,
                    actor: unknown,
                    ctx: ServiceContext
                ) => Promise<unknown>;
            },
            '_beforeCreate'
        );

        beforeCreateSpy.mockImplementation(async (data, _actor, hookCtx) => {
            capturedHookState = hookCtx.hookState as Record<string, unknown> | undefined;
            return data;
        });

        // Act
        await service.create(mockAdminActor, { name: 'Hook State Test', value: 2 }, ctx);

        // Assert — hookState must be an empty object, not undefined
        expect(capturedHookState).toBeDefined();
        expect(capturedHookState).toEqual({});
    });

    it('passes execCtx with hookState initialized to {} in _afterCreate as well', async () => {
        // Arrange
        const ctx: ServiceContext = {};
        let capturedHookState: Record<string, unknown> | undefined;

        const afterCreateSpy = vi.spyOn(
            service as unknown as {
                _afterCreate: (
                    entity: TestEntity,
                    actor: unknown,
                    ctx: ServiceContext
                ) => Promise<TestEntity>;
            },
            '_afterCreate'
        );

        afterCreateSpy.mockImplementation(async (entity, _actor, hookCtx) => {
            capturedHookState = hookCtx.hookState as Record<string, unknown> | undefined;
            return entity;
        });

        // Act
        await service.create(mockAdminActor, { name: 'After Hook Test', value: 3 }, ctx);

        // Assert — _afterCreate also receives initialized hookState
        expect(capturedHookState).toBeDefined();
        expect(capturedHookState).toEqual({});
    });

    it('does not crash when ctx is provided with an explicit undefined hookState', async () => {
        // Arrange — ctx.hookState is explicitly undefined (edge case)
        const ctx: ServiceContext = { hookState: undefined };

        // Act
        const result = await service.create(
            mockAdminActor,
            { name: 'Explicit Undefined hookState', value: 4 },
            ctx
        );

        // Assert — result is defined, no unhandled crash
        expect(result).toBeDefined();
        expect(result.data !== undefined || result.error !== undefined).toBe(true);
    });
});
