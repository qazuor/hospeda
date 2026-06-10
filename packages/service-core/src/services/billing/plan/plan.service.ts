/**
 * Plan Service
 *
 * Thin facade over the plan CRUD module. Provides a class-based API for
 * billing plan management operations.
 *
 * Access control (permission checks) is enforced at the API route layer
 * (T-008+), not here. This service receives `actorId` for audit log purposes.
 *
 * Side effect (SPEC-168 T-017): every successful plan write triggers a
 * best-effort cache revalidation of the public pricing pages via the
 * RevalidationService singleton. Revalidation failures are logged and
 * swallowed — they never block the write operation.
 *
 * @module services/billing/plan/plan.service
 */

import type { QueryContext } from '@repo/db';
import { createLogger } from '@repo/logger';
import { getLocalizedPath } from '../../../revalidation/entity-path-mapper.js';
import { getRevalidationService } from '../../../revalidation/revalidation-init.js';
import {
    createPlan,
    getPlanById,
    getPlanBySlug,
    hardDeletePlan,
    listPlans,
    restorePlan,
    softDeletePlan,
    togglePlanActive,
    updatePlan
} from './plan.crud.js';
import type { CreatePlanInput, ListPlansFilters, UpdatePlanInput } from './plan.types.js';

/** Locales supported by the web app — must stay in sync with entity-path-mapper SUPPORTED_LOCALES */
const PRICING_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Returns the full set of public pricing page paths that must be revalidated
 * whenever a billing plan changes. Covers both owner and tourist pricing pages
 * for every supported locale.
 *
 * @returns Readonly array of locale-prefixed pricing page paths
 *
 * @example
 * ```ts
 * getPricingPaths()
 * // ['/suscriptores/planes/', '/suscriptores/turistas/',
 * //  '/en/suscriptores/planes/', '/en/suscriptores/turistas/',
 * //  '/pt/suscriptores/planes/', '/pt/suscriptores/turistas/']
 * ```
 */
function getPricingPaths(): readonly string[] {
    const paths: string[] = [];
    for (const locale of PRICING_LOCALES) {
        paths.push(getLocalizedPath('/suscriptores/planes/', locale));
        paths.push(getLocalizedPath('/suscriptores/turistas/', locale));
    }
    return paths;
}

/**
 * Plan Service
 *
 * Manages billing plan lifecycle: create, read, update, toggle, soft-delete,
 * hard-delete. All write operations accept an optional `actorId` for audit log
 * attribution and an optional `livemode` flag.
 *
 * Every successful write (create, update, toggleActive, softDelete, hardDelete)
 * triggers a best-effort cache revalidation of the public pricing pages via the
 * RevalidationService singleton (SPEC-168 T-017, decision D3). Revalidation
 * failures are logged and swallowed — they never block the write operation.
 *
 * @example
 * ```ts
 * const planService = new PlanService();
 * const result = await planService.getById('some-uuid');
 * if (result.success) {
 *   console.log(result.data.slug);
 * }
 * ```
 */
export class PlanService {
    private readonly logger = createLogger('plan-service');

    /**
     * Triggers a best-effort revalidation of all public pricing pages.
     *
     * Called after every successful plan write. Uses the global RevalidationService
     * singleton; if it has not been initialized (e.g. in a test harness), this is a
     * silent no-op. Revalidation failures are logged and swallowed — they never block
     * the write operation.
     *
     * @param reason - Human-readable reason for the revalidation log entry
     */
    private triggerPricingRevalidation(reason: string): void {
        try {
            const svc = getRevalidationService();
            if (!svc) {
                this.logger.warn(
                    'Plan write: RevalidationService not initialized — pricing revalidation skipped'
                );
                return;
            }
            // Fire-and-forget — must not block the write response.
            void svc
                .revalidatePaths({
                    paths: getPricingPaths(),
                    triggeredBy: 'system',
                    trigger: 'hook',
                    entityType: 'plan',
                    reason
                })
                .catch((error: unknown) => {
                    this.logger.warn(
                        { error },
                        `Plan write: pricing revalidation failed (best-effort, non-blocking): ${error instanceof Error ? error.message : String(error)}`
                    );
                });
        } catch (error) {
            this.logger.warn(
                { error },
                'Plan write: pricing revalidation scheduling failed (best-effort, non-blocking)'
            );
        }
    }

    /**
     * Lists billing plans with optional filtering and pagination.
     *
     * @param filters - Filter and pagination options
     * @param ctx - Optional query context carrying a transaction client
     * @returns Paginated plan list or error
     */
    async list(filters: ListPlansFilters = {}, ctx?: QueryContext) {
        return listPlans(filters, ctx);
    }

