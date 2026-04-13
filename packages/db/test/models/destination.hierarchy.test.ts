import type { Destination } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { DestinationModel } from '../../src/models/destination/destination.model';
import * as logger from '../../src/utils/logger';

const mockFindOne = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/**
 * Unit tests for DestinationModel.findChildren
 * - Returns direct children of a parent destination
 * - Returns empty array when no children found
 * - Throws DbError on database failure
 */
describe('DestinationModel.findChildren', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns children and logs query', async () => {
        // Arrange
        const parentId = 'parent-1';
        const mockChildren: Partial<Destination>[] = [
            {
                id: 'child-1',
                name: 'Litoral',
                path: '/argentina/litoral',
                pathIds: 'parent-1',
                level: 1,
                parentDestinationId: 'parent-1',
                destinationType: 'REGION'
            },
            {
                id: 'child-2',
                name: 'Cuyo',
                path: '/argentina/cuyo',
                pathIds: 'parent-1',
                level: 1,
                parentDestinationId: 'parent-1',
                destinationType: 'REGION'
            }
        ];

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockChildren);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findChildren(parentId);

        // Assert
        expect(result).toEqual(mockChildren);
        expect(mockSelect).toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalled();
        expect(mockWhere).toHaveBeenCalled();
        expect(mockOrderBy).toHaveBeenCalled();
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findChildren',
            { parentId },
            mockChildren
        );
    });

    it('returns empty array when no children found', async () => {
        // Arrange
        const parentId = 'parent-no-children';
        const mockChildren: Partial<Destination>[] = [];

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockChildren);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findChildren(parentId);

        // Assert
        expect(result).toEqual([]);
        expect(logQuery).toHaveBeenCalledWith('destinations', 'findChildren', { parentId }, []);
    });

    it('throws and logs error on DB failure', async () => {
        // Arrange
        const parentId = 'parent-error';
        const error = new Error('Database connection failed');

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockRejectedValue(error);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act & Assert
        await expect(model.findChildren(parentId)).rejects.toThrow('Database connection failed');
        expect(logError).toHaveBeenCalledWith('destinations', 'findChildren', { parentId }, error);
    });
});

/**
 * Unit tests for DestinationModel.findDescendants
 * - Returns all descendants when parent has pathIds
 * - Returns all descendants when parent has empty pathIds (root)
 * - Returns empty array when parent not found
 * - Applies maxDepth filter correctly
 * - Applies destinationType filter correctly
 * - Throws DbError on database failure
 */
