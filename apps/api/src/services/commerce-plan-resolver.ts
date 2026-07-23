/**
 * Commerce plan slug resolver (HOS-166 D-7, §6.4).
 *
 * Commerce billing is binary today: one plan (`commerce-listing`,
 * `product_domain='commerce'`) covers both verticals — there is no plan
 * picker (NG-3). This module is the single, greppable, test-covered seam
 * that resolves that plan's slug, so no route/web/test literal-hardcodes it.
 *
 * Currently returns a constant for both verticals, read from
 * `env.HOSPEDA_COMMERCE_PLAN_ID` — exactly the same source and 503-on-unset
 * semantics as `apps/api/src/routes/commerce/admin/start-subscription.ts:163-173`
 * uses inline today. Extracting it here means the day pricing diverges by
 * vertical (a second commerce plan), the branch happens in ONE place instead
 * of being smeared across every checkout call site (§6.4 — "cheap insurance,
 * not speculation").
 *
 * @module services/commerce-plan-resolver
 */

import type { CommerceEntityType } from '@repo/service-core';
import { env } from '../utils/env';

/** Input to {@link resolveCommercePlanSlug}. */
export interface ResolveCommercePlanSlugInput {
    /**
     * Which commerce vertical the checkout is for. Currently unused — both
     * verticals resolve to the same env-configured slug — but kept in the
     * signature as the forward-compatible seam described in the module
     * docblock: the day a second commerce plan exists, this parameter is
     * where the branch goes.
     */
    readonly entityType: CommerceEntityType;
}

/**
 * Thrown by {@link resolveCommercePlanSlug} when `HOSPEDA_COMMERCE_PLAN_ID`
 * is unset. Callers map this to HTTP 503 — mirroring
 * `admin/start-subscription.ts:168-172`'s inline handling of the same
 * condition — via `instanceof` rather than duplicating the env check.
 */
export class CommercePlanNotConfiguredError extends Error {
    constructor() {
        super('Commerce subscriptions are not configured (HOSPEDA_COMMERCE_PLAN_ID unset)');
        this.name = 'CommercePlanNotConfiguredError';
    }
}

/**
 * Resolves the commerce-listing plan slug for a checkout.
 *
 * @param input - {@link ResolveCommercePlanSlugInput}
 * @returns The configured plan slug (`env.HOSPEDA_COMMERCE_PLAN_ID`).
 * @throws {CommercePlanNotConfiguredError} When the env var is unset. Callers
 *   should catch this and respond 503, exactly as the admin route does today.
 *
 * @example
 * ```ts
 * let planSlug: string;
 * try {
 *   planSlug = resolveCommercePlanSlug({ entityType: CommerceEntityTypeEnum.GASTRONOMY });
 * } catch (error) {
 *   if (error instanceof CommercePlanNotConfiguredError) {
 *     throw new HTTPException(503, { message: error.message });
 *   }
 *   throw error;
 * }
 * ```
 */
export function resolveCommercePlanSlug(_input: ResolveCommercePlanSlugInput): string {
    const planSlug = env.HOSPEDA_COMMERCE_PLAN_ID;
    if (!planSlug) {
        throw new CommercePlanNotConfiguredError();
    }
    return planSlug;
}
