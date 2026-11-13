import { expect } from '@playwright/test';
import { z } from 'zod';
import { decodeHtmlEntities, runCron } from '../../../fixtures/arrears-cycle.ts';
import { execSQL, getDbPool } from '../../../fixtures/db-helpers.ts';
import { cleanupPartnerBillingSetupRows } from '../../../fixtures/partner-billing-setup.ts';
import { cleanupTestUsers } from '../../../support/test-cleanup.ts';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';
const responseSchema = <T extends z.ZodRawShape>(data: T) =>
    z.object({ data: z.strictObject(data) });

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

/** Validates a rejected admin billing action. */
export const RejectionSchema = z.object({ error: z.object({ reason: z.string() }) });

/** Validates the MP6 registration response. */
export const UnallocatedResultSchema = responseSchema({
    manualPaymentId: z.string(),
    periodStart: z.string(),
    markId: z.string(),
    mark: z.string(),
    outcome: z.string()
});

/** Validates response data objects returned by manual payment routes. */
export const ManualPaymentDataSchema = z.object({ data: z.record(z.string(), z.unknown()) });

/** Creates a manual subscription and its installment and coverage rows for seeded scenarios. */
export async function seedManualSubscription(args: {
    readonly userId: string;
    readonly optionId: string;
    readonly adminId: string;
    readonly status: string;
    readonly nextChargeAt: Date;
    readonly grace?: { readonly startedAt: Date; readonly endsAt: Date };
    readonly installments: readonly {
        readonly periodStart: Date;
        readonly status: 'AWAITING' | 'REGISTERED' | 'DECLARED_UNPAID';
        readonly covered: boolean;
    }[];
}): Promise<{ readonly subscriptionId: string; readonly installmentIds: readonly string[] }> {
    const installments = args.installments.map((row, ordinal) => ({
        ordinal,
        period_start: row.periodStart.toISOString(),
        status: row.status,
        covered: row.covered,
        registered_by: row.status === 'REGISTERED' ? args.adminId : null,
        registered_at: row.status === 'REGISTERED' ? row.periodStart.toISOString() : null
    }));
    const rows = await execSQL<{ subscription_id: string; installment_id: string }>(
        `WITH created AS (
             INSERT INTO subscription (user_id, vertical, plan_version_id, billing_option_id,
                 payment_method, status, class, next_charge_at, grace_started_at, grace_ends_at)
             SELECT $1, 'partner', pv.id, $2, 'MANUAL', $3, 'PRINCIPAL', $4, $5, $6
               FROM billing_option bo JOIN plan_version pv ON pv.id = bo.plan_version_id
              WHERE bo.id = $2 AND pv.current = true RETURNING id
         ), input AS (
             SELECT * FROM jsonb_to_recordset($7::jsonb) AS i(
                 ordinal int, period_start timestamptz, status text, covered boolean,
                 registered_by uuid, registered_at timestamptz)
         ), payments AS (
             INSERT INTO manual_payment (subscription_id, period_start, status, registered_by, registered_at)
             SELECT c.id, i.period_start, i.status, i.registered_by, i.registered_at
               FROM created c CROSS JOIN input i RETURNING id, period_start
         ), coverage AS (
             INSERT INTO covered_period (subscription_id, period_start, manual_payment_id, credited_at)
             SELECT c.id, p.period_start, p.id, p.period_start FROM created c
               JOIN payments p ON true JOIN input i USING (period_start) WHERE i.covered RETURNING id
         )
         SELECT c.id AS subscription_id, p.id AS installment_id
           FROM created c JOIN payments p ON true JOIN input i USING (period_start)
          CROSS JOIN (SELECT count(*) FROM coverage) done ORDER BY i.ordinal`,
        [
            args.userId,
            args.optionId,
            args.status,
            args.nextChargeAt,
            args.grace?.startedAt ?? null,
            args.grace?.endsAt ?? null,
            JSON.stringify(installments)
        ]
    );
    const subscriptionId = rows[0]?.subscription_id;
    if (!subscriptionId) throw new Error('Manual subscription seed failed.');
    return { subscriptionId, installmentIds: rows.map(({ installment_id }) => installment_id) };
}

