import { randomUUID } from 'node:crypto';
import {
    FAKE_NOTICE_DELAY_MS,
    FAKE_PAUSE_BEFORE_EXPIRY_MS,
    FakePaymentProvider
} from '@repo/payments/fake';
import type { FakeProviderRequest } from '@repo/payments/fake-server';
import { createAdjustableClock } from '@repo/test-clock';
import { z } from 'zod';
import { cleanupTestUsers } from '../support/test-cleanup.ts';
import { type CreatedUser, createUser, markProfileCompleted } from './api-helpers.ts';
import { execSQL, getDbPool } from './db-helpers.ts';
import {
    E2E_RECEIVER_PATH,
    E2E_WEBHOOK_SECRET,
    startE2eFakeProvider
} from './fake-provider-server.ts';
import type { E2eMailCaptureServer } from './mail-capture-server.ts';
import { startE2eMailCapture } from './mail-capture-server.ts';

/** Base URL of the E2E API. */
export const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
/** Base URL of the E2E web application. */
export const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
/** Milliseconds in one fixed-duration day. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Running adjustable-clock provider and captured-mail test world. */
export interface FakeWorld {
    readonly clock: ReturnType<typeof createAdjustableClock>;
    readonly fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>>;
    readonly mailCapture: E2eMailCaptureServer;
}

/** New subscriber and privileged actor required by the arrears cron. */
export interface ArrearsSubscriber {
    readonly user: CreatedUser;
    readonly admin: CreatedUser;
}

/** Cron data returned by the admin endpoint. */
export interface CronData {
    readonly success?: boolean;
    readonly processed?: number;
    readonly errors?: number;
    readonly details?: { readonly failedSubscriptionIds?: readonly string[] };
    readonly jobName?: string;
}

const CronDataSchema = z.object({
    success: z.boolean().optional(),
    processed: z.number().optional(),
    errors: z.number().optional(),
    details: z.object({ failedSubscriptionIds: z.array(z.string()).optional() }).optional(),
    jobName: z.string().optional()
});
const CronResponseSchema = CronDataSchema.extend({ data: CronDataSchema.optional() });
const CardSubscriptionResponseSchema = z.object({
    data: z.object({ subscriptionId: z.string().optional() }).optional(),
    error: z.object({ message: z.string().optional() }).optional()
});

/** Create a subscriber with completed onboarding and its SUPER_ADMIN cron actor. */
export async function createSubscriber(): Promise<ArrearsSubscriber> {
    const user = await createUser({}, { apiBaseUrl: API_URL });
    await markProfileCompleted({ userId: user.id });
    const admin = await createUser({ role: 'SUPER_ADMIN' }, { apiBaseUrl: API_URL });
    return { user, admin };
}

/** Ensure the versioned billing deadline fixture exists. */
export async function ensureDeadlineVersion(): Promise<void> {
    await execSQL(
        `INSERT INTO billing_deadline_version (version, "values")
         VALUES (1, $1::jsonb) ON CONFLICT (version) DO NOTHING`,
        [
            JSON.stringify({
                '10': { cardHours: 72, manualDays: 7 },
                '11': { noticeDays: 60, contactDays: [30, 7] },
                '12': { noticeDays: 60, contactDays: [30, 7] },
                '13': { daysBefore: [5, 1] },
                '14': { daysBefore: 7 },
                '15': { hoursRemaining: 24 },
                '16': { days: 7 },
                '17': { days: 7 },
                '18': { days: 180 },
                '19': { minutes: 60 }
            })
        ]
    );
}

/** Read grace duration from the selected catalog version. */
export async function readCurrentGraceDays(args: {
    readonly planVersionId: string;
}): Promise<number> {
    const rows = await execSQL<{ grace_days: number }>(
        'SELECT grace_days FROM plan_version WHERE id = $1',
        [args.planVersionId]
    );
    const days = rows[0]?.grace_days;
    if (days === undefined)
        throw new Error(`No grace_days found for plan version ${args.planVersionId}`);
    return days;
}

