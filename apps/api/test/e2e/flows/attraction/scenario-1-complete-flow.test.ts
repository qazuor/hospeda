import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestDestination, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('E2E: Attraction Flow - Scenario 1: Complete CRUD Operations', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: unknown;
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let testDestination: Awaited<ReturnType<typeof createTestDestination>>;
    let attractionCounter = 0;

    // Helper to create valid attraction data
    const createValidAttractionData = (destinationId?: string) => {
        attractionCounter++;
        return {
            name: `Test Attraction ${attractionCounter}`,
            slug: `test-attraction-${attractionCounter}`,
            description: 'A beautiful attraction that visitors love to explore and discover',
            icon: 'landmark',
            destinationId: destinationId || undefined,
            isFeatured: false,
            isBuiltin: false
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
        testDestination = await createTestDestination();
    });

    afterEach(async () => {
        await testDb.rollbackTransaction(_transactionClient);
    });

    it('should create attraction with minimal fields', async () => {
        // ARRANGE
        const attractionData = {
            name: 'Simple Attraction',
            description: 'A simple attraction for visitors to enjoy',
            icon: 'star'
        };

        // ACT
        const response = await apiClient.post('/api/v1/attractions', attractionData);

        // ASSERT
        const attraction = await apiClient.expectSuccess(response, 201);

        expect(attraction.id).toBeTruthy();
        expect(attraction.name).toBe('Simple Attraction');
        expect(attraction.icon).toBe('star');
    });

    it('should create attraction with all fields', async () => {
        // ARRANGE
        const attractionData = {
            ...createValidAttractionData(testDestination.id),
            isFeatured: true,
            isBuiltin: true
        };

        // ACT
        const response = await apiClient.post('/api/v1/attractions', attractionData);

        // ASSERT
        const attraction = await apiClient.expectSuccess(response, 201);

        expect(attraction.id).toBeTruthy();
        expect(attraction.name).toContain('Test Attraction');
        expect(attraction.destinationId).toBe(testDestination.id);
        expect(attraction.isFeatured).toBe(true);
        expect(attraction.isBuiltin).toBe(true);
    });

    it('should get attraction by ID', async () => {
        // ARRANGE - Create an attraction first
        const createResponse = await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            name: 'Get Test Attraction'
        });
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.get(`/api/v1/attractions/${created.id}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.name).toBe('Get Test Attraction');
    });

    it('should list attractions with pagination', async () => {
        // ARRANGE - Create multiple attractions
        for (let i = 0; i < 3; i++) {
            await apiClient.post('/api/v1/attractions', createValidAttractionData());
        }

        // ACT
        const response = await apiClient.get('/api/v1/attractions', {
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

    it('should update attraction', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/attractions',
            createValidAttractionData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        const updateData = {
            name: 'Updated Attraction Name',
            description: 'This attraction description has been updated with fresh content'
        };

        // ACT
        const response = await apiClient.put(`/api/v1/attractions/${created.id}`, updateData);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.name).toBe('Updated Attraction Name');
        expect(result.description).toContain('updated');
    });

    it('should delete attraction (soft delete)', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/attractions',
            createValidAttractionData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const deleteResponse = await apiClient.delete(`/api/v1/attractions/${created.id}`);

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify deleted attraction is not returned in normal queries
        const getResponse = await apiClient.get(`/api/v1/attractions/${created.id}`);
        expect(getResponse.status).toBe(404);
    });

    it('should reject creation with invalid name (too short)', async () => {
        // ARRANGE
        const attractionData = {
            name: 'AB', // Too short - min 3 chars
            description: 'A valid description for the attraction',
            icon: 'star'
        };

        // ACT
        const response = await apiClient.post('/api/v1/attractions', attractionData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should reject creation with invalid description (too short)', async () => {
        // ARRANGE
        const attractionData = {
            name: 'Valid Name',
            description: 'Short', // Too short - min 10 chars
            icon: 'star'
        };

        // ACT
        const response = await apiClient.post('/api/v1/attractions', attractionData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should reject creation with invalid slug format', async () => {
        // ARRANGE
        const attractionData = {
            ...createValidAttractionData(),
            slug: 'INVALID_SLUG' // Must be lowercase with hyphens only
        };

        // ACT
        const response = await apiClient.post('/api/v1/attractions', attractionData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent attraction', async () => {
        // ACT
        const response = await apiClient.get(
            '/api/v1/attractions/00000000-0000-0000-0000-000000000000'
        );

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('should filter attractions by destination', async () => {
        // ARRANGE - Create another destination
        const anotherDestination = await createTestDestination();

        await apiClient.post('/api/v1/attractions', createValidAttractionData(testDestination.id));
        await apiClient.post(
            '/api/v1/attractions',
            createValidAttractionData(anotherDestination.id)
        );

        // ACT
        const response = await apiClient.get('/api/v1/attractions', {
            destinationId: testDestination.id
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.every((attr: any) => attr.destinationId === testDestination.id)).toBe(true);
    });

    it('should filter attractions by isFeatured', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            isFeatured: true
        });
        await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            isFeatured: false
        });

        // ACT
        const response = await apiClient.get('/api/v1/attractions', {
            isFeatured: true
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.every((attr: any) => attr.isFeatured === true)).toBe(true);
    });

    it('should search attractions by name', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            name: 'Beach Paradise'
        });
        await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            name: 'Mountain View'
        });

        // ACT
        const response = await apiClient.get('/api/v1/attractions', {
            q: 'Beach'
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.some((attr: any) => attr.name.includes('Beach'))).toBe(true);
    });

    it('should update attraction featured status', async () => {
        // ARRANGE
        const createResponse = await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            isFeatured: false
        });
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.put(`/api/v1/attractions/${created.id}`, {
            isFeatured: true
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.isFeatured).toBe(true);
    });

    it('should update attraction icon', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/attractions',
            createValidAttractionData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.put(`/api/v1/attractions/${created.id}`, {
            icon: 'beach'
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.icon).toBe('beach');
    });

    it('should link attraction to destination', async () => {
        // ARRANGE - Create attraction without destination
        const createResponse = await apiClient.post('/api/v1/attractions', {
            ...createValidAttractionData(),
            destinationId: undefined
        });
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT - Link to destination
        const response = await apiClient.put(`/api/v1/attractions/${created.id}`, {
            destinationId: testDestination.id
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.destinationId).toBe(testDestination.id);
    });
});