/** Reads the persisted installment fields asserted by MP6 and MP4. */
export async function manualInstallmentRows(args: { readonly subscriptionId: string }): Promise<
    readonly {
        readonly id: string;
        readonly status: string;
        readonly entry: string;
        readonly period_start: Date;
        readonly proof_ref: string | null;
        readonly registered_by: string | null;
    }[]
> {
    return execSQL(
        `SELECT id, status, entry, period_start, proof_ref, registered_by
           FROM manual_payment WHERE subscription_id = $1 ORDER BY period_start, id`,
        [args.subscriptionId]
    );
}

/** Reads receipt identifiers for one manual payment. */
export async function manualPaymentReceipts(args: {
    readonly manualPaymentId: string;
}): Promise<readonly { readonly id: string }[]> {
    return execSQL('SELECT id FROM receipt WHERE manual_payment_id = $1 ORDER BY id', [
        args.manualPaymentId
    ]);
}

/** Checks the persisted MP4 reimputation, coverage, subscription state, event, and receipt. */
export async function assertLateManualPaymentPersisted(args: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly previousId: string;
    readonly manualPaymentId: string;
    readonly previousPeriod: Date;
    readonly originalPeriod: Date;
    readonly periodStart: Date;
    readonly nextChargeAt: Date;
    readonly proofRef: string;
    readonly adminId: string;
}): Promise<string> {
    const [rows, state, events, receipts] = await Promise.all([
        manualInstallmentRows({ subscriptionId: args.subscriptionId }),
        snapshotSubscription({ subscriptionId: args.subscriptionId, userId: args.userId }),
        execSQL<{ event_type: string; changes: unknown }>(
            `SELECT event_type, changes FROM domain_event
              WHERE event_type = 'manual_payment.reimputed' AND entity_id = $1 ORDER BY created_at, id`,
            [args.manualPaymentId]
        ),
        manualPaymentReceipts({ manualPaymentId: args.manualPaymentId })
    ]);
    expect(rows.find(({ id }) => id === args.manualPaymentId)).toEqual({
        id: args.manualPaymentId,
        status: 'REGISTERED',
        entry: 'INSTALLMENT',
        period_start: args.periodStart,
        proof_ref: args.proofRef,
        registered_by: args.adminId
    });
    const open = { id: expect.any(String), released_at: null };
    expect(state.coveredPeriods).toEqual([
        { ...open, period_start: args.previousPeriod, manual_payment_id: args.previousId },
        { ...open, period_start: args.periodStart, manual_payment_id: args.manualPaymentId }
    ]);
    expect(state.subscription).toEqual([
        {
            status: 'ACTIVE',
            next_charge_at: args.nextChargeAt,
            grace_started_at: null,
            grace_ends_at: null,
            updated_at: expect.any(Date)
        }
    ]);
    expect(events).toEqual([
        {
            event_type: 'manual_payment.reimputed',
            changes: [
                {
                    field: 'manual_payment.period_start',
                    old: args.originalPeriod.toISOString(),
                    new: args.periodStart.toISOString()
                }
            ]
        }
    ]);
    expect(receipts).toHaveLength(1);
    const receiptId = receipts[0]?.id;
    if (!receiptId) throw new Error('Missing MP4 receipt.');
    return receiptId;
}

