/**
 * @file admin/campaigns.ts
 *
 * Admin campaign endpoints (SPEC-101 T-101-27 + T-101-28).
 *
 * T-101-27 — Campaign CRUD:
 *   GET    /api/v1/admin/newsletter/campaigns          paginated list with filters
 *   POST   /api/v1/admin/newsletter/campaigns          create draft → 201
 *   GET    /api/v1/admin/newsletter/campaigns/:id      get one
 *   PATCH  /api/v1/admin/newsletter/campaigns/:id      update draft → 409 if not draft
 *   DELETE /api/v1/admin/newsletter/campaigns/:id      soft-delete → 409 if sending/sent
 *
 * T-101-28 — Campaign Actions + Metrics:
 *   POST /api/v1/admin/newsletter/campaigns/:id/test-send  preview email to admin
 *   POST /api/v1/admin/newsletter/campaigns/:id/send       dispatch campaign
 *   POST /api/v1/admin/newsletter/campaigns/:id/cancel     cancel sending campaign
 *   GET  /api/v1/admin/newsletter/campaigns/:id/metrics    live metrics (no-cache)
 *   GET  /api/v1/admin/newsletter/campaigns/:id/errors     paginated failed deliveries
 *
 * Permissions:
 *   VIEW actions → NEWSLETTER_CAMPAIGN_VIEW
 *   WRITE actions → NEWSLETTER_CAMPAIGN_WRITE
 *   SEND actions → NEWSLETTER_CAMPAIGN_SEND
 *
 * NOTE: NewsletterCampaignService does not expose `list` or `getById` methods.
 * The list and get-one handlers query the DB directly (read-only, no business
 * logic involved) following the same pattern as other admin read endpoints.
 *
 * @module routes/newsletter/admin/campaigns
 */

import { z } from '@hono/zod-openapi';
import type { SelectNewsletterCampaign } from '@repo/db';
import { getDb, newsletterCampaigns } from '@repo/db';
import { safeIlike } from '@repo/db';
import {
    CreateNewsletterCampaignSchema,
    NewsletterCampaignAdminSearchSchema,
    NewsletterCampaignSchema,
    PermissionEnum,
    ServiceErrorCode,
    UpdateNewsletterCampaignSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getActorFromContext } from '../../../utils/actor';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';
import { getDefaultUserService } from '../protected/_singletons';
import { getDefaultCampaignService } from './_singletons';

// ---------------------------------------------------------------------------
// Injectable query deps (test seam)
// ---------------------------------------------------------------------------

/**
 * Dependencies injected into the list handler.
 *
 * In production these resolve to the real Drizzle query.
 * In tests they can be replaced with mock implementations so the test suite
 * does not need a real Drizzle table object from `@repo/db`.
 */
export interface ListCampaignsDeps {
    /** Execute a paginated campaign query and return items + total. */
    queryCampaigns: (opts: {
        campaignStatus?: string;
        localeFilter?: string;
        titleSearch?: string;
        sort?: string;
        page: number;
        pageSize: number;
    }) => Promise<{ items: SelectNewsletterCampaign[]; total: number }>;
}

/**
 * Dependencies injected into the getById handler.
 *
 * In production resolves to the real Drizzle query.
 * In tests replaced with a mock.
 */
export interface GetCampaignByIdDeps {
    /** Fetch a single non-deleted campaign by UUID. Returns `null` when not found. */
    queryCampaignById: (id: string) => Promise<SelectNewsletterCampaign | null>;
}

/**
 * Default production implementation of {@link ListCampaignsDeps.queryCampaigns}.
 *
 * Queries the `newsletter_campaigns` table directly because
 * `NewsletterCampaignService` does not expose a list method.
 */
