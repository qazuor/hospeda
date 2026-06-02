/**
 * Plan CRUD Module
 *
 * Handles database CRUD operations for billing plans:
 * - Map DB rows + prices to BillingPlanResponse DTO
 * - List, getById, create, update, toggle, soft-delete, hard-delete
 *
 * All mutations run inside transactions and emit audit log entries.
 * Access control is enforced at the API layer (T-008+), not here.
 *
 * @module services/billing/plan/plan.crud
 */

import {
    type DrizzleClient,
    type QZPayBillingPlan,
    type QZPayBillingPrice,
    type QueryContext,
    and,
    asc,
    billingPlans,
    billingPrices,
    billingSubscriptions,
    count,
    eq,
    getDb,
    isNull,
    sql,
    withTransaction
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import type { AdminBillingPlanResponse, BillingPlanResponse } from '@repo/schemas';
import { diffPlanFields, insertPlanAuditLog } from './plan.audit.js';
import type { CreatePlanInput, ListPlansFilters, UpdatePlanInput } from './plan.types.js';

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Maps a raw `billing_plans` row plus its associated `billing_prices` rows
 * to the public `BillingPlanResponse` DTO.
 *
 * - `slug` ← `billing_plans.name`
 * - `name` ← `metadata.displayName`
 * - `category` ← `metadata.category`
 * - `monthlyPriceArs` ← monthly `billing_prices.unitAmount`
 * - `annualPriceArs` ← annual `billing_prices.unitAmount` (null if absent)
 * - `isActive` ← `active`
 *
 * @param planRow - Raw DB row from `billing_plans`
 * @param prices - Associated `billing_prices` rows for this plan
 * @returns Mapped `BillingPlanResponse` DTO
 */
export function mapDbToPlan(
    planRow: QZPayBillingPlan,
    prices: readonly QZPayBillingPrice[]
): BillingPlanResponse {
    const metadata = (planRow.metadata ?? {}) as Record<string, unknown>;

    const monthlyPrice = prices.find((p) => p.billingInterval === 'month' && p.active);
    const annualPrice = prices.find((p) => p.billingInterval === 'year' && p.active);

    return {
        id: planRow.id,
        slug: planRow.name,
        name: typeof metadata.displayName === 'string' ? metadata.displayName : planRow.name,
        description: planRow.description ?? '',
        category: (metadata.category as BillingPlanResponse['category']) ?? 'owner',
        monthlyPriceArs: monthlyPrice?.unitAmount ?? 0,
        annualPriceArs: annualPrice?.unitAmount ?? null,
        monthlyPriceUsdRef:
            typeof metadata.monthlyPriceUsdRef === 'number' ? metadata.monthlyPriceUsdRef : 0,
        hasTrial: typeof metadata.hasTrial === 'boolean' ? metadata.hasTrial : false,
        trialDays: typeof metadata.trialDays === 'number' ? metadata.trialDays : 0,
        isDefault: typeof metadata.isDefault === 'boolean' ? metadata.isDefault : false,
        sortOrder: typeof metadata.sortOrder === 'number' ? metadata.sortOrder : 0,
        entitlements: Array.isArray(planRow.entitlements) ? (planRow.entitlements as string[]) : [],
        limits: (planRow.limits as Record<string, number>) ?? {},
        isActive: planRow.active ?? false,
        createdAt: planRow.createdAt.toISOString(),
        updatedAt: planRow.updatedAt?.toISOString() ?? planRow.createdAt.toISOString()
    };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Lists billing plans with optional filters and pagination.
 *
 * By default excludes soft-deleted plans (`deletedAt IS NOT NULL`); pass
 * `includeDeleted: true` to include them. Orders by `metadata->>'sortOrder'`
 * ascending (cast to integer), then by `name` ascending as a secondary sort
 * for stability.
 *
 * Each returned item is an {@link AdminBillingPlanResponse}: the base plan DTO
 * plus `isDeleted` and `activeSubscriptionCount`. The subscription count is the
 * number of subscriptions referencing the plan whose status is `active` or
 * `trialing` and that are not soft-deleted, resolved with a SINGLE grouped
 * query over all listed plan ids.
 *
 * @param filters - Filter and pagination options
 * @param ctx - Optional query context carrying a transaction client
 * @returns Paginated admin plan list or error
 *
 * @example
 * ```ts
 * const result = await listPlans({ category: 'owner', active: true, page: 1, pageSize: 20 });
 * if (result.success) {
 *   console.log(result.data.items, result.data.pagination);
 * }
 * ```
 */
export async function listPlans(filters: ListPlansFilters = {}, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();
        const { page = 1, pageSize = 20, category, active, search, includeDeleted } = filters;

        const conditions = [];

        // Exclude soft-deleted plans unless the caller explicitly opts in.
        if (!includeDeleted) {
            conditions.push(isNull(billingPlans.deletedAt));
        }

        if (category !== undefined) {
            conditions.push(sql`${billingPlans.metadata}->>'category' = ${category}`);
        }

        if (active !== undefined) {
            conditions.push(eq(billingPlans.active, active));
        }

        if (search) {
            const safeSearch = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
            conditions.push(
                sql`(
                    ${billingPlans.name} ILIKE ${safeSearch}
                    OR
                    ${billingPlans.metadata}->>'displayName' ILIKE ${safeSearch}
                )`
            );
        }

        const whereClause = and(...conditions);

        const countResult = await db
            .select({ value: count() })
            .from(billingPlans)
            .where(whereClause);

        const total = countResult[0]?.value ?? 0;

        const planRows = await db
            .select()
            .from(billingPlans)
            .where(whereClause)
            .orderBy(
                asc(sql`(${billingPlans.metadata}->>'sortOrder')::int`),
                asc(billingPlans.name)
            )
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        if (planRows.length === 0) {
            return {
                success: true as const,
                data: {
                    items: [] as AdminBillingPlanResponse[],
                    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
                }
            };
        }

        const planIds = planRows.map((p) => p.id);

        // Fetch all prices for these plans in one query
        const priceRows = await db
            .select()
            .from(billingPrices)
            .where(
                and(
                    sql`${billingPrices.planId} = ANY(ARRAY[${sql.join(
                        planIds.map((id) => sql`${id}`),
                        sql`, `
                    )}]::uuid[])`,
                    eq(billingPrices.active, true)
                )
            );

        // Group prices by planId
        const pricesByPlanId = new Map<string, QZPayBillingPrice[]>();
        for (const price of priceRows) {
            const existing = pricesByPlanId.get(price.planId) ?? [];
            existing.push(price);
            pricesByPlanId.set(price.planId, existing);
        }

        // Count live subscribers (status active/trialing, not soft-deleted) for
        // all listed plans in a SINGLE grouped query, mirroring the prices fetch
        // above. The plan UUID is stored as a varchar in billing_subscriptions.
        const subscriptionCountRows = await db
            .select({
                planId: billingSubscriptions.planId,
                value: count()
            })
            .from(billingSubscriptions)
            .where(
                and(
                    sql`${billingSubscriptions.planId} = ANY(ARRAY[${sql.join(
                        planIds.map((id) => sql`${id}`),
                        sql`, `
                    )}]::text[])`,
                    sql`${billingSubscriptions.status} IN ('active', 'trialing')`,
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .groupBy(billingSubscriptions.planId);

        const subCountByPlanId = new Map<string, number>();
        for (const sub of subscriptionCountRows) {
            subCountByPlanId.set(sub.planId, sub.value);
        }

        const items: AdminBillingPlanResponse[] = planRows.map((row) => {
            const base = mapDbToPlan(row, pricesByPlanId.get(row.id) ?? []);
            return {
                ...base,
                isDeleted: row.deletedAt != null,
                activeSubscriptionCount: subCountByPlanId.get(row.id) ?? 0
            };
        });

        return {
            success: true as const,
            data: {
                items,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
            }
        };
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to list plans' }
        };
    }
}

/**
 * Gets a single billing plan by its UUID.
 *
 * Returns a typed NOT_FOUND error for plans that do not exist or are
 * soft-deleted (deletedAt IS NOT NULL).
 *
 * @param id - UUID of the billing plan
 * @param ctx - Optional query context carrying a transaction client
 * @returns Plan response or NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getPlanById('550e8400-e29b-41d4-a716-446655440000');
 * if (result.success) {
 *   console.log(result.data.slug);
 * }
 * ```
 */
export async function getPlanById(id: string, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();

        const [planRow] = await db
            .select()
            .from(billingPlans)
            .where(and(eq(billingPlans.id, id), isNull(billingPlans.deletedAt)))
            .limit(1);

        if (!planRow) {
            return {
                success: false as const,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
            };
        }

        const priceRows = await db
            .select()
            .from(billingPrices)
            .where(and(eq(billingPrices.planId, id), eq(billingPrices.active, true)));

        return { success: true as const, data: mapDbToPlan(planRow, priceRows) };
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to retrieve plan' }
        };
    }
}

