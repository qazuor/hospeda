import type { BaseModel } from '@repo/db';
/**
 * @fileoverview
 * Test suite for the `list` method of BaseService and its derivatives.
 * Ensures robust, type-safe, and homogeneous handling of list logic, including:
 * - Successful paginated entity listing
 * - Input validation and error handling
 * - Permission checks and forbidden access
 * - Database/internal errors
 * - Lifecycle hook error propagation
 * - Normalizer usage
 *
 * All test data, comments, and documentation are in English, following project guidelines.
 */
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../../src/types';
import { createServiceTestInstance } from '../../helpers/serviceTestFactory';
import { createBaseModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';
import { mockActor, mockEntity } from '../base/base.service.mockData';
import { type TestEntity, TestService } from '../base/base.service.test.setup';

/**
 * Test suite for the `list` method of BaseService.
 *
 * This suite verifies:
 * - Correct paginated entity listing on valid input and permissions
 * - Validation and error codes for forbidden and internal errors
 * - Robustness against errors in hooks and database operations
 * - Use of custom normalizers for list logic
 *
 * The tests use mocks and spies to simulate model and service behavior, ensuring
 * all error paths and edge cases are covered in a type-safe, DRY, and robust manner.
 */
describe('BaseService: list', () => {
    let modelMock: BaseModel<TestEntity>;
    let service: TestService;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        service = createServiceTestInstance(TestService, modelMock);
        asMock(modelMock.findAll).mockResolvedValue([mockEntity]);
    });

    it('should return a paginated list of entities on success', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        asMock(modelMock.findAll).mockResolvedValue(mockPaginatedResult);
        const canListSpy = vi.spyOn(service as unknown as { _canList: () => void }, '_canList');
        const beforeListSpy = vi.spyOn(
            service as unknown as { _beforeList: () => void },
            '_beforeList'
        );
        const afterListSpy = vi.spyOn(
            service as unknown as { _afterList: () => void },
            '_afterList'
        );
        const options = { page: 1, pageSize: 10 };

        // Act
        const result = await service.list(mockActor, options);

        // Assert
        expect(result.data).toEqual(mockPaginatedResult);
        expect(result.error).toBeUndefined();
        expect(canListSpy).toHaveBeenCalledWith(mockActor);
        expect(beforeListSpy).toHaveBeenCalledWith(
            options,
            mockActor,
            expect.objectContaining({ hookState: {} })
        );
        expect(modelMock.findAll).toHaveBeenCalledWith({}, options, undefined, undefined);
        expect(afterListSpy).toHaveBeenCalledWith(
            mockPaginatedResult,
            mockActor,
            expect.objectContaining({ hookState: {} })
        );
    });

    it('should return a FORBIDDEN error if actor lacks permission', async () => {
        // Arrange
        const forbiddenError = new ServiceError(ServiceErrorCode.FORBIDDEN, 'Cannot list entities');
        (service as unknown as { _canList: () => void })._canList = vi.fn();
        asMock((service as unknown as { _canList: () => void })._canList).mockRejectedValue(
            forbiddenError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(forbiddenError);
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if the database lookup fails', async () => {
        // Arrange
        const dbError = new Error('Database connection lost');
        asMock(modelMock.findAll).mockRejectedValue(dbError);

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(result.error?.message).toBe(
            'An unexpected error occurred: Database connection lost'
        );
    });

    it('should return an INTERNAL_ERROR if _beforeList hook fails', async () => {
        // Arrange
        const hookError = new Error('Something went wrong in _beforeList');
        (service as unknown as { _beforeList: () => void })._beforeList = vi.fn();
        asMock((service as unknown as { _beforeList: () => void })._beforeList).mockRejectedValue(
            hookError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        expect(modelMock.findAll).not.toHaveBeenCalled();
    });

    it('should return an INTERNAL_ERROR if _afterList hook fails', async () => {
        // Arrange
        const mockPaginatedResult = { items: [mockEntity], total: 1 };
        asMock(modelMock.findAll).mockResolvedValue(mockPaginatedResult);
        const hookError = new Error('Something went wrong in _afterList');
        (service as unknown as { _afterList: () => void })._afterList = vi.fn();
        asMock((service as unknown as { _afterList: () => void })._afterList).mockRejectedValue(
            hookError
        );

        // Act
        const result = await service.list(mockActor);

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('should use the list normalizer if provided', async () => {
        // Arrange
        // The normalizer modifies a known ListOptions field (pageSize) so the change
        // propagates through the code path that extracts known fields before calling findAll.
        const normalizer = vi.fn((data: { page?: number; pageSize?: number }) => ({
            ...data,
            pageSize: 20
        }));
        const localModelMock: BaseModel<TestEntity> = createBaseModelMock<TestEntity>();
        asMock(localModelMock.findAll).mockResolvedValue({ items: [mockEntity], total: 1 });
        class ServiceWithNormalizer extends TestService {
            protected override normalizers = {
                list: normalizer
            };

            protected getDefaultListRelations() {
                return undefined;
            }
        }
        const normalizedService = createServiceTestInstance(ServiceWithNormalizer, localModelMock);
        const options = { page: 1, pageSize: 10 };

        // Act
        await normalizedService.list(mockActor, options);

        // Assert
        expect(normalizer).toHaveBeenCalledWith(options, mockActor);
        expect(localModelMock.findAll).toHaveBeenCalledWith(
            {},
            { page: 1, pageSize: 20, sortBy: undefined, sortOrder: undefined },
            undefined,
            undefined
        );
    });

    /**
     * Search OR-logic regression tests (SPEC-049 T-029).
     *
     * The `list` method must build search conditions across ALL searchable columns
     * with OR logic (not AND): a row matches if the term hits any one of the columns.
     * The previous AND behaviour caused matches on `description` to be silently dropped.
     *
     * These tests assert the contract between `list()` and `model.findAll`:
     *   - When search has a term and the service exposes searchable columns,
     *     `additionalConditions` is forwarded as a non-empty SQL fragment.
     *   - When search is empty or the service exposes no columns, `additionalConditions`
     *     is omitted (undefined).
     *
     * Per-row OR semantics (e.g. "term matches description -> row returned") live in
     * the integration tests for `buildSearchCondition` in @repo/db; service-core can
     * only verify it forwards the right inputs.
     */
    describe('search OR logic (SPEC-049 T-029)', () => {
        // A minimal stand-in for a Drizzle PgTable. buildSearchCondition only checks
        // that the named columns exist as own properties on the table object; the
        // values themselves are passed to safeIlike, which the test does not exercise.
        const tableMockWithNameAndDescription = {
            name: { name: 'name' },
            description: { name: 'description' }
        };

        class ServiceWithSearchableColumns extends TestService {
            protected override getSearchableColumns(): string[] {
                return ['name', 'description'];
            }

            protected override getDefaultListRelations() {
                return undefined;
            }
        }

        const buildModelMock = () => {
            const m = createBaseModelMock<TestEntity>();
            asMock(m.findAll).mockResolvedValue({ items: [mockEntity], total: 1 });
            asMock(m.getTable).mockReturnValue(tableMockWithNameAndDescription);
            return m;
        };

        it('should pass an additionalConditions SQL fragment when search term matches name column', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock();
            const svc = createServiceTestInstance(ServiceWithSearchableColumns, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, search: 'hello' });

            // Assert — third argument (additionalConditions) is defined; OR logic produces
            // a single SQL fragment that combines all searchable columns.
            const additionalConditions = asMock(localModelMock.findAll).mock.calls[0]?.[2];
            expect(additionalConditions).toBeDefined();
        });

        it('should pass an additionalConditions SQL fragment when search term matches description column (OR not AND)', async () => {
            // Arrange — same setup; the OR semantic means the same condition object
            // covers both name and description matches. The regression this guards against
            // was AND, which would have required EVERY column to match the term.
            const localModelMock: BaseModel<TestEntity> = buildModelMock();
            const svc = createServiceTestInstance(ServiceWithSearchableColumns, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, search: 'description-only-term' });

            // Assert — additionalConditions is forwarded; the SQL fragment encodes OR over
            // ['name', 'description'], so a row matching only description satisfies the
            // condition. (Per-row matching is verified in @repo/db buildSearchCondition tests.)
            const additionalConditions = asMock(localModelMock.findAll).mock.calls[0]?.[2];
            expect(additionalConditions).toBeDefined();
        });

        it('should not forward additionalConditions when search term is empty', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock();
            const svc = createServiceTestInstance(ServiceWithSearchableColumns, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, search: '' });

            // Assert — empty search short-circuits, model receives undefined as third arg.
            expect(localModelMock.findAll).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ page: 1, pageSize: 10 }),
                undefined,
                undefined
            );
        });

        it('should not forward additionalConditions when search term is whitespace only', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock();
            const svc = createServiceTestInstance(ServiceWithSearchableColumns, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, search: '   ' });

            // Assert — trimmed empty string is treated as no search.
            expect(localModelMock.findAll).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ page: 1, pageSize: 10 }),
                undefined,
                undefined
            );
        });

        it('should not forward additionalConditions when service exposes no searchable columns', async () => {
            // Arrange — explicitly override getSearchableColumns to return an empty array,
            // overriding the base default (['name']). A search term with no columns to scan
            // is a no-op.
            class ServiceWithoutColumns extends TestService {
                protected override getSearchableColumns(): string[] {
                    return [];
                }
                protected override getDefaultListRelations() {
                    return undefined;
                }
            }
            const localModelMock: BaseModel<TestEntity> = buildModelMock();
            const svc = createServiceTestInstance(ServiceWithoutColumns, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, search: 'anything' });

            // Assert — no columns means buildSearchCondition returns undefined.
            expect(localModelMock.findAll).toHaveBeenCalledWith(
                {},
                expect.objectContaining({ page: 1, pageSize: 10 }),
                undefined,
                undefined
            );
        });
    });

    /**
     * Soft-delete filtering regression tests (SPEC-230).
     *
     * Before SPEC-230, `list()` did not inject a `deletedAt: null` predicate, so
     * every protected list endpoint returned soft-deleted rows. The fix mirrors the
     * `adminList()` path: when the table has a `deletedAt` column and the caller did
     * not opt in via `includeDeleted`, `list()` adds `deletedAt: null` to the where
     * clause. These tests assert the contract between `list()` and `model.findAll`.
     */
    describe('soft-delete filtering (SPEC-230)', () => {
        // A minimal stand-in for a Drizzle PgTable that HAS a deletedAt column. The
        // injection logic only checks `'deletedAt' in table`, so the column value is
        // irrelevant — its mere presence is what matters.
        const tableWithDeletedAt = {
            id: { name: 'id' },
            name: { name: 'name' },
            deletedAt: { name: 'deleted_at' }
        };
        // A table WITHOUT a deletedAt column — no predicate must be injected.
        const tableWithoutDeletedAt = {
            id: { name: 'id' },
            name: { name: 'name' }
        };

        const buildModelMock = (table: Record<string, unknown>) => {
            const m = createBaseModelMock<TestEntity>();
            asMock(m.findAll).mockResolvedValue({ items: [mockEntity], total: 1 });
            asMock(m.getTable).mockReturnValue(table);
            return m;
        };

        it('should inject deletedAt: null by default when the table has a deletedAt column', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock(tableWithDeletedAt);
            const svc = createServiceTestInstance(TestService, localModelMock);

            // Act — no includeDeleted, no explicit deletedAt
            await svc.list(mockActor, { page: 1, pageSize: 10 });

            // Assert — soft-deleted rows are excluded by default.
            const whereArg = asMock(localModelMock.findAll).mock.calls[0]?.[0];
            expect(whereArg).toEqual({ deletedAt: null });
        });

        it('should NOT inject deletedAt when includeDeleted is true', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock(tableWithDeletedAt);
            const svc = createServiceTestInstance(TestService, localModelMock);

            // Act — opt in to seeing soft-deleted rows.
            await svc.list(mockActor, { page: 1, pageSize: 10, includeDeleted: true });

            // Assert — no soft-delete predicate added.
            const whereArg = asMock(localModelMock.findAll).mock.calls[0]?.[0];
            expect(whereArg).toEqual({});
        });

        it('should respect a caller-supplied deletedAt value (explicit intent wins)', async () => {
            // Arrange — caller passes deletedAt explicitly; the default predicate must
            // not clobber it.
            const localModelMock: BaseModel<TestEntity> = buildModelMock(tableWithDeletedAt);
            const svc = createServiceTestInstance(TestService, localModelMock);
            const explicitDate = new Date('2026-01-01T00:00:00.000Z');

            // Act
            await svc.list(mockActor, {
                page: 1,
                pageSize: 10,
                where: { deletedAt: explicitDate }
            });

            // Assert — the caller's deletedAt survives untouched.
            const whereArg = asMock(localModelMock.findAll).mock.calls[0]?.[0];
            expect(whereArg).toEqual({ deletedAt: explicitDate });
        });

        it('should add NO predicate when the table has no deletedAt column', async () => {
            // Arrange
            const localModelMock: BaseModel<TestEntity> = buildModelMock(tableWithoutDeletedAt);
            const svc = createServiceTestInstance(TestService, localModelMock);

            // Act
            await svc.list(mockActor, { page: 1, pageSize: 10, where: { name: 'foo' } });

            // Assert — query is unchanged; no spurious deletedAt predicate.
            const whereArg = asMock(localModelMock.findAll).mock.calls[0]?.[0];
            expect(whereArg).toEqual({ name: 'foo' });
        });
    });
});
