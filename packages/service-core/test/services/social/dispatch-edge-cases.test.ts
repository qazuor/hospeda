/**
 * @file dispatch-edge-cases.test.ts
 *
 * Adds edge-case unit tests for {@link SocialPublishDispatchService} that are
 * NOT present in `social-publish-dispatch.service.test.ts`.
 *
 * Cases added here:
 *
 *  1. `dispatchTarget` retry boundary — retryCount=2 on failure:
 *       `currentRetryCount=2 < MAX_RETRY_COUNT(3)` → takes the retry path →
 *       newRetryCount becomes 3, outcome is `retry_scheduled`, target status resets
 *       to APPROVED. The target is NOT yet exhausted (exhaustion fires when
 *       `currentRetryCount >= 3` at the moment of failure, i.e. retryCount is
 *       already 3 when the 4th attempt occurs).
 *
 *  2. `dispatchTarget` retry boundary — retryCount=2, verify NO `checkAndCascadePostFailure`
 *       runs on the retry path (no audit event, no postModel.update to FAILED).
 *
 * Cases explicitly SKIPPED as duplicate of social-publish-dispatch.service.test.ts:
 *
 *  - cascade partial success (PUBLISHED + FAILED → post_published): tested in
 *    T-046 section at line 1699.
 *  - cascade total failure (all FAILED → post_failed, nextRunAt=null, no rearm):
 *    tested in T-046 section at lines 1822–1874.
 *
 * Exhaustion threshold (from service source):
 *   `MAX_RETRY_COUNT = 3` (line 382 of social-publish-dispatch.service.ts).
 *   `dispatchTarget` exhausts when `currentRetryCount >= 3` at failure time.
 *   `handleMakeCallbackResult` exhausts when `newRetryCount >= 3` after increment.
 *
 * SPEC-254 T-051.
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
import { SocialPostStatusEnum, SocialPublishResultStatusEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialAuditLogService } from '../../../src/services/social/social-audit-log.service';
import { SocialAuditEvent } from '../../../src/services/social/social-audit-log.service';
import { SocialPublishDispatchService } from '../../../src/services/social/social-publish-dispatch.service';
import { createModelMock } from '../../utils/modelMockFactory';
import type { StandardModelMock } from '../../utils/modelMockFactory';

// ---------------------------------------------------------------------------
// UUID fixtures
// ---------------------------------------------------------------------------

const TARGET_ID = '00000000-0000-4000-8001-000000000001';
const TARGET_ID_2 = '00000000-0000-4000-8001-000000000007';
const POST_ID = '00000000-0000-4000-8001-000000000002';
const PLATFORM_FORMAT_ID = '00000000-0000-4000-8001-000000000003';
const API_BASE_URL = 'https://api.hospeda.com.ar';
const WEBHOOK_URL = 'https://hook.make.com/edge-case-test';
const MAKE_API_KEY = 'edge-case-make-api-key';

// ---------------------------------------------------------------------------
// Fixtures (mirror the pattern from social-publish-dispatch.service.test.ts)
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
 */
function buildPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: POST_ID,
        title: 'Edge Case Post',
        slug: 'edge-case-post',
        status: SocialPostStatusEnum.READY_TO_PUBLISH,
        approvalStatus: 'APPROVED',
        paused: false,
        deletedAt: null,
        nextRunAt: null,
        captionBase: 'Base caption',
        finalCaption: 'Final caption',
        finalHashtagsText: '#test',
        footerId: null,
        timezone: 'UTC',
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
 * Builds a minimal Response-like object for mocking fetch.
 */
