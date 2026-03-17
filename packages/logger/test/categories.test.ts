import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearCategories,
    getCategoryByKey,
    getMaxCategoryNameLength,
    registerCategoryInternal,
    registerDefaultCategory
} from '../src/categories.js';
import { LoggerColors } from '../src/types.js';

describe('categories', () => {
    beforeEach(() => {
        clearCategories();
        registerDefaultCategory();
    });

    describe('registerCategoryInternal', () => {
        it('should register a new category and return it', () => {
            // Arrange
            const name = 'Authentication';
            const key = 'AUTH';
            const options = { color: LoggerColors.BLUE as const };

            // Act
            const category = registerCategoryInternal(name, key, options);

            // Assert
            expect(category).toEqual(
                expect.objectContaining({
                    name: 'Authentication',
                    key: 'AUTH',
                    options: expect.objectContaining({ color: LoggerColors.BLUE })
                })
            );
        });
    });

    describe('getCategoryByKey', () => {
        it('should return DEFAULT for unknown keys', () => {
            // Act
            const category = getCategoryByKey('NONEXISTENT');

            // Assert
            expect(category.key).toBe('DEFAULT');
            expect(category.name).toBe('DEFAULT');
        });

        it('should return the correct category for registered keys', () => {
            // Arrange
            registerCategoryInternal('Database', 'DB', { color: LoggerColors.GREEN as const });

            // Act
            const category = getCategoryByKey('DB');

            // Assert
            expect(category.key).toBe('DB');
            expect(category.name).toBe('Database');
            expect(category.options.color).toBe(LoggerColors.GREEN);
        });
    });

    describe('getMaxCategoryNameLength', () => {
        it('should return length of the longest registered category name', () => {
            // Arrange
            registerCategoryInternal('A', 'SHORT', { color: LoggerColors.RED as const });
            registerCategoryInternal('VeryLongCategoryName', 'LONG', {
                color: LoggerColors.BLUE as const
            });

            // Act
            const maxLength = getMaxCategoryNameLength();

            // Assert
            // 'VeryLongCategoryName' has 20 chars, 'DEFAULT' has 7, 'A' has 1
            expect(maxLength).toBe(20);
        });

        it('should return 0 when no categories are registered', () => {
            // Arrange
            clearCategories();

            // Act
            const maxLength = getMaxCategoryNameLength();

            // Assert
            expect(maxLength).toBe(0);
        });
    });

    describe('env config merge', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
        });

        it('should merge env-based level config when registering a category', () => {
            // Arrange
            vi.stubEnv('LOG_TESTCAT_LEVEL', 'DEBUG');

            // Act
            const category = registerCategoryInternal('TestEnv', 'TESTCAT', {
                color: LoggerColors.CYAN as const
            });

            // Assert
            expect(category.options.level).toBe('DEBUG');
        });
    });

    describe('clearCategories', () => {
        it('should clear all categories including DEFAULT', () => {
            // Arrange
            registerCategoryInternal('TestCat', 'TEST', { color: LoggerColors.CYAN as const });

            // Act
            clearCategories();

            // Assert
            // After clearing, getMaxCategoryNameLength returns 0 (no categories)
            expect(getMaxCategoryNameLength()).toBe(0);

            // getCategoryByKey returns undefined cast, so DEFAULT is gone too
            // Re-register default to verify TEST is gone
            registerDefaultCategory();
            const result = getCategoryByKey('TEST');
            expect(result.key).toBe('DEFAULT');
        });
    });
});