/**
 * Gets a plan by ID without soft-delete filtering (for internal use only).
 * Used by update/toggle/delete operations to fetch the current state.
 */
async function getPlanByIdInternal(
    id: string,
    db: DrizzleClient
): Promise<QZPayBillingPlan | undefined> {
    const [row] = await db.select().from(billingPlans).where(eq(billingPlans.id, id)).limit(1);
    return row;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Creates a new billing plan with associated pricing rows.
 *
 * - Inserts a `billing_plans` row (`name` = slug, metadata contains display fields)
 * - Always inserts a monthly `billing_prices` row
 * - Inserts an annual `billing_prices` row only when `annualPriceArs > 0`
 * - Rejects duplicate slugs with ALREADY_EXISTS
 * - Wraps insert + prices + audit in a single transaction
 *
 * @param input - Plan creation data
 * @param options - Optional settings
 * @param options.livemode - Whether to create in live mode (default: false)
 * @param options.actorId - Optional actor performing the mutation (for audit)
 * @param ctx - Optional query context carrying a transaction client
 * @returns Created plan response or error
 *
 * @example
 * ```ts
 * const result = await createPlan({
 *   slug: 'owner-basico',
 *   name: 'Básico',
 *   description: 'Plan básico para anfitriones',
 *   category: 'owner',
 *   monthlyPriceArs: 500000,
 *   annualPriceArs: 5000000,
 *   monthlyPriceUsdRef: 5,
 *   hasTrial: true,
 *   trialDays: 14,
 *   isDefault: true,
 *   sortOrder: 1,
 *   entitlements: ['CAN_LIST_ACCOMMODATION'],
 *   limits: { MAX_ACCOMMODATIONS: 1 },
 *   isActive: true,
 * });
 * ```
 */
export async function createPlan(
    input: CreatePlanInput,
    options: { readonly livemode?: boolean; readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const livemode = options.livemode ?? false;
        const actorId = options.actorId ?? null;

        const doCreate = async (db: DrizzleClient) => {
            // Check for duplicate slug (billing_plans.name is the slug)
            const [existing] = await db
                .select({ id: billingPlans.id })
                .from(billingPlans)
                .where(eq(billingPlans.name, input.slug))
                .limit(1);

            if (existing) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: `Plan with slug "${input.slug}" already exists`
                    }
                };
            }

            const metadata = {
                slug: input.slug,
                displayName: input.name,
                category: input.category,
                isDefault: input.isDefault,
                sortOrder: input.sortOrder,
                trialDays: input.trialDays,
                hasTrial: input.hasTrial,
                monthlyPriceArs: input.monthlyPriceArs,
                annualPriceArs: input.annualPriceArs,
                monthlyPriceUsdRef: input.monthlyPriceUsdRef
            };

            const [inserted] = await db
                .insert(billingPlans)
                .values({
                    name: input.slug,
                    description: input.description,
                    active: input.isActive,
                    entitlements: input.entitlements as string[],
                    limits: input.limits,
                    livemode,
                    metadata
                })
                .returning();

            if (!inserted) {
                throw new Error('Plan insert returned no row');
            }

            // Monthly price — always created
            await db.insert(billingPrices).values({
                planId: inserted.id,
                currency: 'ARS',
                unitAmount: input.monthlyPriceArs,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                livemode,
                ...(input.hasTrial && input.trialDays > 0 ? { trialDays: input.trialDays } : {})
            });

            // Annual price — only when declared
            if (input.annualPriceArs !== null && input.annualPriceArs > 0) {
                await db.insert(billingPrices).values({
                    planId: inserted.id,
                    currency: 'ARS',
                    unitAmount: input.annualPriceArs,
                    billingInterval: 'year',
                    intervalCount: 1,
                    active: true,
                    livemode
                });
            }

            await insertPlanAuditLog(db, {
                action: 'plan_created',
                planId: inserted.id,
                actorId,
                changes: metadata,
                previousValues: null,
                livemode
            });

            const priceRows = await db
                .select()
                .from(billingPrices)
                .where(and(eq(billingPrices.planId, inserted.id), eq(billingPrices.active, true)));

            return { success: true as const, data: mapDbToPlan(inserted, priceRows) };
        };

        return ctx?.tx ? await doCreate(ctx.tx) : await withTransaction(doCreate);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to create plan' }
        };
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Updates a billing plan's mutable fields.
 *
 * - Slug (`name`) is immutable: any input with `slug` should be rejected by
 *   the API layer (UpdateBillingPlanSchema is strict and omits it), but this
 *   function also guards against it.
 * - Reconciles `billing_prices`: updates monthly, creates/updates/deactivates annual.
 * - Emits a field-level diff audit log.
 * - Wraps everything in a single transaction.
 *
 * @param id - UUID of the plan to update
 * @param input - Fields to update (partial)
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Updated plan response or error
 */