describe('DestinationModel.findDescendants', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        model.findOne = mockFindOne;
    });

    it('returns all descendants when parent has pathIds', async () => {
        // Arrange
        const destinationId = 'parent-1';
        const mockParent: Partial<Destination> = {
            id: 'parent-1',
            name: 'Litoral',
            path: '/argentina/litoral',
            pathIds: 'root-1',
            level: 1,
            destinationType: 'REGION'
        };
        const mockDescendants: Partial<Destination>[] = [
            {
                id: 'child-1',
                name: 'Entre Rios',
                path: '/argentina/litoral/entre-rios',
                pathIds: 'root-1/parent-1',
                level: 2,
                destinationType: 'PROVINCE'
            },
            {
                id: 'child-2',
                name: 'Concepcion del Uruguay',
                path: '/argentina/litoral/entre-rios/concepcion',
                pathIds: 'root-1/parent-1/child-1',
                level: 3,
                destinationType: 'CITY'
            }
        ];

        mockFindOne.mockResolvedValue(mockParent);

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockDescendants);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findDescendants(destinationId);

        // Assert
        expect(result).toEqual(mockDescendants);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findDescendants',
            { destinationId, options: undefined },
            mockDescendants
        );
    });

    it('returns all descendants when parent has empty pathIds (root)', async () => {
        // Arrange
        const destinationId = 'root-1';
        const mockParent: Partial<Destination> = {
            id: 'root-1',
            name: 'Argentina',
            path: '/argentina',
            pathIds: '',
            level: 0,
            destinationType: 'COUNTRY'
        };
        const mockDescendants: Partial<Destination>[] = [
            {
                id: 'child-1',
                name: 'Litoral',
                path: '/argentina/litoral',
                pathIds: 'root-1',
                level: 1,
                destinationType: 'REGION'
            }
        ];

        mockFindOne.mockResolvedValue(mockParent);

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockDescendants);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findDescendants(destinationId);

        // Assert
        expect(result).toEqual(mockDescendants);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
    });

    it('returns empty when parent not found', async () => {
        // Arrange
        const destinationId = 'non-existent';
        mockFindOne.mockResolvedValue(null);

        // Act
        const result = await model.findDescendants(destinationId);

        // Assert
        expect(result).toEqual([]);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
    });

    it('applies maxDepth filter', async () => {
        // Arrange
        const destinationId = 'parent-1';
        const options = { maxDepth: 1 };
        const mockParent: Partial<Destination> = {
            id: 'parent-1',
            name: 'Litoral',
            path: '/argentina/litoral',
            pathIds: 'root-1',
            level: 1,
            destinationType: 'REGION'
        };
        const mockDescendants: Partial<Destination>[] = [
            {
                id: 'child-1',
                name: 'Entre Rios',
                path: '/argentina/litoral/entre-rios',
                pathIds: 'root-1/parent-1',
                level: 2,
                destinationType: 'PROVINCE'
            }
        ];

        mockFindOne.mockResolvedValue(mockParent);

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockDescendants);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findDescendants(destinationId, options);

        // Assert
        expect(result).toEqual(mockDescendants);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findDescendants',
            { destinationId, options },
            mockDescendants
        );
    });

    it('applies destinationType filter', async () => {
        // Arrange
        const destinationId = 'parent-1';
        const options = { destinationType: 'CITY' as const };
        const mockParent: Partial<Destination> = {
            id: 'parent-1',
            name: 'Litoral',
            path: '/argentina/litoral',
            pathIds: 'root-1',
            level: 1,
            destinationType: 'REGION'
        };
        const mockDescendants: Partial<Destination>[] = [
            {
                id: 'child-2',
                name: 'Concepcion del Uruguay',
                path: '/argentina/litoral/entre-rios/concepcion',
                pathIds: 'root-1/parent-1/child-1',
                level: 3,
                destinationType: 'CITY'
            }
        ];

        mockFindOne.mockResolvedValue(mockParent);

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockDescendants);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findDescendants(destinationId, options);

        // Assert
        expect(result).toEqual(mockDescendants);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findDescendants',
            { destinationId, options },
            mockDescendants
        );
    });

    it('throws and logs error on DB failure', async () => {
        // Arrange
        const destinationId = 'parent-error';
        const error = new Error('Database connection failed');

        mockFindOne.mockRejectedValue(error);

        // Act & Assert
        await expect(model.findDescendants(destinationId)).rejects.toThrow(
            'Database connection failed'
        );
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'findDescendants',
            { destinationId, options: undefined },
            error
        );
    });
});

/**
 * Unit tests for DestinationModel.findAncestors
 * - Returns ancestors ordered by level
 * - Returns empty array for root destination (no pathIds)
 * - Returns empty array when destination not found
 * - Throws DbError on database failure
 */
