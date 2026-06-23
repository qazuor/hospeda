/**
 * Unit tests for SocialPlatformFormatService.
 *
 * Covers:
 * - Create is FORBIDDEN (seed-only gating)
 * - Hard-delete is FORBIDDEN (seed-only gating)
 * - Soft-delete is FORBIDDEN (seed-only gating)
 * - Update succeeds with SOCIAL_PLATFORM_MANAGE
 * - Update is FORBIDDEN without SOCIAL_PLATFORM_MANAGE
 * - Read/list requires SOCIAL_PLATFORM_FORMAT_VIEW
 * - countActiveTargetsForFormat returns correct count of non-terminal targets
 * - countActiveTargetsForFormat returns 0 when all targets are in terminal states
 */

import type { SocialPlatformFormatModel, SocialPostTargetModel } from '@repo/db';
import {
    PermissionEnum,
    ServiceErrorCode,
    SocialMediaTypeEnum,
    SocialPlatformEnum,
    SocialPublishFormatEnum
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialPlatformFormatService } from '../../../src/services/social/social-platform-format.service';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_UUID = '00000000-0000-4000-8000-000000000001';

function buildMockFormat(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        platform: SocialPlatformEnum.INSTAGRAM,
        publishFormat: SocialPublishFormatEnum.FEED_POST,
        mediaType: SocialMediaTypeEnum.IMAGE,
        enabled: true,
        mvpEnabled: false,
        recommendedRatio: '1:1',
        recommendedSize: '1080x1080',
        maxCaptionLength: 2200,
        requiresPublicUrl: false,
        requiresMedia: true,
        makeChannelKey: 'instagram-feed',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: MOCK_UUID,
        updatedById: MOCK_UUID,
        deletedAt: null,
        deletedById: null,
        ...overrides
    };
}

function buildMockTarget(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        socialPostId: MOCK_UUID,
        platformFormatId: MOCK_UUID,
        platform: SocialPlatformEnum.INSTAGRAM,
        publishFormat: SocialPublishFormatEnum.FEED_POST,
        mediaType: SocialMediaTypeEnum.IMAGE,
        captionOverride: null,
        hashtagsOverrideText: null,
        footerOverride: null,
        status: 'NEEDS_REVIEW',
        scheduledAt: null,
        publishedAt: null,
        externalPostId: null,
        externalPostUrl: null,
        makeScenarioKey: null,
        makeLastRunId: null,
        makePayloadJson: null,
        lastErrorMessage: null,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SocialPlatformFormatService.create — seed-only gating', () => {
    let service: SocialPlatformFormatService;
    let formatModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        formatModelMock = createModelMock();
        targetModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialPlatformFormatService(
            { logger: loggerMock },
            formatModelMock as unknown as SocialPlatformFormatModel,
            targetModelMock as unknown as SocialPostTargetModel
        );
        vi.clearAllMocks();
    });

    it('should return FORBIDDEN when actor has SOCIAL_PLATFORM_MANAGE (create not allowed)', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_PLATFORM_MANAGE] });
        const input = {
            platform: SocialPlatformEnum.INSTAGRAM,
            publishFormat: SocialPublishFormatEnum.FEED_POST,
            mediaType: SocialMediaTypeEnum.IMAGE,
            enabled: true,
            mvpEnabled: false,
            requiresPublicUrl: false,
            requiresMedia: true
        };

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(formatModelMock.create).not.toHaveBeenCalled();
    });

    it('should return FORBIDDEN even for super-admin (create is seed-only)', async () => {
        // Arrange
        const actor = createActor({ permissions: Object.values(PermissionEnum) });
        const input = {
            platform: SocialPlatformEnum.INSTAGRAM,
            publishFormat: SocialPublishFormatEnum.FEED_POST,
            mediaType: SocialMediaTypeEnum.IMAGE,
            enabled: true,
            mvpEnabled: false,
            requiresPublicUrl: false,
            requiresMedia: true
        };

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});

describe('SocialPlatformFormatService.softDelete and hardDelete — seed-only gating', () => {
    let service: SocialPlatformFormatService;
    let formatModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        formatModelMock = createModelMock();
        targetModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialPlatformFormatService(
            { logger: loggerMock },
            formatModelMock as unknown as SocialPlatformFormatModel,
            targetModelMock as unknown as SocialPostTargetModel
        );
        vi.clearAllMocks();
    });

    it('should return FORBIDDEN on softDelete (seed-only, delete not exposed via API)', async () => {
        // Arrange
        const actor = createActor({ permissions: Object.values(PermissionEnum) });
        formatModelMock.findById.mockResolvedValue(buildMockFormat());

        // Act
        const result = await service.softDelete(actor, MOCK_UUID);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should return FORBIDDEN on hardDelete (seed-only)', async () => {
        // Arrange
        const actor = createActor({ permissions: Object.values(PermissionEnum) });
        formatModelMock.findById.mockResolvedValue(buildMockFormat());

        // Act
        const result = await service.hardDelete(actor, MOCK_UUID);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});

