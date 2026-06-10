/**
 * Unit tests for PlatformSettingsModel custom methods (SPEC-156).
 *
 * Covers:
 *   - findByKey(key): returns row when present, undefined when absent.
 *   - upsertByKey(key, value, actorId): inserts new + updates existing.
 *
 * @module test/models/platform-settings.model.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { PlatformSettingsModel } from '../../src/models/platform/platform-settings.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/** Sample row used across tests */
const seoRow = {
    key: 'seo.defaults',
    value: {
        metaTitleTemplate: '%s | Hospeda',
        metaDescriptionDefault: 'Alojamientos en Concepción del Uruguay',
        ogImageDefault: 'https://hospeda.com.ar/og.png'
    },
    updatedAt: new Date('2026-05-28T00:00:00Z'),
    updatedBy: 'usr-uuid-0000-0000-0000-000000000001'
};

describe('PlatformSettingsModel', () => {
    let model: PlatformSettingsModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new PlatformSettingsModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // findByKey
    // =========================================================================

    describe('findByKey', () => {
        it('returns the matching row when the key exists', async () => {
            // Arrange
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockLimit = vi.fn().mockResolvedValue([seoRow]);

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
            const result = await model.findByKey('seo.defaults');

            // Assert
            expect(result).toEqual(seoRow);
        });

        it('returns undefined when the key does not exist', async () => {
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
            const result = await model.findByKey('nonexistent.key');

            // Assert
            expect(result).toBeUndefined();
        });
    });

    // =========================================================================
    // upsertByKey
    // =========================================================================

    describe('upsertByKey', () => {
        it('returns the inserted row on first write (no conflict)', async () => {
            // Arrange — db returns the newly inserted row
            const mockInsert = vi.fn().mockReturnThis();
            const mockValues = vi.fn().mockReturnThis();
            const mockOnConflictDoUpdate = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([seoRow]);

            getDb.mockReturnValue({ insert: mockInsert });
            mockInsert.mockReturnValue({ values: mockValues });
            mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
            mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });

            // Act
            const result = await model.upsertByKey('seo.defaults', seoRow.value, seoRow.updatedBy);

            // Assert
            expect(result).toEqual(seoRow);
            expect(mockValues).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: 'seo.defaults',
                    value: seoRow.value,
                    updatedBy: seoRow.updatedBy
                })
            );
            // onConflictDoUpdate must target the primary key column
            expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    set: expect.objectContaining({
                        value: seoRow.value,
                        updatedBy: seoRow.updatedBy
                    })
                })
            );
        });

        it('returns the updated row on second write (conflict path)', async () => {
            // Arrange — second upsert returns the existing row with new values
            const newValue = { ...seoRow.value, metaTitleTemplate: 'Updated | Hospeda' };
            const updatedRow = { ...seoRow, value: newValue };

            const mockInsert = vi.fn().mockReturnThis();
            const mockValues = vi.fn().mockReturnThis();
            const mockOnConflictDoUpdate = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([updatedRow]);

            getDb.mockReturnValue({ insert: mockInsert });
            mockInsert.mockReturnValue({ values: mockValues });
            mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
            mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });

            // Act
            const result = await model.upsertByKey('seo.defaults', newValue, seoRow.updatedBy);

            // Assert
            expect(result.value).toEqual(newValue);
        });

        it('throws when the database returns no row (unexpected state)', async () => {
            // Arrange — driver returns empty array (should not happen for upsert)
            const mockInsert = vi.fn().mockReturnThis();
            const mockValues = vi.fn().mockReturnThis();
            const mockOnConflictDoUpdate = vi.fn().mockReturnThis();
            const mockReturning = vi.fn().mockResolvedValue([]);

            getDb.mockReturnValue({ insert: mockInsert });
            mockInsert.mockReturnValue({ values: mockValues });
            mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
            mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning });

            // Act + Assert
            await expect(
                model.upsertByKey('seo.defaults', seoRow.value, seoRow.updatedBy)
            ).rejects.toThrow(/upsertByKey returned no row/);
        });
    });
});
