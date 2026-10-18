import type { Page } from '@playwright/test';
import type { FakeProviderRequest } from '@repo/payments/fake-server';
import type { CreatedUser } from './api-helpers.ts';
import { execSQL } from './db-helpers.ts';

/** Attach a subscriber's SUPER_ADMIN session cookie to the admin origin. */
export async function useAdminSession(args: {
    readonly page: Page;
    readonly admin: CreatedUser;
    readonly adminUrl: string;
}): Promise<void> {
    await args.page.context().addCookies(
        args.admin.sessionCookie.split('; ').map((cookie) => {
            const [name, ...value] = cookie.split('=');
            return { name: (name ?? '').trim(), value: value.join('='), url: args.adminUrl };
        })
    );
}

/** Open the admin revocation route and wait until its preview is ready. */
export async function openRevocationScreen(args: {
    readonly page: Page;
    readonly subscriptionId: string;
    readonly adminUrl: string;
}): Promise<void> {
    await args.page.goto(
        `${args.adminUrl}/billing/subscriptions/${args.subscriptionId}/revocation`,
        { waitUntil: 'domcontentloaded' }
    );
    await args.page.getByTestId('subscription-revocation-ready').waitFor({ state: 'visible' });
}

/** Seed one open pause row and synchronize the provider authorization to PAUSED. */
export async function seedPausedSubscription(args: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly fakeServer: {
        readonly provider: { pause(input: { authorizationId: string }): Promise<unknown> };
    };
}): Promise<void> {
    await args.fakeServer.provider.pause({ authorizationId: args.authorizationId });
    const [{ now }] = await execSQL<{ now: Date }>('SELECT NOW() AS now');
    const startsAt = now;
    const expectedEndAt = new Date(startsAt.getTime() + 60 * 24 * 60 * 60 * 1000);
    await execSQL("UPDATE subscription SET status = 'PAUSED' WHERE id = $1", [args.subscriptionId]);
    await execSQL(
        `INSERT INTO subscription_pause
            (subscription_id, reason, requested_months, starts_at, expected_end_at, actual_end_at)
         VALUES ($1, 'CUSTOMER_REQUEST', 2, $2, $3, NULL)`,
        [args.subscriptionId, startsAt, expectedEndAt]
    );
}

/** Read the refund rows tied to the credited payment. */
export function refundsForPayment(paymentId: string) {
    return execSQL<{
        id: string;
        payment_id: string;
        amount: number;
        status: string;
        created_at: Date;
    }>('SELECT id, payment_id, amount, status, created_at FROM refund WHERE payment_id = $1', [
        paymentId
    ]);
}

/** Read the pause row for a subscription. */
export function pauseForSubscription(subscriptionId: string) {
    return execSQL<{ actual_end_at: Date | null }>(
        'SELECT actual_end_at FROM subscription_pause WHERE subscription_id = $1',
        [subscriptionId]
    );
}

/** Find a recorded provider cancellation request for the authorization. */
export function cancellationRequestsFor(args: {
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

/** Remove S36 rows created by this spec before shared user cleanup runs. */
export async function cleanupRevocationRows(subscriptionIds: readonly string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    await execSQL(
        `DELETE FROM refund_call WHERE refund_id IN
         (SELECT id FROM refund WHERE payment_id IN
          (SELECT id FROM payment WHERE subscription_id = ANY($1::uuid[])))`,
        [subscriptionIds]
    );
    await execSQL(
        `DELETE FROM refund WHERE payment_id IN
         (SELECT id FROM payment WHERE subscription_id = ANY($1::uuid[]))`,
        [subscriptionIds]
    );
    await execSQL('DELETE FROM subscription_pause WHERE subscription_id = ANY($1::uuid[])', [
        subscriptionIds
    ]);
}
