/**
 * Plan Service
 *
 * Thin facade over the plan CRUD module. Provides a class-based API for
 * billing plan management operations.
 *
 * Access control (permission checks) is enforced at the API route layer
 * (T-008+), not here. This service receives `actorId` for audit log purposes.
 *
 * @module services/billing/plan/plan.service
 */

import type { QueryContext } from '@repo/db';
import {
    createPlan,
    getPlanById,
    hardDeletePlan,
    listPlans,
    softDeletePlan,
    togglePlanActive,
    updatePlan
} from './plan.crud.js';
import type { CreatePlanInput, ListPlansFilters, UpdatePlanInput } from './plan.types.js';

/**
 * Plan Service
 *
 * Manages billing plan lifecycle: create, read, update, toggle, soft-delete,
 * hard-delete. All write operations accept an optional `actorId` for audit log
 * attribution and an optional `livemode` flag.
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
     * Creates a new billing plan with associated pricing rows.
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
        return createPlan(input, options, ctx);
    }

    /**
     * Updates mutable fields of a billing plan.
     *
     * Slug is immutable and cannot be changed via this method.
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
        return updatePlan(id, input, options, ctx);
    }

    /**
     * Toggles the `active` flag of a billing plan.
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
        return togglePlanActive(id, active, options, ctx);
    }

    /**
     * Soft-deletes a billing plan (sets `deletedAt = now()`, `active = false`).
     *
     * The row is retained; `getById` will return NOT_FOUND for it.
     *
     * @param id - UUID of the plan to soft-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error
     */
    async softDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        return softDeletePlan(id, options, ctx);
    }

    /**
     * Permanently deletes a billing plan.
     *
     * Blocked if any `billing_subscriptions` row references this plan's UUID.
     * Deletes associated `billing_prices` rows before removing the plan.
     *
     * @param id - UUID of the plan to hard-delete
     * @param options - Optional settings
     * @param options.actorId - Optional actor for audit log
     * @param ctx - Optional query context carrying a transaction client
     * @returns Success or error (ALREADY_EXISTS if referenced by subscriptions)
     */
    async hardDelete(id: string, options: { readonly actorId?: string } = {}, ctx?: QueryContext) {
        return hardDeletePlan(id, options, ctx);
    }
}
