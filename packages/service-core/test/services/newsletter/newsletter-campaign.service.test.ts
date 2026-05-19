/**
 * @file newsletter-campaign.service.test.ts
 *
 * Unit tests for NewsletterCampaignService (SPEC-101 T-101-14).
 *
 * All external dependencies are mocked:
 * - `@repo/db`: `getDb()` returns a stub with chainable query builders and
 *   `db.execute()` that returns pre-configured responses.
 * - `withTransaction` from `@repo/db`: runs the callback synchronously with a
 *   mock transaction client (no real Postgres connection needed).
 * - `NewsletterSubscriberService`: vi.fn() stub for `getEligibleForCampaign`.
 * - `INewsletterDeliveryService`: vi.fn() stubs for all methods.
 *
 * Design note on DB mocking:
 * The service uses both the Drizzle query builder (for SELECTs / INSERT /
 * UPDATE) and `db.execute(sql\`...\`)` for raw SQL (computeMetrics,
 * closeSentCampaigns). The mock factory handles both patterns.
 *
 * Coverage areas:
 * - create: happy path, permission denied
 * - update: DRAFT gate, not-found
 * - softDelete: DRAFT gate, not-found
 * - send: happy path, status != 'draft' rejection, 0 eligible subscribers
 * - testSend: happy path, delivery service failure
 * - cancel: happy path, invalid status rejection
 * - computeMetrics: happy path, not-found
 * - getFailedDeliveries: happy path, permission denied
 * - closeSentCampaigns: happy path (SQL string check), 0 campaigns to close
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be before imports)
// ---------------------------------------------------------------------------

/**
 * Captured SQL strings from db.execute() calls for assertion.
 */
let capturedSqlStrings: string[] = [];

/**
 * Queue of responses for db.execute() calls.
 */
let executeResponses: Array<{ rows: unknown[] }> = [];

/**
 * Queue of row arrays for drizzle query builder chains (select/insert/update).
 * Each call to the terminal method (.then / awaiting the chain) pops the next.
 */
let queryBuilderResponses: unknown[][] = [];

/**
 * Mutable tx state — populated inside beforeEach so vi.fn() instances are fresh.
 * We keep a reference object so the mock factories (created at hoist-time) can
 * refer to it via closure without being captured before initialization.
 */
const txState: {
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
} = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    execute: vi.fn()
};

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
        execute: vi.fn(async (sqlExpr: { sql?: string } | unknown) => {
            const raw =
                sqlExpr !== null && typeof sqlExpr === 'object' && 'sql' in (sqlExpr as object)
                    ? String((sqlExpr as { sql: unknown }).sql)
                    : JSON.stringify(sqlExpr);
            capturedSqlStrings.push(raw);
            return executeResponses.shift() ?? { rows: [] };
        })
    };

    return {
        ...original,
        getDb: vi.fn(() => mockDb),
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
            // Use txState which is mutated in beforeEach
            return fn(txState);
        })
    };
});

// Mock withServiceTransaction to run the callback directly with txState
vi.mock('../../../src/utils/transaction.js', () => ({
    withServiceTransaction: vi.fn(
        async (
            fn: (ctx: { tx: unknown; hookState: Record<string, unknown> }) => Promise<unknown>
        ) => {
            return fn({ tx: txState, hookState: {} });
        }
    )
}));

import { NewsletterCampaignLocaleFilterEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterCampaignService } from '../../../src/services/newsletter/newsletter-campaign.service.js';
import type { INewsletterDeliveryService } from '../../../src/services/newsletter/newsletter-campaign.service.js';
import type { NewsletterSubscriberService } from '../../../src/services/newsletter/newsletter-subscriber.service.js';
import type { Actor } from '../../../src/types/index.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const SUBSCRIBER_ID_1 = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const SUBSCRIBER_ID_2 = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const DELIVERY_ID_1 = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';
const DELIVERY_ID_2 = 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee';
const ACTOR_ID = 'f0f0f0f0-f0f0-4f0f-af0f-f0f0f0f0f0f0';

/** Admin actor with all campaign permissions. */
function makeAdminActor(extra: Partial<Actor> = {}): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
            PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
            PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW
        ],
        ...extra
    };
}

/** Unpermissioned actor. */
function makeUnpermissionedActor(): Actor {
    return {
        id: ACTOR_ID,
        role: RoleEnum.USER,
        permissions: []
    };
}

