/**
 * @file social-publish-dispatch.service.test.ts
 *
 * Unit tests for SocialPublishDispatchService — SPEC-254 T-044 + T-045.
 *
 * Covers:
 *
 * findEligibleTargets:
 *  - Returns an eligible target (happy path).
 *  - Excludes target when post.approvalStatus !== APPROVED.
 *  - Excludes target when post.status is not READY_TO_PUBLISH or SCHEDULED.
 *  - Excludes target when post.status = SCHEDULED but nextRunAt is in the future.
 *  - Excludes target when post.paused = true.
 *  - Excludes target when post.deletedAt is set (soft-deleted).
 *  - Excludes target when target.status = PUBLISHED.
 *  - Excludes target when target.status = FAILED.
 *  - Excludes target when target.status = PUBLISHING.
 *  - Excludes target when post has zero media rows.
 *
 * buildMakePayload:
 *  - Returns the exact payload shape (all fields present).
 *  - callbackClaimUrl and callbackResultUrl are correctly composed from apiBaseUrl + targetId.
 *  - mediaUrls is populated from asset cloudinaryUrls.
 *  - makeChannelKey and platform come from the platform-format row.
 *  - captionFinal falls back to captionBase when finalCaption is null.
 *  - footerFinal resolves footer content from the footer row.
 *  - footerFinal is '' when post.footerId is null.
 *
 * dispatchTarget:
 *  - success 2xx → target PUBLISHING, publish_log RETRYING inserted, post PUBLISHING,
 *    outcome 'dispatched'.
 *  - empty/missing webhook → outcome 'skipped_no_webhook', no fetch call, no status change.
 *  - failure (non-2xx) with retryCount 0 → retryCount incremented to 1, target reset
 *    to APPROVED, publish_log FAILED, outcome 'retry_scheduled'.
 *  - network error (fetch throws) with retryCount 1 → retry path.
 *  - failure with retryCount already 3 → target FAILED, audit TARGET_DISPATCH_FAILED_EXHAUSTED
 *    called, and post set FAILED when all siblings terminal; post NOT set FAILED when a
 *    sibling is still PUBLISHING.
 *  - x-make-apikey header is sent and the payload is the body.
 *
 * SPEC-254 T-044 / T-045.
 */

import type {
    SocialAssetModel,
    SocialPlatformFormatModel,
    SocialPostFooterModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel,
    SocialPublishLogModel,
    SocialSettingModel
} from '@repo/db';
import {
    SocialPostStatusEnum,
    SocialPublishResultStatusEnum,
    SocialRecurrenceTypeEnum
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialAuditEvent } from '../../../src/services/social/social-audit-log.service';
import type {
    BuildMakePayloadInput,
    CascadePostStatusResult,
    RearmRecurrenceResult
} from '../../../src/services/social/social-publish-dispatch.service';
import { SocialPublishDispatchService } from '../../../src/services/social/social-publish-dispatch.service';
import { createModelMock } from '../../utils/modelMockFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// UUID fixtures
// ---------------------------------------------------------------------------

const TARGET_ID = '00000000-0000-4000-8000-000000000001';
const TARGET_ID_2 = '00000000-0000-4000-8000-000000000007';
const POST_ID = '00000000-0000-4000-8000-000000000002';
const PLATFORM_FORMAT_ID = '00000000-0000-4000-8000-000000000003';
const FOOTER_ID = '00000000-0000-4000-8000-000000000004';
const ASSET_ID_1 = '00000000-0000-4000-8000-000000000005';
const ASSET_ID_2 = '00000000-0000-4000-8000-000000000006';
const API_BASE_URL = 'https://api.hospeda.com.ar';
const WEBHOOK_URL = 'https://hook.make.com/abc123';
const MAKE_API_KEY = 'test-make-api-key';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Builds a minimal target row that passes all target-level eligibility checks.
 */
function buildTarget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: TARGET_ID,
        socialPostId: POST_ID,
        platformFormatId: PLATFORM_FORMAT_ID,
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        status: SocialPostStatusEnum.APPROVED,
        retryCount: 0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        ...overrides
    };
}

/**
 * Builds a minimal post row that passes all post-level eligibility checks.
 * Uses READY_TO_PUBLISH by default (no nextRunAt needed).
 */
function buildPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: POST_ID,
        title: 'Test Post',
        slug: 'test-post',
        status: SocialPostStatusEnum.READY_TO_PUBLISH,
        approvalStatus: 'APPROVED',
        paused: false,
        deletedAt: null,
        nextRunAt: null,
        captionBase: 'Base caption text',
        finalCaption: 'Final caption text',
        finalHashtagsText: '#hashtag1 #hashtag2',
        footerId: null,
        timezone: 'America/Argentina/Buenos_Aires',
        scheduledAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        ...overrides
    };
}

/**
 * Builds a minimal platform-format row.
 */
function buildPlatformFormat(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: PLATFORM_FORMAT_ID,
        platform: 'INSTAGRAM',
        publishFormat: 'FEED_POST',
        makeChannelKey: 'instagram-feed',
        enabled: true,
        ...overrides
    };
}

/**
 * Builds a minimal media row referencing an asset.
 */
