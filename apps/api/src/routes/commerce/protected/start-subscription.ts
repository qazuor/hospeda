/**
 * Owner-scoped commerce checkout endpoint (HOS-166 §6.3, §7.1).
 *
 * ```
 * POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription
 * ```
 *
 * Creates the missing `apps/api/src/routes/commerce/protected/` tier's
 * checkout route. Mirrors `apps/api/src/routes/billing/start-paid.ts`
 * (`createCRUDRoute`, self-heal the billing customer, idempotency key,
 * `HOSPEDA_SITE_URL`-based return URL) — NOT the admin commerce route
 * (`apps/api/src/routes/commerce/admin/start-subscription.ts`), which uses
 * `createAdminRoute` + `COMMERCE_EDIT_ALL` and resolves the customer from the
 * TARGET listing's owner rather than the caller (spec §5.3).
 *
 * ## The ownership check (AC-2) — the entire security boundary
 *
 * `COMMERCE_EDIT_OWN` says "may edit *a* listing of their own" — it does not
 * identify *which*. The admin route never compares `actor.id` against the
 * listing's `ownerId` (correct for an admin — see §5.3), so simply relaxing
 * the permission to `COMMERCE_EDIT_OWN` on an admin-shaped route would let any
 * `COMMERCE_OWNER` pay for ANY listing. This route loads the raw listing via
 * the `@repo/db` model directly (not `GastronomyService.getById`, whose
 * public/protected view-tier gating would 404 a non-owner on a still-DRAFT
 * listing instead of the 403 AC-2 requires) and explicitly asserts
 * `actor.id === listing.ownerId` before doing anything else.
 *
 * ## Completeness gate (G-3, AC-5)
 *
 * `resolveListingCompleteness` — the SAME pure function the reconciler and
 * (eventually, PR-C) the web checklist use — runs before any MercadoPago
 * call. Incomplete → 422 with `missing`. This is intentionally a raw
 * `c.json(...)` response rather than a thrown `ServiceError`/`HTTPException`:
 * `handleRouteError` only surfaces `ServiceError.details` when
 * `HOSPEDA_API_DEBUG_ERRORS` is set, and that flag is off in prod — `missing`
 * must reach the client unconditionally (AC-5 has no debug-mode carve-out).
 *
 * @module routes/commerce/protected/start-subscription
 */
import { experienceModel, gastronomyModel } from '@repo/db';
import type { StartPaidSubscriptionResponse } from '@repo/schemas';
import { PermissionEnum, StartPaidSubscriptionResponseSchema } from '@repo/schemas';
import type { CommerceEntityType, CommerceListingCompletenessListing } from '@repo/service-core';
import {
    getCommerceListingSubscriptionStatus,
    resolveListingCompleteness
} from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { getQZPayBilling } from '../../../middlewares/billing';
import { idempotencyKeyMiddleware } from '../../../middlewares/idempotency-key';
import { mapSubscriptionCheckoutErrorToHttp } from '../../../services/billing/subscription-checkout-error-http';
import { BillingCustomerSyncService } from '../../../services/billing-customer-sync';
import {
    CommercePlanNotConfiguredError,
    resolveCommercePlanSlug
} from '../../../services/commerce-plan-resolver';
import {
    initiateCommerceMonthlySubscription,
    SubscriptionCheckoutError
} from '../../../services/subscription-checkout.service';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';
import {
    buildNotificationUrl,
    buildPaymentMethodReturnUrl,
    resolveReturnUrlLocale
} from '../../billing/checkout-return-urls';

/**
 * Supported commerce entity types. Mirrors the admin route's schema — the
 * enum is the single sanctioned set so an unknown entityType is rejected at
 * the schema boundary (400) rather than reaching the handler.
 */
const CommerceEntityTypeSchema = z.enum(['gastronomy', 'experience']);

/** Path params for the owner start-subscription endpoint. */
const StartSubscriptionParamsSchema = {
    entityType: CommerceEntityTypeSchema,
    entityId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
};

/**
 * Subset of the raw `gastronomies`/`experiences` row this route reads —
 * ownership (`ownerId`) + everything `resolveListingCompleteness` needs
 * ({@link CommerceListingCompletenessListing}). Read directly via the
 * `@repo/db` model (not through `GastronomyService.getById`'s view-tier
 * gating) so a non-owner gets a uniform 403 regardless of the listing's
 * current lifecycle/visibility (AC-2).
 */
