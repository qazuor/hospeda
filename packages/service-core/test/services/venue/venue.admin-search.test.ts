/**
 * @fileoverview
 * Unit tests for the `VenueService._executeAdminSearch` override (HOS-1787
 * leaf 7.1).
 *
 * The override extracts `businessLine` from `entityFilters` and converts it
 * into the `@>` SQL condition from `@repo/db`. All other filters pass through
 * unchanged to `super._executeAdminSearch()`.
 *
 * The base class calls `model.findAllWithRelations(relations, where, options,
 * extraConditions)` because `VenueService` defines default relations.
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// HOS-1499: every listing write now runs in a transaction and records the
// owner act; neither has a database here.
vi.mock('../../../src/utils/transaction', async () => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return { withServiceTransaction: vi.fn(doubles.fakeWithServiceTransaction) };
});
vi.mock('@repo/db', async (importOriginal) => {
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...(await importOriginal<object>()),
        domainEventModel: doubles.domainEventModelDouble
    };
});

import { VenueService } from '../../../src/services/venue/venue.service';
import type { AdminSearchExecuteParams } from '../../../src/types';
import { asMock } from '../../utils/test-utils';

class MockVenueModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
}

const defaultPaginatedResult = { items: [], total: 0 };

const mockAdminActor = {
    id: 'admin-1',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: Object.values(PermissionEnum)
};

/** Calls the protected `_executeAdminSearch` via a type cast. */
function callExecuteAdminSearch(
    service: VenueService,
    params: AdminSearchExecuteParams
): Promise<{ items: unknown[]; total: number }> {
    type WithAdminSearch = {
        _executeAdminSearch: (
            p: AdminSearchExecuteParams
        ) => Promise<{ items: unknown[]; total: number }>;
    };
    return (service as unknown as WithAdminSearch)._executeAdminSearch(params);
}

function buildDefaultParams(
    overrides: Partial<AdminSearchExecuteParams> = {}
): AdminSearchExecuteParams {
    return {
        where: {},
        entityFilters: {},
        pagination: { page: 1, pageSize: 20 },
        sort: { sortBy: 'createdAt', sortOrder: 'desc' },
        actor: mockAdminActor,
        ...overrides
    };
}

/** Reads the fourth argument (extra conditions) of the model call. */
function extraConditionsOf(modelCall: unknown[] | undefined): unknown[] | undefined {
    return modelCall?.[3] as unknown[] | undefined;
}

/** Reads the second argument (merged where clause) of the model call. */
function whereOf(modelCall: unknown[] | undefined): Record<string, unknown> {
    return (modelCall?.[1] as Record<string, unknown> | undefined) ?? {};
}

describe('VenueService: _executeAdminSearch override (HOS-1787 7.1)', () => {
    let mockModel: MockVenueModel;
    let service: VenueService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockModel = new MockVenueModel();
        mockModel.findAll.mockResolvedValue(defaultPaginatedResult);
        mockModel.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new VenueService({});
        Object.defineProperty(service, 'model', { value: mockModel });
    });

    it('strips businessLine from the merged where clause and adds one condition', async () => {
        await callExecuteAdminSearch(
            service,
            buildDefaultParams({ entityFilters: { businessLine: 'nightlife' } })
        );

        expect(asMock(mockModel.findAllWithRelations)).toHaveBeenCalledOnce();
        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(whereOf(call)).not.toHaveProperty('businessLine');
        expect(extraConditionsOf(call)).toHaveLength(1);
    });

    it('does not add a condition when no businessLine is present', async () => {
        await callExecuteAdminSearch(service, buildDefaultParams());

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(extraConditionsOf(call)).toBeUndefined();
    });

    it('passes the other entity filters through unchanged', async () => {
        await callExecuteAdminSearch(
            service,
            buildDefaultParams({
                entityFilters: { type: 'BAR', priceRange: 'MID', businessLine: 'food' }
            })
        );

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(whereOf(call)).toEqual({ type: 'BAR', priceRange: 'MID' });
        expect(extraConditionsOf(call)).toHaveLength(1);
    });

    it('preserves pre-existing extra conditions alongside the business-line one', async () => {
        const preExisting = { sql: 'existing condition' } as never;

        await callExecuteAdminSearch(
            service,
            buildDefaultParams({
                entityFilters: { businessLine: 'food' },
                extraConditions: [preExisting]
            })
        );

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(extraConditionsOf(call)).toHaveLength(2);
        expect(extraConditionsOf(call)).toContain(preExisting);
    });

    it('does not treat a non-string businessLine as a filter', async () => {
        await callExecuteAdminSearch(
            service,
            buildDefaultParams({ entityFilters: { businessLine: undefined } })
        );

        const [call] = asMock(mockModel.findAllWithRelations).mock.calls;

        expect(extraConditionsOf(call)).toBeUndefined();
    });
});