function buildMediaRow(assetId: string, position: number): Record<string, unknown> {
    return {
        id: `media-${position}`,
        socialPostId: POST_ID,
        assetId,
        position,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a minimal asset row with a cloudinaryUrl.
 */
function buildAsset(id: string, cloudinaryUrl: string): Record<string, unknown> {
    return {
        id,
        cloudinaryUrl,
        cloudinaryPublicId: `public-id-${id}`,
        mediaType: 'IMAGE',
        source: 'CLOUDINARY',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a minimal social_settings row for `make_webhook_url`.
 */
function buildWebhookSetting(value: string): Record<string, unknown> {
    return {
        id: '00000000-0000-4000-8000-000000000099',
        key: 'make_webhook_url',
        value,
        type: 'string',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
    };
}

/**
 * Builds a minimal Response-like object for mocking fetch.
 */
function buildFetchResponse(status: number, ok: boolean): Response {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Bad Request',
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: WEBHOOK_URL,
        body: null,
        bodyUsed: false,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        clone: function () {
            return this;
        }
    } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Mocks type
// ---------------------------------------------------------------------------

type Mocks = {
    postModel: StandardModelMock;
    targetModel: StandardModelMock;
    postMediaModel: StandardModelMock;
    platformFormatModel: StandardModelMock;
    footerModel: StandardModelMock;
    assetModel: StandardModelMock;
    publishLogModel: StandardModelMock;
    settingModel: StandardModelMock;
    auditLogMock: SocialAuditLogService;
};

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function buildService(): { service: SocialPublishDispatchService; mocks: Mocks } {
    const postModel = createModelMock();
    const targetModel = createModelMock();
    const postMediaModel = createModelMock();
    const platformFormatModel = createModelMock();
    const footerModel = createModelMock();
    const assetModel = createModelMock();
    const publishLogModel = createModelMock();
    const settingModel = createModelMock();

    const auditLogMock = {
        log: vi.fn().mockResolvedValue({ logged: true }),
        list: vi.fn()
    } as unknown as SocialAuditLogService;

    const service = new SocialPublishDispatchService(
        { logger: undefined },
        postModel as unknown as SocialPostModel,
        targetModel as unknown as SocialPostTargetModel,
        postMediaModel as unknown as SocialPostMediaModel,
        platformFormatModel as unknown as SocialPlatformFormatModel,
        footerModel as unknown as SocialPostFooterModel,
        assetModel as unknown as SocialAssetModel,
        publishLogModel as unknown as SocialPublishLogModel,
        settingModel as unknown as SocialSettingModel,
        auditLogMock
    );

    return {
        service,
        mocks: {
            postModel,
            targetModel,
            postMediaModel,
            platformFormatModel,
            footerModel,
            assetModel,
            publishLogModel,
            settingModel,
            auditLogMock
        }
    };
}

// ---------------------------------------------------------------------------
// findEligibleTargets
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.findEligibleTargets — SPEC-254 T-044', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;
    });

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('happy path', () => {
        it('returns an eligible target bundle when all conditions pass (READY_TO_PUBLISH)', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost();
            mocks.targetModel.findAll.mockResolvedValue({ items: [target], total: 1 });
            mocks.postModel.findOne.mockResolvedValue(post);
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(1);
            expect(targets[0]?.target).toBe(target);
            expect(targets[0]?.post).toBe(post);
        });

        it('returns an eligible SCHEDULED target when nextRunAt <= now', async () => {
            // Arrange
            const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
            const target = buildTarget();
            const post = buildPost({
                status: SocialPostStatusEnum.SCHEDULED,
                nextRunAt: pastDate
            });
            mocks.targetModel.findAll.mockResolvedValue({ items: [target], total: 1 });
            mocks.postModel.findOne.mockResolvedValue(post);
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(1);
        });

        it('returns empty array when targetModel returns no candidates', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Post-level exclusion conditions
    // -------------------------------------------------------------------------

    describe('post-level exclusions', () => {
        beforeEach(() => {
            // Default: target always passes its own status check
            mocks.targetModel.findAll.mockResolvedValue({
                items: [buildTarget()],
                total: 1
            });
            // Default: one media row so media check passes when post passes
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });
        });

        it('excludes target when post.approvalStatus !== APPROVED', async () => {
            // Arrange
            mocks.postModel.findOne.mockResolvedValue(buildPost({ approvalStatus: 'PENDING' }));

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when post.status is not READY_TO_PUBLISH or SCHEDULED', async () => {
            // Arrange
            mocks.postModel.findOne.mockResolvedValue(
                buildPost({ status: SocialPostStatusEnum.APPROVED })
            );

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes SCHEDULED target when nextRunAt is in the future', async () => {
            // Arrange
            const futureDate = new Date(Date.now() + 600_000); // 10 minutes from now
            mocks.postModel.findOne.mockResolvedValue(
                buildPost({
                    status: SocialPostStatusEnum.SCHEDULED,
                    nextRunAt: futureDate
                })
            );

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when post.paused = true', async () => {
            // Arrange
            mocks.postModel.findOne.mockResolvedValue(buildPost({ paused: true }));

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when post is soft-deleted (findOne returns null)', async () => {
            // Arrange
            // The model is set up with deletedAt: null in where clause,
            // so a soft-deleted post would return null from findOne.
            mocks.postModel.findOne.mockResolvedValue(null);

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when post has zero media rows', async () => {
            // Arrange
            mocks.postModel.findOne.mockResolvedValue(buildPost());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });
    });

    // -------------------------------------------------------------------------
    // Target-level exclusion conditions (terminal statuses)
    // -------------------------------------------------------------------------

    describe('target-level exclusions (terminal status)', () => {
        beforeEach(() => {
            mocks.postModel.findOne.mockResolvedValue(buildPost());
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });
        });

        it('excludes target when target.status = PUBLISHED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [buildTarget({ status: SocialPostStatusEnum.PUBLISHED })],
                total: 1
            });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when target.status = FAILED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [buildTarget({ status: SocialPostStatusEnum.FAILED })],
                total: 1
            });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });

        it('excludes target when target.status = PUBLISHING', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [buildTarget({ status: SocialPostStatusEnum.PUBLISHING })],
                total: 1
            });

            // Act
            const { targets } = await service.findEligibleTargets();

            // Assert
            expect(targets).toHaveLength(0);
        });
    });
});