interface RawCommerceListingRow extends CommerceListingCompletenessListing {
    readonly id: string;
}

/**
 * Loads the raw commerce entity row for the given `entityType`/`entityId`.
 *
 * @throws {HTTPException} 404 when the listing does not exist, or when
 *   `entityType` somehow reaches here unsupported (defensive — the schema
 *   enum already rejects unknown types with 400).
 */
async function loadRawListing(
    entityType: CommerceEntityType,
    entityId: string
): Promise<RawCommerceListingRow> {
    const model = entityType === 'gastronomy' ? gastronomyModel : experienceModel;
    const entity = await model.findById(entityId);
    if (!entity) {
        throw new HTTPException(404, {
            message: `Commerce listing not found: ${entityType}/${entityId}`
        });
    }
    // TYPE-WORKAROUND: model.findById returns the full Gastronomy/Experience
    // entity type; we only read the RawCommerceListingRow subset (id/ownerId) for
    // the ownership check. The two entity types share no nameable structural
    // supertype, so a double-cast to the narrow row shape is required here.
    return entity as unknown as RawCommerceListingRow;
}

/**
 * Handler for the owner start-subscription endpoint. Exported standalone
 * (mirrors `handleStartPaidSubscription` in `billing/start-paid.ts`) so it is
 * unit-testable against a mocked `Context` without booting the full Hono app.
 *
 * Permission: `COMMERCE_EDIT_OWN` (the role already has it — HOS-166 §6.3),
 * enforced by the explicit `protectedAuthMiddleware` mounted on
 * `startCommerceSubscriptionRouter` below (see that router's docstring for
 * why it is applied manually instead of via `createProtectedRoute`). Full
 * status-code contract: spec §7.1.
 */
