/**
 * @fileoverview
 * Unit tests for UserService._executeAdminSearch override.
 *
 * The override extracts `email` from entityFilters and converts it into an ILIKE
 * condition (`ilike(userTable.email, '%<value>%')`) for case-insensitive partial
 * matching. All other filters and conditions are forwarded to super._executeAdminSearch().
 *
 * UserService does NOT define default relations, so the base class calls
 * model.findAll(where, options, extraConditions | null).
 *
 * IMPORTANT: The override always calls super._executeAdminSearch() — it no longer
 * performs the full query itself (that was the pre-SPEC-052 bypass pattern).
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserService } from '../../../src/services/user/user.service';
import type { AdminSearchExecuteParams, ServiceConfig } from '../../../src/types';
import { asMock } from '../../utils/test-utils';

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        buildSearchCondition: vi.fn()
    };
});

/** Minimal mock for UserModel. */
class MockUserModel {
    findAll = vi.fn();
    findAllWithRelations = vi.fn();
    findAllWithCounts = vi.fn();
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
    getTable = vi.fn();
    getTableName = vi.fn().mockReturnValue('users');
}

const defaultPaginatedResult = { items: [], total: 0 };

const mockAdminActor = {
    id: 'admin-1',
    role: RoleEnum.SUPER_ADMIN,
    permissions: Object.values(PermissionEnum)
};

/**
 * Calls the protected _executeAdminSearch via a type cast.
 * Acceptable in tests to access protected methods.
 */
function callExecuteAdminSearch(
    service: UserService,
    params: AdminSearchExecuteParams
): Promise<{ items: unknown[]; total: number }> {
    type WithAdminSearch = {
        _executeAdminSearch: (
            p: AdminSearchExecuteParams
        ) => Promise<{ items: unknown[]; total: number }>;
    };
    return (service as unknown as WithAdminSearch)._executeAdminSearch(params);
}

/** Builds a default AdminSearchExecuteParams with optional overrides. */
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

