/**
 * @file protected-plan-by-id.ts
 * @description Custom override for the SINGLE-PLAN reads at the protected
 * billing tier — `GET /plans/:id` and `GET /plans/:id/prices` (HOS-1186).
 *
 * WHY THIS EXISTS
 * ---------------
 * HOS-1062 F1 introduced `billing_plans.metadata.publicListing` and filtered the
 * two endpoints that ENUMERATE plans (`GET /api/v1/public/plans` and the
 * `GET /plans` override next door). The single-plan reads were left falling
 * through to qzpay-hono's prebuilt handlers, which answer the whole storage row
 * — `metadata` and `prices[]` included — to ANY authenticated caller. The
 * negotiated amount travels in that ONE response: the Drizzle adapter attaches
 * prices inside `plans.findById`, so `/plans/:id/prices` is a second door to the
 * same number rather than a necessary second step. Both are shadowed here.
 *
 * WHY NOT ONE OF THE THREE GUARDS ALREADY IN THE PATH
 * --------------------------------------------------
 * - `billingAdminGuardMiddleware` gates METHODS by permission and lets every GET
 *   through. It cannot tell a listed plan from an unlisted one without doing the
 *   read this handler does, and it answers 403 — which for a row the caller may
 *   not see would confirm the id exists (`apps/api/docs/error-contract.md`).
 * - `billingOwnershipMiddleware` compares a row's `customerId` against the
 *   caller's billing customer. A plan has no owning customer; `publicListing` is
 *   catalogue visibility, not ownership. There is nothing for it to compare.
 * - `createCollectionListingBlocker` answers a flat 404 with no predicate. Used
 *   here it would withhold the ENTIRE catalogue by id, published plans included
 *   — a different defect, not this one.
 *
 * So the verdict belongs where the row is read, and it is the SAME verdict the
 * listing uses: {@link isServablePlan}, imported rather than restated, so the
 * two doors cannot drift on what they withhold.
 *
 * WHY THE ANSWER IS ACTOR-BLIND
 * -----------------------------
 * A withheld plan answers 404 for every caller, admin included, and answers it
 * with the body a MISSING plan gets — one helper, so the two cannot diverge. A
 * response that varied by actor would still confirm the id exists to whoever
 * could read the difference, which is the same leak one step smaller. This
 * matches `collection-listing-block.ts`, which holds the same invariant at this
 * tier for the same reason.
 *
 * Nothing is taken from the admin: `GET /api/v1/admin/billing/plans/:id`
 * (`routes/billing/admin/plans.ts`, `BILLING_READ_ALL`) serves every plan
 * unfiltered and is the door the admin panel actually calls — measured, it is
 * the only `plans/:id` URL either app builds (`apps/admin/src/features/billing-plans/hooks.ts`,
 * `apps/admin/src/lib/billing-http-adapter/index.ts`). No consumer in `apps/web`
 * or `apps/admin` reads the protected tier's single-plan route at all.
 *
 * Mounted BEFORE the qzpay wrapper (see `routes/billing/index.ts`): Hono
 * resolves by first match, the same ordering rule the `GET /plans`,
 * promo-codes, downgrade-preview and soft-cancel overrides rely on.
 *
 * ONE THING TO KNOW BEFORE ADDING A `/plans/<word>` ROUTE
 * ------------------------------------------------------
 * `GET /:id` matches any single segment, so a future literal route —
 * `GET /plans/featured`, say — registered AFTER this router would never be
 * reached: this handler would look up a plan with the id `"featured"`, find
 * none, and answer 404. Register such a route BEFORE this one, exactly as
 * `downgrade-preview` is registered ahead of qzpay's `GET /subscriptions/:id`
 * for the same reason.
 *
 * @module routes/billing/protected-plan-by-id
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { getQZPayBilling } from '../../middlewares/billing';
import { billingAuthMiddleware } from '../../middlewares/billing-auth.middleware';
import { createRouter } from '../../utils/create-app';
import { isServablePlan } from './protected-plans-list';

/**
 * The shape this module needs off a storage plan: enough to ask the shared
 * predicate, and nothing more. Declared structurally so the handler does not
 * depend on qzpay's plan type.
 */
interface StoragePlanShape {
    readonly metadata?: Record<string, unknown>;
}

/**
 * `billing_plans.id` is a Postgres `uuid` column and `findById` compares against
 * it with no cast, so a malformed id is not a miss — it is a **driver error**
 * (`invalid input syntax for type uuid`) raised below this handler.
 *
 * That is H-68, named in `apps/api/docs/error-contract.md`: the request nobody
 * has to craft is `/plans/undefined`, built by a client from an empty variable.
 * Reaching the database with it answers `500 INTERNAL_ERROR` with a stack and a
 * Sentry event, where the contract's step 3 says **400 `VALIDATION_ERROR`** — and
 * a 4xx is never `INTERNAL_ERROR`. The prebuilt qzpay handler happened to answer
 * 422 because its catch-all matches the driver's message text against `/invalid/i`;
 * that is an accident of wording, not a validation, and shadowing the route means
 * this module owns the answer now.
 *
 * Validated BEFORE the billing-availability check so the 4xx ladder stays in
 * contract order (shape at step 3, existence at step 4) whatever the subsystem
 * is doing.
 */
const PlanIdSchema = z.string().uuid();

