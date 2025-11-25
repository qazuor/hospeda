import { CampaignChannelEnum, CampaignStatusEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { createMockAdminActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestClient, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

describe('E2E: Campaign Flow - Scenario 1: Complete Campaign Creation', () => {
    let app: ReturnType<typeof initApp>;
    let apiClient: E2EApiClient;
    let _transactionClient: any;

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

    it('should create campaign with minimal required fields', async () => {
        // ARRANGE
        const client = await createTestClient();

        // HTTP schema uses dot notation for nested fields
        const campaignData = {
            clientId: client.id,
            name: 'Test Campaign 2025',
            description: 'A complete test campaign for E2E testing with detailed objectives',
            status: CampaignStatusEnum.DRAFT,
            channels: [CampaignChannelEnum.SOCIAL],
            'targetAudience.countries': 'AR',
            'budget.totalBudget': 10000,
            'budget.dailyBudget': 500,
            'budget.currency': 'ARS',
            'budget.bidStrategy': 'automatic',
            'schedule.startDate': '2025-12-01T00:00:00Z',
            'schedule.endDate': '2025-12-31T23:59:59Z',
            'schedule.timezone': 'America/Argentina/Buenos_Aires',
            'content.subject': 'Discover Concepción del Uruguay',
            'content.bodyTemplate': 'Experience the beauty of our region with special offers',
            'content.callToAction': 'Book Now'
        };

        // ACT
        const response = await apiClient.post('/api/v1/campaigns', campaignData);

        // ASSERT
        const campaign = await apiClient.expectSuccess(response, 201);

        expect(campaign.id).toBeTruthy();
        expect(campaign.name).toBe('Test Campaign 2025');
        expect(campaign.status).toBe(CampaignStatusEnum.DRAFT);
        expect(campaign.clientId).toBe(client.id);
        expect(campaign.channels).toContain(CampaignChannelEnum.SOCIAL); // Use enum value
        expect(campaign.budget.totalBudget).toBe(10000);
        expect(campaign.budget.dailyBudget).toBe(500);
        expect(campaign.budget.currency).toBe('ARS');
    });

    it('should reject campaign with invalid client ID', async () => {
        // ARRANGE
        const invalidClientId = '00000000-0000-0000-0000-000000000000';

        const campaignData = {
            clientId: invalidClientId,
            name: 'Test Campaign',
            description: 'A complete test campaign for E2E testing with detailed objectives',
            status: CampaignStatusEnum.DRAFT,
            channels: [CampaignChannelEnum.SOCIAL],
            'targetAudience.countries': 'AR',
            'budget.totalBudget': 10000,
            'budget.currency': 'ARS',
            'budget.bidStrategy': 'automatic',
            'schedule.startDate': '2025-12-01T00:00:00Z',
            'schedule.timezone': 'America/Argentina/Buenos_Aires',
            'content.subject': 'Test Subject',
            'content.bodyTemplate': 'Test body template with enough characters',
            'content.callToAction': 'Click'
        };

        // ACT
        const response = await apiClient.post('/api/v1/campaigns', campaignData);

        // ASSERT - Should get 400 (foreign key violation)
        await apiClient.expectError(response, 400);
    });

    it('should reject campaign without required targeting criteria', async () => {
        // ARRANGE
        const client = await createTestClient();

        const campaignData = {
            clientId: client.id,
            name: 'Test Campaign',
            description: 'A complete test campaign for E2E testing with detailed objectives',
            status: CampaignStatusEnum.DRAFT,
            channels: [CampaignChannelEnum.SOCIAL],
            // No targeting fields - should fail validation
            'budget.totalBudget': 10000,
            'budget.currency': 'ARS',
            'budget.bidStrategy': 'automatic',
            'schedule.startDate': '2025-12-01T00:00:00Z',
            'schedule.timezone': 'America/Argentina/Buenos_Aires',
            'content.subject': 'Test Subject',
            'content.bodyTemplate': 'Test body template with enough characters',
            'content.callToAction': 'Click'
        };

        // ACT
        const response = await apiClient.post('/api/v1/campaigns', campaignData);

        // ASSERT - Should get validation error (400)
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.code).toBe('VALIDATION_ERROR');
        expect(error.error.message).toContain('Validation failed');
    });

    it('should reject campaign with daily budget exceeding total budget', async () => {
        // ARRANGE
        const client = await createTestClient();

        const campaignData = {
            clientId: client.id,
            name: 'Test Campaign',
            description: 'A complete test campaign for E2E testing with detailed objectives',
            status: CampaignStatusEnum.DRAFT,
            channels: [CampaignChannelEnum.WEB],
            'targetAudience.countries': 'AR',
            'budget.totalBudget': 1000,
            'budget.dailyBudget': 2000, // Exceeds total budget!
            'budget.currency': 'ARS',
            'budget.bidStrategy': 'automatic',
            'schedule.startDate': '2025-12-01T00:00:00Z',
            'schedule.timezone': 'America/Argentina/Buenos_Aires',
            'content.subject': 'Test Subject',
            'content.bodyTemplate': 'Test body template with enough characters',
            'content.callToAction': 'Click'
        };

        // ACT
        const response = await apiClient.post('/api/v1/campaigns', campaignData);

        // ASSERT - Should get validation error
        expect(response.status).toBe(400);
        const error = await response.json();
        expect(error.success).toBe(false);
        expect(error.error.code).toBe('VALIDATION_ERROR');
        expect(error.error.message).toContain('Validation failed');
        expect(error.error.message).toContain('budget');
    });

    it('should activate campaign (status change from DRAFT to ACTIVE)', async () => {
        // ARRANGE
        const client = await createTestClient();

        // Create campaign in DRAFT
        const campaignData = {
            clientId: client.id,
            name: 'Campaign to Activate',
            description: 'A complete test campaign for E2E testing with detailed objectives',
            status: CampaignStatusEnum.DRAFT,
            channels: [CampaignChannelEnum.SOCIAL],
            'targetAudience.countries': 'AR',
            'budget.totalBudget': 5000,
            'budget.currency': 'ARS',
            'budget.bidStrategy': 'automatic',
            'schedule.startDate': '2025-12-01T00:00:00Z',
            'schedule.timezone': 'America/Argentina/Buenos_Aires',
            'content.subject': 'Test Subject',
            'content.bodyTemplate': 'Test body template with enough characters',
            'content.callToAction': 'Click'
        };

        const createResponse = await apiClient.post('/api/v1/campaigns', campaignData);
        const campaign = await apiClient.expectSuccess(createResponse, 201);

        // ACT - Activate campaign
        const updateResponse = await apiClient.put(`/api/v1/campaigns/${campaign.id}`, {
            status: CampaignStatusEnum.ACTIVE
        });

        // ASSERT
        const updatedCampaign = await apiClient.expectSuccess(updateResponse, 200);
        expect(updatedCampaign.status).toBe(CampaignStatusEnum.ACTIVE);
    });
});