async function defaultQueryCampaigns(opts: {
    campaignStatus?: string;
    localeFilter?: string;
    titleSearch?: string;
    sort?: string;
    page: number;
    pageSize: number;
}): Promise<{ items: SelectNewsletterCampaign[]; total: number }> {
    const db = getDb();
    const offset = (opts.page - 1) * opts.pageSize;

    const conditions = [isNull(newsletterCampaigns.deletedAt)];

    if (opts.campaignStatus) {
        conditions.push(
            eq(
                newsletterCampaigns.status,
                opts.campaignStatus as 'draft' | 'sending' | 'sent' | 'cancelled'
            )
        );
    }

    if (opts.localeFilter) {
        conditions.push(
            eq(newsletterCampaigns.localeFilter, opts.localeFilter as 'all' | 'es' | 'en' | 'pt')
        );
    }

    if (typeof opts.titleSearch === 'string' && opts.titleSearch.length > 0) {
        // safeIlike escapes %, _, \\ in the user-supplied term per project
        // convention (the raw drizzle-orm helper is rejected by CI).
        conditions.push(safeIlike(newsletterCampaigns.title, opts.titleSearch));
    }

    const whereClause = and(...conditions);
    const orderBy =
        opts.sort === 'asc'
            ? asc(newsletterCampaigns.createdAt)
            : desc(newsletterCampaigns.createdAt);

    const [items, totalResult] = await Promise.all([
        db
            .select()
            .from(newsletterCampaigns)
            .where(whereClause)
            .orderBy(orderBy)
            .limit(opts.pageSize)
            .offset(offset),
        db.select({ total: count() }).from(newsletterCampaigns).where(whereClause)
    ]);

    const total = totalResult[0]?.total ?? 0;
    return { items, total };
}

/**
 * Default production implementation of {@link GetCampaignByIdDeps.queryCampaignById}.
 */
async function defaultQueryCampaignById(id: string): Promise<SelectNewsletterCampaign | null> {
    const db = getDb();
    const result = await db
        .select()
        .from(newsletterCampaigns)
        .where(and(eq(newsletterCampaigns.id, id), isNull(newsletterCampaigns.deletedAt)))
        .limit(1);
    return result[0] ?? null;
}

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/**
 * Response schema for the `send` endpoint.
 *
 * Covers both the dispatched (202) and no-eligible-subscribers (200) shapes.
 * The HTTP status is set manually inside the handler.
 */
const SendResponseSchema = z.union([
    z.object({
        dispatched: z.literal(true),
        enqueued: z.number().int().min(0),
        softcapped: z.number().int().min(0)
    }),
    z.object({
        dispatched: z.literal(false),
        reason: z.literal('no_eligible_subscribers')
    })
]);

/** Request body schema for the `test-send` endpoint. */
const TestSendBodySchema = z.object({
    /** Override recipient. When omitted the actor's own email is used. */
    toEmail: z.string().email().optional()
});

/** Response schema for the `test-send` endpoint. */
const TestSendResponseSchema = z.object({
    sent: z.literal(true),
    sentTo: z.string().email()
});

/** Response schema for the `cancel` endpoint. */
const CancelResponseSchema = z.object({
    cancelled: z.literal(true),
    skipped: z.number().int().min(0)
});

/** Aggregated campaign metrics response schema. */
const CampaignMetricsSchema = z.object({
    campaignId: z.string().uuid(),
    totalRecipients: z.number().int().min(0),
    totalSoftcapped: z.number().int().min(0),
    pending: z.number().int().min(0),
    delivered: z.number().int().min(0),
    failed: z.number().int().min(0),
    skipped: z.number().int().min(0),
    opened: z.number().int().min(0),
    clicked: z.number().int().min(0)
});

/**
 * Failed delivery item schema (email masked by route handler).
 *
 * The service returns `subscriberId` but not the raw subscriber email —
 * email would require a join not present in `getFailedDeliveries`. We expose
 * `maskedEmail` as a derived placeholder; when T-101-16 joins subscribers the
 * real value can be masked here.
 */