// ---------------------------------------------------------------------------
// buildMakePayload
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.buildMakePayload — SPEC-254 T-044', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;
    });

    function buildMinimalInput(
        targetOverrides: Record<string, unknown> = {},
        postOverrides: Record<string, unknown> = {}
    ): BuildMakePayloadInput {
        return {
            target: buildTarget(targetOverrides),
            post: buildPost(postOverrides),
            apiBaseUrl: API_BASE_URL
        };
    }

    // -------------------------------------------------------------------------
    // Happy path — full shape
    // -------------------------------------------------------------------------

    describe('happy path', () => {
        it('returns the exact payload shape with all fields present', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });
            mocks.assetModel.findOne.mockResolvedValue(
                buildAsset(ASSET_ID_1, 'https://res.cloudinary.com/demo/image/upload/sample.jpg')
            );

            const input = buildMinimalInput();

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert — required keys
            expect(payload).toHaveProperty('targetId');
            expect(payload).toHaveProperty('postId');
            expect(payload).toHaveProperty('platform');
            expect(payload).toHaveProperty('publishFormat');
            expect(payload).toHaveProperty('makeChannelKey');
            expect(payload).toHaveProperty('captionFinal');
            expect(payload).toHaveProperty('hashtagsFinal');
            expect(payload).toHaveProperty('footerFinal');
            expect(payload).toHaveProperty('mediaUrls');
            expect(payload).toHaveProperty('scheduledAt');
            expect(payload).toHaveProperty('timezone');
            expect(payload).toHaveProperty('callbackClaimUrl');
            expect(payload).toHaveProperty('callbackResultUrl');
        });

        it('sets correct targetId and postId in the payload', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput();

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.targetId).toBe(TARGET_ID);
            expect(payload.postId).toBe(POST_ID);
        });
    });

    // -------------------------------------------------------------------------
    // Callback URL composition
    // -------------------------------------------------------------------------

    describe('callback URL composition', () => {
        it('composes callbackClaimUrl from apiBaseUrl and targetId', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput();

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.callbackClaimUrl).toBe(
                `${API_BASE_URL}/api/v1/integrations/make/social/jobs/${TARGET_ID}/claim`
            );
        });

        it('composes callbackResultUrl from apiBaseUrl and targetId', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput();

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.callbackResultUrl).toBe(
                `${API_BASE_URL}/api/v1/integrations/make/social/jobs/${TARGET_ID}/result`
            );
        });

        it('correctly uses a different targetId in callback URLs', async () => {
            // Arrange
            const differentTargetId = '99999999-0000-4000-8000-000000000099';
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({ id: differentTargetId });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.callbackClaimUrl).toContain(differentTargetId);
            expect(payload.callbackResultUrl).toContain(differentTargetId);
        });
    });

    // -------------------------------------------------------------------------
    // Platform-format resolution
    // -------------------------------------------------------------------------

    describe('platform-format resolution', () => {
        it('reads platform and makeChannelKey from the platform-format row', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(
                buildPlatformFormat({ platform: 'FACEBOOK', makeChannelKey: 'facebook-page' })
            );
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({ platform: 'INSTAGRAM' }); // target.platform overridden below

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert — platform-format values win over target.platform
            expect(payload.platform).toBe('FACEBOOK');
            expect(payload.makeChannelKey).toBe('facebook-page');
        });

        it('sets makeChannelKey to null when platform-format has no channel key', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(
                buildPlatformFormat({ makeChannelKey: null })
            );
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const { payload } = await service.buildMakePayload(buildMinimalInput());

            // Assert
            expect(payload.makeChannelKey).toBeNull();
        });

        it('reads publishFormat from target row', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({ publishFormat: 'REEL' });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.publishFormat).toBe('REEL');
        });
    });

    // -------------------------------------------------------------------------
    // Caption / hashtags
    // -------------------------------------------------------------------------

    describe('caption and hashtags', () => {
        it('uses finalCaption when present', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput(
                {},
                { finalCaption: 'My final caption', captionBase: 'Base text' }
            );

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.captionFinal).toBe('My final caption');
        });

        it('falls back to captionBase when finalCaption is null', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput(
                {},
                { finalCaption: null, captionBase: 'Only base caption' }
            );

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.captionFinal).toBe('Only base caption');
        });

        it('sets hashtagsFinal from finalHashtagsText', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { finalHashtagsText: '#travel #argentina' });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.hashtagsFinal).toBe('#travel #argentina');
        });

        it('sets hashtagsFinal to empty string when finalHashtagsText is null', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { finalHashtagsText: null });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.hashtagsFinal).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // Footer resolution
    // -------------------------------------------------------------------------

    describe('footer resolution', () => {
        it('resolves footer content from the footer row when footerId is set', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
            mocks.footerModel.findOne.mockResolvedValue({
                id: FOOTER_ID,
                content: 'Reservá en hospeda.com.ar 🏡',
                active: true
            });

            const input = buildMinimalInput({}, { footerId: FOOTER_ID });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.footerFinal).toBe('Reservá en hospeda.com.ar 🏡');
            expect(mocks.footerModel.findOne).toHaveBeenCalledWith({ id: FOOTER_ID });
        });

        it('sets footerFinal to empty string when footerId is null', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { footerId: null });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.footerFinal).toBe('');
            expect(mocks.footerModel.findOne).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Media URL resolution
    // -------------------------------------------------------------------------

    describe('mediaUrls resolution', () => {
        it('populates mediaUrls with Cloudinary URLs from assets in position order', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0), buildMediaRow(ASSET_ID_2, 1)],
                total: 2
            });
            mocks.assetModel.findOne
                .mockResolvedValueOnce(
                    buildAsset(ASSET_ID_1, 'https://res.cloudinary.com/demo/image/1.jpg')
                )
                .mockResolvedValueOnce(
                    buildAsset(ASSET_ID_2, 'https://res.cloudinary.com/demo/image/2.jpg')
                );

            // Act
            const { payload } = await service.buildMakePayload(buildMinimalInput());

            // Assert
            expect(payload.mediaUrls).toEqual([
                'https://res.cloudinary.com/demo/image/1.jpg',
                'https://res.cloudinary.com/demo/image/2.jpg'
            ]);
        });

        it('excludes media rows whose asset has a null cloudinaryUrl', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({
                items: [buildMediaRow(ASSET_ID_1, 0)],
                total: 1
            });
            mocks.assetModel.findOne.mockResolvedValue(
                buildAsset(ASSET_ID_1, null as unknown as string) // asset with no cloudinaryUrl
            );

            // Act
            const { payload } = await service.buildMakePayload(buildMinimalInput());

            // Assert
            expect(payload.mediaUrls).toHaveLength(0);
        });

        it('sets mediaUrls to empty array when post has no media rows', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            // Act
            const { payload } = await service.buildMakePayload(buildMinimalInput());

            // Assert
            expect(payload.mediaUrls).toEqual([]);
        });
    });

    // -------------------------------------------------------------------------
    // Scheduling fields
    // -------------------------------------------------------------------------

    describe('scheduling fields', () => {
        it('passes scheduledAt from the post row', async () => {
            // Arrange
            const scheduledAt = new Date('2024-06-15T10:00:00Z');
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { scheduledAt });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.scheduledAt).toEqual(scheduledAt);
        });

        it('sets scheduledAt to null when post has no scheduledAt', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { scheduledAt: null });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.scheduledAt).toBeNull();
        });

        it('passes timezone from the post row', async () => {
            // Arrange
            mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
            mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });

            const input = buildMinimalInput({}, { timezone: 'UTC' });

            // Act
            const { payload } = await service.buildMakePayload(input);

            // Assert
            expect(payload.timezone).toBe('UTC');
        });
    });
});

