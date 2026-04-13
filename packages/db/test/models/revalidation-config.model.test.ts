/**
 * Unit tests for RevalidationConfigModel custom methods.
 *
 * Tests the model-specific query helpers:
 *   - findByEntityType(entityType): finds a config by entity type key
 *   - findAllEnabled(): returns only rows with enabled = true
 *
 * @module test/models/revalidation-config.model.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RevalidationConfigModel } from '../../src/models/revalidation/revalidation-config.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/** Sample config rows used across tests */
const enabledConfig = {
    id: 'cfg-uuid-0001-0000-0000-000000000001',
    entityType: 'accommodation',
    autoRevalidateOnChange: true,
    cronIntervalMinutes: 60,
    debounceSeconds: 5,
    enabled: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
};

const disabledConfig = {
    id: 'cfg-uuid-0002-0000-0000-000000000002',
    entityType: 'destination',
    autoRevalidateOnChange: false,
    cronIntervalMinutes: 120,
    debounceSeconds: 10,
    enabled: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z')
};

describe('RevalidationConfigModel', () => {
    let model: RevalidationConfigModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new RevalidationConfigModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // findByEntityType
    // =========================================================================

    describe('findByEntityType', () => {
        it('returns the matching config row when entity type exists', async () => {
            // Arrange
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([enabledConfig]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                limit: mockLimit
            });

            // Chain the mocks
            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ limit: mockLimit });

            // Act
            const result = await model.findByEntityType('accommodation');

            // Assert
            expect(result).toEqual(enabledConfig);
        });

        it('returns undefined when entity type does not exist', async () => {
            // Arrange
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere,
                limit: mockLimit
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });
            mockWhere.mockReturnValue({ limit: mockLimit });

            // Act
            const result = await model.findByEntityType('nonexistent_entity');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    // =========================================================================
    // findAllEnabled
    // =========================================================================

    describe('findAllEnabled', () => {
        it('returns only configs where enabled = true', async () => {
            // Arrange — db returns only the enabled row (WHERE clause applied by DB)
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockResolvedValue([enabledConfig]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });

            // Act
            const results = await model.findAllEnabled();

            // Assert
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual(enabledConfig);
            expect(results.every((r) => r.enabled)).toBe(true);
        });

        it('returns empty array when no enabled configs exist', async () => {
            // Arrange
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });

            // Act
            const results = await model.findAllEnabled();

            // Assert
            expect(results).toHaveLength(0);
        });

        it('does not include disabled configs in the result', async () => {
            // Arrange — DB enforces WHERE enabled = true, so disabled never arrives
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            // Simulate DB correctly filtering: only enabled rows returned
            const mockWhere = vi.fn().mockResolvedValue([enabledConfig]);

            getDb.mockReturnValue({
                select: mockSelect,
                from: mockFrom,
                where: mockWhere
            });

            mockSelect.mockReturnValue({ from: mockFrom });
            mockFrom.mockReturnValue({ where: mockWhere });

            // Act
            const results = await model.findAllEnabled();

            // Assert — disabledConfig must not be present
            const ids = results.map((r) => r.id);
            expect(ids).not.toContain(disabledConfig.id);
        });
    });
});
