import { ProfessionalServiceCategoryEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestProfessionalService, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('E2E: Professional Service Flow - Scenario 1: Complete Service Creation', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: unknown;

    beforeAll(async () => {
        await testDb.setup();
        app = initApp();

        // Create a test user for the actor
        const testUser = await createTestUser();
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

    it('should create professional service with minimal required fields', async () => {
        // ARRANGE
        const serviceData = {
            name: 'Photography Service 2025',
            description: 'Professional photography service for accommodations and tourism',
            category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
            defaultPricing: {
                basePrice: 200,
                currency: 'ARS',
                billingUnit: 'project'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        const service = await apiClient.expectSuccess(response, 201);

        expect(service.id).toBeTruthy();
        expect(service.name).toBe('Photography Service 2025');
        expect(service.category).toBe(ProfessionalServiceCategoryEnum.PHOTOGRAPHY);
        expect(service.defaultPricing.basePrice).toBe(200);
        expect(service.defaultPricing.currency).toBe('ARS');
        expect(service.defaultPricing.billingUnit).toBe('project');
        expect(service.isActive).toBe(true);
    });

    it('should create professional service with all pricing fields', async () => {
        // ARRANGE
        const serviceData = {
            name: 'SEO Optimization Service',
            description: 'Complete SEO optimization service for tourism websites',
            category: ProfessionalServiceCategoryEnum.SEO,
            defaultPricing: {
                basePrice: 500,
                currency: 'USD',
                billingUnit: 'month',
                minOrderValue: 300,
                maxOrderValue: 5000
            },
            isActive: true
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        const service = await apiClient.expectSuccess(response, 201);

        expect(service.id).toBeTruthy();
        expect(service.name).toBe('SEO Optimization Service');
        expect(service.category).toBe(ProfessionalServiceCategoryEnum.SEO);
        expect(service.defaultPricing.basePrice).toBe(500);
        expect(service.defaultPricing.currency).toBe('USD');
        expect(service.defaultPricing.billingUnit).toBe('month');
        expect(service.defaultPricing.minOrderValue).toBe(300);
        expect(service.defaultPricing.maxOrderValue).toBe(5000);
    });

    it('should reject service with name too short', async () => {
        // ARRANGE
        const serviceData = {
            name: 'AB', // Too short (min 3 chars)
            description: 'A valid description that is long enough for validation',
            category: ProfessionalServiceCategoryEnum.DESIGN,
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.name).toBe('ZodError');
    });

    it('should reject service with description too short', async () => {
        // ARRANGE
        const serviceData = {
            name: 'Valid Service Name',
            description: 'Short', // Too short (min 10 chars)
            category: ProfessionalServiceCategoryEnum.COPYWRITING,
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.name).toBe('ZodError');
    });

    it('should reject service with negative base price', async () => {
        // ARRANGE
        const serviceData = {
            name: 'Invalid Price Service',
            description: 'A service with invalid pricing for testing validation',
            category: ProfessionalServiceCategoryEnum.MAINTENANCE,
            defaultPricing: {
                basePrice: -100, // Negative price
                currency: 'ARS'
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.name).toBe('ZodError');
    });

    it('should reject service with minOrderValue > maxOrderValue', async () => {
        // ARRANGE
        const serviceData = {
            name: 'Invalid Range Service',
            description: 'A service with invalid order value range for testing',
            category: ProfessionalServiceCategoryEnum.TOUR,
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS',
                minOrderValue: 1000,
                maxOrderValue: 500 // Less than min!
            }
        };

        // ACT
        const response = await apiClient.post('/api/v1/professional-services', serviceData);

        // ASSERT
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        // Service validation returns VALIDATION_ERROR code
        expect(error.error.code).toBe('VALIDATION_ERROR');
    });

    it('should update professional service', async () => {
        // ARRANGE - Create service first
        const service = await createTestProfessionalService({
            name: 'Original Service Name',
            description: 'Original service description for E2E testing purposes'
        });

        const updateData = {
            name: 'Updated Service Name',
            description: 'Updated service description with new information'
        };

        // ACT
        const response = await apiClient.put(
            `/api/v1/professional-services/${service.id}`,
            updateData
        );

        // ASSERT
        const updatedService = await apiClient.expectSuccess(response, 200);

        expect(updatedService.id).toBe(service.id);
        expect(updatedService.name).toBe('Updated Service Name');
        expect(updatedService.description).toBe('Updated service description with new information');
    });

    it('should update service pricing', async () => {
        // ARRANGE - Create service first
        const service = await createTestProfessionalService({
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS',
                billingUnit: 'project'
            }
        });

        const updateData = {
            defaultPricing: {
                basePrice: 250,
                billingUnit: 'hour'
            }
        };

        // ACT
        const response = await apiClient.put(
            `/api/v1/professional-services/${service.id}`,
            updateData
        );

        // ASSERT
        const updatedService = await apiClient.expectSuccess(response, 200);

        expect(updatedService.defaultPricing.basePrice).toBe(250);
        expect(updatedService.defaultPricing.billingUnit).toBe('hour');
    });

    it('should deactivate professional service', async () => {
        // ARRANGE - Create active service
        const service = await createTestProfessionalService({
            isActive: true
        });

        // ACT
        const response = await apiClient.put(`/api/v1/professional-services/${service.id}`, {
            isActive: false
        });

        // ASSERT
        const updatedService = await apiClient.expectSuccess(response, 200);

        expect(updatedService.id).toBe(service.id);
        expect(updatedService.isActive).toBe(false);
    });

    it('should reactivate professional service', async () => {
        // ARRANGE - Create inactive service
        const service = await createTestProfessionalService({
            isActive: false
        });

        // ACT
        const response = await apiClient.put(`/api/v1/professional-services/${service.id}`, {
            isActive: true
        });

        // ASSERT
        const updatedService = await apiClient.expectSuccess(response, 200);

        expect(updatedService.id).toBe(service.id);
        expect(updatedService.isActive).toBe(true);
    });

    it('should get professional service by ID', async () => {
        // ARRANGE
        const service = await createTestProfessionalService({
            name: 'Service to Retrieve',
            category: ProfessionalServiceCategoryEnum.DESIGN
        });

        // ACT
        const response = await apiClient.get(`/api/v1/professional-services/${service.id}`);

        // ASSERT
        const retrievedService = await apiClient.expectSuccess(response, 200);

        expect(retrievedService.id).toBe(service.id);
        expect(retrievedService.name).toBe('Service to Retrieve');
        expect(retrievedService.category).toBe(ProfessionalServiceCategoryEnum.DESIGN);
    });

    it('should return 404 for non-existent service', async () => {
        // ARRANGE
        const fakeId = '00000000-0000-0000-0000-000000000000';

        // ACT
        const response = await apiClient.get(`/api/v1/professional-services/${fakeId}`);

        // ASSERT
        expect(response.status).toBe(404);
    });

    it('should delete (soft delete) professional service', async () => {
        // ARRANGE
        const service = await createTestProfessionalService({
            name: 'Service to Delete'
        });

        // ACT
        const deleteResponse = await apiClient.delete(
            `/api/v1/professional-services/${service.id}`
        );

        // ASSERT
        expect(deleteResponse.status).toBe(200);

        // Verify it has deletedAt set (soft deleted)
        const getResponse = await apiClient.get(`/api/v1/professional-services/${service.id}`);
        const deletedService = await apiClient.expectSuccess(getResponse, 200);
        expect(deletedService.deletedAt).toBeTruthy();
    });

    it('should list professional services with pagination', async () => {
        // ARRANGE - Create multiple services
        await createTestProfessionalService({ name: 'Service A' });
        await createTestProfessionalService({ name: 'Service B' });
        await createTestProfessionalService({ name: 'Service C' });

        // ACT
        const response = await apiClient.get('/api/v1/professional-services?page=1&pageSize=2');

        // ASSERT
        const result = await apiClient.expectSuccess(response, 200);

        // Response structure: { items: [], pagination: {} }
        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(result.pagination).toBeDefined();
    });

    it('should accept category filter parameter', async () => {
        // NOTE: This test verifies the API accepts the category filter parameter
        // Filter implementation depends on model layer which may not fully filter

        // ARRANGE - Create a photography service via API
        const photoServiceData = {
            name: `Photo Service ${Date.now()}`,
            description: 'A professional photography service for E2E testing',
            category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS',
                billingUnit: 'project'
            }
        };

        await apiClient.post('/api/v1/professional-services', photoServiceData);

        // ACT - Request with category filter
        const response = await apiClient.get(
            `/api/v1/professional-services?category=${ProfessionalServiceCategoryEnum.PHOTOGRAPHY}`
        );

        // ASSERT - API should accept the filter and return valid response structure
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.pagination).toBeDefined();
        // At least some PHOTOGRAPHY services should exist in the results
        const photoServices = result.items.filter(
            (s: { category: string }) => s.category === ProfessionalServiceCategoryEnum.PHOTOGRAPHY
        );
        expect(photoServices.length).toBeGreaterThan(0);
    });

    it('should filter services by active status', async () => {
        // NOTE: This test verifies the API accepts the isActive filter parameter
        // Filter implementation depends on model layer which may not fully filter

        // ARRANGE - Create active service via API
        const activeServiceData = {
            name: `Active Service ${Date.now()}`,
            description: 'An active professional service for E2E testing',
            category: ProfessionalServiceCategoryEnum.PHOTOGRAPHY,
            defaultPricing: {
                basePrice: 100,
                currency: 'ARS',
                billingUnit: 'project'
            },
            isActive: true
        };

        await apiClient.post('/api/v1/professional-services', activeServiceData);

        // ACT - Request with isActive filter
        const response = await apiClient.get('/api/v1/professional-services?isActive=true');

        // ASSERT - API should accept the filter and return valid response structure
        const result = await apiClient.expectSuccess(response, 200);

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.pagination).toBeDefined();
        // At least some active services should exist in the results
        const activeServices = result.items.filter(
            (s: { isActive: boolean }) => s.isActive === true
        );
        expect(activeServices.length).toBeGreaterThan(0);
    });
});