/**
 * Answers the plan this tier may serve, or `null` when it may not.
 *
 * ONE function, called by both handlers, for the same reason `servablePlans`
 * exists next door: the single-plan read and its prices sub-route cannot drift
 * on what they withhold. The verdict itself is delegated to
 * {@link isServablePlan} — restating it here would create a second comparison
 * free to drift from the shared one.
 *
 * A plan that is absent and a plan that is withheld both answer `null`, which is
 * what makes the two indistinguishable at the wire.
 *
 * @param input - RO-RO input carrying the raw storage plan (or its absence)
 * @returns The servable plan, or `null`
 *
 * @example
 * ```typescript
 * resolveServablePlan({ plan: { metadata: {} } });                             // { plan }
 * resolveServablePlan({ plan: { metadata: { publicListing: 'unlisted' } } });  // { plan: null }
 * resolveServablePlan({ plan: null });                                         // { plan: null }
 * ```
 */
export function resolveServablePlan<T extends StoragePlanShape>(input: {
    readonly plan: T | null | undefined;
}): { readonly plan: T | null } {
    const { plan } = input;

    if (!plan) {
        return { plan: null };
    }

    return { plan: isServablePlan(plan) ? plan : null };
}

/**
 * The 404 both handlers answer, for a plan that does not exist AND for one this
 * tier withholds.
 *
 * Written once on purpose: two call sites spelling their own body is how a
 * withheld plan ends up distinguishable from a missing one.
 *
 * @param c - Hono context
 * @returns A 404 response naming no reason the caller could tell apart
 */
function planNotFound(c: Context): Response {
    return c.json(
        {
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'Plan not found'
            }
        },
        404
    );
}

/**
 * The 400 both handlers answer for an id that is not a UUID.
 *
 * Written once, like {@link planNotFound}, and deliberately does NOT echo the
 * value back: the caller already knows what it sent, and a reflected path
 * segment is one more thing travelling into logs and error payloads.
 *
 * @param c - Hono context
 * @returns A 400 response carrying the contract's `VALIDATION_ERROR`
 */
function invalidPlanId(c: Context): Response {
    return c.json(
        {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Plan ID must be a valid UUID'
            }
        },
        400
    );
}

/**
 * The 503 answered when billing is not configured.
 *
 * Deliberately NOT a fall-through to the prebuilt route: a handler that cannot
 * ask the question must fail loudly rather than let the unfiltered one answer
 * it. Mirrors `handleProtectedPlansList`.
 *
 * @param c - Hono context
 * @returns A 503 response
 */
function billingUnavailable(c: Context): Response {
    return c.json(
        {
            success: false,
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Billing service is not available'
            }
        },
        503
    );
}

/**
 * Handler for `GET /plans/:id`.
 *
 * Reproduces qzpay-hono's envelope for the served case (`{ success, data }`) so
 * existing consumers of a published plan see no change.
 *
 * @param c - Hono context. Requires an authenticated actor —
 *   {@link billingAuthMiddleware} is applied on {@link protectedPlanByIdRouter}.
 * @returns The plan, or the shared 404
 */
export async function handleProtectedPlanById(c: Context): Promise<Response> {
    // Step 3 of the error contract, and it runs before anything touches the
    // database — see {@link PlanIdSchema}.
    const planId = PlanIdSchema.safeParse(c.req.param('id'));
    if (!planId.success) {
        return invalidPlanId(c);
    }

    const billing = getQZPayBilling();
    if (!billing) {
        return billingUnavailable(c);
    }

    const raw = await billing.plans.get(planId.data);
    const { plan: servablePlan } = resolveServablePlan({ plan: raw });

    if (!servablePlan) {
        return planNotFound(c);
    }

    return c.json({ success: true, data: servablePlan });
}

/**
 * Handler for `GET /plans/:id/prices`.
 *
 * The gate runs on the PLAN before any price is read, so a withheld plan costs
 * one lookup and yields nothing. Reading the prices first and filtering after
 * would leave the amount one logging statement away from the response.
 *
 * @param c - Hono context. Requires an authenticated actor.
 * @returns The plan's prices, or the shared 404
 */
export async function handleProtectedPlanPrices(c: Context): Promise<Response> {
    // Same order as the sibling handler, and for the same reason: this route
    // reaches the same `uuid` column, so it had the same 500 (H-68).
    const planId = PlanIdSchema.safeParse(c.req.param('id'));
    if (!planId.success) {
        return invalidPlanId(c);
    }

    const billing = getQZPayBilling();
    if (!billing) {
        return billingUnavailable(c);
    }

    const raw = await billing.plans.get(planId.data);
    const { plan: servablePlan } = resolveServablePlan({ plan: raw });

    if (!servablePlan) {
        return planNotFound(c);
    }

    const servablePrices = await billing.plans.getPrices(planId.data);
    return c.json({ success: true, data: servablePrices });
}

/**
 * Router exposing ONLY the two single-plan GETs (mounted at `/plans` by
 * `routes/billing/index.ts`), so every other `/plans*` method and sub-path still
 * falls through to the qzpay wrapper mounted after it.
 */
export const protectedPlanByIdRouter = createRouter();
protectedPlanByIdRouter.get('/:id', billingAuthMiddleware, handleProtectedPlanById);
protectedPlanByIdRouter.get('/:id/prices', billingAuthMiddleware, handleProtectedPlanPrices);