export async function handleCommerceStartSubscription(
    ctx: Context,
    input: { entityType: CommerceEntityType; entityId: string }
): Promise<StartPaidSubscriptionResponse | Response> {
    const { entityType, entityId } = input;
    const actor = getActorFromContext(ctx);

    // ── Ownership check (AC-2) — the entire security boundary. ─────────────
    const listing = await loadRawListing(entityType, entityId);
    if (listing.ownerId !== actor.id) {
        throw new HTTPException(403, {
            message: 'You may only start a subscription for your own commerce listing.'
        });
    }

    // ── Plan slug (D-7) — resolved before touching billing so an unset
    // HOSPEDA_COMMERCE_PLAN_ID 503s uniformly for both verticals. ──────────
    let planSlug: string;
    try {
        planSlug = resolveCommercePlanSlug({ entityType });
    } catch (error) {
        if (error instanceof CommercePlanNotConfiguredError) {
            throw new HTTPException(503, { message: error.message });
        }
        throw error;
    }

    const billing = getQZPayBilling();
    if (!billing) {
        throw new HTTPException(503, { message: 'Billing service is not available' });
    }

    // ── Completeness gate (G-3, AC-5) — 422 with `missing`, never a 5xx
    // and never silently ignored, before any MercadoPago call. ─────────────
    const completeness = resolveListingCompleteness({ entityType, listing });
    if (!completeness.complete) {
        apiLogger.info(
            { entityType, entityId, ownerId: actor.id, missing: completeness.missing },
            'Commerce checkout blocked: listing is not complete'
        );
        return ctx.json(
            {
                success: false,
                error: {
                    code: 'LISTING_INCOMPLETE',
                    message: 'This listing is not complete enough to publish.',
                    missing: completeness.missing
                }
            },
            422
        );
    }

    // ── Already-subscribed guard (AC-16) — 409, never silently overwrite
    // a paying subscription (the link table's unique index would reject a
    // second row anyway; failing loudly here is a better error message). ───
    const existingStatus = await getCommerceListingSubscriptionStatus({
        entityType,
        entityId
    });
    if (existingStatus === 'active' || existingStatus === 'trialing') {
        throw new HTTPException(409, {
            message: 'This listing already has an active subscription.'
        });
    }

    // ── Resolve the CALLER's billing customer — never the listing owner via
    // a separate lookup, since ownership was already asserted above,
    // actor.id === listing.ownerId, so "the caller" IS "the owner". ────────
    let billingCustomerId = ctx.get('billingCustomerId');
    if (!billingCustomerId && actor.email) {
        const syncService = new BillingCustomerSyncService(billing, { throwOnError: false });
        billingCustomerId = await syncService.ensureCustomerExists({
            userId: actor.id,
            email: actor.email,
            name: actor.name
        });
        if (billingCustomerId) {
            apiLogger.info(
                { userId: actor.id, customerId: billingCustomerId },
                'commerce start-subscription: billing customer was missing and has been ensured on demand'
            );
        }
    }
    if (!billingCustomerId) {
        throw new HTTPException(400, { message: 'No billing account found' });
    }

    const locale = resolveReturnUrlLocale(ctx);

    try {
        const result = await initiateCommerceMonthlySubscription({
            customerId: billingCustomerId,
            planSlug,
            entityType,
            entityId,
            billing,
            urls: {
                paymentMethodReturnUrl: buildPaymentMethodReturnUrl(locale),
                notificationUrl: buildNotificationUrl()
            }
        });

        apiLogger.info(
            {
                localSubscriptionId: result.localSubscriptionId,
                customerId: billingCustomerId,
                entityType,
                entityId,
                planSlug
            },
            'Commerce subscription initiated (owner self-checkout), awaiting provider authorization'
        );

        return result;
    } catch (error) {
        if (error instanceof SubscriptionCheckoutError) {
            throw mapSubscriptionCheckoutErrorToHttp(error);
        }
        if (error instanceof HTTPException) {
            throw error;
        }
        apiLogger.error(
            {
                entityType,
                entityId,
                planSlug,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to start commerce subscription (owner self-checkout)'
        );
        throw new HTTPException(500, {
            message: 'Failed to start commerce subscription. Please try again.'
        });
    }
}

/**
 * POST /api/v1/protected/commerce/listings/:entityType/:entityId/start-subscription
 *
 * Built with the bare `createCRUDRoute` (mirrors `start-paid.ts:430` literally
 * — NOT `createAdminRoute`). Auth + the `COMMERCE_EDIT_OWN` permission gate
 * are applied explicitly on the wrapping router below, BEFORE the idempotency
 * middleware, rather than via `createProtectedRoute`'s bundling — see that
 * router's docstring for why the ordering matters here.
 */
export const protectedStartCommerceSubscriptionRoute = createCRUDRoute({
    method: 'post',
    path: '/listings/{entityType}/{entityId}/start-subscription',
    summary: 'Start a commerce-listing subscription (owner self-checkout)',
    description:
        "Starts a MercadoPago subscription for the caller's OWN commerce listing. Requires COMMERCE_EDIT_OWN and ownership of the target listing; the listing must be complete (422 otherwise).",
    tags: ['Protected - Commerce', 'Billing'],
    requestParams: StartSubscriptionParamsSchema,
    responseSchema: StartPaidSubscriptionResponseSchema,
    successStatusCode: 201,
    handler: async (ctx: Context, params: Record<string, unknown>) =>
        handleCommerceStartSubscription(ctx, {
            entityType: params.entityType as CommerceEntityType,
            entityId: params.entityId as string
        })
});

/**
 * Router that exposes the owner start-subscription endpoint.
 *
 * Middleware order (HOS-166 §6.3): `auth+COMMERCE_EDIT_OWN` BEFORE
 * `X-Idempotency-Key` (AC-15). This is the inverse of what wrapping the route
 * in `createProtectedRoute` would produce: that helper embeds
 * `protectedAuthMiddleware` INSIDE the route's own sub-app, which Hono runs
 * AFTER any middleware `.use()`-mounted on an outer router before
 * `.route('/', innerApp)` — so an idempotency middleware mounted first (as
 * `start-paid.ts` does on `startPaidRouter`, safe there because
 * `billingPermMiddleware` already ran even earlier at the
 * `createBillingRoutesHandler()` level) would run BEFORE the permission
 * check here, letting an unauthorized caller trigger an idempotency-table
 * write before ever being rejected. Applying `protectedAuthMiddleware`
 * explicitly, first, avoids that.
 */
const startCommerceSubscriptionRouter = createRouter();

const START_SUBSCRIPTION_PATH = '/listings/:entityType/:entityId/start-subscription';

startCommerceSubscriptionRouter.use(
    START_SUBSCRIPTION_PATH,
    protectedAuthMiddleware([PermissionEnum.COMMERCE_EDIT_OWN])
);

startCommerceSubscriptionRouter.use(
    START_SUBSCRIPTION_PATH,
    idempotencyKeyMiddleware({ operation: 'hospeda.commerce_start_subscription' })
);

startCommerceSubscriptionRouter.route('/', protectedStartCommerceSubscriptionRoute);

export { startCommerceSubscriptionRouter };