export async function updatePlan(
    id: string,
    input: UpdatePlanInput & { readonly slug?: never },
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doUpdate = async (db: DrizzleClient) => {
            const existingPlan = await getPlanByIdInternal(id, db);
            if (!existingPlan) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
                };
            }

            const existingMeta = (existingPlan.metadata ?? {}) as Record<string, unknown>;

            // Build updated metadata (merge)
            const updatedMeta: Record<string, unknown> = {
                ...existingMeta
            };
            if (input.name !== undefined) updatedMeta.displayName = input.name;
            if (input.category !== undefined) updatedMeta.category = input.category;
            if (input.isDefault !== undefined) updatedMeta.isDefault = input.isDefault;
            if (input.sortOrder !== undefined) updatedMeta.sortOrder = input.sortOrder;
            if (input.trialDays !== undefined) updatedMeta.trialDays = input.trialDays;
            if (input.hasTrial !== undefined) updatedMeta.hasTrial = input.hasTrial;
            if (input.monthlyPriceArs !== undefined)
                updatedMeta.monthlyPriceArs = input.monthlyPriceArs;
            if (input.annualPriceArs !== undefined)
                updatedMeta.annualPriceArs = input.annualPriceArs;
            if (input.monthlyPriceUsdRef !== undefined)
                updatedMeta.monthlyPriceUsdRef = input.monthlyPriceUsdRef;

            const planUpdateData: Partial<QZPayBillingPlan> = {
                metadata: updatedMeta
            };
            if (input.description !== undefined) planUpdateData.description = input.description;
            if (input.entitlements !== undefined)
                planUpdateData.entitlements = input.entitlements as string[];
            if (input.limits !== undefined) planUpdateData.limits = input.limits;
            if (input.isActive !== undefined) planUpdateData.active = input.isActive;

            const [updatedPlan] = await db
                .update(billingPlans)
                .set(planUpdateData)
                .where(eq(billingPlans.id, id))
                .returning();

            if (!updatedPlan) {
                throw new Error('Plan update returned no row');
            }

            // Reconcile billing_prices
            if (input.monthlyPriceArs !== undefined) {
                const [monthlyPrice] = await db
                    .select()
                    .from(billingPrices)
                    .where(
                        and(
                            eq(billingPrices.planId, id),
                            eq(billingPrices.billingInterval, 'month'),
                            eq(billingPrices.active, true)
                        )
                    )
                    .limit(1);

                if (monthlyPrice) {
                    await db
                        .update(billingPrices)
                        .set({ unitAmount: input.monthlyPriceArs })
                        .where(eq(billingPrices.id, monthlyPrice.id));
                } else {
                    await db.insert(billingPrices).values({
                        planId: id,
                        currency: 'ARS',
                        unitAmount: input.monthlyPriceArs,
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        livemode: existingPlan.livemode ?? false
                    });
                }
            }

            if (input.annualPriceArs !== undefined) {
                const [annualPrice] = await db
                    .select()
                    .from(billingPrices)
                    .where(
                        and(
                            eq(billingPrices.planId, id),
                            eq(billingPrices.billingInterval, 'year'),
                            eq(billingPrices.active, true)
                        )
                    )
                    .limit(1);

                if (input.annualPriceArs === null || input.annualPriceArs === 0) {
                    // Deactivate annual price if it exists
                    if (annualPrice) {
                        await db
                            .update(billingPrices)
                            .set({ active: false })
                            .where(eq(billingPrices.id, annualPrice.id));
                    }
                } else if (annualPrice) {
                    await db
                        .update(billingPrices)
                        .set({ unitAmount: input.annualPriceArs })
                        .where(eq(billingPrices.id, annualPrice.id));
                } else {
                    await db.insert(billingPrices).values({
                        planId: id,
                        currency: 'ARS',
                        unitAmount: input.annualPriceArs,
                        billingInterval: 'year',
                        intervalCount: 1,
                        active: true,
                        livemode: existingPlan.livemode ?? false
                    });
                }
            }

            // Compute before/after diff for audit
            const beforeSnapshot: Record<string, unknown> = {
                description: existingPlan.description,
                active: existingPlan.active,
                entitlements: existingPlan.entitlements,
                limits: existingPlan.limits,
                metadata: existingMeta
            };
            const afterSnapshot: Record<string, unknown> = {
                description: updatedPlan.description,
                active: updatedPlan.active,
                entitlements: updatedPlan.entitlements,
                limits: updatedPlan.limits,
                metadata: updatedMeta
            };
            const diff = diffPlanFields(beforeSnapshot, afterSnapshot);

            await insertPlanAuditLog(db, {
                action: 'plan_updated',
                planId: id,
                actorId,
                // TYPE-WORKAROUND: `diff.changed` is `Record<string, DiffChangedField>` but
                // `insertPlanAuditLog` accepts `Record<string, unknown>`; TypeScript won't
                // implicitly widen a generic Record value type even though it is safe here.
                changes: diff.changed as unknown as Record<string, unknown>,
                previousValues: beforeSnapshot,
                livemode: existingPlan.livemode ?? false
            });

            const priceRows = await db
                .select()
                .from(billingPrices)
                .where(and(eq(billingPrices.planId, id), eq(billingPrices.active, true)));

            return { success: true as const, data: mapDbToPlan(updatedPlan, priceRows) };
        };

        return ctx?.tx ? await doUpdate(ctx.tx) : await withTransaction(doUpdate);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to update plan' }
        };
    }
}

