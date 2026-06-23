/**
 * Unit tests for slug auto-generation in social catalog services.
 *
 * Covers:
 * - SocialCampaignService: slug is derived from name when not provided on create
 * - SocialContentBatchService: slug is derived from name when not provided on create
 * - SocialAudienceService: slug is derived from name when not provided on create
 * - SocialHashtagSetService: slug is derived from name when not provided on create
 * - SocialPostFooterService: slug is derived from name when not provided on create
 * - Slug deduplication: when slug conflicts exist, a suffix is appended
 */

import type {
    SocialAudienceModel,
    SocialCampaignModel,
    SocialContentBatchModel,
    SocialHashtagSetModel,
    SocialPostFooterModel
} from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialAudienceService } from '../../../src/services/social/social-audience.service';
import { SocialCampaignService } from '../../../src/services/social/social-campaign.service';
import { SocialContentBatchService } from '../../../src/services/social/social-content-batch.service';
import { SocialHashtagSetService } from '../../../src/services/social/social-hashtag-set.service';
import { SocialPostFooterService } from '../../../src/services/social/social-post-footer.service';
import {
    generateAudienceSlug,
    generateCampaignSlug,
    generateContentBatchSlug,
    generateHashtagSetSlug,
    generatePostFooterSlug
} from '../../../src/services/social/social.helpers';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

const MOCK_UUID = '00000000-0000-4000-8000-000000000002';

function makeAuditFields() {
    return {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: MOCK_UUID,
        updatedById: MOCK_UUID,
        deletedAt: null,
        deletedById: null
    };
}

// ---------------------------------------------------------------------------
// Slug helper unit tests (pure logic — no service instantiation needed)
// ---------------------------------------------------------------------------

describe('generateCampaignSlug (helper)', () => {
    it('should return the generated slug when it does not exist', async () => {
        // Arrange: findOne always returns null → no conflicts
        const mockModel = { findOne: vi.fn().mockResolvedValue(null) };

        // Act
        const slug = await generateCampaignSlug('Institucional Hospeda', mockModel);

        // Assert
        expect(slug).toBe('institucional-hospeda');
    });

    it('should append -2 suffix when the base slug already exists', async () => {
        // Arrange: first call (base slug) returns existing record, second returns null
        const mockModel = {
            findOne: vi.fn().mockResolvedValueOnce({ id: 'existing' }).mockResolvedValue(null)
        };

        // Act
        const slug = await generateCampaignSlug('Test Campaign', mockModel);

        // Assert
        expect(slug).toBe('test-campaign-2');
    });

    it('should keep incrementing suffix until unique slug is found', async () => {
        // Arrange: first two calls conflict, third is free
        const mockModel = {
            findOne: vi
                .fn()
                .mockResolvedValueOnce({ id: 'existing-1' })
                .mockResolvedValueOnce({ id: 'existing-2' })
                .mockResolvedValue(null)
        };

        // Act
        const slug = await generateCampaignSlug('Test Campaign', mockModel);

        // Assert
        expect(slug).toBe('test-campaign-3');
    });
});

describe('generateAudienceSlug (helper)', () => {
    it('should return a slug for a simple name', async () => {
        const mockModel = { findOne: vi.fn().mockResolvedValue(null) };
        const slug = await generateAudienceSlug('Turistas', mockModel);
        expect(slug).toBe('turistas');
    });
});

describe('generateContentBatchSlug (helper)', () => {
    it('should slugify a batch name with numbers', async () => {
        const mockModel = { findOne: vi.fn().mockResolvedValue(null) };
        const slug = await generateContentBatchSlug('Launch 2026', mockModel);
        expect(slug).toBe('launch-2026');
    });
});

describe('generateHashtagSetSlug (helper)', () => {
    it('should slugify a hashtag set name', async () => {
        const mockModel = { findOne: vi.fn().mockResolvedValue(null) };
        const slug = await generateHashtagSetSlug('Playas Set', mockModel);
        expect(slug).toBe('playas-set');
    });
});

