import type { DirectEmailRecipientRow as DirectEmailRecipient } from '@repo/schemas';
import { DirectEmailRecipientStatusEnum } from '@repo/schemas';
import { and, asc, eq } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { directEmailRecipients } from '../../schemas/direct-email/direct_email_recipient.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Provider events that move a recipient row. */
export type DirectEmailProviderEvent = 'delivered' | 'opened' | 'hard_bounce' | 'soft_bounce';

/** Input of {@link DirectEmailRecipientModel.applyProviderEvent}. */
export interface ApplyProviderEventInput {
    readonly providerMessageId: string;
    readonly event: DirectEmailProviderEvent;
    readonly at: Date;
}

/** The columns {@link resolveProviderEventUpdate} reads from a recipient row. */
export interface ProviderEventRowState {
    readonly status: DirectEmailRecipientStatusEnum;
    readonly deliveredAt: Date | null;
    readonly openedAt: Date | null;
    readonly bouncedAt: Date | null;
}

/** Columns a provider event may write. */
export type ProviderEventUpdate = Partial<
    Pick<
        typeof directEmailRecipients.$inferInsert,
        'status' | 'deliveredAt' | 'openedAt' | 'bouncedAt'
    >
>;

/**
 * Decides what a Brevo event changes on a recipient row (pure).
 *
 * - Events can arrive out of order, so each timestamp is filled once, whenever its event
 *   comes (`opened` before `delivered` still leaves `delivered_at` filled by the later
 *   `delivered`), and the status never moves backwards (`sent` < `delivered` < `opened`).
 * - `soft_bounce` is transient: it records `bounced_at` and leaves the status alone, so a
 *   later `delivered` or `opened` still advances the row.
 * - Only `hard_bounce` sets `bounced`, and `bounced` is terminal.
 * - `failed` and `suppressed` rows never had a delivery, so no event touches them.
 *
 * @param input.row - Current state of the row
 * @param input.event - Provider event
 * @param input.at - Event time
 * @returns The columns to write, or `null` when the event changes nothing
 */
export function resolveProviderEventUpdate(input: {
    readonly row: ProviderEventRowState;
    readonly event: DirectEmailProviderEvent;
    readonly at: Date;
}): ProviderEventUpdate | null {
    const { row, event, at } = input;
    const { SENT, DELIVERED, OPENED, BOUNCED } = DirectEmailRecipientStatusEnum;
    if (row.status === BOUNCED) return null;
    if (row.status !== SENT && row.status !== DELIVERED && row.status !== OPENED) return null;

    const update: ProviderEventUpdate = {};
    switch (event) {
        case 'delivered':
            if (!row.deliveredAt) update.deliveredAt = at;
            if (row.status === SENT) update.status = DELIVERED;
            break;
        case 'opened':
            if (!row.openedAt) update.openedAt = at;
            if (row.status === SENT || row.status === DELIVERED) update.status = OPENED;
            break;
        case 'soft_bounce':
            if (!row.bouncedAt) update.bouncedAt = at;
            break;
        case 'hard_bounce':
            update.status = BOUNCED;
            update.bouncedAt = at;
            break;
    }
    return Object.keys(update).length > 0 ? update : null;
}

/** Attempts of the read-decide-write loop of a provider event before giving up. */
const PROVIDER_EVENT_MAX_ATTEMPTS = 3;

/**
 * Model for `direct_email_recipient` (HOS-2685).
 */
export class DirectEmailRecipientModel extends BaseModelImpl<DirectEmailRecipient> {
    protected table = directEmailRecipients;
    public entityName = 'directEmailRecipients';

    protected getTableName(): string {
        return 'directEmailRecipients';
    }

    /**
     * Recipients of one message, in address order.
     *
     * @param messageId - Message id
     * @param tx - Optional transaction client
     * @returns The recipient rows
     */
    async findByMessageId(messageId: string, tx?: DrizzleClient): Promise<DirectEmailRecipient[]> {
        const db = this.getClient(tx);
        const rows = await db
            .select()
            .from(directEmailRecipients)
            .where(eq(directEmailRecipients.messageId, messageId))
            .orderBy(asc(directEmailRecipients.email));
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return rows as unknown as DirectEmailRecipient[];
    }

    /**
     * Finds the recipient a footer-link opt-out token was issued to.
     *
     * @param optOutToken - Opaque token from the link
     * @param tx - Optional transaction client
     * @returns The recipient row, or `null` for an unknown token
     */
    async findByOptOutToken(
        optOutToken: string,
        tx?: DrizzleClient
    ): Promise<DirectEmailRecipient | null> {
        const db = this.getClient(tx);
        const [row] = await db
            .select()
            .from(directEmailRecipients)
            .where(eq(directEmailRecipients.optOutToken, optOutToken))
            .limit(1);
        // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
        return (row as unknown as DirectEmailRecipient) ?? null;
    }

    /**
     * Applies a Brevo webhook event to the recipient with that provider message id,
     * following {@link resolveProviderEventUpdate}.
     *
     * Read, decide, then write guarded by the status that was read: if a concurrent event
     * moved the row in between, the write matches nothing and the decision is retried on
     * the fresh row.
     *
     * @param input - Provider message id, event and event time
     * @param tx - Optional transaction client
     * @returns The updated row, or `null` when none matched or nothing moved
     */
    async applyProviderEvent(
        input: ApplyProviderEventInput,
        tx?: DrizzleClient
    ): Promise<DirectEmailRecipient | null> {
        const db = this.getClient(tx);
        const logContext = { ...input };
        try {
            for (let attempt = 0; attempt < PROVIDER_EVENT_MAX_ATTEMPTS; attempt++) {
                const [current] = await db
                    .select()
                    .from(directEmailRecipients)
                    .where(eq(directEmailRecipients.providerMessageId, input.providerMessageId))
                    .limit(1);
                if (!current) return null;
                const update = resolveProviderEventUpdate({
                    // DRIZZLE-LIMITATION: the select() row's pgEnum status is branded; the state shape is a structural subset.
                    row: current as unknown as ProviderEventRowState,
                    event: input.event,
                    at: input.at
                });
                if (!update) return null;
                const [row] = await db
                    .update(directEmailRecipients)
                    .set(update)
                    .where(
                        and(
                            eq(directEmailRecipients.id, current.id),
                            eq(directEmailRecipients.status, current.status)
                        )
                    )
                    .returning();
                logQuery(this.entityName, 'applyProviderEvent', logContext, row);
                // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
                if (row) return row as unknown as DirectEmailRecipient;
            }
            return null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'applyProviderEvent', logContext, err);
            throw new DbError(this.entityName, 'applyProviderEvent', logContext, err.message);
        }
    }
}
