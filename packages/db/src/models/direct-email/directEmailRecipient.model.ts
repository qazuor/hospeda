import type { DirectEmailRecipient } from '@repo/schemas';
import { DirectEmailRecipientStatusEnum } from '@repo/schemas';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
     * Applies a Brevo webhook event to the recipient with that provider message id.
     *
     * Only moves forward: `delivered` applies to `sent`; `opened` to `sent` or
     * `delivered`; a bounce to `sent`, `delivered` or `opened`. A duplicate or
     * out-of-order event is a no-op, so the first timestamp of each kind is kept.
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
            const target = this.resolveTransition(input);
            const [row] = await db
                .update(directEmailRecipients)
                .set(target.set)
                .where(
                    and(
                        eq(directEmailRecipients.providerMessageId, input.providerMessageId),
                        inArray(directEmailRecipients.status, target.from)
                    )
                )
                .returning();
            logQuery(this.entityName, 'applyProviderEvent', logContext, row);
            // DRIZZLE-LIMITATION: select() rows carry the unknown-typed jsonb / branded pgEnum columns; cast to the canonical schema type.
            return (row as unknown as DirectEmailRecipient) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'applyProviderEvent', logContext, err);
            throw new DbError(this.entityName, 'applyProviderEvent', logContext, err.message);
        }
    }

    /** Maps a provider event to the SET clause and the statuses it may move from. */
    private resolveTransition(input: ApplyProviderEventInput): {
        readonly set: Partial<typeof directEmailRecipients.$inferInsert>;
        readonly from: DirectEmailRecipientStatusEnum[];
    } {
        const { SENT, DELIVERED, OPENED, BOUNCED } = DirectEmailRecipientStatusEnum;
        switch (input.event) {
            case 'delivered':
                return { set: { status: DELIVERED, deliveredAt: input.at }, from: [SENT] };
            case 'opened':
                return { set: { status: OPENED, openedAt: input.at }, from: [SENT, DELIVERED] };
            default:
                return {
                    set: { status: BOUNCED, bouncedAt: input.at },
                    from: [SENT, DELIVERED, OPENED]
                };
        }
    }
}
