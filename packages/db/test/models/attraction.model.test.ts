import type { Attraction, AttractionIdType } from '@repo/schemas';
import { LifecycleStatusEnum } from '@repo/schemas';
import { Pool } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeDb } from '../../src/client';
import { AttractionModel } from '../../src/models/destination/attraction.model';

/**
 * Test suite for AttractionModel.
 * Tests CRUD operations, validation, and edge cases for attractions.
 *
 * NOTE: These are integration tests that require a properly configured test database
 * with all migrations applied. Skipped until database setup is complete.
 */
describe.skip('AttractionModel', () => {
    let model: AttractionModel;
    let testPool: Pool;

    beforeAll(() => {
        testPool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/hospeda_test'
        });
        initializeDb(testPool);
    });

    beforeEach(() => {
        model = new AttractionModel();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('create', () => {
        it('should create a new attraction with valid data', async () => {
            const attractionData: Partial<Attraction> = {
                name: 'Historical Museum',
                slug: 'historical-museum',
                description: 'A museum showcasing local history and culture',
                icon: '🏛️',
                isBuiltin: false,
                isFeatured: true,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };

            const created = await model.create(attractionData);

            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
            expect(created.name).toBe('Historical Museum');
            expect(created.slug).toBe('historical-museum');
            expect(created.isFeatured).toBe(true);
            expect(created.createdAt).toBeDefined();
            expect(created.updatedAt).toBeDefined();
        });

        it('should create attraction with minimal required fields', async () => {
            const minimalData: Partial<Attraction> = {
                name: 'Beach',
                slug: 'beach',
                description: 'Beautiful sandy beach',
                icon: '🏖️'
            };

            const created = await model.create(minimalData);

            expect(created).toBeDefined();
            expect(created.name).toBe('Beach');
            expect(created.isBuiltin).toBe(false);
            expect(created.isFeatured).toBe(false);
        });
    });

    describe('findById', () => {
        it('should find an attraction by id', async () => {
            const created = await model.create({
                name: 'Park',
                slug: 'park',
                description: 'A beautiful park',
                icon: '🌳'
            });

            const found = await model.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe('Park');
        });

        it('should return null for non-existent id', async () => {
            const found = await model.findById(
                '00000000-0000-0000-0000-000000000000' as AttractionIdType
            );

            expect(found).toBeNull();
        });
    });

    describe('findOne', () => {
        it('should find attraction by slug', async () => {
            await model.create({
                name: 'Zoo',
                slug: 'city-zoo',
                description: 'A large zoo with many animals',
                icon: '🦁'
            });

            const found = await model.findOne({ slug: 'city-zoo' });

            expect(found).toBeDefined();
            expect(found?.slug).toBe('city-zoo');
            expect(found?.name).toBe('Zoo');
        });

        it('should return null when no match found', async () => {
            const found = await model.findOne({ slug: 'non-existent' });

            expect(found).toBeNull();
        });
    });

    describe('findAll', () => {
        beforeEach(async () => {
            // Create test data
            await model.create({
                name: 'Featured Attraction 1',
                slug: 'featured-1',
                description: 'First featured attraction',
                icon: '⭐',
                isFeatured: true
            });

            await model.create({
                name: 'Regular Attraction',
                slug: 'regular',
                description: 'Regular attraction',
                icon: '📍',
                isFeatured: false
            });

            await model.create({
                name: 'Featured Attraction 2',
                slug: 'featured-2',
                description: 'Second featured attraction',
                icon: '⭐',
                isFeatured: true
            });
        });

        it('should find all attractions', async () => {
            const { items } = await model.findAll({});

            expect(items.length).toBeGreaterThanOrEqual(3);
        });

        it('should filter by isFeatured', async () => {
            const { items } = await model.findAll({ isFeatured: true });

            expect(items.length).toBeGreaterThanOrEqual(2);
            for (const item of items) {
                expect(item.isFeatured).toBe(true);
            }
        });

        it('should filter by isBuiltin', async () => {
            const { items } = await model.findAll({ isBuiltin: false });

            expect(items.length).toBeGreaterThanOrEqual(3);
            for (const item of items) {
                expect(item.isBuiltin).toBe(false);
            }
        });
    });

    describe('update', () => {
        it('should update attraction properties', async () => {
            const created = await model.create({
                name: 'Old Name',
                slug: 'old-slug',
                description: 'Old description',
                icon: '🏛️'
            });

            const updated = await model.update(created.id, {
                name: 'New Name',
                description: 'New description',
                isFeatured: true
            });

            expect(updated).toBeDefined();
            expect(updated?.name).toBe('New Name');
            expect(updated?.description).toBe('New description');
            expect(updated?.isFeatured).toBe(true);
            expect(updated?.slug).toBe('old-slug'); // Should not change
        });
    });

    describe('softDelete', () => {
        it('should soft delete an attraction', async () => {
            const created = await model.create({
                name: 'To Delete',
                slug: 'to-delete',
                description: 'Will be deleted',
                icon: '🗑️'
            });

            await model.softDelete({ id: created.id });

            const found = await model.findById(created.id);
            expect(found?.deletedAt).toBeDefined();
            expect(found?.lifecycleState).toBe(LifecycleStatusEnum.DELETED);
        });
    });

    describe('restore', () => {
        it('should restore a soft-deleted attraction', async () => {
            const created = await model.create({
                name: 'To Restore',
                slug: 'to-restore',
                description: 'Will be restored',
                icon: '♻️'
            });

            await model.softDelete({ id: created.id });
            await model.restore({ id: created.id });

            const restored = await model.findById(created.id);
            expect(restored?.deletedAt).toBeNull();
            expect(restored?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        });
    });

    describe('count', () => {
        it('should count all attractions', async () => {
            await model.create({
                name: 'Count Test 1',
                slug: 'count-1',
                description: 'For counting',
                icon: '1️⃣'
            });

            await model.create({
                name: 'Count Test 2',
                slug: 'count-2',
                description: 'For counting',
                icon: '2️⃣'
            });

            const count = await model.count({});
            expect(count).toBeGreaterThanOrEqual(2);
        });

        it('should count with filters', async () => {
            await model.create({
                name: 'Featured Count',
                slug: 'featured-count',
                description: 'Featured for counting',
                icon: '⭐',
                isFeatured: true
            });

            const count = await model.count({ isFeatured: true });
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getTableName', () => {
        it('should return correct table name', () => {
            expect(model.getTableName()).toBe('attractions');
        });
    });
});