const FailedDeliveryItemSchema = z.object({
    id: z.string().uuid(),
    subscriberId: z.string().uuid(),
    channel: z.string(),
    maskedEmail: z.string(),
    errorMessage: z.string().nullable(),
    retryCount: z.number().int().min(0),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Masks an email address to protect PII in admin error logs.
 *
 * Replaces everything before `@` except the first 2 characters with `***`.
 *
 * @example
 * maskEmail('john@example.com')  // 'jo***@example.com'
 * maskEmail('ab@example.com')    // 'ab***@example.com'
 * maskEmail('a@example.com')     // 'a***@example.com'
 */
function maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex < 0) return email;
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    const visible = local.slice(0, 2);
    return `${visible}***${domain}`;
}

/**
 * Converts a `ServiceError` with `ALREADY_EXISTS` + a campaign-state conflict
 * reason into an `HTTPException(409)`.
 *
 * `handleRouteError` maps `ALREADY_EXISTS` → 400 by default, but the AC
 * requires 409 for campaign-state conflicts. Re-throwing as HTTPException
 * causes `handleRouteError` to pick up the correct 409 status.
 *
 * Conflict reasons that trigger 409:
 * - `CAMPAIGN_NOT_DRAFT`       (PATCH / DELETE)
 * - `CAMPAIGN_NOT_SENDABLE`    (send)
 * - `CAMPAIGN_NOT_CANCELLABLE` (cancel)
 *
 * The check is duck-typed on `err.code` and `err.reason` (both strings) to
 * remain resilient to the mock `ServiceError` used in the test suite, which
 * does not extend the real class but carries the same public properties.
 *
 * @throws {HTTPException} 409 for state-conflict cases.
 * @throws Re-throws the original error for all other cases.
 */
function rethrowConflictAsHttp409(err: unknown): never {
    const CONFLICT_REASONS = [
        'CAMPAIGN_NOT_DRAFT',
        'CAMPAIGN_NOT_SENDABLE',
        'CAMPAIGN_NOT_CANCELLABLE'
    ] as const;

    if (
        err !== null &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === ServiceErrorCode.ALREADY_EXISTS &&
        'reason' in err &&
        typeof (err as { reason: unknown }).reason === 'string' &&
        CONFLICT_REASONS.includes(
            (err as { reason: string }).reason as (typeof CONFLICT_REASONS)[number]
        )
    ) {
        const message =
            'message' in err ? String((err as { message: unknown }).message) : 'Conflict';
        throw new HTTPException(409, { message });
    }
    throw err;
}

// ---------------------------------------------------------------------------
// T-101-27: CRUD routes
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/newsletter/campaigns
 *
 * Paginated list of newsletter campaigns with optional status / localeFilter /
 * titleSearch filters. Implemented directly against the DB because
 * `NewsletterCampaignService` does not expose a list method.
 *
 * `createAdminListRoute` auto-merges `PaginationQuerySchema` and rejects
 * unknown query params — only the keys from `NewsletterCampaignAdminSearchSchema`
 * (minus page/pageSize) plus pagination keys are accepted.
 *
 * @param deps - Injectable query implementation (defaults to real Drizzle query).
 *   Pass a custom `queryCampaigns` in tests to avoid importing the real table object.
 */
export function buildAdminListCampaignsRoute(
    deps: ListCampaignsDeps = { queryCampaigns: defaultQueryCampaigns }
) {
    return createAdminListRoute({
        method: 'get',
        path: '/campaigns',
        summary: 'List newsletter campaigns (admin)',
        description:
            'Paginated list of newsletter campaigns with optional campaignStatus, localeFilter, and titleSearch filters.',
        tags: ['Newsletter'],
        requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
        requestQuery: NewsletterCampaignAdminSearchSchema.omit({
            page: true,
            pageSize: true
        }).shape,
        responseSchema: NewsletterCampaignSchema,
        handler: async (_ctx: Context, _params, _body, query) => {
            const { page, pageSize } = extractPaginationParams(query ?? {});
            const q = (query ?? {}) as Record<string, unknown>;

            const { items, total } = await deps.queryCampaigns({
                campaignStatus: q.campaignStatus as string | undefined,
                localeFilter: q.localeFilter as string | undefined,
                titleSearch: q.titleSearch as string | undefined,
                sort: q.sort as string | undefined,
                page,
                pageSize
            });

            return {
                items,
                pagination: getPaginationResponse(total, { page, pageSize })
            };
        }
    });
}