    /**
     * Gets a single billing plan by UUID.
     *
     * Soft-deleted plans return NOT_FOUND.
     *
     * @param id - UUID of the billing plan
     * @param ctx - Optional query context carrying a transaction client
     * @returns Plan response or NOT_FOUND error
     */
    async getById(id: string, ctx?: QueryContext) {
        return getPlanById(id, ctx);
    }

    /**
     * Gets a single billing plan by its slug (stored as `billing_plans.name`).
     *
     * Soft-deleted plans return NOT_FOUND. This is the primary lookup used
     * when resolving a plan from a subscription's `plan_id` field or from
     * the `owner-basico` entitlement fallback (SPEC-192 FR-4).
     *
     * Alias: this method also serves as `getByName` since the DB column
     * `billing_plans.name` is the slug per SPEC-168 convention.
     *
     * @param slug - Plan slug (e.g. `'owner-basico'`)
     * @param ctx - Optional query context carrying a transaction client
     * @returns Plan response or NOT_FOUND error
     *
     * @example
     * ```ts
     * const result = await planService.getBySlug('owner-basico');
     * if (result.success) {
     *   console.log(result.data.entitlements); // string[]
     * }
     * ```
     */
    async getBySlug(slug: string, ctx?: QueryContext) {
        return getPlanBySlug(slug, ctx);
    }

    /**
     * Creates a new billing plan with associated pricing rows.
     *
     * On success, triggers a best-effort cache revalidation of the public pricing pages
     * so that newly-created plans are immediately visible to site visitors.
     *
     * @param input - Plan creation data
     * @param options - Optional settings
     * @param options.livemode - Whether to create in live mode (default: false)
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Created plan or error
     */
    async create(
        input: CreatePlanInput,
        options: { readonly livemode?: boolean; readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        const result = await createPlan(input, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan created: ${input.slug}`);
        }
        return result;
    }

    /**
     * Updates mutable fields of a billing plan.
     *
     * Slug is immutable and cannot be changed via this method.
     * On success, triggers a best-effort cache revalidation of the public pricing pages.
     *
     * @param id - UUID of the plan to update
     * @param input - Fields to update (all optional)
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Updated plan or error
     */
    async update(
        id: string,
        input: UpdatePlanInput,
        options: { readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        const result = await updatePlan(id, input, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan updated: ${id}`);
        }
        return result;
    }

    /**
     * Toggles the `active` flag of a billing plan.
     *
     * On success, triggers a best-effort cache revalidation of the public pricing pages
     * so that toggled plans (shown/hidden) immediately reflect on the site.
     *
     * @param id - UUID of the plan
     * @param active - Desired active state
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Updated plan or error
     */
    async toggleActive(
        id: string,
        active: boolean,
        options: { readonly actorId?: string } = {},
        ctx?: QueryContext
    ) {
        const result = await togglePlanActive(id, active, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan ${active ? 'activated' : 'deactivated'}: ${id}`);
        }
        return result;
    }

    /**
     * Soft-deletes a billing plan (sets `deletedAt = now()`, `active = false`).
     *
     * The row is retained; `getById` will return NOT_FOUND for it.
     * On success, triggers a best-effort cache revalidation of the public pricing pages.
     *
     * @param id - UUID of the plan to soft-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error
     */
    async softDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        const result = await softDeletePlan(id, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan soft-deleted: ${id}`);
        }
        return result;
    }

    /**
     * Restores a soft-deleted billing plan by clearing `deletedAt` and setting `active = true`.
     *
     * Returns VALIDATION_ERROR if the plan is not currently soft-deleted.
     * On success, triggers a best-effort cache revalidation of the public pricing pages
     * so that the restored plan immediately reappears on the site.
     *
     * @param id - UUID of the plan to restore
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Restored plan or error (NOT_FOUND | VALIDATION_ERROR | INTERNAL_ERROR)
     */
    async restore(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        const result = await restorePlan(id, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan restored: ${id}`);
        }
        return result;
    }

    /**
     * Permanently deletes a billing plan.
     *
     * Blocked if any `billing_subscriptions` row references this plan's UUID.
     * Deletes associated `billing_prices` rows before removing the plan.
     * On success, triggers a best-effort cache revalidation of the public pricing pages.
     *
     * @param id - UUID of the plan to hard-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error (ALREADY_EXISTS if referenced by subscriptions)
     */
    async hardDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        const result = await hardDeletePlan(id, options, ctx);
        if (result.success) {
            this.triggerPricingRevalidation(`plan hard-deleted: ${id}`);
        }
        return result;
    }
}
