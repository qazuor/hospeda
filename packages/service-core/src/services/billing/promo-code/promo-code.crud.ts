/**
 * Promo Code CRUD Module
 *
 * Handles database CRUD operations for promo codes:
 * - Create, read, update, soft-delete, and list promo codes
 * - Maps database records to the PromoCode response format
 *
 * @module services/billing/promo-code/promo-code.crud
 */

import {
    type DrizzleClient,
    type QZPayBillingPromoCode,
    type QueryContext,
    and,
    billingAuditLogs,
    billingPromoCodes,
    count,
    desc,
    eq,
    getDb,
    getTableColumns,
    isNull,
    lte,
    or,
    safeIlike,
    sql,
    withTransaction
} from '@repo/db';
import {
    type PromoEffect,
    PromoEffectKindEnum,
    ServiceErrorCode,
    ValueKindEnum
} from '@repo/schemas';
import type {
    CreatePromoCodeInput,
    ListPromoCodesFilters,
    PromoCode,
    UpdatePromoCodeInput
} from './promo-code.service.js';

// ---------------------------------------------------------------------------
// Extended DB row type for SPEC-262 extras-carril columns
//
// The columns `effect_kind`, `value_kind`, `duration_cycles`, `extra_days`
// were added via extras/018 (ADD COLUMN IF NOT EXISTS). They are NOT in the
// QZPay Drizzle TS schema (external package). We extend the row type locally
// so we can safely read them after a Drizzle `.select()` — Drizzle passes
// the raw Postgres row through and the values are present at runtime even
// though the TypeScript type does not declare them.
// ---------------------------------------------------------------------------

/**
 * Row type extended with SPEC-262 effect columns (extras carril, 018).
 *
 * Cast from `QZPayBillingPromoCode` where the extras columns are expected.
 *
 * @internal Not part of the public module API.
 */
interface ExtendedPromoCodeRow extends QZPayBillingPromoCode {
    /** Discriminator: 'discount' | 'trial_extension' | 'comp' */
    effect_kind?: string | null;
    /** Sub-discriminator for discount: 'percentage' | 'fixed' */
    value_kind?: string | null;
    /** Number of billing cycles the discount applies. null = forever. */
    duration_cycles?: number | null;
    /** Extra trial days for trial_extension effects */
    extra_days?: number | null;
}

/**
 * Drizzle projection that augments the QZPay `billingPromoCodes` columns with the
 * SPEC-262 extras-carril columns (`effect_kind`, `value_kind`, `duration_cycles`,
 * `extra_days`).
 *
 * These columns exist in Postgres (added by `extras/018`) but are NOT declared in
 * the QZPay Drizzle schema, so a bare `db.select()` omits them and the typed
 * `PromoEffect` is lost — every read falls back to the legacy `type`/`value` path.
 * Selecting them explicitly keeps {@link parseEffectFromRow} able to reconstruct
 * the effect. Single-table query, so the raw column names are unambiguous.
 */
const promoCodeColumnsWithEffect = () => ({
    ...getTableColumns(billingPromoCodes),
    effect_kind: sql<string | null>`effect_kind`,
    value_kind: sql<string | null>`value_kind`,
    duration_cycles: sql<number | null>`duration_cycles`,
    extra_days: sql<number | null>`extra_days`
});

/**
 * Parse the SPEC-262 extras-carril columns from a DB row into a `PromoEffect`.
 *
 * Returns `undefined` when the `effect_kind` column is absent or still at the
 * legacy default ('discount' without a `value_kind`) — this preserves backward
 * compat for rows that have not been backfilled yet.
 *
 * @param row - Raw DB row (possibly with extras columns)
 * @returns Typed `PromoEffect` or `undefined`
 *
 * @internal
 */
