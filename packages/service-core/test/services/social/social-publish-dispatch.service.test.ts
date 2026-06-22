/**
 * @file social-publish-dispatch.service.test.ts
 *
 * Unit tests for SocialPublishDispatchService — SPEC-254 T-044.
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
 * SPEC-254 T-044.
 */

import type {
    SocialAssetModel,
    SocialPlatformFormatModel,
    SocialPostFooterModel,
    SocialPostMediaModel,
    SocialPostModel,
    SocialPostTargetModel
} from '@repo/db';
import { SocialPostStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildMakePayloadInput } from '../../../src/services/social/social-publish-dispatch.service';
import { SocialPublishDispatchService } from '../../../src/services/social/social-publish-dispatch.service';
import { createModelMock } from '../../utils/modelMockFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// UUID fixtures
// ---------------------------------------------------------------------------

const TARGET_ID = '00000000-0000-4000-8000-000000000001';
const POST_ID = '00000000-0000-4000-8000-000000000002';
const PLATFORM_FORMAT_ID = '00000000-0000-4000-8000-000000000003';
const FOOTER_ID = '00000000-0000-4000-8000-000000000004';
const ASSET_ID_1 = '00000000-0000-4000-8000-000000000005';
const ASSET_ID_2 = '00000000-0000-4000-8000-000000000006';
const API_BASE_URL = 'https://api.hospeda.com.ar';

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

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

type Mocks = {
    postModel: StandardModelMock;
    targetModel: StandardModelMock;
    postMediaModel: StandardModelMock;
    platformFormatModel: StandardModelMock;
    footerModel: StandardModelMock;
    assetModel: StandardModelMock;
};

function buildService(): { service: SocialPublishDispatchService; mocks: Mocks } {
    const postModel = createModelMock();
    const targetModel = createModelMock();
    const postMediaModel = createModelMock();
    const platformFormatModel = createModelMock();
    const footerModel = createModelMock();
    const assetModel = createModelMock();

    const service = new SocialPublishDispatchService(
        { logger: undefined },
        postModel as unknown as SocialPostModel,
        targetModel as unknown as SocialPostTargetModel,
        postMediaModel as unknown as SocialPostMediaModel,
        platformFormatModel as unknown as SocialPlatformFormatModel,
        footerModel as unknown as SocialPostFooterModel,
        assetModel as unknown as SocialAssetModel
    );

    return {
        service,
        mocks: {
            postModel,
            targetModel,
            postMediaModel,
            platformFormatModel,
            footerModel,
            assetModel
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