/** Default export wired with the production Drizzle query implementation. */
export const adminListCampaignsRoute = buildAdminListCampaignsRoute();

/**
 * POST /api/v1/admin/newsletter/campaigns
 *
 * Creates a new newsletter campaign in DRAFT status.
 * Returns HTTP 201 on success.
 */
export const adminCreateCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns',
    summary: 'Create newsletter campaign (admin)',
    description:
        'Creates a new newsletter campaign in DRAFT status. All fields required except localeFilter (defaults to "all").',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestBody: CreateNewsletterCampaignSchema,
    responseSchema: NewsletterCampaignSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const parsed = CreateNewsletterCampaignSchema.parse(body);

        const result = await campaignSvc.create(actor, {
            ...parsed,
            createdBy: actor.id
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * GET /api/v1/admin/newsletter/campaigns/:id
 *
 * Returns a single campaign by UUID. Returns 404 when not found.
 * Implemented directly against the DB because `NewsletterCampaignService`
 * does not expose a `getById` method.
 *
 * @param deps - Injectable query implementation (defaults to real Drizzle query).
 *   Pass a custom `queryCampaignById` in tests to avoid importing the real table object.
 */
export function buildAdminGetCampaignRoute(
    deps: GetCampaignByIdDeps = { queryCampaignById: defaultQueryCampaignById }
) {
    return createAdminRoute({
        method: 'get',
        path: '/campaigns/{id}',
        summary: 'Get newsletter campaign (admin)',
        description: 'Returns a single newsletter campaign by ID including all audit fields.',
        tags: ['Newsletter'],
        requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
        requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
        responseSchema: NewsletterCampaignSchema,
        handler: async (_ctx: Context, params) => {
            const id = params.id as string;
            const campaign = await deps.queryCampaignById(id);

            if (!campaign) {
                // Use HTTPException so handleRouteError maps it to 404 via
                // the `instanceof HTTPException` path — resilient to the test
                // mock ServiceError which is not `instanceof` the real class.
                throw new HTTPException(404, { message: `Campaign not found: ${id}` });
            }

            return campaign;
        }
    });
}

/** Default export wired with the production Drizzle query implementation. */
export const adminGetCampaignRoute = buildAdminGetCampaignRoute();

/**
 * PATCH /api/v1/admin/newsletter/campaigns/:id
 *
 * Partially updates a DRAFT campaign.
 * Returns HTTP 409 when the campaign is not in DRAFT status.
 */
export const adminUpdateCampaignRoute = createAdminRoute({
    method: 'patch',
    path: '/campaigns/{id}',
    summary: 'Update draft newsletter campaign (admin)',
    description:
        'Partially updates a DRAFT newsletter campaign. Returns 409 if the campaign is not in draft status.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestBody: UpdateNewsletterCampaignSchema,
    responseSchema: NewsletterCampaignSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;
        const parsed = UpdateNewsletterCampaignSchema.parse(body);

        try {
            const result = await campaignSvc.update(actor, { id, data: parsed });

            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }

            return result.data;
        } catch (err) {
            rethrowConflictAsHttp409(err);
        }
    }
});

/**
 * DELETE /api/v1/admin/newsletter/campaigns/:id
 *
 * Soft-deletes a DRAFT campaign.
 * Returns HTTP 409 when the campaign is not in DRAFT status.
 * Returns HTTP 204 on success.
 */
