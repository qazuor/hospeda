/**
 * Commerce plan slug resolver (HOS-166 D-7 → HOS-688 §6.8).
 *
 * **The single place in the codebase where a commerce vertical becomes a plan
 * slug.** `scripts/check-commerce-plan-resolution.sh` fails CI on any other
 * module that reads the configuration or hardcodes a commerce plan slug
 * (AC-35), because a second resolution site is how the two verticals end up
 * quietly billed against the same MercadoPago preapproval plan.
 *
 * HOS-166 wrote this module *for this moment*: it already took `entityType` and
 * ignored it, and its docblock said the day a second commerce plan existed the
 * branch would happen here and nowhere else. That day is HOS-688.
 *
 * ## The mapping comes from the environment, and is validated at BOOT
 *
 * `HOSPEDA_COMMERCE_PLAN_SLUGS` carries the whole mapping in ONE value
 * (`gastronomy:<slug>,experience:<slug>`). One variable rather than two, because
 * two can be half-set — one vertical sells and the other 503s while the site
 * looks perfectly fine, which is the failure mode hardest to notice.
 *
 * The value is parsed and rejected at startup by `env.ts`'s `.superRefine`, so
 * an unset or malformed mapping stops the container instead of refusing a
 * customer mid-checkout. Outside production an unset value falls back to the
 * shipped catalogue ({@link DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL}) so local
 * dev and the test suites boot without extra configuration; a value that is SET
 * but malformed is rejected in every environment.
 *
 * @module services/commerce-plan-resolver
 */

import { DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL } from '@repo/billing';
import type { CommercePlanSlugMap, CommercePlanVertical } from '../utils/commerce-plan-config';
import { parseCommercePlanSlugMap } from '../utils/commerce-plan-config';
import { env } from '../utils/env';

/** Input to {@link resolveCommercePlanSlug}. */
export interface ResolveCommercePlanSlugInput {
    /**
     * Which commerce vertical the checkout is for. Each vertical is a DISTINCT
     * MercadoPago preapproval plan, which is what lets an owner who spent their
     * free trial on gastronomy still receive one when they later add an
     * experience — MP scopes the trial to `(payer, preapproval_plan)`.
     *
     * Typed as the plain string union rather than `CommerceEntityTypeEnum` so
     * BOTH shapes reach it: a route that parsed the vertical out of a `z.enum`
     * holds the union, a service holding the enum passes it unchanged (a string
     * enum member is assignable to its own literal type; the reverse is not).
     */
    readonly entityType: CommercePlanVertical;
}

/**
 * Thrown by {@link resolveCommercePlanSlug} when the configuration is unusable.
 *
 * In a booted container this is unreachable: the same value is validated by
 * `env.ts` at startup, so a bad mapping stops the container. It survives as the
 * floor beneath that guarantee, and callers still map it to a 503 so the
 * failure is never a 500.
 */
export class CommercePlanNotConfiguredError extends Error {
    constructor(reason: string) {
        super(`Commerce subscriptions are not configured (HOSPEDA_COMMERCE_PLAN_SLUGS: ${reason})`);
        this.name = 'CommercePlanNotConfiguredError';
    }
}

/**
 * Resolves the effective vertical → plan-slug mapping.
 *
 * @returns The configured mapping, or the shipped catalogue defaults when the
 *   variable is unset (see the module doc for why that is safe).
 * @throws {CommercePlanNotConfiguredError} When the variable is SET but cannot
 *   be parsed. A present-but-wrong value is never silently replaced by the
 *   defaults — that would hide exactly the operator mistake this validates for.
 */
function resolveCommercePlanSlugMap(): CommercePlanSlugMap {
    const raw = env.HOSPEDA_COMMERCE_PLAN_SLUGS;

    if (raw === undefined || raw.trim() === '') {
        return DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL;
    }

    const parsed = parseCommercePlanSlugMap(raw);
    if (!parsed.ok) {
        throw new CommercePlanNotConfiguredError(parsed.error);
    }
    return parsed.map;
}

/**
 * Resolves the plan slug a commerce checkout should subscribe against.
 *
 * @param input - {@link ResolveCommercePlanSlugInput}
 * @returns The plan slug for that vertical.
 * @throws {CommercePlanNotConfiguredError} When the configured mapping is
 *   malformed. Callers respond 503.
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
export function resolveCommercePlanSlug(input: ResolveCommercePlanSlugInput): string {
    const map = resolveCommercePlanSlugMap();
    // The `Record<vertical, slug>` lookup §6.8 sanctions and AC-7 explicitly
    // permits: one code path reading a different value, not a behavioural
    // branch by domain.
    return map[input.entityType];
}
