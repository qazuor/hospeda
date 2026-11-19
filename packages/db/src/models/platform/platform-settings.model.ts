import type { InferSelectModel } from 'drizzle-orm';
import { and, eq, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { platformSettings } from '../../schemas/platform/platform-settings.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/**
 * Inferred row type for the `platform_settings` table.
 */
export type PlatformSettingRecord = InferSelectModel<typeof platformSettings>;

/**
 * Model for the `platform_settings` table (SPEC-156).
 *
 * Cross-device storage for SUPER_ADMIN / ADMIN-level platform settings keyed by a
 * stable string identifier (e.g. `seo.defaults`, `maintenance.mode`,
 * `announcements.global`). The shape of each `value` is validated at the
 * application layer by `PlatformSettingsResponseSchema` in `@repo/schemas`.
 *
 * Upsert-only — there is no soft delete because an absent key and a deleted key
 * would be ambiguous (both mean "use built-in defaults").
 */
export class PlatformSettingsModel extends BaseModelImpl<PlatformSettingRecord> {
    protected table = platformSettings;
    public entityName = 'platform_settings';

    protected getTableName(): string {
        return 'platformSettings';
    }

    /**
     * Finds the platform setting row for the given key.
     *
     * @param key - Stable setting identifier (e.g. `seo.defaults`)
     * @param tx - Optional transaction client
     * @returns The matching row, or `undefined` if the key is not present
     */
    async findByKey(key: string, tx?: DrizzleClient): Promise<PlatformSettingRecord | undefined> {
        const db = this.getClient(tx);
        const results = await db
            .select()
            .from(platformSettings)
            .where(eq(platformSettings.key, key))
            .limit(1);
        return results[0];
    }

    /**
     * Inserts or updates the platform setting row for the given key.
     *
     * On conflict on the primary key, the existing row's `value`, `updatedAt`,
     * and `updatedBy` columns are replaced atomically. Returns the resulting row.
     *
     * @param key - Stable setting identifier
     * @param value - Setting value (validated upstream by Zod per key)
     * @param actorId - UUID of the user performing the write (recorded in `updatedBy`)
     * @param tx - Optional transaction client
     * @returns The upserted row
     */
    async upsertByKey(
        key: string,
        value: unknown,
        actorId: string,
        tx?: DrizzleClient
    ): Promise<PlatformSettingRecord> {
        const db = this.getClient(tx);
        const now = new Date();
        const results = await db
            .insert(platformSettings)
            .values({
                key,
                value,
                updatedAt: now,
                updatedBy: actorId
            })
            .onConflictDoUpdate({
                target: platformSettings.key,
                set: {
                    value,
                    updatedAt: now,
                    updatedBy: actorId
                }
            })
            .returning();
        // Drizzle returns at least one row on a successful upsert.
        const row = results[0];
        if (!row) {
            throw new Error(
                `upsertByKey returned no row for key="${key}" — unexpected database state`
            );
        }
        return row;
    }

    /**
     * Consumes the provider watch battery's monthly authorization (HOS-1512): a single conditional
     * UPDATE, so two runs racing for the same authorization cannot both win. The row must hold
     * the given month and no consumption yet; the loser's UPDATE re-evaluates the condition after
     * the winner commits and matches nothing.
     *
     * @param input.month - The month the run needs (`YYYY-MM`)
     * @param input.maxChargeMinor - The cap the run was pre-flighted with
     * @param input.accountId - The account id the run was pre-flighted with. The three must still be
     *   what is stored, or an authorization the owner rewrote during pre-flight would be consumed
     *   while the run used the old values.
     * @param input.runId - The run consuming it
     * @param input.consumedAt - The instant of consumption
     * @param input.tx - The transaction that also creates the run row
     * @returns Whether this call consumed the authorization
     */
    async consumeProviderWatchAuthorization(input: {
        readonly month: string;
        readonly maxChargeMinor: number;
        readonly accountId: string;
        readonly runId: string;
        readonly consumedAt: Date;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly consumed: boolean }> {
        const marker = JSON.stringify({
            consumedAt: input.consumedAt.toISOString(),
            consumedByRunId: input.runId
        });
        const rows = await this.getClient(input.tx)
            .update(platformSettings)
            .set({ value: sql`${platformSettings.value} || ${marker}::jsonb` })
            .where(
                and(
                    eq(platformSettings.key, 'billing.providerWatchAuthorization'),
                    sql`${platformSettings.value}->>'month' = ${input.month}`,
                    sql`${platformSettings.value}->>'maxChargeMinor' = ${String(input.maxChargeMinor)}`,
                    sql`${platformSettings.value}->>'accountId' = ${input.accountId}`,
                    sql`${platformSettings.value}->>'consumedByRunId' IS NULL`
                )
            )
            .returning({ key: platformSettings.key });
        return { consumed: rows.length === 1 };
    }

    /**
     * Writes the owner's provider watch authorization (HOS-1512). Always a new, unconsumed
     * authorization, with one exception (re-review of #4538, A3): re-authorizing 0 for the SAME
     * month and account as a stored authorization of 0 keeps its daily use (`lastRunDay`,
     * `runIds`), or a re-authorization would let a second run go the same day. The carry-over is
     * decided by the database against the row as it is when the write lands, in the same
     * statement, so a run taking the day concurrently is never lost.
     *
     * @param input.value - The authorization: month, amount, account id and nickname
     * @param input.actorId - Who wrote it
     * @param input.tx - Optional transaction
     * @returns The stored row
     */
    async writeProviderWatchAuthorization(input: {
        readonly value: {
            readonly month: string;
            readonly maxChargeMinor: number;
            readonly accountId: string;
            readonly accountNickname?: string;
        };
        readonly actorId: string;
        readonly tx?: DrizzleClient;
    }): Promise<PlatformSettingRecord> {
        const now = new Date();
        const fresh = JSON.stringify(input.value);
        const stored = sql.raw(`"platform_settings"."value"`);
        const [row] = await this.getClient(input.tx)
            .insert(platformSettings)
            .values({
                key: 'billing.providerWatchAuthorization',
                value: input.value,
                updatedAt: now,
                updatedBy: input.actorId
            })
            .onConflictDoUpdate({
                target: platformSettings.key,
                set: {
                    value: sql`${fresh}::jsonb || CASE
                        WHEN ${input.value.maxChargeMinor} = 0
                            AND ${stored}->>'maxChargeMinor' = '0'
                            AND ${stored}->>'month' = ${input.value.month}
                            AND ${stored}->>'accountId' = ${input.value.accountId}
                        THEN jsonb_strip_nulls(jsonb_build_object(
                            'lastRunDay', ${stored}->'lastRunDay',
                            'runIds', ${stored}->'runIds'
                        ))
                        ELSE '{}'::jsonb
                    END`,
                    updatedAt: now,
                    updatedBy: input.actorId
                }
            })
            .returning();
        if (!row) throw new Error('writeProviderWatchAuthorization returned no row');
        return row;
    }

    /**
     * Takes an authorization of 0 for ONE market day (owner decision on B1, 2026-11-19): an
     * authorization whose catalog moves no money is not consumed; it covers one run a day for its
     * month. A conditional update, like the one-shot consumption: it matches only the exact values
     * the run was pre-flighted with, an amount of 0, an unconsumed row, and a day of that month
     * later than the last one taken, so two runs on the same day cannot both take it, nor can a day
     * already behind. The run id is appended to `runIds`, the audit
     * of the runs it covered.
     *
     * @param input.month - The month the run was pre-flighted with
     * @param input.accountId - The account id the run was pre-flighted with
     * @param input.day - The run's market day, `YYYY-MM-DD`
     * @param input.runId - The run taking the day
     * @param input.tx - Optional transaction
     * @returns Whether THIS run took the day and, when it did not, why: `DAY_TAKEN` when the
     *   authorization is still the one the run was pre-flighted with and that very day is already
     *   taken (the expected second run of a day); `CHANGED` for any other miss: no row, revoked,
     *   replaced, consumed, another account or amount, or a day behind the last one taken (a clock
     *   that went back). The cause is read in the same transaction, after the update missed
     */
    async takeProviderWatchAuthorizationDay(input: {
        readonly month: string;
        readonly accountId: string;
        readonly day: string;
        readonly runId: string;
        readonly tx?: DrizzleClient;
    }): Promise<{ readonly taken: boolean; readonly miss?: 'DAY_TAKEN' | 'CHANGED' }> {
        const rows = await this.getClient(input.tx)
            .update(platformSettings)
            .set({
                value: sql`${platformSettings.value} || jsonb_build_object(
                    'lastRunDay', ${input.day}::text,
                    'runIds', COALESCE(${platformSettings.value} -> 'runIds', '[]'::jsonb) || jsonb_build_array(${input.runId}::text)
                )`
            })
            .where(
                and(
                    eq(platformSettings.key, 'billing.providerWatchAuthorization'),
                    sql`${platformSettings.value}->>'month' = ${input.month}`,
                    sql`${platformSettings.value}->>'maxChargeMinor' = '0'`,
                    sql`${platformSettings.value}->>'accountId' = ${input.accountId}`,
                    sql`${platformSettings.value}->>'consumedByRunId' IS NULL`,
                    // The day belongs to the authorized month, and is LATER than the last one taken:
                    // a day already taken (or an earlier one, from a clock that went back) is refused
                    // (re-review of #4538, A1). `YYYY-MM-DD` orders as text.
                    sql`left(${input.day}::text, 7) = ${platformSettings.value}->>'month'`,
                    sql`(${platformSettings.value}->>'lastRunDay' IS NULL OR ${platformSettings.value}->>'lastRunDay' < ${input.day}::text)`
                )
            )
            .returning({ key: platformSettings.key });
        if (rows.length === 1) return { taken: true };
        // Follow-up of #4538 (A2b): name the cause of the miss. Only a duplicate run on the SAME day,
        // against the unchanged authorization, is the expected skip; everything else stays loud.
        const [stored] = await this.getClient(input.tx)
            .select({ value: platformSettings.value })
            .from(platformSettings)
            .where(eq(platformSettings.key, 'billing.providerWatchAuthorization'));
        const value = (stored?.value ?? null) as Record<string, unknown> | null;
        const sameDayTaken =
            value !== null &&
            value.month === input.month &&
            value.maxChargeMinor === 0 &&
            value.accountId === input.accountId &&
            value.consumedByRunId === undefined &&
            value.lastRunDay === input.day;
        return { taken: false, miss: sameDayTaken ? 'DAY_TAKEN' : 'CHANGED' };
    }
}

/** Singleton instance of PlatformSettingsModel for use across the application. */
export const platformSettingsModel = new PlatformSettingsModel();
