import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { FakeProviderRequest } from '@repo/payments/fake-server';
import { PendingAttemptCancellationResponseSchema } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { z } from 'zod';
import type { CreatedUser } from '../../fixtures/api-helpers.ts';
import {
    API_URL,
    cancelRequestsFor,
    cleanupArrearsRows,
    createApiCardSubscription,
    createSubscriber,
    decodeHtmlEntities,
    ensureDeadlineVersion,
    runCron
} from '../../fixtures/arrears-cycle.ts';
import {
    acceptedRunId,
    cronTriggerUrl,
    waitForAcceptedCronRun
} from '../../fixtures/cron-run-wait.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';
import { startE2eFakeProvider } from '../../fixtures/fake-provider-server.ts';
import type { E2eMailCaptureServer } from '../../fixtures/mail-capture-server.ts';
import { startE2eMailCapture } from '../../fixtures/mail-capture-server.ts';
import { monthlyOptionForSlug } from '../../fixtures/signup-checkout.ts';

const JOB_NAME = 'billing-deferred-cancellation-retry';
const CANCEL_NOTICE = 'billing.attempt-cancelled-cancel';
const CANCEL_SUBJECT = 'Cancelamos tu intento de alta de suscripción';

const RetryDetailsSchema = z.object({
    skipped: z.string().optional(),
    candidates: z.number(),
    noticePending: z.number(),
    noticeAbsent: z.number(),
    settledLongAgo: z.number(),
    deferredToNextRun: z.number(),
    rowsFailed: z.number(),
    retried: z.object({
        confirmed: z.number(),
        noticePending: z.number(),
        callFailed: z.number(),
        sentUnconfirmed: z.number()
    }),
    failedSubscriptionIds: z.array(z.string())
});

type RetryDetails = z.infer<typeof RetryDetailsSchema>;
type NoticeRow = { template: string; status: string } & Record<string, unknown>;
type StatusRow = { status: string } & Record<string, unknown>;
type ReasonRow = { reason: string } & Record<string, unknown>;
type SeenAtRow = { cancelled_seen_at: Date | null } & Record<string, unknown>;
type SignupAttempt = {
    user: CreatedUser;
    admin: CreatedUser;
    subscriptionId: string;
    authorizationId: string;
};

/** The protected route factory wraps the handler result in a `data` envelope. */
const CancellationEnvelopeSchema = z.object({ data: PendingAttemptCancellationResponseSchema });

const cronTriggerBodySchema = z
    .object({
        data: z.unknown().optional(),
        details: z.unknown().optional()
    })
    .passthrough();

async function runDeferredRetry(adminCookie: string): Promise<RetryDetails> {
    const response = await fetch(cronTriggerUrl({ apiUrl: API_URL, jobName: JOB_NAME }), {
        method: 'POST',
        headers: { cookie: adminCookie }
    });
    const text = await response.text();
    let rawDetails: unknown;
    if (response.status === 202) {
        const runId = acceptedRunId(JSON.parse(text));
        if (!runId) throw new Error(`Cron ${JOB_NAME} answered 202 without a run id: ${text}`);
        const run = await waitForAcceptedCronRun({ runId, jobName: JOB_NAME });
        rawDetails = run.details;
    } else if (response.status === 201) {
        const body = cronTriggerBodySchema.parse(JSON.parse(text));
        const data = z
            .object({ details: z.unknown().optional() })
            .passthrough()
            .parse(body.data ?? body);
        rawDetails = data.details;
    } else {
        throw new Error(
            `Expected cron ${JOB_NAME} HTTP 202 or 201; got ${response.status}: ${text}`
        );
    }
    const detailsEnvelope = z.object({ details: z.unknown().optional() }).passthrough();
    const envelope = detailsEnvelope.safeParse(rawDetails);
    return RetryDetailsSchema.parse(
        envelope.success ? (envelope.data.details ?? rawDetails) : rawDetails
    );
}

async function attemptNotices(userId: string, subscriptionId: string): Promise<NoticeRow[]> {
    return execSQL<NoticeRow>(
        `SELECT template, status FROM email_outbox
          WHERE recipient_user_id = $1
            AND payload->>'subscriptionId' = $2
            AND template LIKE 'billing.%'
          ORDER BY created_at, id`,
        [userId, subscriptionId]
    );
}