/** Exercises MP6 preview and registration, then checks the persisted unallocated payment and mark. */
export async function exerciseUnallocatedManualPayment(args: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly cookie: string;
    readonly adminId: string;
    readonly seededInstallmentId: string;
    readonly seededStatus: 'REGISTERED' | 'DECLARED_UNPAID';
    readonly periodStart: Date;
    readonly mark: 'COBRO_DUPLICADO' | 'COBRO_POSTERIOR_A_LA_BAJA';
    readonly proofRef: string;
}): Promise<void> {
    const before = await snapshotSubscription({
        subscriptionId: args.subscriptionId,
        userId: args.userId
    });
    const path = `/api/v1/admin/billing-subscription/${args.subscriptionId}/manual-payments/unallocated`;
    const previewResponse = await adminJson({ method: 'GET', path, cookie: args.cookie });
    expect(previewResponse.status).toBe(200);
    const preview = ManualPaymentDataSchema.parse(previewResponse.body);
    expect(preview.data).toEqual({
        subscriptionId: args.subscriptionId,
        periodStart: args.periodStart.toISOString(),
        mark: args.mark
    });
    expect(
        await snapshotSubscription({ subscriptionId: args.subscriptionId, userId: args.userId })
    ).toEqual(before);

    const response = await adminJson({
        method: 'POST',
        path,
        cookie: args.cookie,
        body: { proofRef: args.proofRef }
    });
    expect(response.status).toBe(200);
    const result = UnallocatedResultSchema.parse(response.body);
    expect(result.data).toEqual({
        manualPaymentId: expect.any(String),
        periodStart: args.periodStart.toISOString(),
        markId: expect.any(String),
        mark: args.mark,
        outcome: 'OPENED'
    });
    expect(result.data.manualPaymentId).not.toBe(args.seededInstallmentId);

    const after = await snapshotSubscription({
        subscriptionId: args.subscriptionId,
        userId: args.userId
    });
    const rows = await manualInstallmentRows({ subscriptionId: args.subscriptionId });
    expect(rows).toHaveLength(2);
    expect(rows.find(({ id }) => id === args.seededInstallmentId)).toEqual({
        id: args.seededInstallmentId,
        status: args.seededStatus,
        entry: 'INSTALLMENT',
        period_start: args.periodStart,
        proof_ref: null,
        registered_by: args.seededStatus === 'REGISTERED' ? args.adminId : null
    });
    expect(rows.find(({ id }) => id === result.data.manualPaymentId)).toEqual({
        id: result.data.manualPaymentId,
        status: 'REGISTERED',
        entry: 'UNALLOCATED',
        period_start: args.periodStart,
        proof_ref: args.proofRef,
        registered_by: args.adminId
    });
    expect(after.coveredPeriods).toEqual(before.coveredPeriods);
    expect(after.marks).toEqual([{ id: result.data.markId, reason: args.mark, lifted_at: null }]);
    expect(after.markPayments).toEqual([
        { mark_id: result.data.markId, manual_payment_id: result.data.manualPaymentId }
    ]);
    expect(after.subscription).toEqual(before.subscription);
    expect(await manualPaymentReceipts({ manualPaymentId: result.data.manualPaymentId })).toEqual(
        []
    );
}

/** Runs manual grace expiry twice and checks the installment, subscription, and notice counts. */
export async function runManualGraceExpiryTwice(args: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly periodStart: Date;
    readonly adminCookie: string;
}): Promise<void> {
    await runCron({ jobName: 'manual-grace-expiry', adminCookie: args.adminCookie });
    await runCron({ jobName: 'manual-grace-expiry', adminCookie: args.adminCookie });
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM manual_payment WHERE subscription_id = $1 AND period_start = $2',
        [args.subscriptionId, args.periodStart]
    );
    expect(rows).toEqual([{ status: 'DECLARED_UNPAID' }]);
    const state = await snapshotSubscription({
        subscriptionId: args.subscriptionId,
        userId: args.userId
    });
    expect(state.subscription[0]?.status).toBe('SUSPENDED');
    const notices = await execSQL<{ template: string }>(
        `SELECT template FROM email_outbox WHERE recipient_user_id = $1 AND template = 'billing.arrears-suspension'`,
        [args.userId]
    );
    expect(notices).toEqual([{ template: 'billing.arrears-suspension' }]);
}

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
          WHERE entity_id = $1::text OR entity_id IN
            (SELECT id::text FROM manual_payment WHERE subscription_id = $1::uuid)`,
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