export const adminDeleteCampaignRoute = createAdminRoute({
    method: 'delete',
    path: '/campaigns/{id}',
    summary: 'Soft-delete newsletter campaign (admin)',
    description:
        'Soft-deletes a newsletter campaign. Only DRAFT campaigns may be deleted. Returns 409 if status is sending or sent.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: z.null(),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;

        try {
            const result = await campaignSvc.softDelete(actor, { id });

            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }

            return null;
        } catch (err) {
            rethrowConflictAsHttp409(err);
        }
    }
});

// ---------------------------------------------------------------------------
// T-101-28: Action + Metrics routes
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/admin/newsletter/campaigns/:id/test-send
 *
 * Sends a preview email without creating delivery rows or changing campaign status.
 *
 * When `toEmail` is omitted in the request body, the actor's own email is
 * resolved via `UserService.getById`. The delivery service prefixes the subject
 * with `[PRUEBA]`.
 *
 * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
 */
export const adminTestSendCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/test-send',
    summary: 'Test-send newsletter campaign (admin)',
    description:
        "Sends a preview email to the admin's own email (or an override address). Does not create delivery rows or change campaign status.",
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    requestBody: TestSendBodySchema,
    responseSchema: TestSendResponseSchema,
    // test-send is idempotent — 200 (not 201) because it does not persist anything
    successStatusCode: 200,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;
        const parsedBody = TestSendBodySchema.parse(body);

        let toEmail: string;

        if (parsedBody.toEmail) {
            toEmail = parsedBody.toEmail;
        } else {
            // Resolve actor email from UserService — canonical source of truth.
            const userSvc = getDefaultUserService();
            const userResult = await userSvc.getById(actor, actor.id);

            if (userResult.error) {
                // Use code-prefixed message format so handleRouteError's string-parse
                // path can map it to the right HTTP status regardless of ServiceError class.
                throw new Error(`${userResult.error.code}: ${userResult.error.message}`);
            }
            if (!userResult.data?.email) {
                // 400 — admin has no email configured; use HTTPException for clarity.
                throw new HTTPException(400, {
                    message: 'Admin user has no email on file. Provide toEmail in the request body.'
                });
            }
            toEmail = userResult.data.email;
        }

        const result = await campaignSvc.testSend(actor, { id, toEmail });

        if (result.error) {
            // Use code-prefixed message format for correct HTTP status mapping.
            throw new Error(`${result.error.code}: ${result.error.message}`);
        }

        return { sent: true as const, sentTo: result.data.sentTo };
    }
});

/**
 * POST /api/v1/admin/newsletter/campaigns/:id/send
 *
 * Dispatches a campaign to all eligible subscribers.
 *
 * Response variants:
 * - HTTP 202 `{ dispatched: true, enqueued, softcapped }` — subscribers enqueued.
 * - HTTP 200 `{ dispatched: false, reason: 'no_eligible_subscribers' }` — 0 eligible.
 * - HTTP 409 — campaign is not in DRAFT status (`CAMPAIGN_NOT_SENDABLE`).
 *
 * Rate-limited to 1 request per minute per IP.
 * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
 */
export const adminSendCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/send',
    summary: 'Send newsletter campaign (admin)',
    description:
        'Dispatches a campaign to all eligible subscribers. Returns 202 with enqueued count, 200 if no eligible subscribers, or 409 if not sendable.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: SendResponseSchema,
    options: {
        customRateLimit: { requests: 1, windowMs: 60_000 }
    },
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;

        try {
            const result = await campaignSvc.send(actor, { id });

            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }

            const { enqueued, softcapped } = result.data;

            if (enqueued === 0) {
                // HTTP 200 — no eligible subscribers.
                // The factory defaults POST → 201, so we return a Response directly.
                return ctx.json(
                    { dispatched: false as const, reason: 'no_eligible_subscribers' as const },
                    200
                );
            }

            // HTTP 202 — dispatched with enqueued count.
            return ctx.json({ dispatched: true as const, enqueued, softcapped }, 202);
        } catch (err) {
            rethrowConflictAsHttp409(err);
        }
    }
});

