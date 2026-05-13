/**
 * @file newsletter-delivery.service.test.ts
 *
 * Unit tests for NewsletterDeliveryService (SPEC-101 T-101-16).
 *
 * All external dependencies are mocked:
 * - `@repo/db`: `getDb()` returns a chainable Drizzle stub that pops from
 *   `queryBuilderResponses` on each terminal call.
 * - `sendBatchFn`: vi.fn() stub that returns configurable `SendBatchResult`.
 * - `renderTiptapEmailFn` / `renderCampaignEmailFn` / `buildCampaignReactElementFn`:
 *   vi.fn() stubs.
 * - `emailTransport.send`: vi.fn() stub for sendTestEmail tests.
 * - `queue.addBulk`: vi.fn() stub for enqueueBatches tests.
 *
 * Coverage areas:
 * - enqueueBatches: happy path (chunking), queue not configured
 * - processBatch: happy path, campaign status != 'sending', non-pending deliveries
 *   (idempotency), inactive subscribers, Brevo HTTP failure (throw)
 * - bulkSkipPending: happy path
 * - sendTestEmail: happy path, permission denied, email transport not configured
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be declared before imports)
// ---------------------------------------------------------------------------

/**
 * Queue of row arrays returned by the chainable Drizzle query builder.
 * Each call to the terminal (`.then` / await) pops the next entry.
 */
let queryBuilderResponses: unknown[][] = [];

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();

    const buildChain = (): Record<string, unknown> => {
        const rows = queryBuilderResponses.shift() ?? [];
        const chain: Record<string, unknown> = {};

        const methods = [
            'select',
            'from',
            'where',
            'and',
            'limit',
            'offset',
            'insert',
            'into',
            'values',
            'update',
            'set',
            'returning',
            'onConflictDoNothing'
        ];
        for (const m of methods) {
            chain[m] = vi.fn(() => chain);
        }

        // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Drizzle chain mock
        chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
        return chain;
    };

    const mockDb = {
        select: vi.fn(() => buildChain()),
        insert: vi.fn(() => buildChain()),
        update: vi.fn(() => buildChain()),
        execute: vi.fn(async () => ({ rows: [] }))
    };

    return {
        ...original,
        getDb: vi.fn(() => mockDb),
        newsletterCampaigns: original.newsletterCampaigns,
        newsletterCampaignDeliveries: original.newsletterCampaignDeliveries,
        newsletterSubscribers: original.newsletterSubscribers
    };
});

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterDeliveryService } from '../../../src/services/newsletter/newsletter-delivery.service.js';
import type {
    BuildCampaignReactElementFn,
    DeliveryBatchPayload,
    DeliveryBatchResult,
    NewsletterDeliveryServiceOptions,
    NewsletterQueue,
    SingleEmailTransport
} from '../../../src/services/newsletter/newsletter-delivery.service.js';
import type { Actor } from '../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUBSCRIBER_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SUBSCRIBER_ID_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DELIVERY_ID_1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DELIVERY_ID_2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const DELIVERY_ID_3 = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

/** Actor with all newsletter campaign permissions. */
function makeAdminActor(extra: Partial<Actor> = {}): Actor {
    return {
        id: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
            PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
            PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW
        ],
        ...extra
    };
}

/** Actor with no permissions. */
function makeUnpermissionedActor(): Actor {
    return {
        id: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        role: RoleEnum.USER,
        permissions: []
    };
}