// ---------------------------------------------------------------------------
// Toggle active / Soft-delete
// ---------------------------------------------------------------------------

/**
 * Toggles the `active` flag of a billing plan.
 *
 * Both `togglePlanActive(id, true)` and `togglePlanActive(id, false)` are
 * valid; the latter effectively "soft-deactivates" but keeps the row visible
 * to `getPlanById`.
 *
 * @param id - UUID of the plan
 * @param active - The desired active state
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Updated plan or NOT_FOUND error
 */
export async function togglePlanActive(
    id: string,
    active: boolean,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doToggle = async (db: DrizzleClient) => {
            const existingPlan = await getPlanByIdInternal(id, db);
            if (!existingPlan) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
                };
            }

            const [updated] = await db
                .update(billingPlans)
                .set({ active })
                .where(eq(billingPlans.id, id))
                .returning();

            if (!updated) {
                throw new Error('Plan toggle returned no row');
            }

            await insertPlanAuditLog(db, {
                action: active ? 'plan_activated' : 'plan_deactivated',
                planId: id,
                actorId,
                changes: { active },
                previousValues: { active: existingPlan.active },
                livemode: existingPlan.livemode ?? false
            });

            const priceRows = await db
                .select()
                .from(billingPrices)
                .where(and(eq(billingPrices.planId, id), eq(billingPrices.active, true)));

            return { success: true as const, data: mapDbToPlan(updated, priceRows) };
        };

        return ctx?.tx ? await doToggle(ctx.tx) : await withTransaction(doToggle);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to toggle plan active state'
            }
        };
    }
}