function parseEffectFromRow(row: ExtendedPromoCodeRow): PromoEffect | undefined {
    const kind = row.effect_kind ?? 'discount';

    if (kind === PromoEffectKindEnum.COMP) {
        return { kind: PromoEffectKindEnum.COMP };
    }

    if (kind === PromoEffectKindEnum.TRIAL_EXTENSION) {
        const extraDays = row.extra_days;
        if (typeof extraDays === 'number' && extraDays > 0) {
            return { kind: PromoEffectKindEnum.TRIAL_EXTENSION, extraDays };
        }
        // Row backfill not yet applied — skip returning an effect
        return undefined;
    }

    // discount branch — only return a typed effect when value_kind is set
    // (i.e. the row has been created or backfilled with the new columns).
    const valueKind = row.value_kind;
    if (valueKind === ValueKindEnum.PERCENTAGE || valueKind === ValueKindEnum.FIXED) {
        return {
            kind: PromoEffectKindEnum.DISCOUNT,
            valueKind,
            value: row.value ?? 0,
            durationCycles: row.duration_cycles ?? 1
        };
    }

    // No value_kind — legacy row without backfill. Return undefined so callers
    // fall back to the legacy `type` + `value` fields.
    return undefined;
}

/**
 * Map a database promo code row to the PromoCode response shape.
 *
 * SPEC-262 (T-005): also reads the SPEC-262 extras-carril columns
 * (`effect_kind`, `value_kind`, `duration_cycles`, `extra_days`) to populate
 * the optional `effect` discriminated union on the DTO. The `type` / `value`
 * legacy fields are preserved unchanged for backward compat (AC-4.3).
 *
 * Legacy rows (no extras columns or `value_kind` not yet backfilled) get
 * `effect = undefined`, so existing callers are unaffected.
 *
 * @param dbPromoCode - Raw database row from billingPromoCodes
 * @returns Mapped PromoCode DTO
 */
export function mapDbToPromoCode(dbPromoCode: QZPayBillingPromoCode): PromoCode {
    // Cast to the extended type to access SPEC-262 extras-carril columns.
    // These columns are present in the Postgres row at runtime (added by extras/018)
    // even though they are not declared in the QZPay Drizzle TS schema.
    const row = dbPromoCode as ExtendedPromoCodeRow;

    const effect = parseEffectFromRow(row);

    // Resolve legacy `type` field for backward compat (AC-4.3).
    // For new SPEC-262 codes we map effect_kind → type so the response
    // shape is consistent whether the code was created before or after T-005.
    const effectKind = row.effect_kind ?? 'discount';
    const legacyType = ((): PromoCode['type'] => {
        if (effectKind === PromoEffectKindEnum.COMP) return 'comp';
        if (effectKind === PromoEffectKindEnum.TRIAL_EXTENSION) return 'trial_extension';
        // discount branch: use the stored `type` column if available, else derive
        // from value_kind; fall back to the DB `type` column for legacy rows.
        const vk = row.value_kind;
        if (vk === ValueKindEnum.PERCENTAGE) return 'percentage';
        if (vk === ValueKindEnum.FIXED) return 'fixed';
        // Fully legacy row — trust the DB `type` column as-is.
        return (row.type ?? 'percentage') as PromoCode['type'];
    })();

    return {
        id: dbPromoCode.id,
        code: dbPromoCode.code,
        type: legacyType,
        value: dbPromoCode.value,
        active: dbPromoCode.active ?? false,
        expiresAt: dbPromoCode.expiresAt?.toISOString(),
        validFrom: dbPromoCode.startsAt?.toISOString(),
        maxUses: dbPromoCode.maxUses ?? undefined,
        maxUsesPerUser: dbPromoCode.maxUsesPerUser ?? undefined,
        timesRedeemed: dbPromoCode.usedCount ?? 0,
        metadata: (dbPromoCode.config as Record<string, unknown>) ?? undefined,
        validPlans: dbPromoCode.validPlans ?? undefined,
        newCustomersOnly: dbPromoCode.newCustomersOnly ?? false,
        isStackable: dbPromoCode.combinable ?? false,
        createdAt: dbPromoCode.createdAt.toISOString(),
        updatedAt: dbPromoCode.createdAt.toISOString(), // QZPay schema doesn't have updatedAt
        // SPEC-262: populate only when effect columns are present and well-formed
        ...(effect !== undefined ? { effect } : {})
    };
}

