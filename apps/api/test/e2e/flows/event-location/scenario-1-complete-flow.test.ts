import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('E2E: Event Location Flow - Scenario 1: Complete CRUD Operations', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: unknown;
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let locationCounter = 0;

    // Helper to create valid location data
    const createValidLocationData = () => {
        locationCounter++;
        return {
            placeName: `Test Venue ${locationCounter}`,
            street: 'Main Street',
            number: '123',
            city: 'Buenos Aires',
            department: 'Capital Federal',
            state: 'Buenos Aires',
            country: 'Argentina',
            zipCode: '1000'
        };
    };

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        testUser = await createTestUser();
        const actor = createMockAdminActor({
            id: testUser.id
        });
        apiClient = new E2EApiClient(app, actor);
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        _transactionClient = await testDb.beginTransaction();
    });

    afterEach(async () => {
        await testDb.rollbackTransaction(_transactionClient);
    });

    it('should create event location with minimal fields', async () => {
        // ARRANGE
        const locationData = {
            placeName: 'Simple Venue',
            city: 'Córdoba'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-locations', locationData);

        // ASSERT
        const location = await apiClient.expectSuccess(response, 201);

        expect(location.id).toBeTruthy();
        expect(location.placeName).toBe('Simple Venue');
        expect(location.city).toBe('Córdoba');
    });

    it('should create event location with all fields', async () => {
        // ARRANGE
        locationCounter++;
        const locationData = {
            placeName: `Test Venue ${locationCounter}`,
            street: 'Main Street',
            number: '123',
            city: 'Buenos Aires',
            department: 'Capital Federal',
            state: 'Buenos Aires',
            country: 'Argentina',
            zipCode: '1000',
            floor: '3',
            apartment: 'A',
            neighborhood: 'Centro',
            coordinates: {
                lat: '-34.6037',
                long: '-58.3816'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-locations', locationData);

        // ASSERT
        const location = await apiClient.expectSuccess(response, 201);

        expect(location.id).toBeTruthy();
        expect(location.placeName).toContain('Test Venue');
        expect(location.floor).toBe('3');
        expect(location.apartment).toBe('A');
        expect(location.neighborhood).toBe('Centro');
    });

    it('should get event location by ID', async () => {
        // ARRANGE - Create a location first
        const createResponse = await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            placeName: 'Get Test Location'
        });
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.get(`/api/v1/event-locations/${created.id}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.placeName).toBe('Get Test Location');
    });

    it('should list event locations with pagination', async () => {
        // ARRANGE - Create multiple locations
        for (let i = 0; i < 3; i++) {
            await apiClient.post('/api/v1/event-locations', createValidLocationData());
        }

        // ACT
        const response = await apiClient.get('/api/v1/event-locations', {
            page: 1,
            pageSize: 2
        });

        // ASSERT
        const { data, pagination } = await apiClient.expectPaginatedSuccess(response);

        expect(data).toHaveLength(2);
        expect(pagination.page).toBe(1);
        expect(pagination.pageSize).toBe(2);
        expect(pagination.total).toBeGreaterThanOrEqual(3);
    });

    it('should update event location', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-locations',
            createValidLocationData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        const updateData = {
            placeName: 'Updated Venue Name',
            city: 'Rosario'
        };

        // ACT
        const response = await apiClient.put(`/api/v1/event-locations/${created.id}`, updateData);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.placeName).toBe('Updated Venue Name');
        expect(result.city).toBe('Rosario');
    });

    it('should delete event location (soft delete)', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-locations',
            createValidLocationData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const deleteResponse = await apiClient.delete(`/api/v1/event-locations/${created.id}`);

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify deleted location is not returned in normal queries
        const getResponse = await apiClient.get(`/api/v1/event-locations/${created.id}`);
        expect(getResponse.status).toBe(404);
    });

    it('should reject creation with invalid city (too short)', async () => {
        // ARRANGE
        const locationData = {
            placeName: 'Test Venue',
            city: 'X' // Too short - min 2 chars
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-locations', locationData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should reject creation with invalid coordinates', async () => {
        // ARRANGE
        const locationData = {
            ...createValidLocationData(),
            coordinates: {
                lat: 'invalid',
                long: 'invalid'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-locations', locationData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent event location', async () => {
        // ACT
        const response = await apiClient.get(
            '/api/v1/event-locations/00000000-0000-0000-0000-000000000000'
        );

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('should filter event locations by city', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            city: 'Buenos Aires'
        });
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            city: 'Córdoba'
        });

        // ACT
        const response = await apiClient.get('/api/v1/event-locations', {
            city: 'Buenos Aires'
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.every((loc: any) => loc.city === 'Buenos Aires')).toBe(true);
    });

    it('should filter event locations by state', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            state: 'Entre Ríos'
        });
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            state: 'Buenos Aires'
        });

        // ACT
        const response = await apiClient.get('/api/v1/event-locations', {
            state: 'Entre Ríos'
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.every((loc: any) => loc.state === 'Entre Ríos')).toBe(true);
    });

    it('should search event locations by name', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            placeName: 'Stadium Arena'
        });
        await apiClient.post('/api/v1/event-locations', {
            ...createValidLocationData(),
            placeName: 'Conference Center'
        });

        // ACT
        const response = await apiClient.get('/api/v1/event-locations', {
            q: 'Stadium'
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.some((loc: any) => loc.placeName.includes('Stadium'))).toBe(true);
    });

    it('should update location coordinates', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-locations',
            createValidLocationData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.put(`/api/v1/event-locations/${created.id}`, {
            coordinates: {
                lat: '-34.9011',
                long: '-56.1645'
            }
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.coordinates).toBeTruthy();
        expect(result.coordinates.lat).toBe('-34.9011');
        expect(result.coordinates.long).toBe('-56.1645');
    });
});
