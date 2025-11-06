/**
 * Integration Testing Patterns
 *
 * This file demonstrates integration testing patterns:
 * - Testing with real database
 * - Transaction setup/teardown
 * - Data fixtures and factories
 * - Testing full service flow
 * - Multi-layer integration
 *
 * Integration tests verify that multiple components work together correctly,
 * using actual database connections and testing complete workflows.
 */

import { db } from '@repo/db';
import { CategoryModel } from '@repo/db';
import type { CategoryIdType } from '@repo/schemas';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { CategoryService } from '../../../src/services/category/category.service';
import { createActor } from '../../factories/actorFactory';
import { createMockCategory } from '../../factories/categoryFactory';
import { getMockId } from '../../factories/utilsFactory';

describe('Integration Tests - CategoryService', () => {
    let service: CategoryService;
    let model: CategoryModel;

    // Actors for testing different permission levels
    const adminActor = createActor({
        id: getMockId('user', 'admin') as string,
        role: RoleEnum.ADMIN,
        permissions: []
    });

    const userActor = createActor({
        id: getMockId('user', 'u1') as string,
        role: RoleEnum.USER,
        permissions: []
    });

    beforeEach(async () => {
        // Initialize service and model
        model = new CategoryModel();
        service = new CategoryService({ logger: console }, model);

        // Clean database before each test
        // In real tests, you might use a test database or transaction rollback
        await cleanDatabase();
    });

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Clean database before each test
     * In production, you'd use transactions or a test database
     */
    async function cleanDatabase() {
        // This is a simplified example
        // In real implementation, use transactions or dedicated test DB
        await db.delete(model.schema).execute();
    }

    /**
     * Seed database with test data
     */
    async function seedCategories(count: number = 3) {
        const categories = [];
        for (let i = 1; i <= count; i++) {
            const category = createMockCategory({
                name: `Category ${i}`,
                slug: `category-${i}`
            });
            const created = await model.create(category);
            categories.push(created);
        }
        return categories;
    }

    // ========================================================================
    // CREATE OPERATION TESTS
    // ========================================================================

    describe('create', () => {
        it('should create category and persist to database', async () => {
            // Arrange
            const createData = {
                name: 'Beach Destinations',
                slug: 'beach-destinations',
                description: 'Beautiful beaches'
            };

            // Act
            const result = await service.create(adminActor, createData);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(result.data?.id).toBeDefined();
            expect(result.data?.name).toBe('Beach Destinations');

            // Verify it was actually saved to database
            const saved = await model.findById(result.data!.id);
            expect(saved).toBeDefined();
            expect(saved?.name).toBe('Beach Destinations');
        });

        it('should enforce unique slug constraint', async () => {
            // Arrange - Create first category
            await service.create(adminActor, {
                name: 'Category 1',
                slug: 'unique-slug'
            });

            // Act - Try to create second with same slug
            const result = await service.create(adminActor, {
                name: 'Category 2',
                slug: 'unique-slug' // Duplicate!
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });

        it('should set audit fields on creation', async () => {
            // Arrange
            const createData = {
                name: 'Test Category',
                slug: 'test-category'
            };

            // Act
            const result = await service.create(adminActor, createData);

            // Assert
            expect(result.data?.createdAt).toBeDefined();
            expect(result.data?.updatedAt).toBeDefined();
            expect(result.data?.createdById).toBe(adminActor.id);
        });
    });

    // ========================================================================
    // READ OPERATION TESTS
    // ========================================================================

    describe('getById', () => {
        it('should retrieve category from database', async () => {
            // Arrange - Create a category
            const created = await service.create(adminActor, {
                name: 'Test Category',
                slug: 'test-category'
            });

            // Act
            const result = await service.getById(userActor, created.data!.id);

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.id).toBe(created.data?.id);
            expect(result.data?.name).toBe('Test Category');
        });

        it('should return NOT_FOUND for non-existent category', async () => {
            // Arrange
            const fakeId = getMockId('category', 'fake') as CategoryIdType;

            // Act
            const result = await service.getById(userActor, fakeId);

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        });
    });

    describe('list', () => {
        it('should retrieve all categories with pagination', async () => {
            // Arrange - Seed database
            await seedCategories(5);

            // Act
            const result = await service.list(userActor, {
                page: 1,
                pageSize: 10
            });

            // Assert
            expect(result.data).toBeDefined();
            expect(result.data?.items).toHaveLength(5);
            expect(result.data?.total).toBe(5);
            expect(result.data?.pagination.page).toBe(1);
            expect(result.data?.pagination.totalPages).toBe(1);
        });

        it('should handle pagination correctly', async () => {
            // Arrange - Seed 15 categories
            await seedCategories(15);

            // Act - Get page 2 with 5 items per page
            const result = await service.list(userActor, {
                page: 2,
                pageSize: 5
            });

            // Assert
            expect(result.data?.items).toHaveLength(5);
            expect(result.data?.pagination.page).toBe(2);
            expect(result.data?.pagination.totalPages).toBe(3);
        });

        it('should filter categories by name', async () => {
            // Arrange
            await service.create(adminActor, {
                name: 'Beach Hotels',
                slug: 'beach-hotels'
            });
            await service.create(adminActor, {
                name: 'Mountain Cabins',
                slug: 'mountain-cabins'
            });

            // Act - Search for "beach"
            const result = await service.search(userActor, {
                name: 'beach'
            });

            // Assert
            expect(result.data?.items).toHaveLength(1);
            expect(result.data?.items[0].name).toContain('Beach');
        });
    });

    // ========================================================================
    // UPDATE OPERATION TESTS
    // ========================================================================

    describe('update', () => {
        it('should update category and persist changes', async () => {
            // Arrange - Create category
            const created = await service.create(adminActor, {
                name: 'Original Name',
                slug: 'original-slug'
            });

            // Act - Update it
            const result = await service.update(adminActor, created.data!.id, {
                name: 'Updated Name'
            });

            // Assert
            expect(result.data?.name).toBe('Updated Name');

            // Verify changes persisted
            const fetched = await model.findById(created.data!.id);
            expect(fetched?.name).toBe('Updated Name');
        });

        it('should update updatedAt timestamp', async () => {
            // Arrange
            const created = await service.create(adminActor, {
                name: 'Test',
                slug: 'test'
            });
            const originalUpdatedAt = created.data!.updatedAt;

            // Wait a bit to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Act
            const result = await service.update(adminActor, created.data!.id, {
                name: 'Updated'
            });

            // Assert
            expect(result.data?.updatedAt).not.toEqual(originalUpdatedAt);
        });

        it('should not allow updating to duplicate slug', async () => {
            // Arrange - Create two categories
            await service.create(adminActor, {
                name: 'Category 1',
                slug: 'slug-1'
            });
            const category2 = await service.create(adminActor, {
                name: 'Category 2',
                slug: 'slug-2'
            });

            // Act - Try to update category2 to use slug-1
            const result = await service.update(adminActor, category2.data!.id, {
                slug: 'slug-1'
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        });
    });

    // ========================================================================
    // DELETE OPERATION TESTS
    // ========================================================================

    describe('softDelete', () => {
        it('should soft delete category', async () => {
            // Arrange
            const created = await service.create(adminActor, {
                name: 'To Delete',
                slug: 'to-delete'
            });

            // Act
            const result = await service.softDelete(adminActor, created.data!.id);

            // Assert
            expect(result.data).toBeDefined();

            // Verify it's marked as deleted
            const deleted = await model.findById(created.data!.id, { includeDeleted: true });
            expect(deleted?.deletedAt).not.toBeNull();
        });

        it('should not return soft-deleted categories in list', async () => {
            // Arrange - Create and delete a category
            const created = await service.create(adminActor, {
                name: 'Deleted Category',
                slug: 'deleted'
            });
            await service.softDelete(adminActor, created.data!.id);

            // Act - List categories
            const result = await service.list(userActor, {});

            // Assert - Deleted category should not appear
            expect(result.data?.items.every((item) => item.id !== created.data?.id)).toBe(true);
        });
    });

    describe('restore', () => {
        it('should restore soft-deleted category', async () => {
            // Arrange - Create and soft delete
            const created = await service.create(adminActor, {
                name: 'To Restore',
                slug: 'to-restore'
            });
            await service.softDelete(adminActor, created.data!.id);

            // Act - Restore it
            const result = await service.restore(adminActor, created.data!.id);

            // Assert
            expect(result.data).toBeDefined();

            // Verify it's no longer deleted
            const restored = await model.findById(created.data!.id);
            expect(restored?.deletedAt).toBeNull();
        });
    });

    // ========================================================================
    // TRANSACTION TESTS
    // ========================================================================

    describe('transactions', () => {
        it('should rollback on validation error', async () => {
            // Arrange - Count initial categories
            const initialCount = (await service.list(userActor, {})).data?.total || 0;

            // Act - Try to create with invalid data
            try {
                await db.transaction(async (trx) => {
                    // This should succeed
                    await model.create(
                        {
                            name: 'Valid Category',
                            slug: 'valid'
                        },
                        trx
                    );

                    // This should fail (missing required field)
                    await model.create(
                        {
                            name: '',
                            slug: 'invalid'
                        } as any,
                        trx
                    );
                });
            } catch (error) {
                // Expected to fail
            }

            // Assert - Count should remain the same (transaction rolled back)
            const finalCount = (await service.list(userActor, {})).data?.total || 0;
            expect(finalCount).toBe(initialCount);
        });
    });

    // ========================================================================
    // PERMISSION TESTS (INTEGRATION LEVEL)
    // ========================================================================

    describe('permissions', () => {
        it('should allow admin to create', async () => {
            // Act
            const result = await service.create(adminActor, {
                name: 'Admin Category',
                slug: 'admin-cat'
            });

            // Assert
            expect(result.data).toBeDefined();
        });

        it('should deny non-admin to create', async () => {
            // Act
            const result = await service.create(userActor, {
                name: 'User Category',
                slug: 'user-cat'
            });

            // Assert
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        });
    });
});