/** Start the HTTP fake provider, adjustable clock, and mail capture. */
export async function startFakeWorld(): Promise<FakeWorld> {
    const clock = createAdjustableClock({ start: new Date() });
    const fakeServer = await startE2eFakeProvider({
        provider: new FakePaymentProvider({
            clock,
            idNamespace: randomUUID(),
            honestAbout: [
                {
                    lie: 'M6',
                    why: 'TEST:B7:17 delivers the provider notices needed by the grace expiry flow.'
                },
                {
                    lie: 'M8',
                    why: 'TEST:B7:17 makes the credited cycle available to the API immediately.'
                }
            ]
        }),
        clock
    });
    try {
        const mailCapture = await startE2eMailCapture();
        return { clock, fakeServer, mailCapture };
    } catch (error) {
        await fakeServer.close();
        throw error;
    }
}

/** Advance provider notices when requested and deliver pending notices to the API. */
export async function deliverNotices(args: {
    readonly fakeServer: FakeWorld['fakeServer'];
    readonly advanceMs?: number;
}): Promise<{ readonly delivered: number; readonly skipped: number }> {
    if (args.advanceMs !== undefined) await args.fakeServer.advanceClock({ ms: args.advanceMs });
    const result = await args.fakeServer.deliverDueAsMercadoPago({
        to: `${API_URL}${E2E_RECEIVER_PATH}`,
        webhookSecret: E2E_WEBHOOK_SECRET
    });
    if (result.delivered === 0)
        throw new Error('Expected at least one due provider notice to be delivered.');
    return result;
}

/** Approve a pending card authorization and wait for the subscription to activate. */
export async function activateCardSubscription(args: {
    readonly fakeServer: FakeWorld['fakeServer'];
    readonly subscriptionId: string;
}): Promise<void> {
    const authorizationId = await authorizationFor(args.subscriptionId);
    await args.fakeServer.provider.approve({ authorizationId });
    await deliverNotices({ fakeServer: args.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
    await waitForSubscriptionStatus({ subscriptionId: args.subscriptionId, status: 'ACTIVE' });
}

/** Record an approved charge and wait for its successful payment row. */
export async function recordCreditedCycle(args: {
    readonly fakeServer: FakeWorld['fakeServer'];
    readonly subscriptionId: string;
    readonly authorizationId: string;
}): Promise<void> {
    const authorization = await args.fakeServer.provider.readAuthorization({
        authorizationId: args.authorizationId
    });
    const amount = authorization.snapshot.amount;
    if (!amount) throw new Error(`Expected amount on authorization ${args.authorizationId}`);
    await args.fakeServer.provider.charge({
        authorizationId: args.authorizationId,
        amount,
        reference: `b7-${randomUUID()}`
    });
    await deliverNotices({ fakeServer: args.fakeServer, advanceMs: FAKE_NOTICE_DELAY_MS });
    const deadline = Date.now() + 30_000;
    while (Date.now() <= deadline) {
        const rows = await execSQL<{ id: string }>(
            `SELECT id FROM payment WHERE subscription_id = $1 AND status = 'SUCCEEDED' LIMIT 1`,
            [args.subscriptionId]
        );
        if (rows.length > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Expected a SUCCEEDED payment row for subscription ${args.subscriptionId}`);
}

/** Trigger an admin cron and return its data, rejecting only non-201 HTTP responses. */
export async function runCron(args: {
    readonly jobName: string;
    readonly adminCookie: string;
}): Promise<CronData> {
    const response = await fetch(`${API_URL}/api/v1/admin/cron/${args.jobName}`, {
        method: 'POST',
        headers: { cookie: args.adminCookie }
    });
    const text = await response.text();
    if (response.status !== 201)
        throw new Error(`Expected cron ${args.jobName} HTTP 201; got ${response.status}: ${text}`);
    const body = CronResponseSchema.parse(JSON.parse(text));
    const data = body.data ?? body;
    if (!data || typeof data !== 'object')
        throw new Error(`Cron ${args.jobName} returned no data object`);
    return data;
}

/** Create a card subscription through the protected billing API. */
export async function createApiCardSubscription(args: {
    readonly user: CreatedUser;
    readonly billingOptionId: string;
}): Promise<{ readonly subscriptionId: string; readonly authorizationId: string }> {
    const response = await fetch(`${API_URL}/api/v1/protected/billing/subscriptions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: args.user.sessionCookie },
        body: JSON.stringify({ billingOptionId: args.billingOptionId })
    });
    const body = CardSubscriptionResponseSchema.parse(await response.json());
    const subscriptionId = body.data?.subscriptionId;
    if (!subscriptionId) {
        throw new Error(
            `Expected API card signup to return a subscription id; saw ${body.error?.message ?? 'no response detail'}.`
        );
    }
    const links = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    const authorizationId = links[0]?.provider_id;
    if (!authorizationId) throw new Error(`Expected provider authorization for ${subscriptionId}.`);
    return { subscriptionId, authorizationId };
}

/** Decode HTML character references before checking visible email content. */
export function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
            String.fromCodePoint(Number.parseInt(code, 16))
        )
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
        .replace(/&amp;/g, '&');
}