function buildFetchResponse(status: number, ok: boolean): Response {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Internal Server Error',
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
// Tests: dispatchTarget retry boundary (retryCount = 2)
// ---------------------------------------------------------------------------

/**
 * These tests verify the exhaustion boundary at the `dispatchTarget` level.
 *
 * MAX_RETRY_COUNT = 3 in the service.
 * Exhaustion condition in dispatchTarget: `currentRetryCount >= MAX_RETRY_COUNT`.
 *
 * At retryCount=2: 2 >= 3 is FALSE → takes the retry path → newRetryCount = 3
 * → outcome is 'retry_scheduled', target resets to APPROVED.
 *
 * Exhaustion only fires when currentRetryCount is already 3 at failure time
 * (the 4th total dispatch attempt), which is covered in the main test file.
 */
describe('SocialPublishDispatchService.dispatchTarget — retry boundary (retryCount=2) — SPEC-254 T-051', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;

        // Shared defaults for all tests in this block
        mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
        mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
        mocks.targetModel.update.mockResolvedValue({ rowCount: 1 });
        mocks.postModel.update.mockResolvedValue({ rowCount: 1 });
        mocks.publishLogModel.create.mockResolvedValue({ id: 'log-id' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns retry_scheduled (not exhausted) when retryCount=2 and dispatch fails (non-2xx)', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        const result = await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — retryCount=2 < MAX_RETRY_COUNT(3) → retry path, not exhaustion
        expect(result.outcome).toBe('retry_scheduled');
        expect(result.retryCount).toBe(3);
    });

    it('resets target status to APPROVED with retryCount=3 when retryCount=2 fails', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — last update resets to APPROVED with new retryCount=3
        const updateCalls = (mocks.targetModel.update as ReturnType<typeof vi.fn>).mock.calls;
        const lastCall = updateCalls[updateCalls.length - 1] ?? [];
        expect(lastCall[1]).toMatchObject({
            status: SocialPostStatusEnum.APPROVED,
            retryCount: 3
        });
    });

    it('inserts a publish_log row with status FAILED when retryCount=2 fails', async () => {
        // Arrange
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(502, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — a FAILED log is written but the target is NOT terminal
        expect(mocks.publishLogModel.create).toHaveBeenCalledWith(
            expect.objectContaining({
                status: SocialPublishResultStatusEnum.FAILED,
                socialPostId: POST_ID,
                socialPostTargetId: TARGET_ID
            })
        );
    });

    it('does NOT call audit event TARGET_DISPATCH_FAILED_EXHAUSTED when retryCount=2 fails', async () => {
        // Arrange — exhaustion audit fires only when currentRetryCount >= 3
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(503, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — no exhaustion audit event (that only fires in exhaustion path)
        const auditCalls = (mocks.auditLogMock.log as ReturnType<typeof vi.fn>).mock.calls;
        const exhaustionCall = auditCalls.find(
            (call) =>
                (call[0] as Record<string, unknown>)?.eventType ===
                SocialAuditEvent.TARGET_DISPATCH_FAILED_EXHAUSTED
        );
        expect(exhaustionCall).toBeUndefined();
    });

    it('does NOT set post status to FAILED (no cascade) when retryCount=2 fails', async () => {
        // Arrange — cascade/post-failure only runs in the exhaustion path
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — postModel.update should NOT be called with FAILED status
        const postUpdateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
        const failedUpdate = postUpdateCalls.find(
            (call) => (call[1] as Record<string, unknown>)?.status === SocialPostStatusEnum.FAILED
        );
        expect(failedUpdate).toBeUndefined();
    });

    it('handles network error when retryCount=2 — still produces retry_scheduled with retryCount=3', async () => {
        // Arrange — network errors are treated identically to non-2xx
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection reset'));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        const result = await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — same retry path regardless of error type
        expect(result.outcome).toBe('retry_scheduled');
        expect(result.retryCount).toBe(3);
    });

    it('confirms retryCount=3 at failure triggers exhaustion (boundary above the retry)', async () => {
        // Arrange — retryCount=3: 3 >= MAX_RETRY_COUNT(3) is TRUE → exhaustion path
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ retryCount: 3 });
        const post = buildPost();
        // Provide siblings so cascade can evaluate (all terminal)
        mocks.targetModel.findAll.mockResolvedValue({
            items: [{ id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }],
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

        // Assert — retryCount=3 crosses the threshold → exhausted outcome
        expect(result.outcome).toBe('exhausted');
    });
});

// ---------------------------------------------------------------------------
// Tests: dispatchTarget retry-path sibling isolation (retryCount=2, has sibling)
// ---------------------------------------------------------------------------

describe('SocialPublishDispatchService.dispatchTarget — sibling isolation on retry path — SPEC-254 T-051', () => {
    let service: SocialPublishDispatchService;
    let mocks: Mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        const built = buildService();
        service = built.service;
        mocks = built.mocks;

        mocks.platformFormatModel.findOne.mockResolvedValue(buildPlatformFormat());
        mocks.postMediaModel.findAll.mockResolvedValue({ items: [], total: 0 });
        mocks.targetModel.update.mockResolvedValue({ rowCount: 1 });
        mocks.postModel.update.mockResolvedValue({ rowCount: 1 });
        mocks.publishLogModel.create.mockResolvedValue({ id: 'log-id' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does NOT query siblings for cascade when retryCount=2 (not on exhaustion path)', async () => {
        // Arrange — on the retry path, targetModel.findAll is NOT called for
        // sibling cascade check (that only happens in checkAndCascadePostFailure
        // which is invoked exclusively from the exhaustion branch)
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ retryCount: 2 });
        const post = buildPost();

        // Act
        await service.dispatchTarget({
            target,
            post,
            makeApiKey: MAKE_API_KEY,
            apiBaseUrl: API_BASE_URL,
            webhookUrl: WEBHOOK_URL
        });

        // Assert — targetModel.findAll is not called for sibling cascade on retry path.
        // Note: targetModel.update IS called (to reset target to APPROVED),
        // but findAll should not be called for cascade purposes.
        // If findAll IS called, it means an unintended cascade path was triggered.
        expect(mocks.targetModel.findAll).not.toHaveBeenCalled();
    });

    it('does not transition post to FAILED even when sibling is already FAILED (retryCount=2)', async () => {
        // Arrange — even if the other sibling is FAILED, the retry path does not
        // cascade post failure (only exhaustion path does)
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(buildFetchResponse(500, false));
        const target = buildTarget({ id: TARGET_ID, retryCount: 2 });
        const post = buildPost();

        // Provide siblings (if findAll were to be called — it should not be)
        mocks.targetModel.findAll.mockResolvedValue({
            items: [
                { id: TARGET_ID, socialPostId: POST_ID, status: SocialPostStatusEnum.APPROVED },
                { id: TARGET_ID_2, socialPostId: POST_ID, status: SocialPostStatusEnum.FAILED }
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

        // Assert — postModel.update is NOT called with FAILED (no cascade on retry path)
        const postUpdateCalls = (mocks.postModel.update as ReturnType<typeof vi.fn>).mock.calls;
        const failedUpdate = postUpdateCalls.find(
            (call) => (call[1] as Record<string, unknown>)?.status === SocialPostStatusEnum.FAILED
        );
        expect(failedUpdate).toBeUndefined();
    });
});