/** Returns a mock campaign row. */
function makeCampaignRow(
    overrides: Partial<{
        id: string;
        title: string;
        subject: string;
        status: string;
        localeFilter: string;
        totalRecipients: number | null;
        totalSoftcapped: number;
        sentAt: Date | null;
        scheduledFor: Date | null;
        createdBy: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }> = {}
) {
    return {
        id: CAMPAIGN_ID,
        title: 'Test Campaign',
        subject: 'Test Subject',
        status: 'draft',
        localeFilter: 'all',
        bodyJson: { type: 'doc', content: [] },
        totalRecipients: null,
        totalSoftcapped: 0,
        sentAt: null,
        scheduledFor: null,
        createdBy: ACTOR_ID,
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-01T00:00:00Z'),
        deletedAt: null,
        ...overrides
    };
}

/** Returns a mock delivery row. */
function makeDeliveryRow(
    overrides: Partial<{
        id: string;
        subscriberId: string;
        channel: string;
        errorMessage: string | null;
        retryCount: number;
        createdAt: Date;
        updatedAt: Date;
    }> = {}
) {
    return {
        id: DELIVERY_ID_1,
        subscriberId: SUBSCRIBER_ID_1,
        channel: 'email',
        errorMessage: 'Brevo 500',
        retryCount: 3,
        createdAt: new Date('2026-05-01T00:00:00Z'),
        updatedAt: new Date('2026-05-01T00:00:00Z'),
        ...overrides
    };
}

/** Creates a mock INewsletterDeliveryService. */
function makeDeliveryService(
    overrides: Partial<INewsletterDeliveryService> = {}
): INewsletterDeliveryService {
    return {
        enqueueBatches: vi.fn().mockResolvedValue({ data: { jobsEnqueued: 1 } }),
        bulkSkipPending: vi.fn().mockResolvedValue({ data: 5 }),
        sendTestEmail: vi.fn().mockResolvedValue({ data: { sentTo: 'test@example.com' } }),
        ...overrides
    };
}

/** Creates a mock subscriber service with getEligibleForCampaign stub. */
function makeSubscriberService(
    result: {
        eligibleIds: string[];
        softCappedCount: number;
        totalCandidates: number;
    } = { eligibleIds: [SUBSCRIBER_ID_1, SUBSCRIBER_ID_2], softCappedCount: 2, totalCandidates: 4 }
) {
    return {
        getEligibleForCampaign: vi.fn().mockResolvedValue({ data: result })
    };
}

/**
 * Queues a db.execute() response.
 */
function enqueueExecuteResponse(rows: unknown[]) {
    executeResponses.push({ rows });
}

/**
 * Queues a drizzle query-builder response.
 */
function enqueueQueryResponse(rows: unknown[]) {
    queryBuilderResponses.push(rows);
}