/**
 * Create a new promo code in the database.
 *
 * Uppercases the code, builds a config object from optional description and
 * minAmount fields, and inserts the record.
 *
 * @param input - Promo code creation data
 * @param options - Optional settings
 * @param options.livemode - Whether to create in live mode (default: false)
 * @param options.tx - Optional Drizzle transaction client (legacy; prefer ctx)
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` takes precedence over `options.tx` so callers can
 *   enlist this operation in a larger atomic transaction.
 * @returns Created PromoCode or error
 *
 * @example
 * ```ts
 * // New-style with typed effect (SPEC-262):
 * const result = await createPromoCode({
 *   code: 'SAVE10',
 *   effect: { kind: 'discount', valueKind: 'percentage', value: 10, durationCycles: 1 },
 * });
 *
 * // Legacy style (seed/startup path — still supported):
 * const result = await createPromoCode({
 *   code: 'SAVE10',
 *   discountType: 'percentage',
 *   discountValue: 10,
 * });
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   await createPromoCode({ code: 'TX10', effect: { kind: 'discount', valueKind: 'fixed', value: 500, durationCycles: 1 } }, {}, ctx);
 * });
 * ```
 */
export async function createPromoCode(
    input: CreatePromoCodeInput,
    options: {
        readonly livemode?: boolean;
        readonly tx?: DrizzleClient;
        readonly actorId?: string;
    } = {},
    ctx?: QueryContext
) {
    try {
        const code = input.code.toUpperCase();

        const config: Record<string, unknown> = {};
        if (input.description) {
            config.description = input.description;
        }
        if (input.minAmount) {
            config.minAmount = input.minAmount;
        }

        const livemode = options.livemode ?? false;
        const actorId = options.actorId ?? null;

        // ---------------------------------------------------------------------------
        // Resolve effect → legacy type/value for the QZPay INSERT columns
        //
        // The QZPay Drizzle schema's `billing_promo_codes` INSERT shape still
        // requires `type` (varchar) and `value` (integer). When `input.effect` is
        // supplied (SPEC-262 path) we derive these legacy columns from it.
        // When only `discountType`/`discountValue` are present (legacy seed path)
        // we use those directly.
        // ---------------------------------------------------------------------------
        const resolvedLegacyType: string = (() => {
            if (input.effect) {
                if (input.effect.kind === PromoEffectKindEnum.COMP) return 'comp';
                if (input.effect.kind === PromoEffectKindEnum.TRIAL_EXTENSION)
                    return 'trial_extension';
                // discount branch
                return input.effect.valueKind ?? 'percentage';
            }
            return input.discountType ?? 'percentage';
        })();

        const resolvedLegacyValue: number = (() => {
            if (input.effect) {
                if (input.effect.kind === PromoEffectKindEnum.DISCOUNT)
                    return input.effect.value ?? 0;
                return 0; // comp / trial_extension have no monetary value
            }
            return input.discountValue ?? 0;
        })();

        const doCreate = async (db: DrizzleClient) => {
            const result = await db
                .insert(billingPromoCodes)
                .values({
                    code,
                    type: resolvedLegacyType,
                    value: resolvedLegacyValue,
                    config: Object.keys(config).length > 0 ? config : null,
                    maxUses: input.maxUses ?? null,
                    // max_uses_per_user is NOT NULL (default 1); omit when unset
                    maxUsesPerUser: input.maxUsesPerUser,
                    usedCount: 0,
                    validPlans: input.planRestrictions ?? null,
                    newCustomersOnly: input.firstPurchaseOnly ?? false,
                    combinable: input.isStackable ?? false,
                    active: input.isActive ?? true,
                    startsAt: input.validFrom ?? null,
                    expiresAt: input.expiryDate ?? null,
                    livemode
                })
                .returning();

            const promoCode = result[0];

            if (!promoCode) {
                throw new Error('Failed to create promo code');
            }

            // -----------------------------------------------------------------
            // Persist SPEC-262 effect columns via raw SQL.
            //
            // These columns (`effect_kind`, `value_kind`, `duration_cycles`,
            // `extra_days`) are added via extras/018 (ADD COLUMN IF NOT EXISTS)
            // and are NOT in the QZPay Drizzle table schema, so we cannot set
            // them in the VALUES clause above. We use a raw UPDATE immediately
            // after the INSERT — same pattern as product_domain in
            // subscription-checkout.service.ts. Both the INSERT and this UPDATE
            // are inside the same `doCreate` transaction block, so they are
            // atomic.
            // -----------------------------------------------------------------
            if (input.effect) {
                await persistEffectColumns(db, promoCode.id, input.effect);
            }

            await db.insert(billingAuditLogs).values({
                action: 'promo_code_created',
                entityType: 'promo_code',
                entityId: promoCode.id,
                actorId,
                actorType: actorId ? 'admin' : 'system',
                changes: {
                    code,
                    effect: input.effect ?? null,
                    // legacy fields preserved for audit log completeness
                    discountType: input.discountType ?? null,
                    discountValue: input.discountValue ?? null
                } as unknown,
                previousValues: null,
                livemode,
                ipAddress: null,
                userAgent: null
            });

            return promoCode;
        };

        // Enlist in caller's transaction if available; otherwise open a new one
        // to keep the promo code INSERT and the audit log INSERT atomic.
        const promoCode = ctx?.tx
            ? await doCreate(ctx.tx)
            : await withTransaction(doCreate, options.tx);

        // Re-fetch to get the effect columns we just wrote via raw SQL.
        // The INSERT .returning() does not include columns set by subsequent
        // UPDATE, so we need a fresh SELECT to build the full DTO.
        if (input.effect) {
            const db = ctx?.tx ?? getDb();
            const [refreshed] = await db
                .select(promoCodeColumnsWithEffect())
                .from(billingPromoCodes)
                .where(eq(billingPromoCodes.id, promoCode.id))
                .limit(1);
            if (refreshed) {
                return { success: true as const, data: mapDbToPromoCode(refreshed) };
            }
        }

        return { success: true as const, data: mapDbToPromoCode(promoCode) };
    } catch (_error) {
        return {
            success: false as const,
            error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'Failed to create promo code' }
        };
    }
}

