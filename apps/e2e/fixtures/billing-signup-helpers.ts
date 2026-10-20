import { execSQL } from './db-helpers.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

export async function triggerCron(options: {
    readonly jobName: string;
    readonly adminCookie: string;
}): Promise<void> {
    const response = await fetch(`${API_URL}/api/v1/admin/cron/${options.jobName}`, {
        method: 'POST',
        headers: { cookie: options.adminCookie }
    });
    const bodyText = await response.text();
    if (!response.ok) {
        throw new Error(`Cron ${options.jobName} failed with HTTP ${response.status}: ${bodyText}`);
    }
    const body = JSON.parse(bodyText) as {
        readonly success?: boolean;
        readonly data?: { readonly success?: boolean };
    };
    if (body.data?.success === false || body.success === false) {
        throw new Error(`Cron ${options.jobName} returned success:false: ${bodyText}`);
    }
}

export async function seedManualPendingSubscription(options: {
    readonly userId: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
    readonly windowEndsAt: Date;
}): Promise<string> {
    const rows = await execSQL<{ id: string }>(
        `INSERT INTO subscription (
             user_id, vertical, plan_version_id, billing_option_id, payment_method, status,
             class, authorization_window_deadline_version, authorization_window_ends_at
         ) VALUES ($1, 'accommodation', $2, $3, 'MANUAL', 'PENDING_AUTHORIZATION',
                   'PRINCIPAL', 1, $4)
         RETURNING id`,
        [options.userId, options.planVersionId, options.billingOptionId, options.windowEndsAt]
    );
    const subscriptionId = rows[0]?.id;
    if (!subscriptionId) throw new Error('Could not seed manual pending subscription');
    return subscriptionId;
}

export async function readSubscriptionStatus(options: {
    readonly subscriptionId: string;
}): Promise<string | null> {
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [options.subscriptionId]
    );
    return rows[0]?.status ?? null;
}