/**
 * Soft-deletes a billing plan by setting `deletedAt = now()` and `active = false`.
 *
 * The row is retained for referential integrity. `getPlanById` will return
 * NOT_FOUND for soft-deleted plans; use `getPlanByIdInternal` to fetch them.
 *
 * @param id - UUID of the plan to soft-delete
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Success or NOT_FOUND error
 */
export async function softDeletePlan(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doDelete = async (db: DrizzleClient) => {
            const existingPlan = await getPlanByIdInternal(id, db);
            if (!existingPlan) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
                };
            }

            await db
                .update(billingPlans)
                .set({ active: false, deletedAt: new Date() })
                .where(eq(billingPlans.id, id));

            await insertPlanAuditLog(db, {
                action: 'plan_soft_deleted',
                planId: id,
                actorId,
                changes: { active: false, deletedAt: new Date().toISOString() },
                previousValues: { active: existingPlan.active, deletedAt: null },
                livemode: existingPlan.livemode ?? false
            });

            return { success: true as const, data: undefined };
        };

        return ctx?.tx ? await doDelete(ctx.tx) : await withTransaction(doDelete);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to soft-delete plan' }
        };
    }
}

// ---------------------------------------------------------------------------
// Restore (undo soft-delete)
// ---------------------------------------------------------------------------

