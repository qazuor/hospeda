import { sql } from 'drizzle-orm';
import type { DrizzleClient } from '../../types.ts';

/** Input for inserting or consolidating one scheduled outbox email. */
export interface EnqueueOrMergeScheduledEmailInput {
    readonly tx: DrizzleClient;
    readonly recipientUserId: string;
    readonly recipientEmail: string;
    readonly template: string;
    readonly dedupKey: string;
    readonly sendAfter: Date;
    readonly payload: Record<string, unknown>;
    readonly vertical: string;
    readonly correlationId?: string;
}

/** Result of inserting, consolidating, or refusing a scheduled email. */
export type EnqueueOrMergeScheduledEmailResult = 'inserted' | 'merged' | 'refused';

/** Input for withdrawing one vertical from pending scheduled emails. */
export interface WithdrawScheduledEmailsInput {
    readonly tx: DrizzleClient;
    readonly recipientUserId: string;
    readonly templates: readonly string[];
    readonly vertical: string;
    readonly reason: string;
}

/** Counts rows changed while withdrawing scheduled emails. */
export interface WithdrawScheduledEmailsResult {
    readonly withdrawn: number;
    readonly cancelled: number;
}

/** Validates the vertical identifier used in a scheduled email payload. */
function validateVertical(vertical: string): void {
    if (!/^[a-z_]+$/.test(vertical)) throw new TypeError('vertical must match ^[a-z_]+$');
}

/** Extracts returned rows from postgres-js or node-postgres Drizzle clients. */
function rowsOf<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    return (result as { rows?: T[] }).rows ?? [];
}

/**
 * Inserts one scheduled email or merges its vertical into an existing pending
 * row. A terminal or in-flight conflicting row is left untouched.
 *
 * @param input - Recipient, occurrence, target send time, payload, and vertical.
 * @returns Whether a row was inserted, merged, or refused because the existing row is not pending.
 * @throws TypeError when the vertical is invalid or the required values are malformed.
 */
export async function enqueueOrMergeScheduledEmail(
    input: EnqueueOrMergeScheduledEmailInput
): Promise<{ readonly outcome: EnqueueOrMergeScheduledEmailResult }> {
    validateVertical(input.vertical);
    if (!(input.sendAfter instanceof Date) || Number.isNaN(input.sendAfter.getTime())) {
        throw new TypeError('sendAfter must be a valid Date');
    }
    if (!input.recipientUserId || !input.recipientEmail || !input.template || !input.dedupKey) {
        throw new TypeError('recipient, template, and dedup key must not be empty');
    }
    const payload = JSON.stringify({ ...input.payload, verticals: [input.vertical] });
    const result = await input.tx.execute(sql`
        INSERT INTO email_outbox (
            recipient_user_id, recipient_email, template, dedup_key, send_after,
            payload, correlation_id
        ) VALUES (
            ${input.recipientUserId}::uuid, ${input.recipientEmail}, ${input.template},
            ${input.dedupKey}, ${input.sendAfter.toISOString()}::timestamptz,
            ${payload}::jsonb, ${input.correlationId ?? null}::uuid
        )
        ON CONFLICT (dedup_key) DO UPDATE
        SET payload = jsonb_set(
            email_outbox.payload,
            '{verticals}',
            (
                SELECT jsonb_agg(vertical ORDER BY vertical)
                FROM (
                    SELECT DISTINCT existing.current_vertical AS vertical
                    FROM jsonb_array_elements_text(COALESCE(email_outbox.payload->'verticals', '[]'::jsonb)) AS existing(current_vertical)
                    UNION SELECT ${input.vertical}
                ) AS merged_verticals
            )
        )
        WHERE email_outbox.status = 'pending'
        RETURNING (xmax = 0) AS inserted
    `);
    const row = rowsOf<{ inserted: boolean }>(result)[0];
    return { outcome: row ? (row.inserted ? 'inserted' : 'merged') : 'refused' };
}

/**
 * Removes one vertical from matching pending campaign rows and marks rows with
 * no remaining verticals as failed. Rows are retained as outbox history.
 *
 * @param input - Recipient, campaign templates, vertical, and cancellation reason.
 * @returns Number of pending rows changed and rows cancelled after losing their final vertical.
 * @throws TypeError when templates are empty or a value is malformed.
 */
export async function withdrawScheduledEmails(
    input: WithdrawScheduledEmailsInput
): Promise<WithdrawScheduledEmailsResult> {
    validateVertical(input.vertical);
    if (input.templates.length === 0 || input.templates.some((template) => !template)) {
        throw new TypeError('templates must not be empty');
    }
    if (!/^[a-z0-9-]+$/.test(input.reason)) {
        throw new TypeError('reason must match ^[a-z0-9-]+$');
    }
    const updated = await input.tx.execute(sql`
        UPDATE email_outbox
        SET payload = jsonb_set(
            payload,
            '{verticals}',
            COALESCE(
                (SELECT jsonb_agg(existing.current_vertical ORDER BY existing.current_vertical)
                 FROM jsonb_array_elements_text(payload->'verticals') AS existing(current_vertical)
                 WHERE existing.current_vertical <> ${input.vertical}),
                '[]'::jsonb
            )
        )
        WHERE status = 'pending'
          AND recipient_user_id = ${input.recipientUserId}::uuid
          AND template = ANY(ARRAY[${sql.join(
              input.templates.map((template) => sql`${template}`),
              sql`, `
          )}]::text[])
          AND COALESCE(payload->'verticals', '[]'::jsonb) ? ${input.vertical}
        RETURNING id
    `);
    const changed = rowsOf<{ id: string }>(updated);
    if (changed.length === 0) return { withdrawn: 0, cancelled: 0 };
    const ids = changed.map((row) => row.id);
    const cancelledResult = await input.tx.execute(sql`
        UPDATE email_outbox
        SET status = 'failed', last_error = ${`cancelled:${input.reason}`}
        WHERE id IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `
        )})
          AND jsonb_array_length(COALESCE(payload->'verticals', '[]'::jsonb)) = 0
        RETURNING id
    `);
    return { withdrawn: changed.length, cancelled: rowsOf<{ id: string }>(cancelledResult).length };
}