describe('SocialPlatformFormatService.update — permission gating', () => {
    let service: SocialPlatformFormatService;
    let formatModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        formatModelMock = createModelMock();
        targetModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialPlatformFormatService(
            { logger: loggerMock },
            formatModelMock as unknown as SocialPlatformFormatModel,
            targetModelMock as unknown as SocialPostTargetModel
        );
        vi.clearAllMocks();
    });

    it('should update when actor has SOCIAL_PLATFORM_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_PLATFORM_MANAGE] });
        const existing = buildMockFormat();
        const updated = buildMockFormat({ enabled: false });
        formatModelMock.findById.mockResolvedValue(existing);
        formatModelMock.update.mockResolvedValue(updated);

        // Act
        const result = await service.update(actor, MOCK_UUID, { enabled: false });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_PLATFORM_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        formatModelMock.findById.mockResolvedValue(buildMockFormat());

        // Act
        const result = await service.update(actor, MOCK_UUID, { enabled: false });

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(formatModelMock.update).not.toHaveBeenCalled();
    });
});

describe('SocialPlatformFormatService.list — permission gating', () => {
    let service: SocialPlatformFormatService;
    let formatModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        formatModelMock = createModelMock();
        targetModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialPlatformFormatService(
            { logger: loggerMock },
            formatModelMock as unknown as SocialPlatformFormatModel,
            targetModelMock as unknown as SocialPostTargetModel
        );
        vi.clearAllMocks();
    });

    it('should list when actor has SOCIAL_PLATFORM_FORMAT_VIEW', async () => {
        // Arrange
        const actor = createActor({
            permissions: [PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW]
        });
        formatModelMock.findAll.mockResolvedValue({ items: [buildMockFormat()], total: 1 });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data).toBeDefined();
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_PLATFORM_FORMAT_VIEW', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});

describe('SocialPlatformFormatService.countActiveTargetsForFormat', () => {
    let service: SocialPlatformFormatService;
    let formatModelMock: ReturnType<typeof createModelMock>;
    let targetModelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        formatModelMock = createModelMock();
        targetModelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialPlatformFormatService(
            { logger: loggerMock },
            formatModelMock as unknown as SocialPlatformFormatModel,
            targetModelMock as unknown as SocialPostTargetModel
        );
        vi.clearAllMocks();
    });

    it('should return 0 when there are no targets for the format', async () => {
        // Arrange
        targetModelMock.findAll.mockResolvedValue({ items: [], total: 0 });

        // Act
        const count = await service.countActiveTargetsForFormat(MOCK_UUID);

        // Assert
        expect(count).toBe(0);
    });

    it('should return count of targets with non-terminal status', async () => {
        // Arrange — 2 active targets, 1 published (terminal)
        const activeTarget1 = buildMockTarget({ status: 'NEEDS_REVIEW' });
        const activeTarget2 = buildMockTarget({ status: 'SCHEDULED' });
        const terminalTarget = buildMockTarget({ status: 'PUBLISHED' });

        // First call returns total count (probe call with pageSize 1)
        targetModelMock.findAll.mockResolvedValueOnce({ items: [activeTarget1], total: 3 });
        // Second call returns all items
        targetModelMock.findAll.mockResolvedValueOnce({
            items: [activeTarget1, activeTarget2, terminalTarget],
            total: 3
        });

        // Act
        const count = await service.countActiveTargetsForFormat(MOCK_UUID);

        // Assert
        expect(count).toBe(2);
    });

    it('should return 0 when all targets are in terminal states', async () => {
        // Arrange — all targets are PUBLISHED, FAILED, or ARCHIVED
        const published = buildMockTarget({ status: 'PUBLISHED' });
        const failed = buildMockTarget({ status: 'FAILED' });
        const archived = buildMockTarget({ status: 'ARCHIVED' });

        targetModelMock.findAll.mockResolvedValueOnce({ items: [published], total: 3 });
        targetModelMock.findAll.mockResolvedValueOnce({
            items: [published, failed, archived],
            total: 3
        });

        // Act
        const count = await service.countActiveTargetsForFormat(MOCK_UUID);

        // Assert
        expect(count).toBe(0);
    });

    it('should count DRAFT and SCHEDULED as active (non-terminal)', async () => {
        // Arrange
        const draft = buildMockTarget({ status: 'DRAFT' });
        const scheduled = buildMockTarget({ status: 'SCHEDULED' });

        targetModelMock.findAll.mockResolvedValueOnce({ items: [draft], total: 2 });
        targetModelMock.findAll.mockResolvedValueOnce({ items: [draft, scheduled], total: 2 });

        // Act
        const count = await service.countActiveTargetsForFormat(MOCK_UUID);

        // Assert
        expect(count).toBe(2);
    });
});