// ---------------------------------------------------------------------------
// Effect-column persistence helper (SPEC-262)
// ---------------------------------------------------------------------------

/**
 * Persist SPEC-262 effect columns for a promo code via raw SQL.
 *
 * Called immediately after the QZPay INSERT in `createPromoCode` to set the
 * extras-carril columns (`effect_kind`, `value_kind`, `duration_cycles`,
 * `extra_days`) that are not part of the QZPay Drizzle table schema.
 *
 * Must run within the same transaction as the parent INSERT so both are
 * atomic (the caller's `doCreate` block wraps both in `withTransaction`).
 *
 * @param db - Drizzle client (already inside a transaction)
 * @param promoCodeId - ID of the newly created promo code row
 * @param effect - Typed effect to persist
 *
 * @internal
 */
async function persistEffectColumns(
    db: DrizzleClient,
    promoCodeId: string,
    effect: PromoEffect
): Promise<void> {
    if (effect.kind === PromoEffectKindEnum.COMP) {
        await db.execute(
            sql`UPDATE billing_promo_codes
                SET effect_kind = 'comp',
                    value_kind  = NULL,
                    duration_cycles = NULL,
                    extra_days  = NULL
                WHERE id = ${promoCodeId}`
        );
        return;
    }

    if (effect.kind === PromoEffectKindEnum.TRIAL_EXTENSION) {
        await db.execute(
            sql`UPDATE billing_promo_codes
                SET effect_kind = 'trial_extension',
                    value_kind  = NULL,
                    duration_cycles = NULL,
                    extra_days  = ${effect.extraDays}
                WHERE id = ${promoCodeId}`
        );
        return;
    }

    // discount
    await db.execute(
        sql`UPDATE billing_promo_codes
            SET effect_kind     = 'discount',
                value_kind      = ${effect.valueKind},
                duration_cycles = ${effect.durationCycles},
                extra_days      = NULL
            WHERE id = ${promoCodeId}`
    );
}