// ---------------------------------------------------------------------------
// dispatchTarget — SPEC-254 T-045
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.dispatchTarget — SPEC-254 T-045', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;

        // Default: platform-format for buildMakePayload calls
        mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
        // Default: no media rows (payload assembly still works)
        mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
        // Default: update always succeeds (returns some row count)
        mocks.targetModel.update.mockResolvedValue({ rowCount: 1 });
        mocks.postModel.update.mockResolvedValue({ rowCount: 1 });
        // Default: publishLog create succeeds
        mocks.publishLogModel.create.mockResolvedValue({ id: 'log-id' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // skipped_no_webhook
    // -------------------------------------------------------------------------

    describe('skipped_no_webhook', () => {
        it('returns skipped_no_webhook when make_webhook_url setting is missing (returns null)', async () => {
            // Arrange
            mocks.settingModel.findOne.mockResolvedValue(null);
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            // Act
            const result = await service.dispatchTarget({
                target: buildTarget(),
                post: buildPost(),
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL
            });

            // Assert
            expect(result.outcome).toBe('skipped_no_webhook');
            expect(fetchSpy).not.toHaveBeenCalled();
            // Target status must NOT be changed
            expect(mocks.targetModel.update).not.toHaveBeenCalled();
        });

        it('returns skipped_no_webhook when make_webhook_url setting value is empty string', async () => {
            // Arrange
            mocks.settingModel.findOne.mockResolvedValue(buildWebhookSetting(''));
            const fetchSpy = vi.spyOn(globalThis, 'fetch');

            // Act
            const result = await service.dispatchTarget({
                target: buildTarget(),
                post: buildPost(),
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL
            });

            // Assert
            expect(result.outcome).toBe('skipped_no_webhook');
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(mocks.targetModel.update).not.toHaveBeenCalled();
        });

        it('uses the webhookUrl override param directly and does NOT query settings', async () => {
            // Arrange — webhook override provided; no settings query needed
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(200, true));

            // Act
            const result = await service.dispatchTarget({
                target: buildTarget(),
                post: buildPost(),
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert — dispatched without touching settingModel
            expect(result.outcome).toBe('dispatched');
            expect(mocks.settingModel.findOne).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Success path (2xx)
    // -------------------------------------------------------------------------

    describe('success path (2xx)', () => {
        beforeEach(() => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(200, true));
        });

        it('returns dispatched on HTTP 200', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost();

            // Act
            const result = await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(result.outcome).toBe('dispatched');
        });

        it('sets target status to PUBLISHING (optimistic lock) before HTTP call', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: first update should be to PUBLISHING
            const firstUpdateCall =
                (mocks.targetModel.update as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
            expect(firstUpdateCall[1]).toMatchObject({ status: SocialPostStatusEnum.PUBLISHING });
        });

        it('inserts a publish_log row with status RETRYING on success', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(mocks.publishLogModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: SocialPublishResultStatusEnum.RETRYING,
                    socialPostId: POST_ID,
                    socialPostTargetId: TARGET_ID
                })
            );
        });

        it('sets post status to PUBLISHING when post is not already PUBLISHING', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost({ status: SocialPostStatusEnum.READY_TO_PUBLISH });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: postModel.update called with PUBLISHING status
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.PUBLISHING }
            );
        });

        it('does NOT update post status when post is already PUBLISHING', async () => {
            // Arrange
            const target = buildTarget();
            const post = buildPost({ status: SocialPostStatusEnum.PUBLISHING });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: postModel.update should NOT be called
            expect(mocks.postModel.update).not.toHaveBeenCalled();
        });

        it('sends x-make-apikey header and the payload as JSON body', async () => {
            // Arrange
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockResolvedValue(buildFetchResponse(200, true));
            const target = buildTarget();
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert headers
            const fetchCall = fetchSpy.mock.calls[0] ?? [];
            const fetchOptions = fetchCall[1] as RequestInit | undefined;
            const headers = fetchOptions?.headers as Record<string, string> | undefined;
            expect(headers?.['x-make-apikey']).toBe(MAKE_API_KEY);
            expect(headers?.['content-type']).toBe('application/json');

            // Assert body contains the payload
            const body = fetchOptions?.body as string | undefined;
            expect(typeof body).toBe('string');
            const parsed = JSON.parse(body ?? '{}') as Record<string, unknown>;
            expect(parsed.targetId).toBe(TARGET_ID);
            expect(parsed.postId).toBe(POST_ID);
        });

        it('POSTs to the correct webhook URL', async () => {
            // Arrange
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockResolvedValue(buildFetchResponse(200, true));

            // Act
            await service.dispatchTarget({
                target: buildTarget(),
                post: buildPost(),
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(fetchSpy).toHaveBeenCalledWith(
                WEBHOOK_URL,
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Retry path (non-2xx failure, retryCount < 3)
    // -------------------------------------------------------------------------

    describe('retry path (non-2xx, retryCount < 3)', () => {
        it('returns retry_scheduled with retryCount=1 on first failure (retryCount=0)', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
            const target = buildTarget({ retryCount: 0 });
            const post = buildPost();

            // Act
            const result = await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(result.outcome).toBe('retry_scheduled');
            expect(result.retryCount).toBe(1);
        });

        it('resets target status back to APPROVED on non-2xx failure', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
            const target = buildTarget({ retryCount: 0 });
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: last update on targetModel should reset to APPROVED
            const updateCalls = (mocks.targetModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const lastCall = updateCalls[updateCalls.length - 1] ?? [];
            expect(lastCall[1]).toMatchObject({
                status: SocialPostStatusEnum.APPROVED,
                retryCount: 1
            });
        });

        it('inserts a publish_log row with status FAILED on non-2xx failure', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
            const target = buildTarget({ retryCount: 0 });
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(mocks.publishLogModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: SocialPublishResultStatusEnum.FAILED,
                    socialPostId: POST_ID,
                    socialPostTargetId: TARGET_ID
                })
            );
        });

        it('handles network error (fetch throws) as a retry-able failure (retryCount=1)', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network timeout'));
            const target = buildTarget({ retryCount: 1 });
            const post = buildPost();

            // Act
            const result = await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(result.outcome).toBe('retry_scheduled');
            expect(result.retryCount).toBe(2);
        });

        it('includes the error message in the publish_log row on network failure', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
            const target = buildTarget({ retryCount: 0 });
            const post = buildPost();

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(mocks.publishLogModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'ECONNREFUSED'
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Exhaustion path (retryCount >= 3)
    // -------------------------------------------------------------------------

    describe('exhaustion path (retryCount >= 3)', () => {
        it('returns exhausted when retryCount is already 3 at failure time', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ retryCount: 3 });
            const post = buildPost();
            // All siblings are already terminal (just this one target)
            mocks.targetModel.findAll.mockResolvedValue({
                items: [{ ...buildTarget({ retryCount: 3 }), status: SocialPostStatusEnum.FAILED }],
                total: 1
            });

            // Act
            const result = await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(result.outcome).toBe('exhausted');
        });

        it('sets target status to FAILED on exhaustion', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ retryCount: 3 });
            const post = buildPost();
            mocks.targetModel.findAll.mockResolvedValue({
                items: [{ ...buildTarget({ retryCount: 3 }), status: SocialPostStatusEnum.FAILED }],
                total: 1
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: targetModel.update called with FAILED status
            const updateCalls = (mocks.targetModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const failedUpdate = updateCalls.find(
                (call) =>
                    (call[1] as Record<string, unknown>)?.status === SocialPostStatusEnum.FAILED
            );
            expect(failedUpdate).toBeDefined();
        });

        it('calls audit log TARGET_DISPATCH_FAILED_EXHAUSTED on exhaustion', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ retryCount: 3 });
            const post = buildPost();
            mocks.targetModel.findAll.mockResolvedValue({
                items: [{ ...buildTarget({ retryCount: 3 }), status: SocialPostStatusEnum.FAILED }],
                total: 1
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(mocks.auditLogMock.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: SocialAuditEvent.TARGET_DISPATCH_FAILED_EXHAUSTED,
                    entityType: 'social_post_target',
                    entityId: TARGET_ID,
                    metadata: expect.objectContaining({
                        postId: POST_ID,
                        retryCount: 3
                    })
                })
            );
        });

        it('sets post status to FAILED when all siblings are terminal (all FAILED)', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ id: TARGET_ID, retryCount: 3 });
            const post = buildPost();

            // All targets for this post: just the exhausted one (already FAILED in DB)
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 1
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: post was set to FAILED
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.FAILED }
            );
        });

        it('sets post status to FAILED when all siblings are terminal (one PUBLISHED, one FAILED)', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ id: TARGET_ID, retryCount: 3 });
            const post = buildPost();

            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    }
                ],
                total: 2
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: post was set to FAILED (PUBLISHED counts as terminal per owner decision)
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.FAILED }
            );
        });

        it('does NOT set post to FAILED when a sibling is still in PUBLISHING state', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ id: TARGET_ID, retryCount: 3 });
            const post = buildPost();

            // One sibling is still PUBLISHING (not terminal)
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHING
                    }
                ],
                total: 2
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: postModel.update should NOT have been called with FAILED
            const postUpdateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const failedUpdate = postUpdateCalls.find(
                (call) =>
                    (call[1] as Record<string, unknown>)?.status === SocialPostStatusEnum.FAILED
            );
            expect(failedUpdate).toBeUndefined();
        });

        it('does NOT set post to FAILED when a sibling is still in APPROVED state', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ id: TARGET_ID, retryCount: 3 });
            const post = buildPost();

            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.APPROVED
                    }
                ],
                total: 2
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert: postModel.update NOT called with FAILED
            const postUpdateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const failedUpdate = postUpdateCalls.find(
                (call) =>
                    (call[1] as Record<string, unknown>)?.status === SocialPostStatusEnum.FAILED
            );
            expect(failedUpdate).toBeUndefined();
        });

        it('inserts a publish_log row with status FAILED on exhaustion', async () => {
            // Arrange
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
            const target = buildTarget({ retryCount: 3 });
            const post = buildPost();
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 1
            });

            // Act
            await service.dispatchTarget({
                target,
                post,
                makeApiKey: MAKE_API_KEY,
                apiBaseUrl: API_BASE_URL,
                webhookUrl: WEBHOOK_URL
            });

            // Assert
            expect(mocks.publishLogModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: SocialPublishResultStatusEnum.FAILED,
                    socialPostId: POST_ID,
                    socialPostTargetId: TARGET_ID
                })
            );
        });
    });
});

