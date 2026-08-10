import type { HostTradeBenefitUsage } from '@repo/schemas';
import { and, count, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeBenefitUsages } from '../../schemas/host-trade/host_trade_benefit_usage.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Row shape for `host_trade_benefit_usages`.
 *
 * The `@repo/schemas` entity rather than `typeof table.$inferSelect`: Drizzle
 * widens the pgEnum columns to `string`, which does not satisfy
 * `BaseModel<TEntity>` when the service layer binds this model to
 * `BaseCrudService<HostTradeBenefitUsage, …>`. Matching `HostTradeModel`, which
 * types on `HostTrade` for the same reason.
 */
type HostTradeBenefitUsageRow = HostTradeBenefitUsage;

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
     * The rows that are waiting on THIS user to act.
     *
     * Scoped to `declaredBy = 'PROVIDER'` on purpose. A `PENDING` row the host
     * declared himself is waiting on the *provider*, so it is not actionable by
     * him — and the nav badge that this query feeds turns off by RESOLVING, not
     * by viewing (spec §6.6). Including his own declarations would produce a
     * badge he is structurally unable to clear.
     *
     * Shared by the list and the count so the two can never disagree about what
     * "pending for me" means: a badge showing 3 over a page listing 1 is worse
     * than either number being wrong on its own.
     */
    private pendingForUserCondition(hostUserId: string) {
        return and(
            eq(hostTradeBenefitUsages.hostUserId, hostUserId),
            eq(hostTradeBenefitUsages.status, 'PENDING'),
            eq(hostTradeBenefitUsages.declaredBy, 'PROVIDER'),
            isNull(hostTradeBenefitUsages.deletedAt)
        );
    }

    /**
     * Returns the pending usages that are waiting on THIS user to act,
     * newest first.
     *
     * @param hostUserId - The host whose inbox is being read.
     * @param pagination - Optional 1-based page window. Absent means every row.
     * @param tx - Optional transaction client.
     * @returns Pending usages awaiting this host's confirmation.
     * @throws DbError if the query fails.
     */
    async findPendingForUser(
        hostUserId: string,
        pagination?: { page: number; pageSize: number },
        tx?: DrizzleClient
    ): Promise<HostTradeBenefitUsageRow[]> {
        const db = this.getClient(tx);
        const logContext = { hostUserId, pagination };

        try {
            const query = db
                .select()
                .from(hostTradeBenefitUsages)
                .where(this.pendingForUserCondition(hostUserId))
                .orderBy(desc(hostTradeBenefitUsages.createdAt));

            const results = pagination
                ? await query
                      .limit(pagination.pageSize)
                      .offset((pagination.page - 1) * pagination.pageSize)
                : await query;

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
     * Counts the pending usages waiting on this user, for the nav badge and for
     * the list's total.
     *
     * @param hostUserId - The host whose inbox is being counted.
     * @param tx - Optional transaction client.
     * @returns How many rows await this host's confirmation.
     * @throws DbError if the query fails.
     */
    async countPendingForUser(hostUserId: string, tx?: DrizzleClient): Promise<number> {
        const db = this.getClient(tx);
        const logContext = { hostUserId };

        try {
            const results = await db
                .select({ value: count() })
                .from(hostTradeBenefitUsages)
                .where(this.pendingForUserCondition(hostUserId));

            try {
                logQuery(this.entityName, 'countPendingForUser', logContext, results);
            } catch {}

            return results[0]?.value ?? 0;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'countPendingForUser', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'countPendingForUser', logContext, err.message);
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
     * The same linked hosts as {@link findLinkedHosts}, carrying the name the
     * selector needs to render.
     *
     * A join rather than the id list plus a lookup per row: a provider with
     * forty past clients would otherwise cost forty round trips to draw one
     * dropdown.
     *
     * THE SELECT LIST IS THE PRIVACY BOUNDARY. Id and name only — never the
     * email. "Already served" is not consent to hand over a stored address, and
     * a provider who needs the email channel already has the address; what he
     * must not receive is an export of every past client's contact details.
     *
     * @param hostTradeId - The provider whose selector is being filled.
     * @param tx - Optional transaction client.
     * @returns Distinct hosts with a confirmed usage, most recent first.
     * @throws DbError if the query fails.
     */
    async findLinkedHostsWithNames(
        hostTradeId: string,
        tx?: DrizzleClient
    ): Promise<
        {
            id: string;
            displayName: string | null;
            firstName: string | null;
            lastName: string | null;
        }[]
    > {
        const db = this.getClient(tx);
        const logContext = { hostTradeId };

        try {
            const results = await db
                .select({
                    id: users.id,
                    displayName: users.displayName,
                    firstName: users.firstName,
                    lastName: users.lastName
                })
                .from(hostTradeBenefitUsages)
                .innerJoin(users, eq(users.id, hostTradeBenefitUsages.hostUserId))
                .where(
                    and(
                        eq(hostTradeBenefitUsages.hostTradeId, hostTradeId),
                        eq(hostTradeBenefitUsages.status, 'CONFIRMED'),
                        isNull(hostTradeBenefitUsages.deletedAt)
                    )
                )
                .groupBy(users.id, users.displayName, users.firstName, users.lastName)
                .orderBy(sql`max(${hostTradeBenefitUsages.confirmedAt}) desc`);

            try {
                logQuery(this.entityName, 'findLinkedHostsWithNames', logContext, results);
            } catch {}

            return results;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findLinkedHostsWithNames', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findLinkedHostsWithNames', logContext, err.message);
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
    /**
     * The PENDING rows whose confirmation window has run out.
     *
     * Returns ids only: the expiry cron writes a status and notifies NOBODY
     * (§7.6 — silence is not an accusation), so it has no use for the rest of
     * the row and no reason to drag it across the wire.
     *
     * @param now - The moment to measure against. Injected rather than read
     *   from the clock so a test can place a row on either side of it.
     * @param tx - Optional transaction client.
     * @returns The ids of every usage that should expire.
     */
    async findExpirableIds(now: Date, tx?: DrizzleClient): Promise<string[]> {
        const db = this.getClient(tx);
        const logContext = { now: now.toISOString() };

        try {
            const rows = await db
                .select({ id: hostTradeBenefitUsages.id })
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.status, 'PENDING'),
                        isNull(hostTradeBenefitUsages.deletedAt),
                        lte(hostTradeBenefitUsages.expiresAt, now)
                    )
                );

            try {
                logQuery(this.entityName, 'findExpirableIds', logContext, rows);
            } catch {}

            return rows.map((row) => row.id);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findExpirableIds', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findExpirableIds', logContext, err.message);
        }
    }

    /**
     * The PENDING rows old enough to deserve their one nudge, and not yet sent.
     *
     * `reminderSentAt IS NULL` is not an optimisation — it IS the idempotency
     * (AC-8). The cron runs daily and every row it returns stays old enough
     * forever, so without that predicate a forgotten confirmation would be
     * chased every morning until it expired.
     *
     * @param createdBefore - Rows created at or before this moment qualify.
     * @param tx - Optional transaction client.
     * @returns Full rows: the reminder email needs the counterpart and dates.
     */
    async findRemindable(
        createdBefore: Date,
        tx?: DrizzleClient
    ): Promise<HostTradeBenefitUsageRow[]> {
        const db = this.getClient(tx);
        const logContext = { createdBefore: createdBefore.toISOString() };

        try {
            const rows = await db
                .select()
                .from(hostTradeBenefitUsages)
                .where(
                    and(
                        eq(hostTradeBenefitUsages.status, 'PENDING'),
                        isNull(hostTradeBenefitUsages.deletedAt),
                        isNull(hostTradeBenefitUsages.reminderSentAt),
                        lte(hostTradeBenefitUsages.createdAt, createdBefore)
                    )
                );

            try {
                logQuery(this.entityName, 'findRemindable', logContext, rows);
            } catch {}

            // DRIZZLE-LIMITATION: Drizzle infers the pgEnum columns as plain
            // `string`, which does not satisfy the `@repo/schemas` entity this
            // model is typed on.
            return rows as unknown as HostTradeBenefitUsageRow[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findRemindable', logContext, err);
            } catch {}
            throw new DbError(this.entityName, 'findRemindable', logContext, err.message);
        }
    }

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