/**
 * POST /api/v1/admin/newsletter/campaigns/:id/cancel
 *
 * Cancels a campaign in `sending` status by bulk-flipping pending deliveries
 * to `skipped`.
 *
 * Response variants:
 * - HTTP 200 `{ cancelled: true, skipped }` — success.
 * - HTTP 409 — campaign is not in a cancellable status.
 *
 * Requires `NEWSLETTER_CAMPAIGN_SEND` permission.
 */
export const adminCancelCampaignRoute = createAdminRoute({
    method: 'post',
    path: '/campaigns/{id}/cancel',
    summary: 'Cancel newsletter campaign (admin)',
    description:
        'Cancels a sending campaign, flipping all pending deliveries to skipped. Returns 409 if not cancellable.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_SEND],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: CancelResponseSchema,
    // cancel is a state transition, not a resource creation — return 200
    successStatusCode: 200,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;

        try {
            const result = await campaignSvc.cancel(actor, { id });

            if (result.error) {
                throw new ServiceError(result.error.code, result.error.message);
            }

            return { cancelled: true as const, skipped: result.data.skipped };
        } catch (err) {
            rethrowConflictAsHttp409(err);
        }
    }
});

/**
 * GET /api/v1/admin/newsletter/campaigns/:id/metrics
 *
 * Returns aggregated delivery metrics for a campaign.
 * Sets `Cache-Control: no-store` so browsers always fetch fresh counters.
 *
 * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission.
 */
export const adminCampaignMetricsRoute = createAdminRoute({
    method: 'get',
    path: '/campaigns/{id}/metrics',
    summary: 'Get campaign metrics (admin)',
    description:
        'Returns aggregated delivery metrics (pending, delivered, failed, opened, clicked). Always fresh — Cache-Control: no-store.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: CampaignMetricsSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;

        ctx.header('Cache-Control', 'no-store');

        const result = await campaignSvc.computeMetrics(actor, { id });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});

/**
 * GET /api/v1/admin/newsletter/campaigns/:id/errors
 *
 * Paginated list of failed delivery rows for a campaign.
 *
 * The subscriber `maskedEmail` field replaces everything before `@` (except
 * the first 2 chars) with `***` to protect PII in the admin UI.
 *
 * Note: `getFailedDeliveries` returns `subscriberId` but not the raw email
 * (the service does not join the subscribers table). The masked value is
 * derived from the subscriber UUID as a safe placeholder until a join is
 * added in a future task.
 *
 * Requires `NEWSLETTER_CAMPAIGN_VIEW` permission.
 */
export const adminCampaignErrorsRoute = createAdminListRoute({
    method: 'get',
    path: '/campaigns/{id}/errors',
    summary: 'Get campaign delivery errors (admin)',
    description:
        'Paginated list of failed delivery rows. Subscriber email is masked for PII protection.',
    tags: ['Newsletter'],
    requiredPermissions: [PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW],
    requestParams: { id: z.string().uuid('Campaign ID must be a valid UUID') },
    responseSchema: FailedDeliveryItemSchema,
    handler: async (_ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(_ctx);
        const campaignSvc = await getDefaultCampaignService();
        const id = params.id as string;
        const { page, pageSize } = extractPaginationParams(query ?? {});

        const result = await campaignSvc.getFailedDeliveries(actor, { id, page, pageSize });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const { items, total } = result.data;

        // Mask emails in-route.
        // The service returns subscriberId but not the raw email address
        // (no join with subscribers table). We produce a masked placeholder
        // derived from the subscriberId prefix so the format is consistent.
        const maskedItems = items.map((item) => ({
            id: item.id,
            subscriberId: item.subscriberId,
            channel: item.channel,
            maskedEmail: maskEmail(`sub-${item.subscriberId.slice(0, 8)}@masked.invalid`),
            errorMessage: item.errorMessage,
            retryCount: item.retryCount,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }));

        return {
            items: maskedItems,
            pagination: getPaginationResponse(total, { page, pageSize })
        };
    }
});