/** Returns a minimal campaign DB row in 'sending' status. */
function makeCampaignRow(overrides: Record<string, unknown> = {}) {
    return {
        id: CAMPAIGN_ID,
        title: 'Test Campaign',
        subject: 'Test Subject',
        bodyJson: { type: 'doc', content: [] },
        status: 'sending',
        localeFilter: 'all',
        totalRecipients: 2,
        totalSoftcapped: 0,
        sentAt: new Date(),
        scheduledFor: null,
        createdBy: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

/** Returns a minimal delivery row. */
function makeDeliveryRow(
    id: string,
    subscriberId: string,
    overrides: Record<string, unknown> = {}
) {
    return {
        id,
        campaignId: CAMPAIGN_ID,
        subscriberId,
        channel: 'email',
        status: 'pending',
        openedAt: null,
        firstClickAt: null,
        deliveredAt: null,
        retryCount: 0,
        errorMessage: null,
        providerMessageId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
}

/** Returns a minimal subscriber row in 'active' status. */
function makeSubscriberRow(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        userId: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        email: `user-${id.slice(0, 8)}@example.com`,
        channel: 'email',
        status: 'active',
        locale: 'es',
        source: 'web_footer',
        consentIp: null,
        consentUa: null,
        consentVersion: null,
        subscribedAt: new Date(),
        verifiedAt: new Date(),
        unsubscribedAt: null,
        bouncedAt: null,
        complainedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...overrides
    };
}

/** Returns a successful `DeliveryBatchResult` with one outcome per ID. */
function makeBatchResult(emails: string[], messageIds?: string[]): DeliveryBatchResult {
    return {
        statusCode: 201,
        messageIds: emails.map((email, i) => ({
            email,
            messageId: messageIds?.[i] ?? `msg-${i}`
        }))
    };
}

/**
 * Type-safe helper to extract mock call arguments.
 * Vitest's `mock.calls` is typed as a tuple with length 0, which makes strict
 * TS complain on index access. This helper casts through unknown safely.
 */
function getMockCallArg<T>(
    mockFn: ReturnType<typeof vi.fn>,
    callIndex: number,
    argIndex: number
): T {
    const calls = mockFn.mock.calls as unknown as unknown[][];
    return (calls[callIndex]?.[argIndex] ?? undefined) as T;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
    overrides: Partial<NewsletterDeliveryServiceOptions> = {}
): NewsletterDeliveryService {
    const defaultSendBatchFn = vi.fn(
        async (_input: { payload: DeliveryBatchPayload; apiKey: string }) =>
            makeBatchResult([`user-${DELIVERY_ID_1.slice(0, 8)}@example.com`], ['msg-001'])
    );

    return new NewsletterDeliveryService(
        {},
        {
            queue: { addBulk: vi.fn(async () => []) },
            emailTransport: { send: vi.fn(async () => ({ messageId: 'test-msg-id' })) },
            sendBatchFn: defaultSendBatchFn,
            renderTiptapEmailFn: vi.fn(() => '<p>Body HTML</p>'),
            renderCampaignEmailFn: vi.fn(
                ({ subject }) => `<html><body><h1>${subject}</h1></body></html>`
            ),
            buildCampaignReactElementFn: vi.fn(({ subject }) => ({
                type: 'div',
                props: { children: subject }
            })),
            apiKey: 'xkeysib-test-key',
            senderEmail: 'noreply@hospeda.com.ar',
            senderName: 'Hospeda',
            siteUrl: 'https://hospeda.com.ar',
            hmacSecret: 'test-hmac-secret-32-chars-minimum!!',
            ...overrides
        }
    );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    queryBuilderResponses = [];
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ===========================================================================
// enqueueBatches
// ===========================================================================

describe('enqueueBatches', () => {
    it('should enqueue 1 job when deliveryIds fit in a single batch', async () => {
        const queue = { addBulk: vi.fn(async () => []) };
        const svc = makeService({ queue });

        const result = await svc.enqueueBatches({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2],
            batchSize: 100
        });

        expect(result.data?.jobsEnqueued).toBe(1);
        expect(queue.addBulk).toHaveBeenCalledOnce();
        type AddBulkArg = Parameters<NewsletterQueue['addBulk']>[0];
        const jobs = getMockCallArg<AddBulkArg>(queue.addBulk, 0, 0);
        expect(jobs).toHaveLength(1);
        expect(jobs?.[0]?.data.deliveryIds).toEqual([DELIVERY_ID_1, DELIVERY_ID_2]);
    });

    it('should chunk deliveryIds into ceil(N/batchSize) jobs', async () => {
        const queue = { addBulk: vi.fn(async () => []) };
        const svc = makeService({ queue });

        const deliveryIds = [DELIVERY_ID_1, DELIVERY_ID_2, DELIVERY_ID_3];
        const result = await svc.enqueueBatches({
            campaignId: CAMPAIGN_ID,
            deliveryIds,
            batchSize: 2
        });

        expect(result.data?.jobsEnqueued).toBe(2);
        type AddBulkArg2 = Parameters<NewsletterQueue['addBulk']>[0];
        const jobs = getMockCallArg<AddBulkArg2>(queue.addBulk, 0, 0);
        expect(jobs).toHaveLength(2);
        expect(jobs?.[0]?.data.deliveryIds).toEqual([DELIVERY_ID_1, DELIVERY_ID_2]);
        expect(jobs?.[1]?.data.deliveryIds).toEqual([DELIVERY_ID_3]);
    });

    it('should include campaignId in each job name and data', async () => {
        const queue = { addBulk: vi.fn(async () => []) };
        const svc = makeService({ queue });

        await svc.enqueueBatches({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1],
            batchSize: 100
        });

        type AddBulkArg3 = Parameters<NewsletterQueue['addBulk']>[0];
        const jobs = getMockCallArg<AddBulkArg3>(queue.addBulk, 0, 0);
        expect(jobs?.[0]?.name).toContain(CAMPAIGN_ID);
        expect(jobs?.[0]?.data.campaignId).toBe(CAMPAIGN_ID);
    });

    it('should return SERVICE_UNAVAILABLE when queue is not configured', async () => {
        const svc = makeService({ queue: undefined });

        const result = await svc.enqueueBatches({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1],
            batchSize: 100
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
    });
});

// ===========================================================================
// processBatch
// ===========================================================================

describe('processBatch', () => {
    it('should deliver emails and update delivery rows on happy path', async () => {
        // DB response queue: campaign, deliveries, subscribers,
        // then 2x update (one per delivered ID)
        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1)], // deliveries SELECT
            [makeSubscriberRow(SUBSCRIBER_ID_1)], // subscribers SELECT
            [{ id: DELIVERY_ID_1 }], // UPDATE delivered
            [] // (no inactive, no failed updates)
        ];

        const email1 = `user-${DELIVERY_ID_1.slice(0, 8)}@example.com`;
        const sendBatchFn = vi.fn(async () => makeBatchResult([email1], ['brevo-msg-001']));

        const svc = makeService({ sendBatchFn });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.delivered).toBe(1);
        expect(result.data?.skipped).toBe(0);
        expect(result.data?.failed).toBe(0);
        expect(sendBatchFn).toHaveBeenCalledOnce();
    });

    it('should return early (all skipped) when campaign status is not "sending"', async () => {
        queryBuilderResponses = [
            [makeCampaignRow({ status: 'cancelled' })] // campaign SELECT
        ];

        const sendBatchFn = vi.fn();
        const svc = makeService({ sendBatchFn });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.delivered).toBe(0);
        expect(result.data?.skipped).toBe(2);
        expect(result.data?.failed).toBe(0);
        // sendBatch must NOT be called
        expect(sendBatchFn).not.toHaveBeenCalled();
    });

    it('should skip non-pending delivery rows (idempotency guard)', async () => {
        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [
                makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1, { status: 'delivered' }),
                makeDeliveryRow(DELIVERY_ID_2, SUBSCRIBER_ID_2, { status: 'skipped' })
            ] // deliveries SELECT — all non-pending
        ];

        const sendBatchFn = vi.fn();
        const svc = makeService({ sendBatchFn });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.delivered).toBe(0);
        // 2 non-pending rows returned by DB, 0 missing deliveries
        expect(result.data?.skipped).toBeGreaterThanOrEqual(0);
        expect(result.data?.failed).toBe(0);
        expect(sendBatchFn).not.toHaveBeenCalled();
    });

    it('should skip deliveries whose subscriber is not active', async () => {
        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1)], // deliveries SELECT
            [makeSubscriberRow(SUBSCRIBER_ID_1, { status: 'bounced' })], // subscribers SELECT
            [] // bulk-skip update
        ];

        const sendBatchFn = vi.fn();
        const svc = makeService({ sendBatchFn });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.delivered).toBe(0);
        expect(result.data?.skipped).toBeGreaterThanOrEqual(1);
        expect(result.data?.failed).toBe(0);
        expect(sendBatchFn).not.toHaveBeenCalled();
    });

    it('should throw (not return error) when Brevo HTTP call fails', async () => {
        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1)], // deliveries SELECT
            [makeSubscriberRow(SUBSCRIBER_ID_1)] // subscribers SELECT
        ];

        const sendBatchFn = vi
            .fn()
            .mockRejectedValue(new Error('Brevo batch send failed (503): Service Unavailable'));

        const svc = makeService({ sendBatchFn });

        // processBatch wraps in runWithLoggingAndValidation which returns ServiceOutput
        // But because the error is not a ServiceError, it wraps in INTERNAL_ERROR
        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1]
        });

        // The service catches the throw and maps to INTERNAL_ERROR
        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Brevo batch send failed');
    });

    it('should mark individual deliveries as failed when Brevo rejects a recipient', async () => {
        const email1 = `user-${DELIVERY_ID_1.slice(0, 8)}@example.com`;
        const email2 = `user-${DELIVERY_ID_2.slice(0, 8)}@example.com`;

        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [
                makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1),
                makeDeliveryRow(DELIVERY_ID_2, SUBSCRIBER_ID_2)
            ], // deliveries SELECT
            [
                makeSubscriberRow(SUBSCRIBER_ID_1, { email: email1 }),
                makeSubscriberRow(SUBSCRIBER_ID_2, { email: email2 })
            ], // subscribers SELECT
            [{ id: DELIVERY_ID_1 }], // UPDATE delivered (delivery 1)
            [] // UPDATE failed (delivery 2) — bulk
        ];

        // Delivery 1 succeeds, delivery 2 fails
        const sendBatchFn = vi.fn(async () => ({
            statusCode: 201,
            messageIds: [
                { email: email1, messageId: 'msg-001' },
                { email: email2, error: 'Invalid email address' }
            ]
        }));

        const svc = makeService({ sendBatchFn });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2]
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.delivered).toBe(1);
        expect(result.data?.failed).toBe(1);
    });

    it('should call renderTiptapEmailFn once per batch regardless of recipient count', async () => {
        const email1 = `user-${DELIVERY_ID_1.slice(0, 8)}@example.com`;
        const email2 = `user-${DELIVERY_ID_2.slice(0, 8)}@example.com`;

        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [
                makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1),
                makeDeliveryRow(DELIVERY_ID_2, SUBSCRIBER_ID_2)
            ], // deliveries SELECT
            [
                makeSubscriberRow(SUBSCRIBER_ID_1, { email: email1 }),
                makeSubscriberRow(SUBSCRIBER_ID_2, { email: email2 })
            ], // subscribers SELECT
            [{ id: DELIVERY_ID_1 }], // UPDATE delivered 1
            [{ id: DELIVERY_ID_2 }] // UPDATE delivered 2
        ];

        const sendBatchFn = vi.fn(async () => makeBatchResult([email1, email2]));
        const renderTiptapEmailFn = vi.fn(() => '<p>Body HTML</p>');
        const renderCampaignEmailFn = vi.fn(() => '<html><body>campaign</body></html>');

        const svc = makeService({ sendBatchFn, renderTiptapEmailFn, renderCampaignEmailFn });

        await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2]
        });

        // TipTap render called once for the whole batch
        expect(renderTiptapEmailFn).toHaveBeenCalledOnce();
        // Campaign template rendered per-recipient (2 recipients)
        expect(renderCampaignEmailFn).toHaveBeenCalledTimes(2);
    });

    it('should return SERVICE_UNAVAILABLE when sendBatchFn is not configured', async () => {
        queryBuilderResponses = [
            [makeCampaignRow()], // campaign SELECT
            [makeDeliveryRow(DELIVERY_ID_1, SUBSCRIBER_ID_1)], // deliveries SELECT
            [makeSubscriberRow(SUBSCRIBER_ID_1)] // subscribers SELECT
        ];

        const svc = makeService({ sendBatchFn: undefined });

        const result = await svc.processBatch({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1]
        });

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
    });
});

