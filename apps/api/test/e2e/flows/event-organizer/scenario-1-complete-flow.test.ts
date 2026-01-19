import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('E2E: Event Organizer Flow - Scenario 1: Complete CRUD Operations', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: unknown;
    let testUser: Awaited<ReturnType<typeof createTestUser>>;
    let organizerCounter = 0;

    // Helper to create valid organizer data
    const createValidOrganizerData = () => {
        organizerCounter++;
        return {
            name: `Test Organizer ${organizerCounter}`,
            description: 'A professional event organizer with years of experience in the industry',
            email: `organizer${organizerCounter}@test.com`,
            phone: `+54 11 1234567${organizerCounter}`
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

    it('should create event organizer with minimal fields', async () => {
        // ARRANGE
        const organizerData = {
            name: 'Simple Organizer'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        const organizer = await apiClient.expectSuccess(response, 201);

        expect(organizer.id).toBeTruthy();
        expect(organizer.name).toBe('Simple Organizer');
    });

    it('should create event organizer with all fields', async () => {
        // ARRANGE
        const organizerData = {
            ...createValidOrganizerData(),
            logo: 'https://example.com/logo.png',
            website: 'https://www.organizer-example.com',
            instagram: 'https://instagram.com/test_organizer',
            facebook: 'https://facebook.com/testorganizer',
            twitter: 'https://twitter.com/test_org'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        const organizer = await apiClient.expectSuccess(response, 201);

        expect(organizer.id).toBeTruthy();
        expect(organizer.name).toContain('Test Organizer');
        expect(organizer.logo).toBe('https://example.com/logo.png');
    });

    it('should get event organizer by ID', async () => {
        // ARRANGE - Create an organizer first
        const createResponse = await apiClient.post('/api/v1/event-organizers', {
            ...createValidOrganizerData(),
            name: 'Get Test Organizer'
        });
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.get(`/api/v1/event-organizers/${created.id}`);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.name).toBe('Get Test Organizer');
    });

    it('should list event organizers with pagination', async () => {
        // ARRANGE - Create multiple organizers
        for (let i = 0; i < 3; i++) {
            await apiClient.post('/api/v1/event-organizers', createValidOrganizerData());
        }

        // ACT
        const response = await apiClient.get('/api/v1/event-organizers', {
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

    it('should update event organizer', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-organizers',
            createValidOrganizerData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        const updateData = {
            name: 'Updated Organizer Name',
            logo: 'https://example.com/updated-logo.png'
        };

        // ACT
        const response = await apiClient.put(`/api/v1/event-organizers/${created.id}`, updateData);

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.id).toBe(created.id);
        expect(result.name).toBe('Updated Organizer Name');
        expect(result.logo).toBe('https://example.com/updated-logo.png');
    });

    it('should delete event organizer (soft delete)', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-organizers',
            createValidOrganizerData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const deleteResponse = await apiClient.delete(`/api/v1/event-organizers/${created.id}`);

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify deleted organizer is not returned in normal queries
        const getResponse = await apiClient.get(`/api/v1/event-organizers/${created.id}`);
        expect(getResponse.status).toBe(404);
    });

    it('should reject creation with invalid name (too short)', async () => {
        // ARRANGE
        const organizerData = {
            name: 'AB' // Too short - min 3 chars
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should reject creation with invalid email', async () => {
        // ARRANGE
        const organizerData = {
            ...createValidOrganizerData(),
            email: 'invalid-email'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should reject creation with invalid logo URL', async () => {
        // ARRANGE
        const organizerData = {
            ...createValidOrganizerData(),
            logo: 'not-a-valid-url'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent event organizer', async () => {
        // ACT
        const response = await apiClient.get(
            '/api/v1/event-organizers/00000000-0000-0000-0000-000000000000'
        );

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('should search event organizers by name', async () => {
        // ARRANGE
        await apiClient.post('/api/v1/event-organizers', {
            ...createValidOrganizerData(),
            name: 'Alpha Events Company'
        });
        await apiClient.post('/api/v1/event-organizers', {
            ...createValidOrganizerData(),
            name: 'Beta Productions'
        });

        // ACT
        const response = await apiClient.get('/api/v1/event-organizers', {
            q: 'Alpha'
        });

        // ASSERT
        const { data } = await apiClient.expectPaginatedSuccess(response);

        expect(data.some((org: any) => org.name.includes('Alpha'))).toBe(true);
    });

    it('should update organizer contact info', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-organizers',
            createValidOrganizerData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.put(`/api/v1/event-organizers/${created.id}`, {
            email: 'newemail@organizer.com',
            phone: '+54 351 5551234',
            website: 'https://new-website.com'
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.contactInfo?.personalEmail).toBe('newemail@organizer.com');
        // Phone may be normalized (spaces removed) by the database
        expect(result.contactInfo?.mobilePhone).toBe('+543515551234');
        expect(result.contactInfo?.website).toBe('https://new-website.com');
    });

    it('should update organizer social media links', async () => {
        // ARRANGE
        const createResponse = await apiClient.post(
            '/api/v1/event-organizers',
            createValidOrganizerData()
        );
        const created = await apiClient.expectSuccess(createResponse, 201);

        // ACT
        const response = await apiClient.put(`/api/v1/event-organizers/${created.id}`, {
            phone: '+54 11 99999999', // Required for contactInfo
            instagram: 'https://instagram.com/new_instagram',
            facebook: 'https://facebook.com/newfacebook',
            twitter: 'https://twitter.com/new_twitter'
        });

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.social?.instagram).toBe('https://instagram.com/new_instagram');
        expect(result.social?.facebook).toBe('https://facebook.com/newfacebook');
        expect(result.social?.twitter).toBe('https://twitter.com/new_twitter');
    });

    it('should create organizer with logo', async () => {
        // ARRANGE
        const organizerData = {
            ...createValidOrganizerData(),
            logo: 'https://cdn.example.com/logos/organizer-logo.png'
        };

        // ACT
        const response = await apiClient.post('/api/v1/event-organizers', organizerData);

        // ASSERT
        const organizer = await apiClient.expectSuccess(response, 201);

        expect(organizer.logo).toBe('https://cdn.example.com/logos/organizer-logo.png');
    });
});