/**
 * Get a promo code by its code string.
 *
 * Normalizes the code to uppercase before querying.
 *
 * @param code - Promo code string (case-insensitive)
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` is used so the query participates in the caller's
 *   transaction. Omit for standalone queries.
 * @returns PromoCode or NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getPromoCodeByCode('save10');
 * if (result.success) {
 *   console.log(result.data.id);
 * }
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   const result = await getPromoCodeByCode('save10', ctx);
 * });
 * ```
 */
export async function getPromoCodeByCode(code: string, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();
        const normalizedCode = code.toUpperCase();

        const [dbPromoCode] = await db
            .select(promoCodeColumnsWithEffect())
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.code, normalizedCode))
            .limit(1);

        if (dbPromoCode) {
            return { success: true, data: mapDbToPromoCode(dbPromoCode) };
        }

        return {
            success: false,
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
        };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to retrieve promo code'
            }
        };
    }
}

/**
 * Get a promo code by its database ID.
 *
 * @param id - UUID of the promo code record
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` is used so the query participates in the caller's
 *   transaction. Omit for standalone queries.
 * @returns PromoCode or NOT_FOUND error
 *
 * @example
 * ```ts
 * const result = await getPromoCodeById('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   const result = await getPromoCodeById('550e8400-e29b-41d4-a716-446655440000', ctx);
 * });
 * ```
 */
export async function getPromoCodeById(id: string, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();

        const [promoCode] = await db
            .select(promoCodeColumnsWithEffect())
            .from(billingPromoCodes)
            .where(eq(billingPromoCodes.id, id))
            .limit(1);

        if (!promoCode) {
            return {
                success: false,
                error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
            };
        }

        return { success: true, data: mapDbToPromoCode(promoCode) };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to retrieve promo code'
            }
        };
    }
}

/**
 * Update a promo code's mutable fields.
 *
 * Only updates fields that are explicitly provided. The description is merged
 * into the existing config JSON object.
 *
 * @param id - Promo code ID
 * @param input - Fields to update (all optional)
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` is used so the operation participates in the caller's
 *   transaction. Omit for standalone operations.
 * @returns Updated PromoCode or error
 *
 * @example
 * ```ts
 * const result = await updatePromoCode('abc', { isActive: false });
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   await updatePromoCode('abc', { isActive: false }, ctx);
 * });
 * ```
 */
export async function updatePromoCode(
    id: string,
    input: UpdatePromoCodeInput & { readonly actorId?: string },
    ctx?: QueryContext
) {
    try {
        const actorId = input.actorId ?? null;

        const doUpdate = async (db: DrizzleClient) => {
            const updateData: Partial<QZPayBillingPromoCode> = {};
            let previousValues: Partial<QZPayBillingPromoCode> | null = null;

            if (input.description !== undefined) {
                const [existing] = await db
                    .select()
                    .from(billingPromoCodes)
                    .where(eq(billingPromoCodes.id, id))
                    .limit(1);

                if (!existing) {
                    return {
                        success: false as const,
                        error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
                    };
                }

                previousValues = existing;
                const config = (existing.config as Record<string, unknown>) ?? {};
                config.description = input.description;
                updateData.config = config;
            }

            if (input.expiryDate !== undefined) {
                updateData.expiresAt = input.expiryDate;
            }

            if (input.maxUses !== undefined) {
                updateData.maxUses = input.maxUses;
            }

            if (input.isActive !== undefined) {
                updateData.active = input.isActive;
            }

            const [updatedPromoCode] = await db
                .update(billingPromoCodes)
                .set(updateData)
                .where(eq(billingPromoCodes.id, id))
                .returning();

            if (!updatedPromoCode) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
                };
            }

            await db.insert(billingAuditLogs).values({
                action: 'promo_code_updated',
                entityType: 'promo_code',
                entityId: id,
                actorId,
                actorType: actorId ? 'admin' : 'system',
                changes: updateData as unknown,
                previousValues: previousValues as unknown,
                livemode: updatedPromoCode.livemode ?? false,
                ipAddress: null,
                userAgent: null
            });

            return { success: true as const, data: mapDbToPromoCode(updatedPromoCode) };
        };

        return ctx?.tx ? await doUpdate(ctx.tx) : await withTransaction(doUpdate);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to update promo code'
            }
        };
    }
}