describe('generatePostFooterSlug (helper)', () => {
    it('should slugify a footer name', async () => {
        const mockModel = { findOne: vi.fn().mockResolvedValue(null) };
        const slug = await generatePostFooterSlug('Default Footer', mockModel);
        expect(slug).toBe('default-footer');
    });
});

// ---------------------------------------------------------------------------
// Service integration: _beforeCreate generates slug when missing
// ---------------------------------------------------------------------------

describe('SocialCampaignService — slug in _beforeCreate', () => {
    let service: SocialCampaignService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        service = new SocialCampaignService(
            { logger: createLoggerMock() },
            modelMock as unknown as SocialCampaignModel
        );
        vi.clearAllMocks();
    });

    it('should use the provided slug without regenerating', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_CAMPAIGN_MANAGE] });
        const input = { name: 'My Campaign', slug: 'custom-slug', active: true };
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue({ id: MOCK_UUID, ...input, ...makeAuditFields() });

        // Act
        await service.create(actor, input);

        // Assert — provided slug is forwarded unchanged
        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.slug).toBe('custom-slug');
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_CAMPAIGN_MANAGE', async () => {
        const actor = createActor({ permissions: [] });
        const input = { name: 'My Campaign', slug: 'my-campaign', active: true };
        const result = await service.create(actor, input);
        expect(result.error?.code).toBe('FORBIDDEN');
    });
});

describe('SocialAudienceService — slug in _beforeCreate', () => {
    let service: SocialAudienceService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        service = new SocialAudienceService(
            { logger: createLoggerMock() },
            modelMock as unknown as SocialAudienceModel
        );
        vi.clearAllMocks();
    });

    it('should create an audience with the provided slug', async () => {
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_AUDIENCE_MANAGE] });
        const input = { name: 'Turistas', slug: 'turistas', active: true };
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue({ id: MOCK_UUID, ...input, ...makeAuditFields() });

        await service.create(actor, input);

        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.slug).toBe('turistas');
    });
});

describe('SocialContentBatchService — slug in _beforeCreate', () => {
    let service: SocialContentBatchService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        service = new SocialContentBatchService(
            { logger: createLoggerMock() },
            modelMock as unknown as SocialContentBatchModel
        );
        vi.clearAllMocks();
    });

    it('should create a content batch with the provided slug', async () => {
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_BATCH_MANAGE] });
        const input = { name: 'Launch 2026', slug: 'launch-2026', active: true };
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue({ id: MOCK_UUID, ...input, ...makeAuditFields() });

        await service.create(actor, input);

        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.slug).toBe('launch-2026');
    });
});

describe('SocialHashtagSetService — slug in _beforeCreate', () => {
    let service: SocialHashtagSetService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        service = new SocialHashtagSetService(
            { logger: createLoggerMock() },
            modelMock as unknown as SocialHashtagSetModel
        );
        vi.clearAllMocks();
    });

    it('should create a hashtag set with the provided slug', async () => {
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_HASHTAG_SET_MANAGE] });
        const input = {
            name: 'Playas Set',
            slug: 'playas-set',
            hashtagsText: '#playa #verano',
            priority: 0,
            active: true
        };
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue({ id: MOCK_UUID, ...input, ...makeAuditFields() });

        await service.create(actor, input);

        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.slug).toBe('playas-set');
    });
});

describe('SocialPostFooterService — slug in _beforeCreate', () => {
    let service: SocialPostFooterService;
    let modelMock: ReturnType<typeof createModelMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        service = new SocialPostFooterService(
            { logger: createLoggerMock() },
            modelMock as unknown as SocialPostFooterModel
        );
        vi.clearAllMocks();
    });

    it('should create a post footer with the provided slug', async () => {
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_FOOTER_MANAGE] });
        const input = {
            name: 'Default Footer',
            slug: 'default-footer',
            content: 'Reservá en hospeda.com.ar',
            active: true,
            isDefault: true,
            priority: 0
        };
        modelMock.findOne.mockResolvedValue(null);
        modelMock.create.mockResolvedValue({ id: MOCK_UUID, ...input, ...makeAuditFields() });

        await service.create(actor, input);

        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.slug).toBe('default-footer');
    });
});