/** Creates a campaign service instance for testing. */
function makeService(
    opts: {
        deliveryService?: INewsletterDeliveryService;
        subscriberService?: ReturnType<typeof makeSubscriberService>;
        notifyCampaignClosedWithFailuresFn?: ReturnType<typeof vi.fn>;
    } = {}
) {
    return new NewsletterCampaignService(
        {},
        {
            batchSize: 2,
            softCapDays: 7,
            deliveryService: opts.deliveryService,
            subscriberService: opts.subscriberService as unknown as NewsletterSubscriberService,
            notifyCampaignClosedWithFailuresFn: opts.notifyCampaignClosedWithFailuresFn
        }
    );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    capturedSqlStrings = [];
    executeResponses = [];
    queryBuilderResponses = [];
    // Reset tx mocks
    txState.insert.mockReset();
    txState.update.mockReset();
    txState.select.mockReset();
    txState.execute.mockReset();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ===========================================================================
// create
// ===========================================================================

describe('NewsletterCampaignService.create', () => {
    it('creates a campaign in DRAFT status', async () => {
        const actor = makeAdminActor();
        const svc = makeService();
        const createdRow = makeCampaignRow({ status: 'draft' });

        // Query builder: INSERT RETURNING → returns [createdRow]
        enqueueQueryResponse([createdRow]);

        const result = await svc.create(actor, {
            title: 'Test',
            subject: 'Subj',
            bodyJson: { type: 'doc', content: [] },
            localeFilter: NewsletterCampaignLocaleFilterEnum.ALL,
            createdBy: ACTOR_ID
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.status).toBe('draft');
        expect(result.data?.title).toBe('Test Campaign');
    });

    it('rejects actor without NEWSLETTER_CAMPAIGN_WRITE', async () => {
        const actor = makeUnpermissionedActor();
        const svc = makeService();

        const result = await svc.create(actor, {
            title: 'T',
            subject: 'S',
            bodyJson: { type: 'doc', content: [] },
            localeFilter: NewsletterCampaignLocaleFilterEnum.ALL,
            createdBy: ACTOR_ID
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('FORBIDDEN');
        expect(result.error?.reason).toBe('NEWSLETTER_CAMPAIGN_WRITE_PERMISSION_DENIED');
    });
});

// ===========================================================================
// update
// ===========================================================================

describe('NewsletterCampaignService.update', () => {
    it('updates a DRAFT campaign', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        // SELECT (existing) → DRAFT campaign row
        enqueueQueryResponse([makeCampaignRow()]);
        // UPDATE RETURNING → updated row
        enqueueQueryResponse([makeCampaignRow({ subject: 'Updated' })]);

        const result = await svc.update(actor, {
            id: CAMPAIGN_ID,
            data: { subject: 'Updated' }
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.subject).toBe('Updated');
    });

    it('rejects update on non-DRAFT campaign', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([makeCampaignRow({ status: 'sending' })]);

        const result = await svc.update(actor, {
            id: CAMPAIGN_ID,
            data: { subject: 'X' }
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_DRAFT');
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([]);

        const result = await svc.update(actor, {
            id: CAMPAIGN_ID,
            data: { title: 'X' }
        });

        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// softDelete
// ===========================================================================

describe('NewsletterCampaignService.softDelete', () => {
    it('soft-deletes a DRAFT campaign', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        // SELECT → DRAFT row
        enqueueQueryResponse([makeCampaignRow()]);
        // UPDATE (no return) → []
        enqueueQueryResponse([]);

        const result = await svc.softDelete(actor, { id: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
    });

    it('rejects soft-delete on non-DRAFT campaign', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([makeCampaignRow({ status: 'sent' })]);

        const result = await svc.softDelete(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_DRAFT');
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([]);

        const result = await svc.softDelete(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// send — THE critical method
// ===========================================================================

describe('NewsletterCampaignService.send', () => {
    it('happy path: inserts deliveries, updates campaign, enqueues batches', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService();
        const subscriberSvc = makeSubscriberService({
            eligibleIds: [SUBSCRIBER_ID_1, SUBSCRIBER_ID_2],
            softCappedCount: 1,
            totalCandidates: 3
        });
        const svc = makeService({ deliveryService: deliverySvc, subscriberService: subscriberSvc });

        // db.select → DRAFT campaign row
        enqueueQueryResponse([makeCampaignRow()]);

        // tx.insert (deliveries) → returns 2 delivery rows via a promise-returning terminal
        {
            const deliveryRows = [{ id: DELIVERY_ID_1 }, { id: DELIVERY_ID_2 }];
            // Each chained method returns a new mock that ultimately resolves to deliveryRows
            const returningMock = Promise.resolve(deliveryRows);
            const onConflictMock = { returning: vi.fn(() => returningMock) };
            const valuesMock = { onConflictDoNothing: vi.fn(() => onConflictMock) };
            txState.insert.mockReturnValue({ values: vi.fn(() => valuesMock) });
        }

        // tx.update (campaign) → resolves to []
        {
            const whereMock = Promise.resolve([]);
            const setMock = { where: vi.fn(() => whereMock) };
            txState.update.mockReturnValue({ set: vi.fn(() => setMock) });
        }

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data?.enqueued).toBe(2);
        expect(result.data?.softcapped).toBe(1);
        expect(deliverySvc.enqueueBatches).toHaveBeenCalledWith({
            campaignId: CAMPAIGN_ID,
            deliveryIds: [DELIVERY_ID_1, DELIVERY_ID_2],
            batchSize: 2
        });
    });

    it('rejects send when campaign status is not "draft"', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService();
        const svc = makeService({ deliveryService: deliverySvc });

        enqueueQueryResponse([makeCampaignRow({ status: 'sending' })]);

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_SENDABLE');
        expect(deliverySvc.enqueueBatches).not.toHaveBeenCalled();
    });

    it('rejects send when campaign status is "sent"', async () => {
        const actor = makeAdminActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([makeCampaignRow({ status: 'sent' })]);

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_SENDABLE');
    });

    it('returns { enqueued: 0, softcapped: N } without changing status when 0 eligible subscribers', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService();
        const subscriberSvc = makeSubscriberService({
            eligibleIds: [],
            softCappedCount: 5,
            totalCandidates: 5
        });
        const svc = makeService({ deliveryService: deliverySvc, subscriberService: subscriberSvc });

        enqueueQueryResponse([makeCampaignRow()]);

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data?.enqueued).toBe(0);
        expect(result.data?.softcapped).toBe(5);
        // No delivery insert, no campaign update, no enqueue
        expect(deliverySvc.enqueueBatches).not.toHaveBeenCalled();
        expect(txState.insert).not.toHaveBeenCalled();
    });

    it('rejects actor without NEWSLETTER_CAMPAIGN_SEND', async () => {
        const actor = makeUnpermissionedActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([makeCampaignRow()]);

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
        const actor = makeAdminActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([]);

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// testSend
// ===========================================================================

describe('NewsletterCampaignService.testSend', () => {
    it('delegates to delivery service sendTestEmail', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService({
            sendTestEmail: vi.fn().mockResolvedValue({ data: { sentTo: 'preview@example.com' } })
        });
        const svc = makeService({ deliveryService: deliverySvc });

        // Campaign exists
        enqueueQueryResponse([makeCampaignRow()]);

        const result = await svc.testSend(actor, {
            id: CAMPAIGN_ID,
            toEmail: 'preview@example.com'
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.sentTo).toBe('preview@example.com');
        expect(deliverySvc.sendTestEmail).toHaveBeenCalledWith({
            campaignId: CAMPAIGN_ID,
            toEmail: 'preview@example.com'
        });
    });

    it('surfaces delivery service error as INTERNAL_ERROR', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService({
            sendTestEmail: vi.fn().mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'Brevo timeout' }
            })
        });
        const svc = makeService({ deliveryService: deliverySvc });

        enqueueQueryResponse([makeCampaignRow()]);

        const result = await svc.testSend(actor, {
            id: CAMPAIGN_ID,
            toEmail: 'preview@example.com'
        });

        expect(result.error?.code).toBe('INTERNAL_ERROR');
        expect(result.error?.reason).toBe('TEST_SEND_FAILED');
    });
});

// ===========================================================================
// cancel
// ===========================================================================

describe('NewsletterCampaignService.cancel', () => {
    it('cancels a sending campaign and bulk-skips deliveries', async () => {
        const actor = makeAdminActor();
        const deliverySvc = makeDeliveryService({
            bulkSkipPending: vi.fn().mockResolvedValue({ data: 10 })
        });
        const svc = makeService({ deliveryService: deliverySvc });

        // SELECT → sending campaign
        enqueueQueryResponse([makeCampaignRow({ status: 'sending' })]);
        // UPDATE → no rows returned
        enqueueQueryResponse([]);

        const result = await svc.cancel(actor, { id: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data?.skipped).toBe(10);
        expect(deliverySvc.bulkSkipPending).toHaveBeenCalledWith({ campaignId: CAMPAIGN_ID });
    });

    it('rejects cancel when status is "draft"', async () => {
        const actor = makeAdminActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([makeCampaignRow({ status: 'draft' })]);

        const result = await svc.cancel(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_CANCELLABLE');
    });

    it('rejects cancel when status is "sent"', async () => {
        const actor = makeAdminActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([makeCampaignRow({ status: 'sent' })]);

        const result = await svc.cancel(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_CANCELLABLE');
    });

    it('rejects cancel when status is "cancelled"', async () => {
        const actor = makeAdminActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        enqueueQueryResponse([makeCampaignRow({ status: 'cancelled' })]);

        const result = await svc.cancel(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('ALREADY_EXISTS');
        expect(result.error?.reason).toBe('CAMPAIGN_NOT_CANCELLABLE');
    });

    it('rejects cancel actor without NEWSLETTER_CAMPAIGN_SEND', async () => {
        const actor = makeUnpermissionedActor();
        const svc = makeService({ deliveryService: makeDeliveryService() });

        const result = await svc.cancel(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('FORBIDDEN');
    });
});

// ===========================================================================
// computeMetrics
// ===========================================================================

describe('NewsletterCampaignService.computeMetrics', () => {
    it('returns aggregated delivery metrics', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        // SELECT campaign header
        enqueueQueryResponse([makeCampaignRow({ totalRecipients: 100, totalSoftcapped: 5 })]);
        // db.execute for metrics aggregate
        enqueueExecuteResponse([
            {
                pending: '10',
                delivered: '80',
                failed: '5',
                skipped: '5',
                opened: '40',
                clicked: '20'
            }
        ]);

        const result = await svc.computeMetrics(actor, { id: CAMPAIGN_ID });

        expect(result.error).toBeUndefined();
        expect(result.data?.pending).toBe(10);
        expect(result.data?.delivered).toBe(80);
        expect(result.data?.failed).toBe(5);
        expect(result.data?.skipped).toBe(5);
        expect(result.data?.opened).toBe(40);
        expect(result.data?.clicked).toBe(20);
        expect(result.data?.totalRecipients).toBe(100);
        expect(result.data?.totalSoftcapped).toBe(5);
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([]);

        const result = await svc.computeMetrics(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('rejects actor without NEWSLETTER_CAMPAIGN_VIEW', async () => {
        const actor = makeUnpermissionedActor();
        const svc = makeService();

        const result = await svc.computeMetrics(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('FORBIDDEN');
    });
});

// ===========================================================================
// getFailedDeliveries
// ===========================================================================

describe('NewsletterCampaignService.getFailedDeliveries', () => {
    it('returns paginated list of failed deliveries', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        // SELECT campaign (exists check)
        enqueueQueryResponse([{ id: CAMPAIGN_ID }]);
        // SELECT items
        enqueueQueryResponse([makeDeliveryRow(), makeDeliveryRow({ id: DELIVERY_ID_2 })]);
        // SELECT count
        enqueueQueryResponse([{ total: 2 }]);

        const result = await svc.getFailedDeliveries(actor, {
            id: CAMPAIGN_ID,
            page: 1,
            pageSize: 50
        });

        expect(result.error).toBeUndefined();
        expect(result.data?.items).toHaveLength(2);
        expect(result.data?.total).toBe(2);
        expect(result.data?.page).toBe(1);
        expect(result.data?.pageSize).toBe(50);
    });

    it('rejects actor without NEWSLETTER_CAMPAIGN_VIEW', async () => {
        const actor = makeUnpermissionedActor();
        const svc = makeService();

        const result = await svc.getFailedDeliveries(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('returns NOT_FOUND when campaign does not exist', async () => {
        const actor = makeAdminActor();
        const svc = makeService();

        enqueueQueryResponse([]);

        const result = await svc.getFailedDeliveries(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('NOT_FOUND');
    });
});

// ===========================================================================
// closeSentCampaigns
// ===========================================================================

describe('NewsletterCampaignService.closeSentCampaigns', () => {
    it('closes sending campaigns with no pending deliveries and returns count', async () => {
        const svc = makeService();

        // db.execute (SELECT ids) → two campaigns to close
        enqueueExecuteResponse([
            { id: CAMPAIGN_ID },
            { id: 'ffffffff-ffff-4fff-ffff-fffffffffffe' }
        ]);
        // db.execute (UPDATE) → nothing needed
        enqueueExecuteResponse([]);

        const result = await svc.closeSentCampaigns();

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(2);

        // SQL must contain the NOT EXISTS subquery fragment
        const selectSql = capturedSqlStrings[0] ?? '';
        expect(selectSql).toMatch(/not exists/i);
        expect(selectSql).toMatch(/pending/i);
    });

    it('returns 0 when no campaigns need closing', async () => {
        const svc = makeService();

        // db.execute → empty result
        enqueueExecuteResponse([]);

        const result = await svc.closeSentCampaigns();

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(0);
        // Only one SQL call should have been made (the SELECT — no UPDATE needed)
        expect(capturedSqlStrings).toHaveLength(1);
    });

    it('SQL includes status = sending filter', async () => {
        const svc = makeService();

        enqueueExecuteResponse([]);

        await svc.closeSentCampaigns();

        const sql = capturedSqlStrings[0] ?? '';
        expect(sql).toMatch(/sending/i);
    });

    // -----------------------------------------------------------------------
    // SPEC-108 T-108-02: admin notification when failed > 0 on close
    // -----------------------------------------------------------------------

    it('fires notifyCampaignClosedWithFailuresFn for campaigns closed with failed > 0', async () => {
        const notifyFn = vi.fn(async () => {});
        const svc = makeService({ notifyCampaignClosedWithFailuresFn: notifyFn });

        // SELECT (toCloseResult): one campaign to close
        enqueueExecuteResponse([{ id: CAMPAIGN_ID }]);
        // UPDATE (bulk transition to sent)
        enqueueExecuteResponse([]);
        // SELECT (failure-count aggregate): one campaign with failed > 0
        enqueueExecuteResponse([
            {
                id: CAMPAIGN_ID,
                subject: 'Test Subject',
                total_recipients: 100,
                delivered: 95,
                failed: 5
            }
        ]);

        const result = await svc.closeSentCampaigns();

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(1);
        expect(notifyFn).toHaveBeenCalledTimes(1);
        expect(notifyFn).toHaveBeenCalledWith(
            expect.objectContaining({
                campaignId: CAMPAIGN_ID,
                subject: 'Test Subject',
                totalRecipients: 100,
                delivered: 95,
                failed: 5,
                closedAt: expect.any(Date)
            })
        );
    });

    it('does NOT fire notifyCampaignClosedWithFailuresFn when failed === 0', async () => {
        const notifyFn = vi.fn(async () => {});
        const svc = makeService({ notifyCampaignClosedWithFailuresFn: notifyFn });

        // SELECT (toCloseResult): one campaign to close
        enqueueExecuteResponse([{ id: CAMPAIGN_ID }]);
        // UPDATE (bulk transition to sent)
        enqueueExecuteResponse([]);
        // SELECT (failure-count aggregate): the HAVING clause filters out
        // campaigns with failed === 0 server-side, so the result is empty.
        enqueueExecuteResponse([]);

        const result = await svc.closeSentCampaigns();

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(1);
        expect(notifyFn).not.toHaveBeenCalled();
    });

    it('skips the failure-count query when no campaigns transitioned', async () => {
        const notifyFn = vi.fn(async () => {});
        const svc = makeService({ notifyCampaignClosedWithFailuresFn: notifyFn });

        // SELECT (toCloseResult): empty — no transitions
        enqueueExecuteResponse([]);

        const result = await svc.closeSentCampaigns();

        expect(result.error).toBeUndefined();
        expect(result.data).toBe(0);
        // Only one SQL call (the initial SELECT). No UPDATE, no failure-count.
        expect(capturedSqlStrings).toHaveLength(1);
        expect(notifyFn).not.toHaveBeenCalled();
    });

    it('swallows notifier errors so the campaign transition is not rolled back', async () => {
        const notifyFn = vi.fn(async () => {
            throw new Error('transport temporarily unavailable');
        });
        const svc = makeService({ notifyCampaignClosedWithFailuresFn: notifyFn });

        enqueueExecuteResponse([{ id: CAMPAIGN_ID }]);
        enqueueExecuteResponse([]);
        enqueueExecuteResponse([
            {
                id: CAMPAIGN_ID,
                subject: 'Test Subject',
                total_recipients: 10,
                delivered: 9,
                failed: 1
            }
        ]);

        const result = await svc.closeSentCampaigns();

        // The service-level result is success — the notifier failure is
        // logged but does NOT bubble up.
        expect(result.error).toBeUndefined();
        expect(result.data).toBe(1);
        expect(notifyFn).toHaveBeenCalledTimes(1);
    });
});

// ===========================================================================
// requireDeliveryService guard
// ===========================================================================

describe('NewsletterCampaignService — delivery service not configured', () => {
    it('send() returns SERVICE_UNAVAILABLE when deliveryService is missing', async () => {
        const actor = makeAdminActor();
        // No deliveryService injected
        const svc = makeService();

        enqueueQueryResponse([makeCampaignRow()]);

        const subscriberSvc = makeSubscriberService();
        (svc as unknown as { subscriberService: unknown }).subscriberService = subscriberSvc;

        const result = await svc.send(actor, { id: CAMPAIGN_ID });

        expect(result.error?.code).toBe('SERVICE_UNAVAILABLE');
        expect(result.error?.reason).toBe('DELIVERY_SERVICE_NOT_CONFIGURED');
    });
});
