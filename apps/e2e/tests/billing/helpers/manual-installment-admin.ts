import { z } from 'zod';
import { decodeHtmlEntities } from '../../../fixtures/arrears-cycle.ts';
import { execSQL, getDbPool } from '../../../fixtures/db-helpers.ts';
import { cleanupPartnerBillingSetupRows } from '../../../fixtures/partner-billing-setup.ts';
import { cleanupTestUsers } from '../../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

/** Validates the action 6 option preview response. */
export const Action6PreviewSchema = z.object({
    data: z.object({
        options: z.array(z.object({ billingOptionId: z.string(), planSlug: z.string() }))
    })
});

/** Validates the action 6 subscription creation response. */
export const Action6ResultSchema = z.object({
    data: z.object({ subscriptionId: z.string(), manualPaymentId: z.string() })
});

/** Validates the MP1 preview response. */
export const RegisterPreviewSchema = z.object({
    data: z.strictObject({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        periodStart: z.string(),
        effect: z.string(),
        nextChargeAt: z.string()
    })
});

/** Validates the MP1 registration response. */
export const RegisterResultSchema = z.object({
    data: z.object({ outcome: z.string(), effect: z.string(), nextChargeAt: z.string() })
});

/** Validates the MP2 preview response. */
export const UnpaidPreviewSchema = z.object({
    data: z.strictObject({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        periodStart: z.string(),
        effect: z.string()
    })
});

/** Validates the MP2 declaration response. */
export const UnpaidResultSchema = z.object({
    data: z.strictObject({ outcome: z.string(), notice: z.string() })
});

/** Validates a rejected admin billing action. */
export const RejectionSchema = z.object({ error: z.object({ reason: z.string() }) });

/** Validates the MP6 preview response. */
export const UnallocatedPreviewSchema = z.object({
    data: z.strictObject({ subscriptionId: z.string(), periodStart: z.string(), mark: z.string() })
});

/** Validates the MP6 registration response. */
export const UnallocatedResultSchema = z.object({
    data: z.strictObject({
        manualPaymentId: z.string(),
        periodStart: z.string(),
        markId: z.string(),
        mark: z.string(),
        outcome: z.string()
    })
});

/** Validates the MP4 preview response. */
export const LatePreviewSchema = z.object({
    data: z.strictObject({
        subscriptionId: z.string(),
        manualPaymentId: z.string(),
        periodStart: z.string(),
        reimputedPeriodStart: z.string().nullable(),
        nextChargeAt: z.string(),
        effect: z.string()
    })
});

/** Validates the MP4 registration response. */
export const LateResultSchema = z.object({
    data: z.strictObject({
        effect: z.string(),
        nextChargeAt: z.string(),
        periodStart: z.string(),
        reimputedFrom: z.string().nullable(),
        receiptId: z.string().nullable()
    })
});

/** Performs the action 6 preview and confirmed setup for the given Partner. */
export async function createManualPartnerSetup(args: {
    readonly partnerId: string;
    readonly optionId: string;
    readonly cookie: string;
    readonly nonce: string;
}): Promise<{ readonly subscriptionId: string; readonly manualPaymentId: string }> {
    const path = `/api/v1/admin/partners/${args.partnerId}/billing-setup`;
    const previewResponse = await adminJson({ method: 'GET', path, cookie: args.cookie });
    const preview = Action6PreviewSchema.parse(previewResponse.body);
    if (previewResponse.status !== 200) throw new Error('Action 6 preview failed.');
    if (
        !preview.data.options.some(
            ({ billingOptionId, planSlug }) =>
                billingOptionId === args.optionId && planSlug === 'partner-silver'
        )
    ) {
        throw new Error('Action 6 preview did not include partner-silver.');
    }
    const response = await adminJson({
        method: 'POST',
        path,
        cookie: args.cookie,
        body: { billingOptionId: args.optionId, reason: `HOS-2160 ${args.nonce}`, confirm: true }
    });
    const result = Action6ResultSchema.parse(response.body);
    if (response.status !== 200) throw new Error('Action 6 setup failed.');
    return result.data;
}

