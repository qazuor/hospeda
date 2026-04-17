/**
 * @fileoverview
 * Tests verifying that _executeAdminSearch forwards ctx.tx to model calls.
 *
 * This is a regression-test file for SPEC-059 T-059G-005.
 * Phase A of the gap remediation ensured that `_executeAdminSearch` passes
 * `ctx?.tx` as the last argument to both `model.findAll` and
 * `model.findAllWithRelations`. These tests break if that forwarding is removed.
 *
 * See: packages/service-core/src/base/base.crud.read.ts — _executeAdminSearch
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSearchExecuteParams, ServiceContext } from '../../src/types';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { mockAdminActor } from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

// Provide a partial @repo/db mock that preserves everything except
// buildSearchCondition (which is used in adminList pre-processing).
vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Minimal service sub-classes used only in this file
// ---------------------------------------------------------------------------

/**
 * Service variant with NO default list relations — exercises the findAll path.
 */
class NoRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return undefined;
    }
}

/**
 * Service variant WITH default list relations — exercises the findAllWithRelations path.
 */
class WithRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return { destination: true };
    }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

const defaultPaginatedResult = { items: [], total: 0 };

function callExecuteAdminSearch(
    service: TestService,
    params: AdminSearchExecuteParams
): Promise<{ items: TestEntity[]; total: number }> {
    return (
        service as unknown as {
            _executeAdminSearch: (
                p: AdminSearchExecuteParams
            ) => Promise<{ items: TestEntity[]; total: number }>;
        }
    )._executeAdminSearch(params);
}

function buildParams(ctx?: ServiceContext): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        ctx
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCrudRead: _executeAdminSearch — ctx.tx forwarding (SPEC-059 T-059G-005)', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.findAllWithRelations).mockResolvedValue(defaultPaginatedResult);
    });

    it('documents that _executeAdminSearch forwards ctx.tx to model (see SPEC-059 T-059G-005)', async () => {
        // Arrange
        // biome-ignore lint/suspicious/noExplicitAny: mock tx for forwarding assertion
        const mockTx = { execute: vi.fn() } as any;
        const ctx: ServiceContext = { tx: mockTx, hookState: {} };
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params = buildParams(ctx);

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — the last argument to findAll must be the mockTx object
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        const txArg = findAllCall?.[3];
        expect(txArg).toBe(mockTx);
    });

    it('forwards ctx.tx to model.findAll when no default relations are configured', async () => {
        // Arrange
        // biome-ignore lint/suspicious/noExplicitAny: mock tx for forwarding assertion
        const mockTx = { execute: vi.fn() } as any;
        const ctx: ServiceContext = { tx: mockTx, hookState: {} };
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params = buildParams(ctx);

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — findAll receives tx as its 4th argument
        expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        expect(findAllCall?.[3]).toBe(mockTx);
    });

    it('forwards ctx.tx to model.findAllWithRelations when default relations are configured', async () => {
        // Arrange
        // biome-ignore lint/suspicious/noExplicitAny: mock tx for forwarding assertion
        const mockTx = { execute: vi.fn() } as any;
        const ctx: ServiceContext = { tx: mockTx, hookState: {} };
        const service = createServiceTestInstance(WithRelationsService, modelMock);
        const params = buildParams(ctx);

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — findAllWithRelations receives tx as its 5th argument
        expect(asMock(modelMock.findAllWithRelations)).toHaveBeenCalledTimes(1);
        const withRelationsCall = asMock(modelMock.findAllWithRelations).mock.calls[0];
        expect(withRelationsCall?.[4]).toBe(mockTx);
    });

    it('passes undefined as tx when ctx is not provided', async () => {
        // Arrange — no ctx at all
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params = buildParams(undefined);

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — tx position receives undefined (ctx?.tx evaluates to undefined)
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        expect(findAllCall?.[3]).toBeUndefined();
    });
});