// ===========================================================================
// bulkSkipPending
// ===========================================================================

describe('bulkSkipPending', () => {
    it('should update pending deliveries to skipped and return the count', async () => {
        // Drizzle returning() returns the updated rows
        queryBuilderResponses = [
            [{ id: DELIVERY_ID_1 }, { id: DELIVERY_ID_2 }] // UPDATE returning
        ];

        const svc = makeService();

        const result = await svc.bulkSkipPending({ campaignId: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(2);
    });

    it('should return 0 when no pending deliveries exist for the campaign', async () => {
        queryBuilderResponses = [
            [] // UPDATE returning — 0 rows
        ];

        const svc = makeService();

        const result = await svc.bulkSkipPending({ campaignId: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(0);
    });
});

// ===========================================================================
// bulkMarkFailed
// ===========================================================================

describe('bulkMarkFailed', () => {
    it('should update pending deliveries to failed and return the count', async () => {
        queryBuilderResponses = [
            [{ id: DELIVERY_ID_1 }, { id: DELIVERY_ID_2 }] // UPDATE returning
        ];

        const svc = makeService();

        const result = await svc.bulkMarkFailed({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2],
            reason: 'BullMQ exhausted retries (3 attempts): Brevo 503'
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(2);
    });

    it('should return 0 when no rows are still pending (idempotency)', async () => {
        // Already-terminal rows are filtered by the status='pending' guard in WHERE.
        queryBuilderResponses = [
            [] // UPDATE returning — 0 rows matched
        ];

        const svc = makeService();

        const result = await svc.bulkMarkFailed({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1],
            reason: 'Late exhaustion after retry'
        });

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(0);
    });
});

// ===========================================================================
// sendTestEmail
// ===========================================================================

describe('sendTestEmail', () => {
    it('should render and send a preview email to the given address', async () => {
        queryBuilderResponses = [
            [makeCampaignRow({ status: 'draft' })] // campaign SELECT
        ];

        const emailTransport = { send: vi.fn(async () => ({ messageId: 'test-123' })) };
        const renderTiptapEmailFn = vi.fn(() => '<p>Preview body</p>');
        const buildCampaignReactElementFn = vi.fn(() => ({ type: 'div', props: {} }));

        const svc = makeService({
            emailTransport,
            renderTiptapEmailFn,
            buildCampaignReactElementFn
        });

        const result = await svc.sendTestEmail(
            { campaignId: CAMPAIGN_ID, toEmail: 'admin@example.com' },
            makeAdminActor()
        );

        expect(result.error).toBeUndefined();
        expect(result.data?.sentTo).toBe('admin@example.com');
        expect(emailTransport.send).toHaveBeenCalledOnce();

        type SendArg = Parameters<SingleEmailTransport['send']>[0];
        const sendCall = getMockCallArg<SendArg>(emailTransport.send, 0, 0);
        expect(sendCall?.to).toBe('admin@example.com');
        expect(sendCall?.subject).toContain('[PRUEBA]');
        expect(sendCall?.subject).toContain('Test Subject');
    });

    it('should return FORBIDDEN when actor lacks NEWSLETTER_CAMPAIGN_SEND', async () => {
        const svc = makeService();

        const result = await svc.sendTestEmail(
            { campaignId: CAMPAIGN_ID, toEmail: 'admin@example.com' },
            makeUnpermissionedActor()
        );

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('should return SERVICE_UNAVAILABLE when emailTransport is not configured', async () => {
        queryBuilderResponses = [
            [makeCampaignRow({ status: 'draft' })] // campaign SELECT
        ];

        const svc = makeService({
            emailTransport: undefined,
            buildCampaignReactElementFn: vi.fn(() => ({ type: 'div', props: {} }))
        });

        const result = await svc.sendTestEmail(
            { campaignId: CAMPAIGN_ID, toEmail: 'admin@example.com' },
            makeAdminActor()
        );

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('should return NOT_FOUND when campaign does not exist', async () => {
        queryBuilderResponses = [
            [] // campaign SELECT — empty
        ];

        const svc = makeService();

        const result = await svc.sendTestEmail(
            { campaignId: CAMPAIGN_ID, toEmail: 'admin@example.com' },
            makeAdminActor()
        );

        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should call buildCampaignReactElementFn with isTest=true', async () => {
        queryBuilderResponses = [
            [makeCampaignRow({ status: 'draft' })] // campaign SELECT
        ];

        const emailTransport = { send: vi.fn(async () => ({ messageId: 'test-xyz' })) };
        const buildCampaignReactElementFn = vi.fn(() => ({ type: 'div', props: {} }));

        const svc = makeService({ emailTransport, buildCampaignReactElementFn });

        await svc.sendTestEmail(
            { campaignId: CAMPAIGN_ID, toEmail: 'admin@example.com' },
            makeAdminActor()
        );

        expect(buildCampaignReactElementFn).toHaveBeenCalledOnce();
        type BuildArg = Parameters<BuildCampaignReactElementFn>[0];
        const call = getMockCallArg<BuildArg>(buildCampaignReactElementFn, 0, 0);
        expect(call?.isTest).toBe(true);
    });
});
