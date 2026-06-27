/**
 * Unit tests for SocialHashtagService.
 *
 * Covers:
 * - Hashtag normalization (lowercase + # prefix) via _beforeCreate / _beforeUpdate
 * - Permission gating (SOCIAL_HASHTAG_VIEW for reads, SOCIAL_HASHTAG_MANAGE for writes)
 * - FORBIDDEN path when actor lacks required permission
 */

import type { SocialHashtagModel } from '@repo/db';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialHashtagService } from '../../../src/services/social/social-hashtag.service';
import { normalizeHashtag } from '../../../src/services/social/social.helpers';
import { createActor } from '../../factories/actorFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_UUID = '00000000-0000-4000-8000-000000000001';

function buildMockHashtag(overrides: Record<string, unknown> = {}) {
    return {
        id: MOCK_UUID,
        hashtag: '#playa',
        normalizedHashtag: '#playa',
        category: 'nature',
        platform: undefined,
        audienceId: undefined,
        priority: 0,
        active: true,
        notes: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: MOCK_UUID,
        updatedById: MOCK_UUID,
        deletedAt: undefined,
        deletedById: undefined,
        ...overrides
    };
}

function buildCreateInput(overrides: Record<string, unknown> = {}) {
    return {
        hashtag: 'Playa',
        normalizedHashtag: '#playa',
        category: 'nature',
        priority: 0,
        active: true,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// normalizeHashtag pure-function tests
// ---------------------------------------------------------------------------

describe('normalizeHashtag (helper)', () => {
    it('should lowercase and add # prefix to a plain word', () => {
        expect(normalizeHashtag('Playa')).toBe('#playa');
    });

    it('should lowercase a tag that already has #', () => {
        expect(normalizeHashtag('#VERANO')).toBe('#verano');
    });

    it('should trim surrounding whitespace', () => {
        expect(normalizeHashtag('  #Hospeda ')).toBe('#hospeda');
    });

    it('should not double the # prefix', () => {
        expect(normalizeHashtag('#already')).toBe('#already');
    });

    it('should handle a single character', () => {
        expect(normalizeHashtag('A')).toBe('#a');
    });
});

// ---------------------------------------------------------------------------
// SocialHashtagService permission tests
// ---------------------------------------------------------------------------

describe('SocialHashtagService.create', () => {
    let service: SocialHashtagService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialHashtagService(
            { logger: loggerMock },
            modelMock as unknown as SocialHashtagModel
        );
        vi.clearAllMocks();
    });

    it('should create a hashtag when actor has SOCIAL_HASHTAG_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE] });
        const input = buildCreateInput();
        const created = buildMockHashtag();
        modelMock.create.mockResolvedValue(created);

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(modelMock.create).toHaveBeenCalled();
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_HASHTAG_MANAGE', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        const input = buildCreateInput();

        // Act
        const result = await service.create(actor, input);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(result.data).toBeUndefined();
    });

    it('should normalize the hashtag before persisting (lowercase + # prefix)', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_HASHTAG_MANAGE] });
        const input = buildCreateInput({ hashtag: 'SUMMER' });
        const created = buildMockHashtag({ hashtag: 'SUMMER', normalizedHashtag: '#summer' });
        modelMock.create.mockResolvedValue(created);

        // Act
        await service.create(actor, input);

        // Assert — the model must have been called with normalizedHashtag set
        const callArg = modelMock.create.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg?.normalizedHashtag).toBe('#summer');
    });

    it('should return UNAUTHORIZED when actor is null', async () => {
        const input = buildCreateInput();
        // @ts-expect-error purposely testing null actor
        const result = await service.create(null, input);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('UNAUTHORIZED');
    });
});

describe('SocialHashtagService.list', () => {
    let service: SocialHashtagService;
    let modelMock: ReturnType<typeof createModelMock>;
    let loggerMock: ReturnType<typeof createLoggerMock>;

    beforeEach(() => {
        modelMock = createModelMock();
        loggerMock = createLoggerMock();
        service = new SocialHashtagService(
            { logger: loggerMock },
            modelMock as unknown as SocialHashtagModel
        );
        vi.clearAllMocks();
    });

    it('should list when actor has SOCIAL_HASHTAG_VIEW', async () => {
        // Arrange
        const actor = createActor({ permissions: [PermissionEnum.SOCIAL_HASHTAG_VIEW] });
        modelMock.findAll.mockResolvedValue({ items: [buildMockHashtag()], total: 1 });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.data).toBeDefined();
        expect(result.error).toBeUndefined();
    });

    it('should return FORBIDDEN when actor lacks SOCIAL_HASHTAG_VIEW', async () => {
        // Arrange
        const actor = createActor({ permissions: [] });
        modelMock.findAll.mockResolvedValue({ items: [], total: 0 });

        // Act
        const result = await service.list(actor, {});

        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });
});
