import { execSQL } from '../../../fixtures/db-helpers.ts';

type OutboxNoticeRow = {
    readonly status: string;
    readonly payload: Record<string, unknown>;
    readonly created_at: Date;
} & Record<string, unknown>;

/** Read a user's outbox notices for one template in deterministic creation order. */
export async function outboxRowsFor(args: {
    readonly userId: string;
    readonly template: string;
}): Promise<readonly OutboxNoticeRow[]> {
    return execSQL<OutboxNoticeRow>(
        `SELECT status, payload, created_at FROM email_outbox
         WHERE recipient_user_id = $1 AND template = $2
         ORDER BY created_at, id`,
        [args.userId, args.template]
    );
}

/** Count every outbox row addressed to one user. */
export async function outboxCountFor(args: { readonly userId: string }): Promise<number> {
    const [row] = await execSQL<{ count: number } & Record<string, unknown>>(
        'SELECT count(*)::int AS count FROM email_outbox WHERE recipient_user_id = $1',
        [args.userId]
    );
    return row?.count ?? 0;
}