// ---------------------------------------------------------------------------
// Additional UUIDs for T-046 tests
// ---------------------------------------------------------------------------

const TARGET_ID_3 = '00000000-0000-4000-8000-000000000008';

// ---------------------------------------------------------------------------
// cascadePostStatus — SPEC-254 T-046
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.cascadePostStatus — SPEC-254 T-046', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;

        // Default: postModel.update and targetModel.update succeed
        mocks.postModel.update.mockResolvedValue({ id: POST_ID });
        mocks.targetModel.update.mockResolvedValue({ rowCount: 1 });
        // Default: no targets (overridden per test)
        mocks.targetModel.findAll.mockResolvedValue({ items: [], total: 0 });
        // Default: post for reload in cascadePostStatus (ONCE, no recurrence)
        mocks.postModel.findOne.mockResolvedValue(
            buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.ONCE,
                status: SocialPostStatusEnum.PUBLISHED
            })
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // not_all_terminal — returns early without changes
    // -------------------------------------------------------------------------

    describe('not_all_terminal — at least one target is non-terminal', () => {
        it('returns not_all_terminal when one target is still APPROVED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.APPROVED
                    }
                ],
                total: 2
            });

            // Act
            const result: CascadePostStatusResult = await service.cascadePostStatus({
                postId: POST_ID
            });

            // Assert
            expect(result.outcome).toBe('not_all_terminal');
            expect(mocks.postModel.update).not.toHaveBeenCalled();
        });

        it('returns not_all_terminal when one target is PUBLISHING', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHING
                    }
                ],
                total: 2
            });

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.outcome).toBe('not_all_terminal');
            expect(mocks.postModel.update).not.toHaveBeenCalled();
        });

        it('returns not_all_terminal when one target is READY_TO_PUBLISH', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.READY_TO_PUBLISH
                    }
                ],
                total: 2
            });

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.outcome).toBe('not_all_terminal');
        });
    });

    // -------------------------------------------------------------------------
    // post_published — all terminal, at least one PUBLISHED
    // -------------------------------------------------------------------------

    describe('post_published — all terminal, at least one PUBLISHED', () => {
        it('sets post status to PUBLISHED and returns post_published when all targets are PUBLISHED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    }
                ],
                total: 2
            });

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.outcome).toBe('post_published');
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.PUBLISHED }
            );
        });

        it('returns post_published when targets are mixed PUBLISHED+FAILED (at least one PUBLISHED)', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    { id: TARGET_ID_2, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 2
            });

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.outcome).toBe('post_published');
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.PUBLISHED }
            );
        });

        it('calls rearmRecurrence (postModel.findOne then update) after setting PUBLISHED', async () => {
            // Arrange — ONCE post (rearm sets next_run_at = null)
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.PUBLISHED }
                ],
                total: 1
            });
            mocks.postModel.findOne.mockResolvedValue(
                buildPost({
                    recurrenceType: SocialRecurrenceTypeEnum.ONCE,
                    status: SocialPostStatusEnum.PUBLISHED
                })
            );

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert: rearm was invoked (postModel.findOne called for reload)
            expect(result.outcome).toBe('post_published');
            expect(mocks.postModel.findOne).toHaveBeenCalledWith({ id: POST_ID });
        });

        it('returns nextRunAt = null for a ONCE post after cascade', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.PUBLISHED }
                ],
                total: 1
            });
            mocks.postModel.findOne.mockResolvedValue(
                buildPost({ recurrenceType: SocialRecurrenceTypeEnum.ONCE })
            );

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.nextRunAt).toBeNull();
        });

        it('returns a future nextRunAt for a BIWEEKLY post after cascade', async () => {
            // Arrange
            const _now = new Date('2024-03-01T10:00:00Z');
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.PUBLISHED }
                ],
                total: 1
            });
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY,
                timezone: 'UTC'
            });
            mocks.postModel.findOne.mockResolvedValue(post);
            // Targets for the rearm reset
            mocks.targetModel.findAll
                .mockResolvedValueOnce({
                    items: [
                        {
                            id: TARGET_ID,
                            socialPostId: POST_ID,
                            status: SocialPostStatusEnum.PUBLISHED
                        }
                    ],
                    total: 1
                })
                .mockResolvedValue({
                    items: [
                        {
                            id: TARGET_ID,
                            socialPostId: POST_ID,
                            status: SocialPostStatusEnum.PUBLISHED
                        }
                    ],
                    total: 1
                });

            // We need to pass now via rearmRecurrence directly, but cascadePostStatus
            // calls it internally. We test via the final postModel.update call.
            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert: a future date was set
            expect(result.outcome).toBe('post_published');
            expect(result.nextRunAt).toBeInstanceOf(Date);
            if (result.nextRunAt) {
                expect(result.nextRunAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
            }
        });
    });

    // -------------------------------------------------------------------------
    // post_failed — all targets are FAILED
    // -------------------------------------------------------------------------

    describe('post_failed — all targets are FAILED', () => {
        it('sets post status to FAILED and next_run_at to null when all targets are FAILED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED },
                    { id: TARGET_ID_2, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 2
            });

            // Act
            const result = await service.cascadePostStatus({ postId: POST_ID });

            // Assert
            expect(result.outcome).toBe('post_failed');
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { status: SocialPostStatusEnum.FAILED, nextRunAt: null }
            );
        });

        it('does NOT reset any targets when all targets are FAILED', async () => {
            // Arrange — spec edge-case §313: no rearm on full failure
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 1
            });

            // Act
            await service.cascadePostStatus({ postId: POST_ID });

            // Assert: targetModel.update NOT called (no target reset)
            expect(mocks.targetModel.update).not.toHaveBeenCalled();
        });

        it('does NOT call rearmRecurrence when all targets are FAILED', async () => {
            // Arrange
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 1
            });

            // Act
            await service.cascadePostStatus({ postId: POST_ID });

            // Assert: postModel.findOne (used by rearm) NOT called
            expect(mocks.postModel.findOne).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// rearmRecurrence — SPEC-254 T-046
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.rearmRecurrence — SPEC-254 T-046', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    // Fixed "now" for deterministic tests: Friday 2024-03-01 10:00:00 UTC
    // In UTC that is a Friday (weekday index 5).
    const FIXED_NOW = new Date('2024-03-01T10:00:00.000Z');

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;

        mocks.postModel.update.mockResolvedValue({ id: POST_ID });
        mocks.targetModel.update.mockResolvedValue({ rowCount: 1 });
        // Default: no targets (overridden per test when targets need to be reset)
        mocks.targetModel.findAll.mockResolvedValue({ items: [], total: 0 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // ONCE: next_run_at = null, post stays PUBLISHED, targets untouched
    // -------------------------------------------------------------------------

    describe('ONCE recurrence', () => {
        it('sets next_run_at to null for a ONCE post', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.ONCE });

            // Act
            const result: RearmRecurrenceResult = await service.rearmRecurrence({
                post,
                now: FIXED_NOW
            });

            // Assert
            expect(result.nextRunAt).toBeNull();
            expect(result.rearmed).toBe(false);
        });

        it('calls postModel.update with next_run_at = null for ONCE', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.ONCE });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                { nextRunAt: null }
            );
        });

        it('does NOT call targetModel.update for ONCE (targets untouched)', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.ONCE });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(mocks.targetModel.update).not.toHaveBeenCalled();
            expect(mocks.targetModel.findAll).not.toHaveBeenCalled();
        });

        it('does NOT change post status to APPROVED for ONCE', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.ONCE });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: update should only set nextRunAt, not status
            const updateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const updateData = (updateCalls[0] ?? [])[1] as Record<string, unknown>;
            expect(updateData.status).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // BIWEEKLY: next_run_at = now + 14 days
    // -------------------------------------------------------------------------

    describe('BIWEEKLY recurrence', () => {
        it('sets next_run_at to now + 14 days for BIWEEKLY', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY });
            const expected = new Date(FIXED_NOW.getTime() + 14 * 24 * 60 * 60 * 1000);

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expected);
            expect(result.rearmed).toBe(true);
        });

        it('resets post status to APPROVED for BIWEEKLY', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: postModel.update called with status=APPROVED
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({ status: SocialPostStatusEnum.APPROVED })
            );
        });

        it('resets all targets to APPROVED with retry_count=0 for BIWEEKLY', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.BIWEEKLY });
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    { id: TARGET_ID_2, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 2
            });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: both targets reset
            expect(mocks.targetModel.update).toHaveBeenCalledTimes(2);
            expect(mocks.targetModel.update).toHaveBeenCalledWith(
                { id: TARGET_ID },
                { status: SocialPostStatusEnum.APPROVED, retryCount: 0 }
            );
            expect(mocks.targetModel.update).toHaveBeenCalledWith(
                { id: TARGET_ID_2 },
                { status: SocialPostStatusEnum.APPROVED, retryCount: 0 }
            );
        });
    });

    // -------------------------------------------------------------------------
    // MONTHLY: next_run_at = same day next month, with clamping
    // -------------------------------------------------------------------------

    describe('MONTHLY recurrence', () => {
        it('sets next_run_at to same day next month for MONTHLY', async () => {
            // Arrange: March 1 → April 1
            const march1 = new Date('2024-03-01T10:00:00.000Z');
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.MONTHLY });
            const expectedApril1 = new Date('2024-04-01T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: march1 });

            // Assert
            expect(result.nextRunAt).toEqual(expectedApril1);
            expect(result.rearmed).toBe(true);
        });

        it('clamps month-end date (Jan 31 → last day of Feb)', async () => {
            // Arrange: Jan 31 2024 → Feb 29 2024 (2024 is a leap year)
            const jan31 = new Date('2024-01-31T10:00:00.000Z');
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.MONTHLY });
            const expectedFeb29 = new Date('2024-02-29T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: jan31 });

            // Assert
            expect(result.nextRunAt).toEqual(expectedFeb29);
        });

        it('clamps month-end date in non-leap year (Jan 31 → Feb 28)', async () => {
            // Arrange: Jan 31 2023 → Feb 28 2023 (non-leap year)
            const jan31_2023 = new Date('2023-01-31T10:00:00.000Z');
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.MONTHLY });
            const expectedFeb28 = new Date('2023-02-28T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: jan31_2023 });

            // Assert
            expect(result.nextRunAt).toEqual(expectedFeb28);
        });

        it('handles December → January (year rollover)', async () => {
            // Arrange: Dec 15 2024 → Jan 15 2025
            const dec15 = new Date('2024-12-15T10:00:00.000Z');
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.MONTHLY });
            const expectedJan15 = new Date('2025-01-15T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: dec15 });

            // Assert
            expect(result.nextRunAt).toEqual(expectedJan15);
        });

        it('resets post status to APPROVED and targets for MONTHLY', async () => {
            // Arrange
            const post = buildPost({ recurrenceType: SocialRecurrenceTypeEnum.MONTHLY });
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.PUBLISHED }
                ],
                total: 1
            });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({ status: SocialPostStatusEnum.APPROVED })
            );
            expect(mocks.targetModel.update).toHaveBeenCalledWith(
                { id: TARGET_ID },
                { status: SocialPostStatusEnum.APPROVED, retryCount: 0 }
            );
        });
    });

    // -------------------------------------------------------------------------
    // WEEKLY: next occurrence of configured weekday in timezone
    // -------------------------------------------------------------------------

    describe('WEEKLY recurrence', () => {
        // FIXED_NOW = 2024-03-01T10:00:00Z = Friday UTC
        // In UTC: weekday is Friday (index 5).

        it('returns the SAME day when next weekday = today (Friday → Friday)', async () => {
            // Arrange: now is Friday, want FRIDAY → daysToAdd=0, same moment
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'FRIDAY' },
                timezone: 'UTC'
            });

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: same-day publish is valid (daysToAdd = 0)
            expect(result.rearmed).toBe(true);
            expect(result.nextRunAt).toBeInstanceOf(Date);
            // Should be FIXED_NOW itself (0 days added)
            expect(result.nextRunAt?.getTime()).toBe(FIXED_NOW.getTime());
        });

        it('advances to next MONDAY from a Friday (daysToAdd = 3)', async () => {
            // Arrange: 2024-03-01 is Friday UTC. Next Monday = 2024-03-04.
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'MONDAY' },
                timezone: 'UTC'
            });
            const expectedMonday = new Date('2024-03-04T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expectedMonday);
        });

        it('advances to next SATURDAY from a Friday (daysToAdd = 1)', async () => {
            // Arrange: Friday → Saturday = 1 day
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'SATURDAY' },
                timezone: 'UTC'
            });
            const expectedSaturday = new Date('2024-03-02T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expectedSaturday);
        });

        it('advances to next THURSDAY from a Friday (daysToAdd = 6)', async () => {
            // Arrange: Friday → next Thursday = 6 days ahead
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'THURSDAY' },
                timezone: 'UTC'
            });
            const expectedThursday = new Date('2024-03-07T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expectedThursday);
        });

        it('uses the post timezone to determine the local weekday (UTC+3 Saturday = UTC Friday)', async () => {
            // Arrange: FIXED_NOW = 2024-03-01T10:00:00Z.
            // In UTC+3 (e.g. 'Africa/Nairobi') this is Friday at 13:00.
            // Requesting SATURDAY → daysToAdd = 1 → 2024-03-02T10:00:00Z.
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'SATURDAY' },
                timezone: 'Africa/Nairobi' // UTC+3
            });
            const expected = new Date('2024-03-02T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expected);
        });

        it('handles timezone where local day is SATURDAY when UTC is still Friday', async () => {
            // Arrange: FIXED_NOW = 2024-03-01T10:00:00Z.
            // In UTC+14 (Pacific/Kiritimati) this would already be Saturday
            // (UTC 10:00 → local Saturday). Requesting SATURDAY → daysToAdd = 0.
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'SATURDAY' },
                timezone: 'Pacific/Kiritimati' // UTC+14
            });

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: daysToAdd = 0 → returns FIXED_NOW itself
            expect(result.nextRunAt?.getTime()).toBe(FIXED_NOW.getTime());
        });

        it('resets post status to APPROVED and all targets for WEEKLY', async () => {
            // Arrange
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'MONDAY' },
                timezone: 'UTC'
            });
            mocks.targetModel.findAll.mockResolvedValue({
                items: [
                    {
                        id: TARGET_ID,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    {
                        id: TARGET_ID_2,
                        socialPostId: POST_ID,
                        status: SocialPostStatusEnum.PUBLISHED
                    },
                    { id: TARGET_ID_3, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
                ],
                total: 3
            });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: post reset to APPROVED
            expect(mocks.postModel.update).toHaveBeenCalledWith(
                { id: POST_ID },
                expect.objectContaining({ status: SocialPostStatusEnum.APPROVED })
            );
            // Assert: ALL 3 targets reset
            expect(mocks.targetModel.update).toHaveBeenCalledTimes(3);
            for (const tid of [TARGET_ID, TARGET_ID_2, TARGET_ID_3]) {
                expect(mocks.targetModel.update).toHaveBeenCalledWith(
                    { id: tid },
                    { status: SocialPostStatusEnum.APPROVED, retryCount: 0 }
                );
            }
        });

        it('does NOT modify approval_status (keeps it APPROVED)', async () => {
            // Arrange
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'MONDAY' },
                timezone: 'UTC',
                approvalStatus: 'APPROVED'
            });

            // Act
            await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert: postModel.update does NOT include approvalStatus
            const updateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
            const updateData = (updateCalls[0] ?? [])[1] as Record<string, unknown>;
            expect(updateData.approvalStatus).toBeUndefined();
        });

        it('returns rearmed=true for WEEKLY', async () => {
            // Arrange
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'MONDAY' },
                timezone: 'UTC'
            });

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.rearmed).toBe(true);
        });

        it('nextRunAt is in the future (or same moment) relative to FIXED_NOW', async () => {
            // Arrange
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'WEDNESDAY' },
                timezone: 'UTC'
            });
            // Friday → Wednesday = 5 days ahead

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toBeInstanceOf(Date);
            expect(result.nextRunAt!.getTime()).toBeGreaterThanOrEqual(FIXED_NOW.getTime());
        });

        it('nextRunAt lands on the configured WEDNESDAY (UTC) from a Friday', async () => {
            // Arrange: 2024-03-01 is Friday; next Wednesday = 2024-03-06
            const post = buildPost({
                recurrenceType: SocialRecurrenceTypeEnum.WEEKLY,
                recurrenceParamsJson: { weekday: 'WEDNESDAY' },
                timezone: 'UTC'
            });
            const expectedWednesday = new Date('2024-03-06T10:00:00.000Z');

            // Act
            const result = await service.rearmRecurrence({ post, now: FIXED_NOW });

            // Assert
            expect(result.nextRunAt).toEqual(expectedWednesday);
            // Verify it is indeed a Wednesday (UTC day = 3)
            expect(result.nextRunAt?.getUTCDay()).toBe(3);
        });
    });
});
