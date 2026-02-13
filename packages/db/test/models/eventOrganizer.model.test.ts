import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EventOrganizerModel } from '../../src/models/event/eventOrganizer.model';
// import { cleanupTestDb, initTestDb } from '../helpers/db';

// SKIPPED: Integration test requires database to be running
describe.skip('EventOrganizerModel', () => {
    let model: EventOrganizerModel;

    beforeAll(async () => {
        // await initTestDb();
    });

    beforeEach(() => {
        model = new EventOrganizerModel();
    });

    afterAll(async () => {
        // await cleanupTestDb();
    });

    describe('Basic CRUD Operations', () => {
        it('should create a new event organizer', async () => {
            const organizerData = {
                name: 'Test Event Organizer',
                description: 'A test event organizer for conferences',
                logo: 'https://example.com/logo.png',
                contactInfo: {
                    personalEmail: 'contact@testorganizer.com',
                    mobilePhone: '+1234567890'
                },
                lifecycleState: 'ACTIVE' as const
            };

            const created = await model.create(organizerData);

            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
            expect(created.name).toBe('Test Event Organizer');
            expect(created.description).toBe('A test event organizer for conferences');
            expect(created.logo).toBe('https://example.com/logo.png');
            expect(created.contactInfo).toEqual(organizerData.contactInfo);
            expect(created.createdAt).toBeDefined();
            expect(created.updatedAt).toBeDefined();
        });

        it('should find event organizer by id', async () => {
            const created = await model.create({
                name: 'Find By ID Test',
                lifecycleState: 'ACTIVE' as const
            });

            const found = await model.findById(created.id);

            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe('Find By ID Test');
        });

        it('should find one event organizer by criteria', async () => {
            await model.create({
                name: 'Unique Organizer Name',
                lifecycleState: 'ACTIVE' as const
            });

            const found = await model.findOne({ name: 'Unique Organizer Name' });

            expect(found).toBeDefined();
            expect(found?.name).toBe('Unique Organizer Name');
        });

        it('should find all event organizers', async () => {
            await model.create({ name: 'Organizer 1', lifecycleState: 'ACTIVE' as const });
            await model.create({ name: 'Organizer 2', lifecycleState: 'ACTIVE' as const });

            const result = await model.findAll({});

            expect(result.items.length).toBeGreaterThanOrEqual(2);
        });

        it('should update event organizer', async () => {
            const created = await model.create({
                name: 'Update Test',
                lifecycleState: 'ACTIVE' as const
            });

            const updated = await model.updateById(created.id, {
                name: 'Updated Name',
                description: 'Updated description'
            });

            expect(updated).toBeDefined();
            expect(updated?.name).toBe('Updated Name');
            expect(updated?.description).toBe('Updated description');
        });

        it('should soft delete event organizer', async () => {
            const created = await model.create({
                name: 'Soft Delete Test',
                lifecycleState: 'ACTIVE' as const
            });

            await model.softDelete({ id: created.id });

            const found = await model.findById(created.id);
            expect(found).toBeNull(); // Should not find soft-deleted records by default
        });

        it('should restore soft-deleted event organizer', async () => {
            const created = await model.create({
                name: 'Restore Test',
                lifecycleState: 'ACTIVE' as const
            });

            await model.softDelete({ id: created.id });
            await model.restore({ id: created.id });

            const found = await model.findById(created.id);
            expect(found).toBeDefined();
            expect(found?.name).toBe('Restore Test');
        });
    });

    describe('Search and Filtering', () => {
        beforeEach(async () => {
            await model.create({
                name: 'Music Festival Organizer',
                description: 'Organizes music festivals',
                lifecycleState: 'ACTIVE' as const
            });
            await model.create({
                name: 'Tech Conference Organizer',
                description: 'Organizes technology conferences',
                lifecycleState: 'ACTIVE' as const
            });
        });

        it('should filter by name', async () => {
            const result = await model.findAll({ name: 'Music Festival Organizer' });

            expect(result.items.length).toBeGreaterThanOrEqual(1);
            expect(result.items[0]?.name).toBe('Music Festival Organizer');
        });

        it('should filter by lifecycle state', async () => {
            const result = await model.findAll({ lifecycleState: 'ACTIVE' });

            expect(result.items.length).toBeGreaterThanOrEqual(2);
            for (const item of result.items) {
                expect(item.lifecycleState).toBe('ACTIVE');
            }
        });
    });

    describe('Pagination', () => {
        beforeEach(async () => {
            // Create multiple organizers for pagination testing
            for (let i = 1; i <= 15; i++) {
                await model.create({
                    name: `Organizer ${i}`,
                    lifecycleState: 'ACTIVE' as const
                });
            }
        });

        it('should paginate results', async () => {
            const page1 = await model.findAll({}, { page: 1, pageSize: 5 });
            const page2 = await model.findAll({}, { page: 2, pageSize: 5 });

            expect(page1.items.length).toBe(5);
            expect(page2.items.length).toBe(5);
            expect(page1.total).toBeGreaterThanOrEqual(15);
            expect(page2.total).toBeGreaterThanOrEqual(15);

            // Ensure different results
            expect(page1.items[0]?.id).not.toBe(page2.items[0]?.id);
        });

        it('should respect pageSize limit', async () => {
            const result = await model.findAll({}, { page: 1, pageSize: 3 });

            expect(result.items.length).toBe(3);
        });
    });

    describe('Validation', () => {
        it('should require name', async () => {
            await expect(
                model.create({
                    // @ts-expect-error - Testing validation
                    lifecycleState: 'ACTIVE'
                })
            ).rejects.toThrow();
        });
    });
});