/**
 * Restores a soft-deleted billing plan by clearing `deletedAt` and setting `active = true`.
 *
 * Semantics:
 * - If the plan does not exist at all → NOT_FOUND error.
 * - If the plan is NOT soft-deleted (`deletedAt == null`) → VALIDATION_ERROR (invalid state).
 * - If soft-deleted → sets `deletedAt = null` and `active = true`, emits audit log,
 *   returns the restored plan.
 *
 * Uses `getPlanByIdInternal` (no soft-delete filter) so soft-deleted plans are found.
 * Wraps the mutation in a transaction and emits an audit log entry with action
 * `plan_restored`, recording `{ active: true, deletedAt: null }` as changes and the
 * previous `{ active, deletedAt }` as previous values.
 *
 * @param id - UUID of the plan to restore
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Restored plan response or error (NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR)
 *
 * @example
 * ```ts
 * const result = await restorePlan('550e8400-e29b-41d4-a716-446655440000', { actorId: 'admin-uuid' });
 * if (result.success) {
 *   console.log(result.data.isActive); // true
 * }
 * ```
 */
export async function restorePlan(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doRestore = async (db: DrizzleClient) => {
            // getPlanByIdInternal has no soft-delete filter — finds deleted rows too.
            const existingPlan = await getPlanByIdInternal(id, db);
            if (!existingPlan) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
                };
            }

            if (existingPlan.deletedAt == null) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Plan is not soft-deleted and cannot be restored'
                    }
                };
            }

            const [updated] = await db
                .update(billingPlans)
                .set({ active: true, deletedAt: null })
                .where(eq(billingPlans.id, id))
                .returning();

            if (!updated) {
                throw new Error('Plan restore returned no row');
            }

            await insertPlanAuditLog(db, {
                action: 'plan_restored',
                planId: id,
                actorId,
                changes: { active: true, deletedAt: null },
                previousValues: {
                    active: existingPlan.active,
                    deletedAt: existingPlan.deletedAt?.toISOString() ?? null
                },
                livemode: existingPlan.livemode ?? false
            });

            const priceRows = await db
                .select()
                .from(billingPrices)
                .where(and(eq(billingPrices.planId, id), eq(billingPrices.active, true)));

            return { success: true as const, data: mapDbToPlan(updated, priceRows) };
        };

        return ctx?.tx ? await doRestore(ctx.tx) : await withTransaction(doRestore);
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to restore plan' }
        };
    }
}