/** Read failed subscription IDs defensively from cron details. */
export function sweepFailedIds(data: CronData): readonly string[] {
    return data.details?.failedSubscriptionIds ?? [];
}

/** Select cancellation requests for one authorization from provider request logs. */
export function cancelRequestsFor(args: {
    readonly requests: readonly FakeProviderRequest[];
    readonly authorizationId: string;
}): readonly FakeProviderRequest[] {
    return args.requests.filter(
        (request) =>
            request.method === 'PUT' &&
            request.path === `/preapproval/${args.authorizationId}` &&
            typeof request.body === 'object' &&
            request.body !== null &&
            (request.body as { readonly status?: unknown }).status === 'cancelled'
    );
}

/** Format a date as a Spanish market date in Buenos Aires. */
export function formatMarketDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Argentina/Buenos_Aires'
    }).formatToParts(date);
    const marketDate = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
    return new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${marketDate}T00:00:00.000Z`));
}

/** Stop 30 seconds before charge expiry, after the provider pause threshold. */
export function expiryMinusPauseMargin(args: { readonly expiresAt: Date }): Date {
    const pauseAt = args.expiresAt.getTime() - FAKE_PAUSE_BEFORE_EXPIRY_MS;
    const stopAt = args.expiresAt.getTime() - 30_000;
    if (
        !Number.isFinite(args.expiresAt.getTime()) ||
        stopAt <= pauseAt ||
        stopAt >= args.expiresAt.getTime()
    ) {
        throw new Error(
            'The 30-second margin must fall strictly after provider pause and before expiry.'
        );
    }
    return new Date(stopAt);
}

/** Remove only this test's billing rows and users. */
export async function cleanupArrearsRows(args: {
    readonly userIds: readonly string[];
}): Promise<void> {
    if (args.userIds.length === 0) return;
    await execSQL(
        `DELETE FROM provider_link WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        [args.userIds]
    );
    await execSQL(
        `DELETE FROM covered_period WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        [args.userIds]
    );
    await execSQL(
        `DELETE FROM receipt WHERE payment_id IN (SELECT id FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])))`,
        [args.userIds]
    );
    await execSQL(
        `DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
        [args.userIds]
    );
    await execSQL(
        `UPDATE email_outbox SET status = 'failed', last_error = 'cancelled:e2e-cleanup', locked_by = NULL, locked_until = NULL
          WHERE recipient_user_id = ANY($1::uuid[]) AND status IN ('pending', 'retry')`,
        [args.userIds]
    );
    await cleanupTestUsers(getDbPool(), args.userIds);
}

async function authorizationFor(subscriptionId: string): Promise<string> {
    const rows = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    const id = rows[0]?.provider_id;
    if (!id) throw new Error(`Expected provider authorization for subscription ${subscriptionId}`);
    return id;
}

async function waitForSubscriptionStatus(args: {
    readonly subscriptionId: string;
    readonly status: string;
}): Promise<void> {
    const deadline = Date.now() + 30_000;
    while (Date.now() <= deadline) {
        const rows = await execSQL<{ status: string }>(
            'SELECT status FROM subscription WHERE id = $1',
            [args.subscriptionId]
        );
        if (rows[0]?.status === args.status) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Expected subscription ${args.subscriptionId} to reach ${args.status}`);
}