/** Sends an authenticated admin request and returns its parsed JSON body. */
export async function adminJson(args: {
    readonly method: 'GET' | 'POST';
    readonly path: string;
    readonly cookie: string;
    readonly body?: unknown;
}): Promise<{ readonly status: number; readonly body: unknown }> {
    const headers: Record<string, string> = { cookie: args.cookie };
    if (args.body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${API_URL}${args.path}`, {
        method: args.method,
        headers,
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) })
    });
    return { status: response.status, body: JSON.parse(await response.text()) };
}

/** Reads the live, non-deleted SUPER_ADMIN recipients in product sort order. */
export async function superAdminRecipients(): Promise<
    readonly { readonly userId: string; readonly email: string }[]
> {
    const rows = await execSQL<{ user_id: string; email: string }>(
        `SELECT DISTINCT u.id AS user_id, u.email
           FROM user_role ur JOIN users u ON u.id = ur.user_id
          WHERE ur.role = 'SUPER_ADMIN' AND u.deleted_at IS NULL
          ORDER BY u.id`
    );
    return rows.map(({ user_id, email }) => ({ userId: user_id, email }));
}

/** Reads unpaid notice outbox rows for one manual payment. */
export async function unpaidNoticeRows(args: { readonly manualPaymentId: string }): Promise<
    readonly {
        readonly recipient_user_id: string;
        readonly recipient_email: string;
        readonly payload: unknown;
        readonly status: string;
    }[]
> {
    return execSQL<{
        recipient_user_id: string;
        recipient_email: string;
        payload: unknown;
        status: string;
    }>(
        `SELECT recipient_user_id, recipient_email, payload, status
           FROM email_outbox
          WHERE template = 'billing.manual-installment-unpaid'
            AND payload->>'manualPaymentId' = $1
          ORDER BY recipient_user_id`,
        [args.manualPaymentId]
    );
}

/** Captures every relevant persisted value used to prove a preview is read-only. */
export async function snapshotSubscription(args: {
    readonly subscriptionId: string;
    readonly userId: string;
}): Promise<{
    readonly subscription: readonly Record<string, unknown>[];
    readonly manualPayments: readonly Record<string, unknown>[];
    readonly coveredPeriods: readonly Record<string, unknown>[];
    readonly receipts: readonly Record<string, unknown>[];
    readonly marks: readonly Record<string, unknown>[];
    readonly markPayments: readonly Record<string, unknown>[];
    readonly domainEvents: number;
    readonly outboxRows: number;
}> {
    const subscription = await execSQL(
        `SELECT status, next_charge_at, grace_started_at, grace_ends_at, updated_at
           FROM subscription WHERE id = $1`,
        [args.subscriptionId]
    );
    const manualPayments = await execSQL(
        `SELECT id, status, entry, period_start, proof_ref, registered_at, updated_at
           FROM manual_payment WHERE subscription_id = $1 ORDER BY created_at, id`,
        [args.subscriptionId]
    );
    const coveredPeriods = await execSQL(
        `SELECT id, period_start, manual_payment_id, released_at
           FROM covered_period WHERE subscription_id = $1 ORDER BY period_start, id`,
        [args.subscriptionId]
    );
    const receipts = await execSQL(
        `SELECT manual_payment_id, count(*)::int AS count
           FROM receipt WHERE manual_payment_id IN
             (SELECT id FROM manual_payment WHERE subscription_id = $1)
          GROUP BY manual_payment_id ORDER BY manual_payment_id`,
        [args.subscriptionId]
    );
    const marks = await execSQL(
        `SELECT id, reason, lifted_at FROM reconciliation_mark
          WHERE subscription_id = $1 ORDER BY id`,
        [args.subscriptionId]
    );
    const markPayments = await execSQL(
        `SELECT rmp.mark_id, rmp.manual_payment_id
           FROM reconciliation_mark_payment rmp
           JOIN reconciliation_mark rm ON rm.id = rmp.mark_id
          WHERE rm.subscription_id = $1 ORDER BY rmp.mark_id, rmp.manual_payment_id`,
        [args.subscriptionId]
    );
    const eventRows = await execSQL<{ count: number }>(
        `SELECT count(*)::int AS count FROM domain_event
          WHERE entity_id = $1 OR entity_id IN
            (SELECT id FROM manual_payment WHERE subscription_id = $1)`,
        [args.subscriptionId]
    );
    const outboxRows = await execSQL<{ count: number }>(
        `SELECT count(*)::int AS count FROM email_outbox
          WHERE recipient_user_id = $1 OR payload->>'subscriptionId' = $2`,
        [args.userId, args.subscriptionId]
    );
    return {
        subscription,
        manualPayments,
        coveredPeriods,
        receipts,
        marks,
        markPayments,
        domainEvents: eventRows[0]?.count ?? 0,
        outboxRows: outboxRows[0]?.count ?? 0
    };
}

/** Adds UTC calendar months while keeping the source day when it exists. */
export function addUtcMonths(args: { readonly date: Date; readonly months: number }): Date {
    const end = new Date(args.date.getTime());
    end.setUTCDate(1);
    end.setUTCMonth(end.getUTCMonth() + args.months);
    const lastDayOfTarget = new Date(
        Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)
    ).getUTCDate();
    end.setUTCDate(Math.min(args.date.getUTCDate(), lastDayOfTarget));
    return end;
}

/** Converts captured email HTML to normalized visible text. */
export function mailText(html: string): string {
    return decodeHtmlEntities(html)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Removes test-owned marks, action 6 rows, and users in foreign-key order. */
export async function cleanupManualAdminRows(args: {
    readonly userIds: readonly string[];
    readonly partnerIds: readonly string[];
}): Promise<void> {
    if (args.userIds.length) {
        await execSQL(
            `DELETE FROM reconciliation_mark_payment
              WHERE mark_id IN (SELECT id FROM reconciliation_mark
                WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[])))`,
            [args.userIds]
        );
        await execSQL(
            `DELETE FROM reconciliation_mark
              WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ANY($1::uuid[]))`,
            [args.userIds]
        );
    }
    await cleanupPartnerBillingSetupRows(args);
    await cleanupTestUsers(getDbPool(), args.userIds);
}
