import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeBenefitUsages } from '../../schemas/host-trade/host_trade_benefit_usage.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Drizzle-inferred row shape for `host_trade_benefit_usages`. */
type HostTradeBenefitUsageRow = typeof hostTradeBenefitUsages.$inferSelect;

/**
 * Model for the `host_trade_benefit_usages` table (HOS-376).
 *
 * Standard CRUD comes from {@link BaseModelImpl}. On top of it this model
 * carries the four domain queries the usage service is built on — each one
 * encodes a rule from the spec that is easy to get subtly wrong in an ad-hoc
 * `findAll` call, which is why they live here rather than in the service.
 */
export class HostTradeBenefitUsageModel extends BaseModelImpl<HostTradeBenefitUsageRow> {
    protected table = hostTradeBenefitUsages;
    public entityName = 'hostTradeBenefitUsages';

    protected getTableName(): string {
        return 'hostTradeBenefitUsages';
    }

    /**
     * Returns the pending usages that are waiting on THIS user to act,
     * newest first.
     *
     * Scoped to `declaredBy = 'PROVIDER'` on purpose. A `PENDING` row the host
     * declared himself is waiting on the *provider*, so it is not actionable by
     * him — and the nav badge that this query feeds turns off by RESOLVING, not
     * by viewing (spec §6.6). Including his own declarations would produce a
     * badge he is structurally unable to clear.
     *
     * @param hostUserId - The host whose inbox is being read.
     * @param tx - Optional transaction client.
     * @returns Pending usages awaiting this host's confirmation.
     * @throws DbError if the query fails.
     */
    async findPendingForUser(
        hostUserId: string,
        tx?: DrizzleClient
    ): Promise<HostTradeBenefitUsageRow[]> {
        const db = this.getClient(tx);
        const logContext = { hostUserId };

        try {
            const results = await db
                .select()
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.hostUserId, hostUserId),
                        eq(hostTradeBenefitUsages.status, 'PENDING'),
                        eq(hostTradeBenefitUsages.declaredBy, 'PROVIDER'),
                        isNull(hostTradeBenefitUsages.deletedAt)
                    )
                )
                .orderBy(desc(hostTradeBenefitUsages.createdAt));

            try {
                logQuery(this.entityName, 'findPendingForUser', logContext, results);
            } catch {}

            return results as HostTradeBenefitUsageRow[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findPendingForUser', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findPendingForUser', logContext, err.message);
        }
    }

    /**
     * Returns the most recently confirmed usage for a (provider, host) pair,
     * or `null` when none exists.
     *
     * This is the review gate of spec §6.3: a host may only review a provider
     * he has a `CONFIRMED` usage with. The pair can accumulate several confirmed
     * usages over time (the repeat customer), so the newest one is returned.
     *
     * @param hostTradeId - The provider.
     * @param hostUserId - The host.
     * @param tx - Optional transaction client.
     * @returns The newest confirmed usage for the pair, or null.
     * @throws DbError if the query fails.
     */
    async findConfirmedPair(
        hostTradeId: string,
        hostUserId: string,
        tx?: DrizzleClient
    ): Promise<HostTradeBenefitUsageRow | null> {
        const db = this.getClient(tx);
        const logContext = { hostTradeId, hostUserId };

        try {
            const results = await db
                .select()
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.hostTradeId, hostTradeId),
                        eq(hostTradeBenefitUsages.hostUserId, hostUserId),
                        eq(hostTradeBenefitUsages.status, 'CONFIRMED'),
                        isNull(hostTradeBenefitUsages.deletedAt)
                    )
                )
                .orderBy(desc(hostTradeBenefitUsages.confirmedAt))
                .limit(1);

            try {
                logQuery(this.entityName, 'findConfirmedPair', logContext, results);
            } catch {}

            return (results[0] as HostTradeBenefitUsageRow | undefined) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findConfirmedPair', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findConfirmedPair', logContext, err.message);
        }
    }

    /**
     * Returns the distinct host user IDs that have at least one confirmed usage
     * with this provider, most recently confirmed first.
     *
     * Backs the scoped selector of spec §6.2(b). The scoping IS the privacy
     * boundary: the provider only ever sees hosts who already confirmed a usage
     * with him, never the destination's roster.
     *
     * @param hostTradeId - The provider.
     * @param tx - Optional transaction client.
     * @returns Distinct host user IDs, most recent confirmation first.
     * @throws DbError if the query fails.
     */
    async findLinkedHosts(hostTradeId: string, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const logContext = { hostTradeId };

        try {
            const results = await db
                .select({ hostUserId: hostTradeBenefitUsages.hostUserId })
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.hostTradeId, hostTradeId),
                        eq(hostTradeBenefitUsages.status, 'CONFIRMED'),
                        isNull(hostTradeBenefitUsages.deletedAt)
                    )
                )
                .groupBy(hostTradeBenefitUsages.hostUserId)
                .orderBy(sql`max(${hostTradeBenefitUsages.confirmedAt}) desc`);

            try {
                logQuery(this.entityName, 'findLinkedHosts', logContext, results);
            } catch {}

            return results.map((row) => row.hostUserId);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findLinkedHosts', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findLinkedHosts', logContext, err.message);
        }
    }

    /**
     * Counts how many of this provider's own declarations were rejected within
     * the trailing `windowDays`.
     *
     * Feeds the suspension threshold of spec §6.5. Scoped to
     * `declaredBy = 'PROVIDER'` deliberately: the threshold measures a provider
     * declaring usages that hosts then deny. A usage the HOST declared and the
     * provider rejected is the provider exercising his own right to refuse, and
     * counting it would suspend him for saying "no, I never did that work".
     *
     * @param hostTradeId - The provider.
     * @param windowDays - Size of the trailing window, in days.
     * @param tx - Optional transaction client.
     * @returns Number of rejections inside the window.
     * @throws DbError if the query fails.
     */
    async countRejectionsInWindow(
        hostTradeId: string,
        windowDays: number,
        tx?: DrizzleClient
    ): Promise<number> {
        const db = this.getClient(tx);
        const since = new Date(Date.now() - windowDays * 86_400_000);
        const logContext = { hostTradeId, windowDays, since };

        try {
            const results = await db
                .select({ value: count() })
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.hostTradeId, hostTradeId),
                        eq(hostTradeBenefitUsages.status, 'REJECTED'),
                        eq(hostTradeBenefitUsages.declaredBy, 'PROVIDER'),
                        gte(hostTradeBenefitUsages.rejectedAt, since),
                        isNull(hostTradeBenefitUsages.deletedAt)
                    )
                );

            try {
                logQuery(this.entityName, 'countRejectionsInWindow', logContext, results);
            } catch {}

            return results[0]?.value ?? 0;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countRejectionsInWindow', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'countRejectionsInWindow', logContext, err.message);
        }
    }
}

/** Singleton instance of HostTradeBenefitUsageModel. */
export const hostTradeBenefitUsageModel = new HostTradeBenefitUsageModel();