// ---------------------------------------------------------------------------
// Hard-delete (with referential guard)
// ---------------------------------------------------------------------------

/**
 * Permanently deletes a billing plan and its associated prices.
 *
 * **Referential guard**: before deleting, counts `billing_subscriptions`
 * rows where `plan_id = uuid`. If any subscriptions reference the plan,
 * rejects with ALREADY_EXISTS (treated as a conflict).
 *
 * Emits an audit log entry before deletion so the history is preserved in
 * `billing_audit_logs`.
 *
 * @param id - UUID of the plan to hard-delete
 * @param options - Optional settings
 * @param options.actorId - Optional actor for audit log
 * @param ctx - Optional query context carrying a transaction client
 * @returns Success or error (NOT_FOUND | ALREADY_EXISTS | INTERNAL_ERROR)
 */
export async function hardDeletePlan(
    id: string,
    options: { readonly actorId?: string } = {},
    ctx?: QueryContext
) {
    try {
        const actorId = options.actorId ?? null;

        const doHardDelete = async (db: DrizzleClient) => {
            const existingPlan = await getPlanByIdInternal(id, db);
            if (!existingPlan) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Plan not found' }
                };
            }

            // Referential guard: count subscriptions that reference this plan UUID
            const [subCount] = await db
                .select({ value: count() })
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.planId, id));

            const activeSubCount = subCount?.value ?? 0;
            if (activeSubCount > 0) {
                return {
                    success: false as const,
                    error: {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: `Plan is referenced by ${activeSubCount} subscription(s) and cannot be hard-deleted`
                    }
                };
            }

            // Emit audit BEFORE deletion so the log survives
            await insertPlanAuditLog(db, {
                action: 'plan_hard_deleted',
                planId: id,
                actorId,
                changes: null,
                previousValues: {
                    name: existingPlan.name,
                    active: existingPlan.active,
                    deletedAt: existingPlan.deletedAt?.toISOString() ?? null
                },
                livemode: existingPlan.livemode ?? false
            });

            // Delete associated prices first (FK constraint)
            await db.delete(billingPrices).where(eq(billingPrices.planId, id));

            // Delete the plan row
            await db.delete(billingPlans).where(eq(billingPlans.id, id));

            return { success: true as const, data: undefined };
        };

        return ctx?.tx ? await doHardDelete(ctx.tx) : await withTransaction(doHardDelete);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to hard-delete plan'
            }
        };
    }
}
