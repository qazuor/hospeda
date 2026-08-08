import type { PartnerMention } from '@repo/schemas';
import { and, asc, count, desc, eq, gte, isNull, lte, type SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import {
    type InsertPartnerMention,
    partnerMentions
} from '../../schemas/partner/partner_mention.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Filters accepted by {@link PartnerMentionModel.findByPartner}. */
export interface FindPartnerMentionsFilters {
    readonly channel?: string;
    readonly batchId?: string;
    readonly mentionedAfter?: Date;
    readonly mentionedBefore?: Date;
    readonly page?: number;
    readonly pageSize?: number;
    readonly includeDeleted?: boolean;
}

/**
 * Data access for the partner mentions log (HOS-377).
 *
 * Kept separate from {@link PartnerModel} for the same reason
 * `partner_subscriptions` got its own schema rather than columns on `partners`:
 * it is a child collection with its own lifecycle, not a facet of the parent row.
 */
export class PartnerMentionModel extends BaseModelImpl<PartnerMention> {
    protected table = partnerMentions;
    public entityName = 'partnerMention';

    protected getTableName(): string {
        return 'partnerMentions';
    }

    /**
     * Insert every row of one submission, in the caller's transaction.
     *
     * Takes the transaction rather than opening its own, because the batch is
     * all-or-nothing: a campaign that logged three of four networks is worse than
     * one that logged none, since the partner is then shown a log that silently
     * understates what was done. The caller owns the transaction so the
     * notification can be fired only after it commits.
     *
     * @param params - Receives the rows to insert and the transaction to use.
     * @returns The inserted rows.
     */
    async createMany({
        rows,
        tx
    }: {
        readonly rows: readonly InsertPartnerMention[];
        readonly tx?: DrizzleClient;
    }): Promise<PartnerMention[]> {
        if (rows.length === 0) return [];

        const client = this.getClient(tx);
        const inserted = await client
            .insert(partnerMentions)
            .values([...rows])
            .returning();

        return inserted as PartnerMention[];
    }

    /**
     * The WHERE terms shared by the page query and its total.
     *
     * Extracted so the two can never diverge: a count that applies fewer filters
     * than the list it accompanies reports a total for a different question, and
     * the UI renders page links to pages that come back empty. The page/pageSize
     * fields are deliberately not read here — they belong to the slice, not to
     * the set being sliced.
     */
    private buildPartnerConditions(partnerId: string, filters: FindPartnerMentionsFilters): SQL[] {
        const conditions: SQL[] = [eq(partnerMentions.partnerId, partnerId)];

        if (!filters.includeDeleted) {
            conditions.push(isNull(partnerMentions.deletedAt));
        }
        if (filters.channel) {
            conditions.push(
                eq(
                    partnerMentions.channel,
                    filters.channel as (typeof partnerMentions.channel.enumValues)[number]
                )
            );
        }
        if (filters.batchId) {
            conditions.push(eq(partnerMentions.batchId, filters.batchId));
        }
        if (filters.mentionedAfter) {
            conditions.push(gte(partnerMentions.mentionedAt, filters.mentionedAfter));
        }
        if (filters.mentionedBefore) {
            conditions.push(lte(partnerMentions.mentionedAt, filters.mentionedBefore));
        }

        return conditions;
    }

    /**
     * How many rows {@link findByPartner} would return across every page.
     *
     * Shares {@link buildPartnerConditions} with the list query rather than
     * re-deriving the filters, so the total always describes exactly the set
     * being paginated.
     *
     * @param params - Receives the partner id, optional filters and a transaction.
     * @returns The number of matching rows.
     */
    async countByPartner({
        partnerId,
        filters = {},
        tx
    }: {
        readonly partnerId: string;
        readonly filters?: FindPartnerMentionsFilters;
        readonly tx?: DrizzleClient;
    }): Promise<number> {
        const client = this.getClient(tx);

        const rows = await client
            .select({ total: count() })
            .from(partnerMentions)
            .where(and(...this.buildPartnerConditions(partnerId, filters)));

        return Number(rows[0]?.total ?? 0);
    }

    /**
     * One partner's log, newest-first by when the promotion HAPPENED.
     *
     * Ordered by `mentionedAt`, not `createdAt`: a mention entered a week late
     * belongs on the date it actually ran, which is the whole point of keeping the
     * two columns apart.
     *
     * `createdAt` then `id` break ties, and BOTH are needed. Rows written by one
     * submission share a `mentionedAt`, so without a tie-break the order is
     * whatever Postgres feels like and page 2 can hand back a row already seen on
     * page 1. `createdAt` alone does not fix it either: Postgres' `now()` is
     * transaction-scoped, so every row of a batch carries the SAME `created_at`
     * down to the microsecond. `id` is the only column here guaranteed to be
     * unique, which is what makes the ordering total and pagination stable.
     *
     * @param params - Receives the partner id, optional filters and a transaction.
     * @returns The matching rows.
     */
    async findByPartner({
        partnerId,
        filters = {},
        tx
    }: {
        readonly partnerId: string;
        readonly filters?: FindPartnerMentionsFilters;
        readonly tx?: DrizzleClient;
    }): Promise<PartnerMention[]> {
        const client = this.getClient(tx);
        const page = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 20;

        const conditions = this.buildPartnerConditions(partnerId, filters);

        const rows = await client
            .select()
            .from(partnerMentions)
            .where(and(...conditions))
            .orderBy(
                desc(partnerMentions.mentionedAt),
                desc(partnerMentions.createdAt),
                asc(partnerMentions.id)
            )
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        return rows as PartnerMention[];
    }

    /**
     * Every row written by one submission, in canonical channel order.
     *
     * Ordered by `channel` — Postgres sorts an enum by DECLARATION order, so this
     * is Instagram, Facebook, Twitter, YouTube, TikTok, newsletter, WhatsApp,
     * other, the same sequence in every batch and in both the partner-facing view
     * and the notification email.
     *
     * Insertion order is deliberately NOT used, because it is not recoverable:
     * `created_at` defaults to `now()`, which in Postgres is the TRANSACTION
     * timestamp, so all rows of a batch share it exactly and sorting by it yields
     * an arbitrary order that merely looks stable. Reproducing the order the admin
     * picked the channels in would need a dedicated position column, which is not
     * worth a schema column when a canonical order reads better anyway.
     *
     * @param params - Receives the batch id and a transaction.
     * @returns The rows sharing that batch id.
     */
    async findByBatch({
        batchId,
        tx
    }: {
        readonly batchId: string;
        readonly tx?: DrizzleClient;
    }): Promise<PartnerMention[]> {
        const client = this.getClient(tx);

        const rows = await client
            .select()
            .from(partnerMentions)
            .where(and(eq(partnerMentions.batchId, batchId), isNull(partnerMentions.deletedAt)))
            .orderBy(asc(partnerMentions.channel), asc(partnerMentions.id));

        return rows as PartnerMention[];
    }
}