function cancelPuts(requests: readonly FakeProviderRequest[], authorizationId: string): number {
    return cancelRequestsFor({ requests, authorizationId }).length;
}

test.describe('TEST:2157:1 TEST:2157:2 TEST:2157:3 TEST:2157:4 a cancelled signup attempt leaves the provider through the deferred retry @p0 @billing @clock', () => {
    test.describe.configure({ mode: 'serial' });
    test.setTimeout(180_000);

    /**
     * Preconditions: the E2E database has the billing catalog and the API is configured with
     * the fake provider and local mail capture. The test creates its own subscriber, admin,
     * pending card signup, and cancellation notice; cleanup removes those users and billing rows.
     */
    let fakeServer: Awaited<ReturnType<typeof startE2eFakeProvider>> | null = null;
    let mailCapture: E2eMailCaptureServer | null = null;
    const userIds: string[] = [];
    let attempt: SignupAttempt | null = null;

    test.beforeAll(async () => {
        await ensureDeadlineVersion();
        const clock = createAdjustableClock({ start: new Date() });
        fakeServer = await startE2eFakeProvider({
            provider: new FakePaymentProvider({ clock, idNamespace: randomUUID() }),
            clock
        });
        try {
            mailCapture = await startE2eMailCapture();
        } catch (error) {
            await fakeServer.close();
            fakeServer = null;
            throw error;
        }
    });

    test.afterAll(async () => {
        try {
            await cleanupArrearsRows({ userIds });
        } finally {
            try {
                await mailCapture?.close();
            } finally {
                await fakeServer?.close();
            }
        }
    });

    test('a cancelled attempt keeps its preapproval alive while its notice is still queued', async () => {
        const { user, admin } = await createSubscriber();
        userIds.push(user.id, admin.id);
        const optionId = await monthlyOptionForSlug('owner-basico');
        const { subscriptionId, authorizationId } = await createApiCardSubscription({
            user,
            billingOptionId: optionId
        });
        if (!fakeServer) throw new Error('Fake provider server was not started.');

        const before = await fakeServer.provider.readAuthorization({ authorizationId });
        expect(
            before.snapshot.status,
            'the new card signup starts with a pending preapproval'
        ).toBe('pending');

        const response = await fetch(
            `${API_URL}/api/v1/protected/billing/subscriptions/${subscriptionId}/pending-attempt-cancellation`,
            { method: 'POST', headers: { cookie: user.sessionCookie } }
        );
        const cancellationText = await response.text();
        expect(response.status, cancellationText).toBe(200);
        const cancellation = CancellationEnvelopeSchema.parse(JSON.parse(cancellationText));
        expect(cancellation.data).toEqual({ subscriptionId, outcome: 'ABANDONED' });

        const subscription = await execSQL<StatusRow>(
            'SELECT status FROM subscription WHERE id = $1',
            [subscriptionId]
        );
        expect(
            subscription,
            'S40 leaves the signup attempt abandoned before the retry job runs'
        ).toEqual([{ status: 'ABANDONED' }]);
        const events = await execSQL<ReasonRow>(
            `SELECT reason FROM domain_event
                  WHERE entity_type = 'subscription'
                    AND entity_id = $1
                    AND event_type = 'subscription.provider_cancellation_decided'`,
            [subscriptionId]
        );
        expect(events, 'the cancellation decision records the S40 transition').toEqual([
            { reason: 'S40' }
        ]);
        expect(await attemptNotices(user.id, subscriptionId)).toEqual([
            { template: CANCEL_NOTICE, status: 'pending' }
        ]);
        expect(cancelPuts(fakeServer.requests(), authorizationId)).toBe(0);

        const details = await runDeferredRetry(admin.sessionCookie);
        expect(
            details.skipped,
            `a live reconciliation sweep run blocks the deferred retry: ${JSON.stringify(details)}`
        ).toBeUndefined();
        expect(details.failedSubscriptionIds, JSON.stringify(details)).not.toContain(
            subscriptionId
        );

        expect(cancelPuts(fakeServer.requests(), authorizationId)).toBe(0);
        const stillPending = await fakeServer.provider.readAuthorization({ authorizationId });
        expect(stillPending.snapshot.status).toBe('pending');
        expect(details.noticePending, JSON.stringify(details)).toBeGreaterThanOrEqual(1);
        expect(details.retried.noticePending, JSON.stringify(details)).toBe(0);
        expect(details.retried.confirmed, JSON.stringify(details)).toBe(0);
        expect(await attemptNotices(user.id, subscriptionId)).toEqual([
            { template: CANCEL_NOTICE, status: 'pending' }
        ]);

        attempt = { user, admin, subscriptionId, authorizationId };
    });

    test('once the notice is sent, the next retry run cancels the preapproval at the provider', async () => {
        if (!attempt || !fakeServer || !mailCapture)
            throw new Error('The queued signup attempt and test servers must be ready.');
        const sentAttempt = attempt;

        await runCron({
            jobName: 'email-outbox-sender',
            adminCookie: sentAttempt.admin.sessionCookie
        });
        const mail = await mailCapture.waitForMail({
            to: sentAttempt.user.email,
            subject: CANCEL_SUBJECT,
            timeoutMs: 30_000
        });
        const html = decodeHtmlEntities(mail.html).replace(/\s+/g, ' ');
        expect(html).toContain('Cancelaste el intento de alta de suscripción que tenías pendiente');
        expect(html).toContain('Ese intento no te cobró nada.');
        await expect
            .poll(() => attemptNotices(sentAttempt.user.id, sentAttempt.subscriptionId), {
                timeout: 10_000
            })
            .toEqual([{ template: CANCEL_NOTICE, status: 'sent' }]);
        expect(cancelPuts(fakeServer.requests(), sentAttempt.authorizationId)).toBe(0);

        const details = await runDeferredRetry(sentAttempt.admin.sessionCookie);
        expect(
            details.skipped,
            `a live reconciliation sweep run blocks the deferred retry: ${JSON.stringify(details)}`
        ).toBeUndefined();
        expect(details.failedSubscriptionIds, JSON.stringify(details)).not.toContain(
            sentAttempt.subscriptionId
        );

        expect(details.retried.confirmed, JSON.stringify(details)).toBe(1);
        expect(details.retried.callFailed, JSON.stringify(details)).toBe(0);
        expect(details.retried.sentUnconfirmed, JSON.stringify(details)).toBe(0);
        expect(cancelPuts(fakeServer.requests(), sentAttempt.authorizationId)).toBe(1);
        const cancelled = await fakeServer.provider.readAuthorization({
            authorizationId: sentAttempt.authorizationId
        });
        expect(cancelled.snapshot.status).toBe('cancelled');
        expect(
            mailCapture
                .mailsTo({ to: sentAttempt.user.email })
                .filter((captured) => captured.subject === CANCEL_SUBJECT)
        ).toHaveLength(1);
    });

    test('a later retry run neither cancels again nor sends a second notice', async () => {
        if (!attempt || !fakeServer || !mailCapture)
            throw new Error('The sent signup attempt and test servers must be ready.');

        const details = await runDeferredRetry(attempt.admin.sessionCookie);
        expect(
            details.skipped,
            `a live reconciliation sweep run blocks the deferred retry: ${JSON.stringify(details)}`
        ).toBeUndefined();
        expect(details.failedSubscriptionIds, JSON.stringify(details)).not.toContain(
            attempt.subscriptionId
        );

        expect(cancelPuts(fakeServer.requests(), attempt.authorizationId)).toBe(1);
        const seen = await execSQL<SeenAtRow>(
            'SELECT cancelled_seen_at FROM provider_link WHERE subscription_id = $1',
            [attempt.subscriptionId]
        );
        expect(seen, 'the signup keeps exactly one provider link').toHaveLength(1);
        expect(seen[0]?.cancelled_seen_at).toBeInstanceOf(Date);
        expect(await attemptNotices(attempt.user.id, attempt.subscriptionId)).toEqual([
            { template: CANCEL_NOTICE, status: 'sent' }
        ]);
        await runCron({ jobName: 'email-outbox-sender', adminCookie: attempt.admin.sessionCookie });
        expect(
            mailCapture
                .mailsTo({ to: attempt.user.email })
                .filter((captured) => captured.subject === CANCEL_SUBJECT)
        ).toHaveLength(1);
        expect(details.retried.callFailed, JSON.stringify(details)).toBe(0);
    });
});