describe('DestinationModel.findAncestors', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        model.findOne = mockFindOne;
    });

    it('returns ancestors ordered by level', async () => {
        // Arrange
        const destinationId = 'child-3';
        const mockDestination: Partial<Destination> = {
            id: 'child-3',
            name: 'Concepcion del Uruguay',
            path: '/argentina/litoral/entre-rios/concepcion',
            pathIds: 'root-1/parent-1/child-1',
            level: 3,
            destinationType: 'CITY'
        };
        const mockAncestors: Partial<Destination>[] = [
            {
                id: 'root-1',
                name: 'Argentina',
                path: '/argentina',
                pathIds: '',
                level: 0,
                destinationType: 'COUNTRY'
            },
            {
                id: 'parent-1',
                name: 'Litoral',
                path: '/argentina/litoral',
                pathIds: 'root-1',
                level: 1,
                destinationType: 'REGION'
            },
            {
                id: 'child-1',
                name: 'Entre Rios',
                path: '/argentina/litoral/entre-rios',
                pathIds: 'root-1/parent-1',
                level: 2,
                destinationType: 'PROVINCE'
            }
        ];

        mockFindOne.mockResolvedValue(mockDestination);

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockResolvedValue(mockAncestors);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findAncestors(destinationId);

        // Assert
        expect(result).toEqual(mockAncestors);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findAncestors',
            { destinationId },
            mockAncestors
        );
    });

    it('returns empty for root destination (no pathIds)', async () => {
        // Arrange
        const destinationId = 'root-1';
        const mockDestination: Partial<Destination> = {
            id: 'root-1',
            name: 'Argentina',
            path: '/argentina',
            pathIds: '',
            level: 0,
            destinationType: 'COUNTRY'
        };

        mockFindOne.mockResolvedValue(mockDestination);

        // Act
        const result = await model.findAncestors(destinationId);

        // Assert
        expect(result).toEqual([]);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
    });

    it('returns empty when destination not found', async () => {
        // Arrange
        const destinationId = 'non-existent';
        mockFindOne.mockResolvedValue(null);

        // Act
        const result = await model.findAncestors(destinationId);

        // Assert
        expect(result).toEqual([]);
        expect(mockFindOne).toHaveBeenCalledWith({ id: destinationId }, undefined);
    });

    it('throws and logs error on DB failure', async () => {
        // Arrange
        const destinationId = 'child-error';
        const error = new Error('Database connection failed');

        mockFindOne.mockRejectedValue(error);

        // Act & Assert
        await expect(model.findAncestors(destinationId)).rejects.toThrow(
            'Database connection failed'
        );
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'findAncestors',
            { destinationId },
            error
        );
    });
});

/**
 * Unit tests for DestinationModel.findByPath
 * - Returns destination matching path
 * - Returns null when path not found
 * - Throws DbError on database failure
 */
describe('DestinationModel.findByPath', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    it('returns destination matching path', async () => {
        // Arrange
        const path = '/argentina/litoral/entre-rios';
        const mockDestination: Partial<Destination> = {
            id: 'child-1',
            name: 'Entre Rios',
            path: '/argentina/litoral/entre-rios',
            pathIds: 'root-1/parent-1',
            level: 2,
            destinationType: 'PROVINCE'
        };

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockLimit.mockResolvedValue([mockDestination]);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findByPath(path);

        // Assert
        expect(result).toEqual(mockDestination);
        expect(mockSelect).toHaveBeenCalled();
        expect(mockFrom).toHaveBeenCalled();
        expect(mockWhere).toHaveBeenCalled();
        expect(mockLimit).toHaveBeenCalledWith(1);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findByPath',
            { path },
            mockDestination
        );
    });

    it('returns null when path not found', async () => {
        // Arrange
        const path = '/non-existent/path';

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockLimit.mockResolvedValue([]);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act
        const result = await model.findByPath(path);

        // Assert
        expect(result).toBeNull();
        expect(logQuery).toHaveBeenCalledWith('destinations', 'findByPath', { path }, null);
    });

    it('throws and logs error on DB failure', async () => {
        // Arrange
        const path = '/error/path';
        const error = new Error('Database connection failed');

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockLimit = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockLimit.mockRejectedValue(error);

        getDb.mockReturnValue({
            select: mockSelect
        });

        // Act & Assert
        await expect(model.findByPath(path)).rejects.toThrow('Database connection failed');
        expect(logError).toHaveBeenCalledWith('destinations', 'findByPath', { path }, error);
    });
});

/**
 * Unit tests for DestinationModel.isDescendant
 * - Returns true when pathIds contains ancestorId
 * - Returns false when pathIds does not contain ancestorId
 * - Returns false when destination not found
 * - Returns false when pathIds is empty
 * - Throws DbError on database failure
 */
