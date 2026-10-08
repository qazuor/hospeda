/**
 * @file plan-catalog.model.ts
 *
 * Read model for the plan and addon catalog (HOS-1435, piece V2, AC:V2:3 to
 * AC:V2:5): the rows the inverse direction of the billing-verticals contract
 * reads (`planPolicy`, `changeDirection`, `addonPolicy`).
 *
 * **Why NOT BaseModelImpl:** a version is immutable (extras 041 rejects every
 * UPDATE but `plan_version.current`, and every DELETE). `BaseModelImpl` hands
 * every model `update`, `softDelete`, `hardDelete` and `restore`, and assumes
 * `deleted_at` columns these tables do not have. Publishing a version (action
 * 18) is not this leaf; this model only reads.
 */

import { type AggregationStrategy, AggregationStrategySchema } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    addonVersions,
    type SelectAddonVersion
} from '../../schemas/vertical/addon-catalog.dbschema.ts';
import { catalogKeys } from '../../schemas/vertical/catalog-key.dbschema.ts';
import {
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    type SelectPlanVersion
} from '../../schemas/vertical/plan-catalog.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

const ENTITY_NAME = 'planCatalog';

/** Input of the single-row reads: an id and an optional transaction. */
export interface FindCatalogVersionInput {
    readonly id: string;
    readonly tx?: DrizzleClient;
}

/**
 * One entitlement a plan version grants, with its quotas when metered, and the
 * aggregation strategy its key declares in `catalog_key`.
 */
export interface PlanVersionEntitlementEffect {
    readonly key: string;
    readonly planQuota: number | null;
    readonly trialQuota: number | null;
    readonly aggregationStrategy: AggregationStrategy;
}

/** One limit a plan version sets, and the aggregation strategy its key declares. */
export interface PlanVersionLimitEffect {
    readonly key: string;
    readonly value: number;
    readonly aggregationStrategy: AggregationStrategy;
}

/** What a plan version grants: its entitlements and its limits. */
export interface PlanVersionEffects {
    readonly entitlements: readonly PlanVersionEntitlementEffect[];
    readonly limits: readonly PlanVersionLimitEffect[];
}

/** Read model of the plan and addon catalog. */
export class PlanCatalogModel {
    /** Resolves the transaction client when given, the shared client otherwise. */
    private client(tx?: DrizzleClient): DrizzleClient {
        return tx ?? getDb();
    }

    /**
     * Reads one plan version.
     *
     * @param input - The version id and an optional transaction.
     * @returns The row, or `null` when no version has that id.
     * @throws DbError if the query fails.
     */
    async findPlanVersion(input: FindCatalogVersionInput): Promise<SelectPlanVersion | null> {
        const logContext = { id: input.id };
        try {
            const rows = await this.client(input.tx)
                .select()
                .from(planVersions)
                .where(eq(planVersions.id, input.id))
                .limit(1);
            this.logOk('findPlanVersion', logContext, rows);
            return rows[0] ?? null;
        } catch (error) {
            this.fail('findPlanVersion', logContext, error);
        }
    }

    /**
     * Reads what one plan version grants: its entitlements and limits, each
     * with the aggregation strategy its key declares in `catalog_key`.
     *
     * @param input - The version id and an optional transaction.
     * @returns The version's effects (empty lists for a version that grants nothing).
     * @throws DbError if the query fails.
     */
    async findPlanVersionEffects(input: FindCatalogVersionInput): Promise<PlanVersionEffects> {
        const logContext = { id: input.id };
        try {
            const client = this.client(input.tx);
            const entitlements = await client
                .select({
                    key: planVersionEntitlements.key,
                    planQuota: planVersionEntitlements.planQuota,
                    trialQuota: planVersionEntitlements.trialQuota,
                    aggregationStrategy: catalogKeys.aggregationStrategy
                })
                .from(planVersionEntitlements)
                .innerJoin(catalogKeys, eq(catalogKeys.key, planVersionEntitlements.key))
                .where(eq(planVersionEntitlements.planVersionId, input.id));
            const limits = await client
                .select({
                    key: planVersionLimits.key,
                    value: planVersionLimits.value,
                    aggregationStrategy: catalogKeys.aggregationStrategy
                })
                .from(planVersionLimits)
                .innerJoin(catalogKeys, eq(catalogKeys.key, planVersionLimits.key))
                .where(eq(planVersionLimits.planVersionId, input.id));
            // `catalog_key.aggregation_strategy` is a varchar held to the closed
            // list by `ck_catalog_key_aggregation_strategy`; parsed, not cast.
            const effects = {
                entitlements: entitlements.map((row) => ({
                    ...row,
                    aggregationStrategy: AggregationStrategySchema.parse(row.aggregationStrategy)
                })),
                limits: limits.map((row) => ({
                    ...row,
                    aggregationStrategy: AggregationStrategySchema.parse(row.aggregationStrategy)
                }))
            };
            this.logOk('findPlanVersionEffects', logContext, effects);
            return effects;
        } catch (error) {
            this.fail('findPlanVersionEffects', logContext, error);
        }
    }

    /**
     * Reads one addon version.
     *
     * @param input - The version id and an optional transaction.
     * @returns The row, or `null` when no addon version has that id.
     * @throws DbError if the query fails.
     */
    async findAddonVersion(input: FindCatalogVersionInput): Promise<SelectAddonVersion | null> {
        const logContext = { id: input.id };
        try {
            const rows = await this.client(input.tx)
                .select()
                .from(addonVersions)
                .where(eq(addonVersions.id, input.id))
                .limit(1);
            this.logOk('findAddonVersion', logContext, rows);
            return rows[0] ?? null;
        } catch (error) {
            this.fail('findAddonVersion', logContext, error);
        }
    }

    /** Logs a successful query; logging never breaks the operation. */
    private logOk(method: string, context: unknown, result: unknown): void {
        try {
            logQuery(ENTITY_NAME, method, context, result);
        } catch {}
    }

    /** Logs and rethrows as a {@link DbError} that keeps the original error as `cause`. */
    private fail(method: string, context: unknown, error: unknown): never {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            logError(ENTITY_NAME, method, context, err);
        } catch {}
        throw new DbError(ENTITY_NAME, method, context, err.message, err);
    }
}

/** Singleton instance of {@link PlanCatalogModel}. */
export const planCatalogModel = new PlanCatalogModel();
