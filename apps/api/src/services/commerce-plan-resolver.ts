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

import { DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL, findCommercePlanForVertical } from '@repo/billing';
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
    /**
     * The tier the buyer PICKED, when they picked one (HOS-1119).
     *
     * `undefined` — the pre-HOS-1119 shape, and still what every caller without
     * a picker passes — means "whatever this vertical resolves to by default":
     * exactly the previous behaviour, `HOSPEDA_COMMERCE_PLAN_SLUGS` override
     * included.
     *
     * A value is validated against {@link findCommercePlanForVertical} and
     * REFUSED when it names no tier of `entityType`. It is never trusted as a
     * slug. A request naming the OTHER vertical's plan is precisely how the two
     * verticals would come to share one MercadoPago `preapproval_plan` — the
     * thing HOS-688 AC-35 exists to prevent — and unlike a second resolution
     * site, an unvalidated request parameter is a hole a *customer* can drive
     * through rather than one a developer has to add.
     */
    readonly requestedPlanSlug?: string;
}

/**
 * Thrown by {@link resolveCommercePlanSlug} when the caller asked for a plan
 * that is not a tier of the vertical they are checking out (HOS-1119).
 *
 * Distinct from {@link CommercePlanNotConfiguredError}, which is an OPERATOR
 * mistake resolved as a 503. This one is a CALLER mistake — a bad request body,
 * or a tampered one — and routes answer it 400 per the error contract's
 * input-shape tier. It is deliberately not a 404: the plan may well exist, it
 * simply does not belong to this vertical, and saying so leaks nothing (the
 * commerce catalogue is public).
 */
export class CommercePlanNotForVerticalError extends Error {
    constructor(
        /** The slug the caller asked for. */
        public readonly requestedPlanSlug: string,
        /** The vertical it was asked for. */
        public readonly vertical: CommercePlanVertical
    ) {
        super(`Plan '${requestedPlanSlug}' is not a plan of the '${vertical}' vertical`);
        this.name = 'CommercePlanNotForVerticalError';
    }
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
 * ## HOS-1119 — the site now takes an argument, and is still ONE site
 *
 * Until HOS-1119 this function had exactly one answer per vertical, and AC-35's
 * guard existed to keep it that way. What HOS-1119 changes is NOT that: the
 * guard's invariant is "a commerce vertical is turned into a plan slug here and
 * nowhere else", and that is still literally true — every caller with a tier to
 * honour passes it IN rather than resolving one itself.
 *
 * What HOS-1119 removes is a different, accidental property that was never the
 * invariant: that the answer could not depend on anything but the vertical.
 * `gastronomy-pro` shipped active, priced and trial-carrying in HOS-895 and was
 * unbuyable purely because no caller had a way to ask for it.
 *
 * The MercadoPago property AC-35 actually protects — one vertical, one
 * `preapproval_plan` family, so a trial spent on gastronomy still leaves one for
 * experiences — survives because {@link findCommercePlanForVertical} refuses any
 * slug that is not a tier OF THIS VERTICAL. Cross-vertical is the failure the
 * guard describes, and it is now impossible by validation rather than by there
 * having been only one possible answer.
 *
 * @param input - {@link ResolveCommercePlanSlugInput}
 * @returns The plan slug for that vertical: the requested tier when one was
 *   asked for and belongs to the vertical, the configured default otherwise.
 * @throws {CommercePlanNotConfiguredError} When the configured mapping is
 *   malformed. Callers respond 503.
 * @throws {CommercePlanNotForVerticalError} When `requestedPlanSlug` names no
 *   tier of `entityType`. Callers respond 400.
 *
 * @example
 * ```ts
 * let planSlug: string;
 * try {
 *   planSlug = resolveCommercePlanSlug({
 *     entityType: CommerceEntityTypeEnum.GASTRONOMY,
 *     requestedPlanSlug: body.planSlug
 *   });
 * } catch (error) {
 *   if (error instanceof CommercePlanNotConfiguredError) {
 *     throw new HTTPException(503, { message: error.message });
 *   }
 *   if (error instanceof CommercePlanNotForVerticalError) {
 *     throw new HTTPException(400, { message: error.message });
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
    const defaultSlug = map[input.entityType];

    const requested = input.requestedPlanSlug?.trim();
    if (requested === undefined || requested === '') {
        // No pick — byte-identical to the pre-HOS-1119 behaviour, env override
        // and all. A blank string is treated as "no pick" rather than as an
        // invalid slug: it is what an untouched form field serialises to, and
        // 400-ing on it would break the default path for the caller that is
        // least deliberate about the field.
        return defaultSlug;
    }

    const plan = findCommercePlanForVertical({ vertical: input.entityType, slug: requested });
    if (!plan) {
        throw new CommercePlanNotForVerticalError(requested, input.entityType);
    }

    // `plan.slug`, not `requested`: identical strings today, but returning the
    // catalogue's own value means whatever reaches MercadoPago came from the
    // catalogue rather than from the request body.
    return plan.slug;
}