describe('DestinationModel.isDescendant', () => {
    let model: DestinationModel;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        model.findOne = mockFindOne;
    });

    it('returns true when pathIds contains ancestorId', async () => {
        // Arrange
        const potentialDescendantId = 'child-3';
        const ancestorId = 'parent-1';
        const mockDescendant: Partial<Destination> = {
            id: 'child-3',
            name: 'Concepcion del Uruguay',
            path: '/argentina/litoral/entre-rios/concepcion',
            pathIds: 'root-1/parent-1/child-1',
            level: 3,
            destinationType: 'CITY'
        };

        mockFindOne.mockResolvedValue(mockDescendant);

        // Act
        const result = await model.isDescendant(potentialDescendantId, ancestorId);

        // Assert
        expect(result).toBe(true);
        expect(mockFindOne).toHaveBeenCalledWith({ id: potentialDescendantId }, undefined);
    });

    it('returns false when pathIds does not contain ancestorId', async () => {
        // Arrange
        const potentialDescendantId = 'child-3';
        const ancestorId = 'unrelated-parent';
        const mockDescendant: Partial<Destination> = {
            id: 'child-3',
            name: 'Concepcion del Uruguay',
            path: '/argentina/litoral/entre-rios/concepcion',
            pathIds: 'root-1/parent-1/child-1',
            level: 3,
            destinationType: 'CITY'
        };

        mockFindOne.mockResolvedValue(mockDescendant);

        // Act
        const result = await model.isDescendant(potentialDescendantId, ancestorId);

        // Assert
        expect(result).toBe(false);
    });

    it('returns false when destination not found', async () => {
        // Arrange
        const potentialDescendantId = 'non-existent';
        const ancestorId = 'parent-1';

        mockFindOne.mockResolvedValue(null);

        // Act
        const result = await model.isDescendant(potentialDescendantId, ancestorId);

        // Assert
        expect(result).toBe(false);
        expect(mockFindOne).toHaveBeenCalledWith({ id: potentialDescendantId }, undefined);
    });

    it('returns false when pathIds is empty', async () => {
        // Arrange
        const potentialDescendantId = 'root-1';
        const ancestorId = 'parent-1';
        const mockDescendant: Partial<Destination> = {
            id: 'root-1',
            name: 'Argentina',
            path: '/argentina',
            pathIds: '',
            level: 0,
            destinationType: 'COUNTRY'
        };

        mockFindOne.mockResolvedValue(mockDescendant);

        // Act
        const result = await model.isDescendant(potentialDescendantId, ancestorId);

        // Assert
        expect(result).toBe(false);
    });

    it('throws and logs error on DB failure', async () => {
        // Arrange
        const potentialDescendantId = 'child-error';
        const ancestorId = 'parent-1';
        const error = new Error('Database connection failed');

        mockFindOne.mockRejectedValue(error);

        // Act & Assert
        await expect(model.isDescendant(potentialDescendantId, ancestorId)).rejects.toThrow(
            'Database connection failed'
        );
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'isDescendant',
            { potentialDescendantId, ancestorId },
            error
        );
    });
});

/**
 * Unit tests for DestinationModel.updateDescendantPaths
 * - Updates path for all descendants
 * - Returns early when parent not found
 * - Throws DbError on database failure
 */
describe('DestinationModel.updateDescendantPaths', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    it('executes batch UPDATE for all descendants and logs success', async () => {
        // Arrange
        const parentId = 'parent-1';
        const oldPath = '/argentina/litoral';
        const newPath = '/argentina/region-litoral';
        const mockExecute = vi.fn().mockResolvedValue(undefined);

        getDb.mockReturnValue({ execute: mockExecute });

        // Act
        await model.updateDescendantPaths(parentId, oldPath, newPath);

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'updateDescendantPaths',
            { parentId, oldPath, newPath },
            null
        );
    });

    it('uses tx client when tx is provided instead of getDb', async () => {
        // Arrange
        const parentId = 'parent-1';
        const oldPath = '/argentina/litoral';
        const newPath = '/argentina/region-litoral';
        const mockExecute = vi.fn().mockResolvedValue(undefined);
        const mockTx = { execute: mockExecute } as any;
        vi.spyOn(model as any, 'getClient').mockReturnValue(mockTx);

        // Act
        await model.updateDescendantPaths(parentId, oldPath, newPath, mockTx);

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);
        expect(getDb).not.toHaveBeenCalled();
    });

    it('throws DbError and logs error on DB failure', async () => {
        // Arrange
        const parentId = 'parent-error';
        const oldPath = '/argentina/litoral';
        const newPath = '/argentina/region-litoral';
        const error = new Error('Database connection failed');

        getDb.mockReturnValue({ execute: vi.fn().mockRejectedValue(error) });

        // Act & Assert
        await expect(model.updateDescendantPaths(parentId, oldPath, newPath)).rejects.toThrow(
            'Database connection failed'
        );
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'updateDescendantPaths',
            { parentId, oldPath, newPath },
            error
        );
    });
});
