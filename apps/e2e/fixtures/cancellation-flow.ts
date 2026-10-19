import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { CreatedUser } from './api-helpers.ts';
import {
    activateCardSubscription,
    DAY_MS,
    deliverNotices,
    type FakeWorld,
    readCurrentGraceDays,
    recordCreditedCycle,
    runCron
} from './arrears-cycle.ts';
import { execSQL } from './db-helpers.ts';
import { readPublicationStatus } from './listing-notices.ts';
import { attachSession, monthlyOptionForSlug, openSignupCheckout } from './signup-checkout.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const WAIT_TIMEOUT_MS = 30_000;

type CancellationPreview = {
    readonly origin: string;
    readonly addons: readonly unknown[];
    readonly serviceEndsAt: string | null;
    readonly graceEndsAt: string | null;
};

/** Sign up a card subscriber through the web checkout and credit its first cycle. */
export async function signUpCardSubscriber(args: {
    readonly page: Page;
    readonly world: FakeWorld;
    readonly user: CreatedUser;
    readonly slug: 'owner-basico';
}): Promise<{ readonly subscriptionId: string; readonly authorizationId: string }> {
    await attachSession(args.page, args.user.sessionCookie);
    await openSignupCheckout({
        page: args.page,
        webUrl: WEB_URL,
        billingOptionId: await monthlyOptionForSlug(args.slug)
    });
    await args.page.getByTestId('signup-checkout-confirm').click();
    const pending = args.page.getByTestId('signup-checkout-pending');
    await expect(pending).toBeVisible();
    const subscriptionId = await pending.getAttribute('data-subscription-id');
    if (!subscriptionId) throw new Error('Expected web checkout subscription id.');
    const links = await execSQL<{ provider_id: string }>(
        'SELECT provider_id FROM provider_link WHERE subscription_id = $1',
        [subscriptionId]
    );
    const authorizationId = links[0]?.provider_id;
    if (!authorizationId) throw new Error(`Expected provider authorization for ${subscriptionId}.`);
    await activateCardSubscription({ fakeServer: args.world.fakeServer, subscriptionId });
    await recordCreditedCycle({
        fakeServer: args.world.fakeServer,
        subscriptionId,
        authorizationId
    });
    return { subscriptionId, authorizationId };
}

/** Move an active card subscription through its real failed-charge grace transition. */
export async function driveToGrace(args: {
    readonly world: FakeWorld;
    readonly subscriptionId: string;
    readonly authorizationId: string;
}): Promise<{ readonly graceEndsAt: Date }> {
    await args.world.fakeServer.advanceClock({ ms: 31 * DAY_MS });
    await args.world.fakeServer.provider.declineCharge({
        authorizationId: args.authorizationId,
        declineReason: 'cc_rejected_other_reason'
    });
    await deliverNotices({ fakeServer: args.world.fakeServer });
    const row = await readSubscriptionRow({ subscriptionId: args.subscriptionId });
    expect(row.status, 'Expected failed charge to enter GRACE_PERIOD.').toBe('GRACE_PERIOD');
    if (!row.grace_ends_at) throw new Error('Expected grace_ends_at after entering grace.');
    return { graceEndsAt: row.grace_ends_at };
}

/** Reach SUSPENDED through both real reconciliation sweeps and captured suspension mail. */
export async function driveToSuspended(args: {
    readonly world: FakeWorld;
    readonly user: CreatedUser;
    readonly admin: CreatedUser;
    readonly subscriptionId: string;
    readonly authorizationId: string;
}): Promise<{
    readonly suspensionMail: Awaited<ReturnType<FakeWorld['mailCapture']['waitForMail']>>;
    readonly cancelRequestsAfterSuspension: 1;
}> {
    const before = await readSubscriptionRow({ subscriptionId: args.subscriptionId });
    expect(before.status, 'Expected the real arrears flow to start from GRACE_PERIOD.').toBe(
        'GRACE_PERIOD'
    );
    const graceDays = await readCurrentGraceDays({ planVersionId: before.plan_version_id });
    await args.world.fakeServer.advanceClock({ ms: graceDays * DAY_MS + 60_000 });
    await runCron({
        jobName: 'billing-reconciliation-sweep',
        adminCookie: args.admin.sessionCookie
    });
    const firstRow = await readSubscriptionRow({ subscriptionId: args.subscriptionId });
    expect(firstRow.status, 'Expected first sweep to leave the row in GRACE_PERIOD.').toBe(
        'GRACE_PERIOD'
    );
    const firstNotice = await latestOutbox({
        userId: args.user.id,
        template: 'billing.arrears-suspension'
    });
    expect(firstNotice?.status, 'Expected first sweep to queue suspension mail.').toBe('pending');
    expect(
        cancelRequestsFor({
            requests: args.world.fakeServer.requests(),
            authorizationId: args.authorizationId
        }),
        'Expected no provider cancellation before the suspension mail.'
    ).toHaveLength(0);
    await runCron({ jobName: 'email-outbox-sender', adminCookie: args.admin.sessionCookie });
    const suspensionMail = await args.world.mailCapture.waitForMail({
        to: args.user.email,
        subject: 'Tu suscripción se suspendió',
        timeoutMs: WAIT_TIMEOUT_MS
    });
    const secondSweepStartedAt = new Date();
    await runCron({
        jobName: 'billing-reconciliation-sweep',
        adminCookie: args.admin.sessionCookie
    });
    const suspended = await readSubscriptionRow({ subscriptionId: args.subscriptionId });
    expect(suspended.status, 'Expected second sweep to reach SUSPENDED.').toBe('SUSPENDED');
    expect(
        (
            await args.world.fakeServer.provider.readAuthorization({
                authorizationId: args.authorizationId
            })
        ).snapshot.status,
        'Expected arrears suspension to cancel the provider authorization.'
    ).toBe('cancelled');
    const requests = cancelRequestsFor({
        requests: args.world.fakeServer.requests(),
        authorizationId: args.authorizationId
    });
    expect(requests, 'Expected exactly one provider cancellation after suspension.').toHaveLength(
        1
    );
    expect(
        suspensionMail.receivedAt.getTime(),
        'Expected captured suspension mail before the second reconciliation sweep started.'
    ).toBeLessThan(secondSweepStartedAt.getTime());
    return { suspensionMail, cancelRequestsAfterSuspension: 1 };
}