describe('UserService: _executeAdminSearch override', () => {
    let mockModel: MockUserModel;
    let service: UserService;

    beforeEach(() => {
        vi.restoreAllMocks();
        mockModel = new MockUserModel();
        mockModel.findAll.mockResolvedValue(defaultPaginatedResult);
        mockModel.findAllWithRelations.mockResolvedValue(defaultPaginatedResult);
        service = new UserService({} as ServiceConfig, mockModel as never);
    });

    // --- email ILIKE condition ---

    describe('email filter', () => {
        it('should add one ILIKE condition when email is provided', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { email: 'test@' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: UserService has no relations → findAll is called
            // findAll(where, options, conditions): conditions is the 3rd arg
            expect(asMock(mockModel.findAll)).toHaveBeenCalledOnce();
            const callArgs = asMock(mockModel.findAll).mock.calls[0] as unknown[];
            const conditions = callArgs[2] as unknown[] | null;
            expect(conditions).not.toBeNull();
            expect(Array.isArray(conditions)).toBe(true);
            expect((conditions as unknown[]).length).toBe(1);
        });

        it('should not expose email in the merged where clause (it becomes a SQL condition)', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { email: 'test@example.com' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const callArgs = asMock(mockModel.findAll).mock.calls[0] as unknown[];
            const whereArg = callArgs[0] as Record<string, unknown>;
            expect(whereArg).not.toHaveProperty('email');
        });

        it('should not add any condition when email is an empty string', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: { email: '' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: empty string is falsy, no ILIKE condition added
            const callArgs = asMock(mockModel.findAll).mock.calls[0] as unknown[];
            const conditions = callArgs[2];
            // null or undefined means no conditions
            expect(
                conditions == null || (Array.isArray(conditions) && conditions.length === 0)
            ).toBe(true);
        });

        it('should not add any condition when email is absent', async () => {
            // Arrange
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: no extra conditions
            const callArgs = asMock(mockModel.findAll).mock.calls[0] as unknown[];
            const conditions = callArgs[2];
            expect(
                conditions == null || (Array.isArray(conditions) && conditions.length === 0)
            ).toBe(true);
        });
    });

    // --- super._executeAdminSearch is called ---

    describe('delegation to super._executeAdminSearch', () => {
        it('should always call super._executeAdminSearch (no bypass)', async () => {
            // Arrange
            const baseCrudReadProto = Object.getPrototypeOf(Object.getPrototypeOf(service)) as {
                _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
            };
            const superSpy = vi.spyOn(baseCrudReadProto, '_executeAdminSearch');
            superSpy.mockResolvedValue(defaultPaginatedResult);
            const params = buildDefaultParams({ entityFilters: { email: 'test@' } });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: the override always delegates to super (SPEC-052 refactor)
            expect(superSpy).toHaveBeenCalledOnce();
        });

        it('should call super._executeAdminSearch even when email is absent', async () => {
            // Arrange
            const baseCrudReadProto = Object.getPrototypeOf(Object.getPrototypeOf(service)) as {
                _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
            };
            const superSpy = vi.spyOn(baseCrudReadProto, '_executeAdminSearch');
            superSpy.mockResolvedValue(defaultPaginatedResult);
            const params = buildDefaultParams({ entityFilters: {} });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            expect(superSpy).toHaveBeenCalledOnce();
        });

        it('should pass email-stripped entityFilters and email as extraConditions to super', async () => {
            // Arrange
            const baseCrudReadProto = Object.getPrototypeOf(Object.getPrototypeOf(service)) as {
                _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
            };
            const superSpy = vi.spyOn(baseCrudReadProto, '_executeAdminSearch');
            superSpy.mockResolvedValue(defaultPaginatedResult);
            const params = buildDefaultParams({
                entityFilters: { email: 'john@', role: 'USER' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert
            const calledWith = superSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            // email is removed from entityFilters
            expect(calledWith.entityFilters).not.toHaveProperty('email');
            // other filters remain in entityFilters
            expect(calledWith.entityFilters).toHaveProperty('role', 'USER');
            // email ILIKE condition is in extraConditions
            expect(calledWith.extraConditions).toBeDefined();
            expect((calledWith.extraConditions as unknown[]).length).toBe(1);
        });
    });

    // --- pre-existing extraConditions preserved ---

    describe('pre-existing extraConditions', () => {
        it('should merge pre-existing extraConditions with the email ILIKE condition', async () => {
            // Arrange
            const baseCrudReadProto = Object.getPrototypeOf(Object.getPrototypeOf(service)) as {
                _executeAdminSearch: (p: AdminSearchExecuteParams) => unknown;
            };
            const superSpy = vi.spyOn(baseCrudReadProto, '_executeAdminSearch');
            superSpy.mockResolvedValue(defaultPaginatedResult);
            const preExisting = { sql: 'pre-existing condition' } as never;
            const params = buildDefaultParams({
                entityFilters: { email: 'user@domain' },
                extraConditions: [preExisting]
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: 1 pre-existing + 1 email = 2 total in super call
            const calledWith = superSpy.mock.calls[0]?.[0] as AdminSearchExecuteParams;
            expect(calledWith.extraConditions).toBeDefined();
            expect((calledWith.extraConditions as unknown[]).length).toBe(2);
            expect(calledWith.extraConditions).toContain(preExisting);
        });
    });

    // --- other entityFilters pass through ---

    describe('other entityFilters', () => {
        it('should pass non-email entityFilters into the where clause', async () => {
            // Arrange
            const params = buildDefaultParams({
                entityFilters: { role: 'ADMIN', displayName: 'Alice' }
            });

            // Act
            await callExecuteAdminSearch(service, params);

            // Assert: role and displayName end up in the merged where
            const callArgs = asMock(mockModel.findAll).mock.calls[0] as unknown[];
            const whereArg = callArgs[0] as Record<string, unknown>;
            expect(whereArg).toHaveProperty('role', 'ADMIN');
            expect(whereArg).toHaveProperty('displayName', 'Alice');
        });
    });

    // --- return value ---

    describe('return value', () => {
        it('should return the paginated result from the model', async () => {
            // Arrange
            const expected = { items: [{ id: 'user-1' }], total: 1 };
            mockModel.findAll.mockResolvedValue(expected);
            const localService = new UserService({} as ServiceConfig, mockModel as never);

            // Act
            const result = await callExecuteAdminSearch(localService, buildDefaultParams());

            // Assert
            expect(result).toEqual(expected);
        });
    });
});