/**
 * Soft-delete a promo code by setting active = false.
 *
 * @param id - Promo code ID
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` is used so the operation participates in the caller's
 *   transaction. Omit for standalone operations.
 * @returns Success or NOT_FOUND error
 *
 * @example
 * ```ts
 * await deletePromoCode('550e8400-e29b-41d4-a716-446655440000');
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   await deletePromoCode('550e8400-e29b-41d4-a716-446655440000', ctx);
 * });
 * ```
 */
export async function deletePromoCode(id: string, ctx?: QueryContext, actorId?: string) {
    try {
        const resolvedActorId = actorId ?? null;

        const doDelete = async (db: DrizzleClient) => {
            const [deletedPromoCode] = await db
                .update(billingPromoCodes)
                .set({ active: false })
                .where(eq(billingPromoCodes.id, id))
                .returning();

            if (!deletedPromoCode) {
                return {
                    success: false as const,
                    error: { code: ServiceErrorCode.NOT_FOUND, message: 'Promo code not found' }
                };
            }

            await db.insert(billingAuditLogs).values({
                action: 'promo_code_deleted',
                entityType: 'promo_code',
                entityId: id,
                actorId: resolvedActorId,
                actorType: resolvedActorId ? 'admin' : 'system',
                changes: { active: false } as unknown,
                previousValues: { active: true } as unknown,
                livemode: deletedPromoCode.livemode ?? false,
                ipAddress: null,
                userAgent: null
            });

            return { success: true as const, data: undefined };
        };

        return ctx?.tx ? await doDelete(ctx.tx) : await withTransaction(doDelete);
    } catch (_error) {
        return {
            success: false as const,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to delete promo code'
            }
        };
    }
}

/**
 * List promo codes with optional filters and pagination.
 *
 * Supports filtering by active status, expiry status, and code substring search.
 * Results are ordered by createdAt descending.
 *
 * @param filters - Filter and pagination options
 * @param ctx - Optional query context carrying a transaction client. When
 *   provided, `ctx.tx` is used so the query participates in the caller's
 *   transaction. Omit for standalone queries.
 * @returns Paginated list of promo codes with total count
 *
 * @example
 * ```ts
 * const result = await listPromoCodes({ active: true, page: 1, pageSize: 20 });
 * if (result.success) {
 *   console.log(result.data.items, result.data.pagination);
 * }
 *
 * // Inside a transaction:
 * await withServiceTransaction(async (ctx) => {
 *   const result = await listPromoCodes({ active: true }, ctx);
 * });
 * ```
 */
export async function listPromoCodes(filters: ListPromoCodesFilters = {}, ctx?: QueryContext) {
    try {
        const db = ctx?.tx ?? getDb();
        const { page = 1, pageSize = 20, active, expired, codeSearch } = filters;

        const conditions = [];

        if (active !== undefined) {
            conditions.push(eq(billingPromoCodes.active, active));
        }

        if (expired !== undefined) {
            if (expired) {
                conditions.push(lte(billingPromoCodes.expiresAt, new Date()));
            } else {
                conditions.push(
                    or(
                        isNull(billingPromoCodes.expiresAt),
                        sql`${billingPromoCodes.expiresAt} > NOW()`
                    )
                );
            }
        }

        if (codeSearch) {
            conditions.push(safeIlike(billingPromoCodes.code, codeSearch));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const countResult = await db
            .select({ value: count() })
            .from(billingPromoCodes)
            .where(whereClause);

        const total = countResult[0]?.value ?? 0;

        const items = await db
            .select(promoCodeColumnsWithEffect())
            .from(billingPromoCodes)
            .where(whereClause)
            .orderBy(desc(billingPromoCodes.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const mappedItems = items.map((item) => mapDbToPromoCode(item));

        return {
            success: true,
            data: {
                items: mappedItems,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            }
        };
    } catch (_error) {
        return {
            success: false,
            error: {
                code: ServiceErrorCode.INTERNAL_ERROR,
                message: 'Failed to list promo codes'
            }
        };
    }
}