/** Open self-service cancellation for one subscription and return its preview and end line. */
export async function selfCancelFromMySubscription(args: {
    readonly page: Page;
    readonly subscriptionId: string;
}): Promise<{
    readonly preview: CancellationPreview;
    readonly endLine: ReturnType<Page['getByTestId']>;
}> {
    await args.page.goto(`${WEB_URL}/es/mi-cuenta/suscripcion/`);
    const article = subscriptionArticle({ page: args.page, subscriptionId: args.subscriptionId });
    const response = args.page.waitForResponse(
        (candidate) =>
            candidate.request().method() === 'GET' &&
            candidate
                .url()
                .includes(
                    `/api/v1/protected/billing-subscription/${args.subscriptionId}/cancellation-preview`
                ),
        { timeout: WAIT_TIMEOUT_MS }
    );
    await article.getByTestId('self-cancel-open').click();
    const body = await (await response).json();
    const preview = (body.data ?? body) as CancellationPreview;
    return { preview, endLine: article.getByTestId('self-cancel-end') };
}

/** Confirm the currently open self-service cancellation flow. */
export async function confirmSelfCancel(args: { readonly page: Page }) {
    await args.page.getByTestId('self-cancel-confirm').click();
    return args.page.getByTestId('self-cancel-done');
}

/** Read the subscription state and cancellation linkage from its own database row. */
export async function readSubscriptionRow(args: { readonly subscriptionId: string }) {
    const rows = await execSQL<{
        status: string;
        service_ends_at: Date | null;
        grace_ends_at: Date | null;
        succeeds_id: string | null;
        plan_version_id: string;
    }>(
        'SELECT status, service_ends_at, grace_ends_at, succeeds_id, plan_version_id FROM subscription WHERE id = $1',
        [args.subscriptionId]
    );
    const row = rows[0];
    if (!row) throw new Error(`Missing subscription ${args.subscriptionId}.`);
    return row;
}

/** Wait until a subscription reaches a requested state. */
export async function waitForSubscriptionStatus(args: {
    readonly subscriptionId: string;
    readonly status: string;
    readonly timeoutMs: number;
}): Promise<void> {
    await expect
        .poll(
            async () => (await readSubscriptionRow({ subscriptionId: args.subscriptionId })).status,
            { timeout: args.timeoutMs }
        )
        .toBe(args.status);
}

/** Read the newest outbox entry for a specific user and template. */
export async function latestOutbox(args: { readonly userId: string; readonly template: string }) {
    const rows = await execSQL<{
        status: string;
        payload: Record<string, unknown>;
        created_at: Date;
    }>(
        `SELECT status, payload, created_at FROM email_outbox
          WHERE recipient_user_id = $1 AND template = $2
          ORDER BY created_at DESC LIMIT 1`,
        [args.userId, args.template]
    );
    return rows[0];
}

/** Read cancellation notices created at or after a self-cancellation request. */
export async function cancellationOutboxSince(args: {
    readonly userId: string;
    readonly createdAt: Date;
}) {
    return execSQL<{ status: string; created_at: Date }>(
        `SELECT status, created_at FROM email_outbox
          WHERE recipient_user_id = $1 AND template = 'billing.direct-cancellation'
            AND created_at >= $2
          ORDER BY created_at`,
        [args.userId, args.createdAt]
    );
}

/** Wait until asynchronous coverage recalculation writes the requested listing state. */
export async function waitForPublicationStatus(args: {
    readonly listingId: string;
    readonly status: string;
    readonly timeoutMs: number;
}): Promise<void> {
    await expect
        .poll(() => readPublicationStatus({ listingId: args.listingId }), {
            timeout: args.timeoutMs
        })
        .toBe(args.status);
}

export function subscriptionArticle(args: {
    readonly page: Page;
    readonly subscriptionId: string;
}) {
    return args.page.locator(
        `article[data-testid="my-subscription"][data-subscription-id="${args.subscriptionId}"]`
    );
}

function cancelRequestsFor(args: {
    readonly requests: ReturnType<FakeWorld['fakeServer']['requests']>;
    readonly authorizationId: string;
}) {
    return args.requests.filter(
        (request) =>
            request.method === 'PUT' &&
            request.path === `/preapproval/${args.authorizationId}` &&
            typeof request.body === 'object' &&
            request.body !== null &&
            (request.body as { readonly status?: unknown }).status === 'cancelled'
    );
}
