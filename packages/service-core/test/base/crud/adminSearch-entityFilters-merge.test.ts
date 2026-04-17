/**
 * Tests for adminSearch entityFilters merging coverage (SPEC-059 GAP-051).
 *
 * Verifies that when both `params.entityFilters` (coming from the adminSearchSchema
 * extra fields) AND service-internal default entityFilters (injected into
 * _executeAdminSearch via params.where or entityFilters) are present, neither
 * set of filters is silently dropped — they merge correctly.
 *
 * The _executeAdminSearch implementation merges as:
 *   mergedWhere = { ...where, ...entityFilters }
 * So we validate that both sets of keys survive in the merged where clause
 * passed to model.findAll.
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import type { ListRelationsConfig } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSearchExecuteParams } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockAdminActor } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Service without default relations (exercises findAll path)
// ---------------------------------------------------------------------------

class NoRelationsService extends TestService {
    protected override getDefaultListRelations(): ListRelationsConfig {
        return undefined;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseCrudRead: _executeAdminSearch — entityFilters merging (SPEC-059 GAP-051)', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(defaultPaginatedResult);
        asMock(modelMock.findAllWithRelations).mockResolvedValue(defaultPaginatedResult);
    });

    it('merges params.entityFilters and internal where without dropping any filter', async () => {
        // Arrange — simulate the scenario where:
        // - `where` carries system-level filters (status, deleted-at range) that the
        //   adminList method computes from standard params
        // - `entityFilters` carries entity-specific filters extracted from the
        //   adminSearchSchema (e.g. `category`, `destinationId`)
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params: AdminSearchExecuteParams = {
            where: {
                lifecycleState: 'ACTIVE',
                deletedAt: null,
                createdAfter: new Date('2024-01-01')
            },
            entityFilters: {
                category: 'luxury',
                destinationId: 'dest-uuid-001'
            },
            pagination: { page: 1, pageSize: 20 },
            sort: { sortBy: 'createdAt', sortOrder: 'desc' },
            actor: mockAdminActor
        };

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — all six keys from both sources must appear in the merged where
        expect(asMock(modelMock.findAll)).toHaveBeenCalledTimes(1);
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        const mergedWhere = findAllCall?.[0] as Record<string, unknown>;

        // Internal where-clause keys must survive
        expect(mergedWhere).toHaveProperty('lifecycleState', 'ACTIVE');
        expect(mergedWhere).toHaveProperty('deletedAt', null);
        expect(mergedWhere).toHaveProperty('createdAfter', new Date('2024-01-01'));

        // Entity-specific filter keys must also survive
        expect(mergedWhere).toHaveProperty('category', 'luxury');
        expect(mergedWhere).toHaveProperty('destinationId', 'dest-uuid-001');
    });

    it('preserves entityFilters keys when where is empty', async () => {
        // Arrange — where has no standard filters (e.g. status=all, includeDeleted=false)
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params: AdminSearchExecuteParams = {
            where: {},
            entityFilters: { type: 'HOTEL', rating: 4 },
            pagination: { page: 1, pageSize: 10 },
            sort: { sortBy: 'name', sortOrder: 'asc' },
            actor: mockAdminActor
        };

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — entity filters must appear even when base where is empty
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        const mergedWhere = findAllCall?.[0] as Record<string, unknown>;
        expect(mergedWhere).toHaveProperty('type', 'HOTEL');
        expect(mergedWhere).toHaveProperty('rating', 4);
    });

    it('preserves where keys when entityFilters is empty', async () => {
        // Arrange — entity-specific schema has no extra filters for this query
        const service = createServiceTestInstance(NoRelationsService, modelMock);
        const params: AdminSearchExecuteParams = {
            where: { lifecycleState: 'DRAFT', deletedAt: null },
            entityFilters: {},
            pagination: { page: 1, pageSize: 20 },
            sort: { sortBy: 'createdAt', sortOrder: 'desc' },
            actor: mockAdminActor
        };

        // Act
        await callExecuteAdminSearch(service, params);

        // Assert — base where clause must survive intact
        const findAllCall = asMock(modelMock.findAll).mock.calls[0];
        const mergedWhere = findAllCall?.[0] as Record<string, unknown>;
        expect(mergedWhere).toHaveProperty('lifecycleState', 'DRAFT');
        expect(mergedWhere).toHaveProperty('deletedAt', null);
        expect(Object.keys(mergedWhere)).toHaveLength(2);
    });
});
