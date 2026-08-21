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
 * public/protected view-tier gating varies by the listing's lifecycle and
 * visibility) and explicitly asserts `actor.id === listing.ownerId` before
 * doing anything else.
 *
 * Since HOS-600 that refusal is a **404, not the 403 AC-2 originally
 * specified**, and it is byte-identical to the answer for a listing that does
 * not exist. The 403 confirmed the id was real to somebody with no right to
 * know it, which the error contract's "a foreign resource answers 404" rule
 * exists to prevent; the security boundary itself is unchanged — a non-owner
 * still cannot start a checkout.
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
import {
    type CommerceVertical,
    ENTITLEMENT_GRANTING_STATUSES,
    LIMIT_KEY_BY_COMMERCE_VERTICAL
} from '@repo/billing';
import { experienceModel, gastronomyModel } from '@repo/db';
import type {
    CommerceEntityType,
    CommerceListingCompletenessListing,
    StartPaidSubscriptionResponse
} from '@repo/schemas';
import {
    PermissionEnum,
    resolveListingCompleteness,
    ServiceErrorCode,
    StartPaidSubscriptionResponseSchema
} from '@repo/schemas';
import { getCommerceListingSubscriptionStatus, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { protectedAuthMiddleware } from '../../../middlewares/authorization';
import { getQZPayBilling } from '../../../middlewares/billing';
import { resolveCommerceVerticalCap } from '../../../middlewares/commerce-entitlement';
import { idempotencyKeyMiddleware } from '../../../middlewares/idempotency-key';
import { buildLimitReachedDetails } from '../../../middlewares/limit-enforcement';
import { mapSubscriptionCheckoutErrorToHttp } from '../../../services/billing/subscription-checkout-error-http';
import { BillingCustomerSyncService } from '../../../services/billing-customer-sync';
import { loadCommerceListingMedia } from '../../../services/commerce-listing-media';
import {
    CommercePlanNotConfiguredError,
    resolveCommercePlanSlug
} from '../../../services/commerce-plan-resolver';
import {
    attachListingToSubscription,
    countAttachedListings,
    findOwnerVerticalSubscription
} from '../../../services/commerce-subscription-attach.service';
import {
    initiateCommerceMonthlySubscription,
    SubscriptionCheckoutError
} from '../../../services/subscription-checkout.service';
import { getActorFromContext } from '../../../utils/actor';
import { createRouter } from '../../../utils/create-app';
import { calculateUsagePercent } from '../../../utils/limit-check';
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
 * Subscription statuses (`commerce_listing_subscriptions.status`, mirroring
 * `billing_subscriptions.status` — see `SubscriptionStatusEnum`) that
 * indicate the listing already has a LIVE-ish subscription and must block a
 * new checkout (AC-16 / HOS-166 judgment-day W1).
 *
 * `past_due` is included alongside `active`/`trialing`: a dunning
 * subscription is still a real MercadoPago preapproval mid-retry, not a dead
 * one, so letting the owner start a SECOND checkout here would create a
 * second concurrent preapproval for the same listing rather than resolving
 * the first one (the dunning flow — grace period, retries, eventual
 * cancel/reactivate — is the correct path back to `active`). Deliberately
 * excludes `cancelled`, `expired`, `abandoned`, and `paused` — those ARE
 * terminal/inactive enough that a fresh checkout is the correct next step.
 *
 * HOS-702: built as the canonical `ENTITLEMENT_GRANTING_STATUSES` PLUS
 * `past_due`, never as a hand-rolled list. The hand-rolled version omitted
 * `comp`, so an owner whose listing already carried a complimentary
 * subscription could start a second, real, CHARGED checkout for it.
 */
const LIVE_SUBSCRIPTION_STATUSES = new Set<string>([...ENTITLEMENT_GRANTING_STATUSES, 'past_due']);

/**
 * Subset of the raw `gastronomies`/`experiences` row this route reads —
 * ownership (`ownerId`) + the fields `resolveListingCompleteness` needs
 * ({@link CommerceListingCompletenessListing}). Read directly via the
 * `@repo/db` model (not through `GastronomyService.getById`'s view-tier
 * gating) so a non-owner gets a uniform answer regardless of the listing's
 * current lifecycle/visibility (AC-2) — since HOS-600 that answer is the same
 * 404 a non-existent listing gets, not a 403.
 *
 * `media` is the ONE completeness field this row cannot supply: HOS-372 dropped
 * the `media` JSONB column, so it is loaded separately via
 * {@link loadCommerceListingMedia} and merged in before the gate runs (H-154 /
 * HOS-494). Do not "restore" it here — the column does not exist.
 */
interface RawCommerceListingRow extends CommerceListingCompletenessListing {
    readonly id: string;
}

/**
 * The single 404 this route answers when the caller may not start a
 * subscription for the listing they named — because it does not exist, or
 * because it is somebody else's (HOS-600). Built in one place so the two
 * branches cannot drift into two distinguishable bodies, and carrying neither
 * the entity type nor the id (error-contract rule R5).
 *
 * @returns The `HTTPException` to throw.
 */
const commerceListingNotFound = (): HTTPException =>
    new HTTPException(404, { message: 'commerce listing not found' });

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
        throw commerceListingNotFound();
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
    //
    // HOS-600: a listing that is not the caller's answers the SAME 404 as one
    // that does not exist. The 403 this replaces said "that id is real, it just
    // is not yours", which let anyone holding an id confirm a live listing —
    // the disclosure the error contract's 404-for-foreign-rows rule exists to
    // close. The old 404 also echoed `${entityType}/${entityId}` back, against
    // rule R5; both branches now share one body that carries neither.
    const listing = await loadRawListing(entityType, entityId);
    if (listing.ownerId !== actor.id) {
        throw commerceListingNotFound();
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
    //
    // `media` is composed from the relational media tables rather than read off
    // `listing`: HOS-372 dropped the `media` JSONB column, so the raw row this
    // route deliberately loads (see the ownership note above) has no `media`
    // key at all. Reading it there made this gate reject EVERY listing with
    // `missing: ['media.featuredImage']` — H-154 / HOS-494.
    const media = await loadCommerceListingMedia({ entityType, entityId });
    const completeness = resolveListingCompleteness({
        entityType,
        listing: { ...listing, media }
    });
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

    // ── Already-subscribed guard (AC-16, hardened by HOS-166 judgment-day
    // W1) — 409, never silently overwrite a live subscription (the link
    // table's unique index would reject a second row anyway; failing loudly
    // here is a better error message, and blocks a SECOND MercadoPago
    // preapproval from ever being created mid-dunning). ─────────────────────
    const existingStatus = await getCommerceListingSubscriptionStatus({
        entityType,
        entityId
    });
    if (existingStatus !== null && LIVE_SUBSCRIPTION_STATUSES.has(existingStatus)) {
        throw new HTTPException(409, {
            message: 'This listing already has an active subscription.'
        });
    }

    // ── Resolve the CALLER's billing customer — never the listing owner via
    // a separate lookup, since ownership was already asserted above,
    // actor.id === listing.ownerId, so "the caller" IS "the owner". ────────
    //
    // Moved AHEAD of the per-owner fork below (HOS-688): under per-owner
    // billing the customer is what identifies the subscription this listing may
    // join, so it has to be resolved before deciding whether to open a checkout
    // at all.
    let billingCustomerId = ctx.get('billingCustomerId');
    if (!billingCustomerId && actor.email) {
        // HOS-596: customer creation runs on the tolerant facade so a
        // MercadoPago hiccup cannot delete the row it just wrote and turn this
        // commerce checkout into a 422. `billing` (strict) stays in charge of the
        // subscription/checkout legs below.
        const syncService = new BillingCustomerSyncService(
            getQZPayBilling({ forCustomerSync: true }),
            {
                throwOnError: false
            }
        );
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

    // ── The per-owner fork (HOS-688 §6.8, AC-14) ─────────────────────────────
    //
    // Under per-LISTING billing this route had one answer: open a checkout. Now
    // the listing in the path is no longer the subscription's subject — it is
    // the thing being attached to the OWNER's subscription for this vertical —
    // and the answer forks three ways.
    //
    // The middle branch is the one that did not exist before, and the one where
    // a per-listing model quietly survives a rename: opening a checkout for a
    // second listing the owner's plan already covers creates a SECOND
    // MercadoPago preapproval and charges them twice. Both requests would answer
    // 201 with a valid URL, so nothing about it is visible from the API.
    const ownerSubscription = await findOwnerVerticalSubscription({
        billing,
        customerId: billingCustomerId,
        vertical: entityType as CommerceVertical
    });

    if (ownerSubscription) {
        const [attached, cap] = await Promise.all([
            countAttachedListings({ subscriptionId: ownerSubscription.id }),
            resolveCommerceVerticalCap({
                customerId: billingCustomerId,
                vertical: entityType as CommerceVertical
            })
        ]);

        if (attached >= cap) {
            // Branch 3. Mostly unreachable while the create route holds the same
            // cap — the owner could not have created the listing — but reachable
            // when the cap DROPS after creation (an extra-listing add-on lapses).
            // Same LIMIT_REACHED shape as the create route, so the web side
            // resolves the vertical's at-limit copy and its add-on link without
            // special-casing this endpoint.
            apiLogger.warn(
                { entityType, entityId, ownerId: actor.id, attached, cap },
                'Commerce checkout refused: the owner is at their listing cap for this vertical'
            );
            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                `Ya estás usando ${attached} de ${cap} publicaciones de tu plan. Ampliá tu plan con un complemento para publicar otra.`,
                buildLimitReachedDetails({
                    limitKey: LIMIT_KEY_BY_COMMERCE_VERTICAL[entityType as CommerceVertical],
                    currentCount: attached,
                    maxAllowed: cap,
                    usagePercent: calculateUsagePercent(attached, cap)
                })
            );
        }

        // Branch 2 — attach, and open no checkout at all.
        await attachListingToSubscription({
            subscription: ownerSubscription,
            entityType: entityType as CommerceVertical,
            entityId
        });

        return {
            // An in-app sentinel, exactly as the `comp` branch of the
            // accommodation checkout does: there is no payment page to send the
            // owner to, because there is no new charge.
            checkoutUrl: buildPaymentMethodReturnUrl(locale),
            localSubscriptionId: ownerSubscription.id,
            expiresAt: new Date().toISOString(),
            appliedEffect: 'attached' as const
        };
    }

    // Branch 1 — no subscription for this vertical yet. Today's behaviour.
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
