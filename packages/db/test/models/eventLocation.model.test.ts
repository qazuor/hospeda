import type { EventLocationCreateInput } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EventLocationModel } from '../../src/models/event/eventLocation.model';

// SKIPPED: Integration test requires database to be running
describe.skip('EventLocationModel', () => {
    let model: EventLocationModel;

    beforeAll(() => {
        model = new EventLocationModel();
    });

    beforeEach(async () => {
        // Clean up any test data before each test
        const allLocations = await model.findAll({});
        for (const location of allLocations.items) {
            await model.hardDelete(location.id);
        }
    });

    afterAll(async () => {
        // Final cleanup
        const allLocations = await model.findAll({});
        for (const location of allLocations.items) {
            await model.hardDelete(location.id);
        }
    });

    describe('create', () => {
        it('should create an event location with all fields', async () => {
            // Arrange
            const data: EventLocationCreateInput = {
                slug: 'test-location-1',
                country: 'Argentina',
                state: 'Entre Ríos',
                city: 'Concepción del Uruguay',
                street: 'Calle Principal',
                number: '123',
                neighborhood: 'Centro',
                placeName: 'Centro de Convenciones',
                postalCode: '3260',
                latitude: -32.4834,
                longitude: -58.2372
            };

            // Act
            const result = await model.create(data);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.slug).toBe('test-location-1');
            expect(result.country).toBe('Argentina');
            expect(result.state).toBe('Entre Ríos');
            expect(result.city).toBe('Concepción del Uruguay');
            expect(result.street).toBe('Calle Principal');
            expect(result.number).toBe('123');
            expect(result.neighborhood).toBe('Centro');
            expect(result.placeName).toBe('Centro de Convenciones');
            expect(result.postalCode).toBe('3260');
            expect(result.latitude).toBe(-32.4834);
            expect(result.longitude).toBe(-58.2372);
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });

        it('should create an event location with minimal fields', async () => {
            // Arrange
            const data: EventLocationCreateInput = {
                slug: 'minimal-location',
                country: 'Argentina'
            };

            // Act
            const result = await model.create(data);

            // Assert
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.slug).toBe('minimal-location');
            expect(result.country).toBe('Argentina');
        });
    });

    describe('findById', () => {
        it('should find an event location by id', async () => {
            // Arrange
            const created = await model.create({
                slug: 'find-by-id-test',
                country: 'Argentina',
                city: 'Buenos Aires'
            });

            // Act
            const result = await model.findById(created.id);

            // Assert
            expect(result).toBeDefined();
            expect(result?.id).toBe(created.id);
            expect(result?.slug).toBe('find-by-id-test');
            expect(result?.city).toBe('Buenos Aires');
        });

        it('should return null for non-existent id', async () => {
            // Act
            const result = await model.findById('non-existent-id');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('findBySlug', () => {
        it('should find an event location by slug', async () => {
            // Arrange
            await model.create({
                slug: 'unique-slug-test',
                country: 'Argentina',
                city: 'Rosario'
            });

            // Act
            const result = await model.findBySlug('unique-slug-test');

            // Assert
            expect(result).toBeDefined();
            expect(result?.slug).toBe('unique-slug-test');
            expect(result?.city).toBe('Rosario');
        });

        it('should return null for non-existent slug', async () => {
            // Act
            const result = await model.findBySlug('non-existent-slug');

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all event locations', async () => {
            // Arrange
            await model.create({
                slug: 'location-1',
                country: 'Argentina',
                city: 'Córdoba'
            });
            await model.create({
                slug: 'location-2',
                country: 'Argentina',
                city: 'Mendoza'
            });

            // Act
            const result = await model.findAll({});

            // Assert
            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should filter by city', async () => {
            // Arrange
            await model.create({
                slug: 'cordoba-location',
                country: 'Argentina',
                city: 'Córdoba'
            });
            await model.create({
                slug: 'mendoza-location',
                country: 'Argentina',
                city: 'Mendoza'
            });

            // Act
            const result = await model.findAll({ city: 'Córdoba' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]?.city).toBe('Córdoba');
        });

        it('should filter by state', async () => {
            // Arrange
            await model.create({
                slug: 'location-er',
                country: 'Argentina',
                state: 'Entre Ríos',
                city: 'Paraná'
            });
            await model.create({
                slug: 'location-ba',
                country: 'Argentina',
                state: 'Buenos Aires',
                city: 'La Plata'
            });

            // Act
            const result = await model.findAll({ state: 'Entre Ríos' });

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]?.state).toBe('Entre Ríos');
        });

        it('should paginate results', async () => {
            // Arrange
            for (let i = 1; i <= 5; i++) {
                await model.create({
                    slug: `paginated-location-${i}`,
                    country: 'Argentina',
                    city: `City ${i}`
                });
            }

            // Act
            const page1 = await model.findAll({}, { page: 1, pageSize: 2 });
            const page2 = await model.findAll({}, { page: 2, pageSize: 2 });

            // Assert
            expect(page1.items).toHaveLength(2);
            expect(page2.items).toHaveLength(2);
            expect(page1.total).toBe(5);
            expect(page2.total).toBe(5);
        });
    });

    describe('update', () => {
        it('should update an event location', async () => {
            // Arrange
            const created = await model.create({
                slug: 'update-test',
                country: 'Argentina',
                city: 'Original City'
            });

            // Act
            const updated = await model.updateById(created.id, {
                city: 'Updated City',
                state: 'Nueva Provincia'
            });

            // Assert
            expect(updated).toBeDefined();
            expect(updated?.city).toBe('Updated City');
            expect(updated?.state).toBe('Nueva Provincia');
            expect(updated?.slug).toBe('update-test'); // Should not change
        });
    });

    describe('softDelete', () => {
        it('should soft delete an event location', async () => {
            // Arrange
            const created = await model.create({
                slug: 'soft-delete-test',
                country: 'Argentina',
                city: 'Delete City'
            });

            // Act
            const deleted = await model.softDelete(created.id);

            // Assert
            expect(deleted).toBeDefined();
            expect(deleted?.deletedAt).toBeDefined();
            expect(deleted?.deletedAt).not.toBeNull();
        });

        it('should not include soft-deleted locations in default queries', async () => {
            // Arrange
            await model.create({
                slug: 'active-location',
                country: 'Argentina'
            });
            const toDelete = await model.create({
                slug: 'deleted-location',
                country: 'Argentina'
            });
            await model.softDelete(toDelete.id);

            // Act
            const result = await model.findAll({});

            // Assert
            expect(result.items).toHaveLength(1);
            expect(result.items[0]?.slug).toBe('active-location');
        });
    });

    describe('restore', () => {
        it('should restore a soft-deleted event location', async () => {
            // Arrange
            const created = await model.create({
                slug: 'restore-test',
                country: 'Argentina'
            });
            await model.softDelete(created.id);

            // Act
            const restored = await model.restore(created.id);

            // Assert
            expect(restored).toBeDefined();
            expect(restored?.deletedAt).toBeNull();
        });

        it('should include restored location in queries', async () => {
            // Arrange
            const created = await model.create({
                slug: 'restore-query-test',
                country: 'Argentina'
            });
            await model.softDelete(created.id);
            await model.restore(created.id);

            // Act
            const result = await model.findAll({});

            // Assert
            const found = result.items.find((item) => item.slug === 'restore-query-test');
            expect(found).toBeDefined();
        });
    });

    describe('hardDelete', () => {
        it('should permanently delete an event location', async () => {
            // Arrange
            const created = await model.create({
                slug: 'hard-delete-test',
                country: 'Argentina'
            });

            // Act
            await model.hardDelete(created.id);
            const result = await model.findById(created.id);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('count', () => {
        it('should count all event locations', async () => {
            // Arrange
            await model.create({
                slug: 'count-1',
                country: 'Argentina'
            });
            await model.create({
                slug: 'count-2',
                country: 'Argentina'
            });
            await model.create({
                slug: 'count-3',
                country: 'Argentina'
            });

            // Act
            const count = await model.count({});

            // Assert
            expect(count).toBe(3);
        });

        it('should count with filters', async () => {
            // Arrange
            await model.create({
                slug: 'count-cordoba',
                country: 'Argentina',
                city: 'Córdoba'
            });
            await model.create({
                slug: 'count-mendoza',
                country: 'Argentina',
                city: 'Mendoza'
            });

            // Act
            const count = await model.count({ city: 'Córdoba' });

            // Assert
            expect(count).toBe(1);
        });

        it('should not count soft-deleted locations', async () => {
            // Arrange
            await model.create({
                slug: 'count-active',
                country: 'Argentina'
            });
            const toDelete = await model.create({
                slug: 'count-deleted',
                country: 'Argentina'
            });
            await model.softDelete(toDelete.id);

            // Act
            const count = await model.count({});

            // Assert
            expect(count).toBe(1);
        });
    });
});
