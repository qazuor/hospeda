/**
 * Past-Due Grace Period Middleware
 *
 * Enforces the grace period policy for subscriptions in `past_due` status.
 * Allows requests during the grace window and blocks them with 402 once the
 * grace period has expired.
 *
 * Behavior:
 * - Billing disabled or no customer: pass through silently
 * - Subscription NOT past_due: pass through immediately
 * - Subscription past_due + within grace: allow request, set `X-Grace-Period-Days-Remaining` header
 * - Subscription past_due + grace expired: return 402 with GRACE_PERIOD_EXPIRED error
 * - Any unexpected error: log and pass through (fail open)
 *
 * @module middlewares/past-due-grace.middleware
 */

import type { QZPaySubscriptionWithHelpers } from '@qazuor/qzpay-core';
import { normalizeStoredSubscriptionStatus, PAYMENT_GRACE_PERIOD_DAYS } from '@repo/billing';
import { ProductDomainEnum, type ProductDomainValue, SubscriptionStatusEnum } from '@repo/schemas';
import { hydrateSubscriptionProductDomains, subscriptionMatchesDomain } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { getQZPayBilling } from './billing';

/**
 * Reference validation: log a warning at import time if the reference constant
 * diverges from the expected value. QZPay is the actual source of truth for
 * grace period enforcement.
 *
 * NOTE: This is a tripwire, not enforcement. The runtime grace window honored by
 * qzpay-core's `isInGracePeriod()` + `daysRemainingInGrace()` is actually 7 days
 * (DUNNING_GRACE_PERIOD_DAYS), not 3. `PAYMENT_GRACE_PERIOD_DAYS=3` is a reference
 * constant from `@repo/billing` that no consumer reads for enforcement. See:
 * docs/billing/grace-period-source-of-truth.md
 */
if (PAYMENT_GRACE_PERIOD_DAYS !== 3) {
    apiLogger.warn(
        { configuredDays: PAYMENT_GRACE_PERIOD_DAYS, expectedDays: 3 },
        'PAYMENT_GRACE_PERIOD_DAYS reference constant diverges from expected value (purely informational; runtime enforcement is independent of this).'
    );
}

/**
 * Milliseconds in one day, used by the `daysOverdue` fallback in the 402 branch.
 */
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * The grace window length honored by qzpay-core at runtime, in days. This must
 * match qzpay-core's `DUNNING_GRACE_PERIOD_DAYS` so that the middleware's
 * `daysOverdue` calculation in the 402 path agrees with the helper's
 * `isInGracePeriod()` boundary.
 *
 * If qzpay-core changes the window, update this constant — there is no shared
 * symbol to import; the helpers expose the boolean only.
 */
const QZPAY_GRACE_WINDOW_DAYS = 7;

/**
 * Paths exempt from grace period enforcement.
 * These are "recovery" paths that allow users to fix their billing status.
 */
const GRACE_EXEMPT_PATH_SUFFIXES = [
    '/trial/reactivate',
    '/trial/reactivate-subscription',
    '/checkout',
    '/subscriptions/reactivate',
    // HOS-348 Part A: read-only. `GET /users/me/subscription` is the ONLY
    // endpoint that renders `apps/web`'s `/mi-cuenta/suscripcion` page
    // (`SubscriptionDashboard.client.tsx`'s `fetchData`) — without this
    // exemption a past-due customer whose grace period expired got a 402 on
    // the one screen that could show them *why* and let them act, and the
    // page's `<ErrorState>` "Reintentar" button just re-issued the same
    // request into the same 402 forever. This is a READ: it reports status,
    // it does not grant anything the gate is meant to withhold. There used
    // to be a `/payment-methods` suffix here too, added for the same
    // "let them fix it" intent, but no route in this codebase ever matched
    // it (grep confirmed) — an exemption that matches nothing is worse than
    // no exemption, so it was removed rather than kept as decoration.
    '/me/subscription',
    // HOS-348 Part B: the actual remedy `/me/subscription` above only lets
    // the customer SEE. `POST .../subscriptions/:id/replace-payment-method`
    // (`replace-payment-method.ts`) mints a fresh preapproval on their
    // current plan — it does not skip payment, it IS the payment path this
    // whole gate exists to funnel a past-due customer toward. Safe as a bare
    // suffix for the same reason `/start-subscription` below is: this
    // middleware only runs on `/api/v1/protected/*`.
    '/replace-payment-method',
    // HOS-166: commerce owner self-checkout. `billing_customers` is one row
    // per user shared across accommodation + commerce (ADR-035), so a host
    // whose ACCOMMODATION subscription is past-due/grace-expired must still
    // be able to pay for a brand-new COMMERCE listing subscription — the
    // same "can't block payment for being delinquent on a DIFFERENT domain"
    // exemption as the other recovery paths above. Safe as a bare suffix
    // because this middleware only runs on `/api/v1/protected/*`
    // (see `routes/index.ts`) — the admin-tier equivalent
    // (`/api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription`)
    // never reaches this middleware.
    '/start-subscription'
] as const;

/**
 * Whole route families exempt from grace period enforcement, matched by PREFIX.
 *
 * Separate from {@link GRACE_EXEMPT_PATH_SUFFIXES} on purpose: that list is
 * checked with `endsWith`, and filing a prefix under a name that says "suffix"
 * would make the constant lie about its own predicate.
 *
 * - `/api/v1/protected/alliance/` (HOS-278) — the alliance tier is where an
 *   applicant reads the state of their partner / proveedor / editor
 *   application. `billing_customers` is one row per user shared across product
 *   domains (ADR-035), so without this a host whose ACCOMMODATION subscription
 *   went past-due beyond grace would be told 402 when asking whether their
 *   PARTNER application was approved — a different product domain, and a read
 *   of non-billing state that withholding cannot incentivise paying for. Same
 *   "can't gate one domain on delinquency in another" reasoning as the
 *   `/start-subscription` suffix above, applied to the whole tier because the
 *   tier carries no paid capability at all.
 */
const GRACE_EXEMPT_PATH_PREFIXES = ['/api/v1/protected/alliance/'] as const;

/**
 * Response header name for communicating remaining grace period days to clients.
 *
 * @example
 * ```
 * X-Grace-Period-Days-Remaining: 2
 * ```
 */
const GRACE_DAYS_HEADER = 'X-Grace-Period-Days-Remaining';

/**
 * Path-prefix rules mapping a `/api/v1/protected/*` request to the product
 * domain whose past-due status should gate it (HOS-1277).
 *
 * **The bug this closes**: {@link findPastDueSubscription} used to scan the
 * customer's ENTIRE subscription set — every vertical at once — and block on
 * whichever one was most urgent, regardless of what the request was actually
 * for. A dual-owner with a paid, up-to-date ACCOMMODATION subscription and a
 * past-due GASTRONOMY one got 402'd on every `/protected/*` route, including
 * the accommodation ones they were current on. That is the platform-wide
 * lockout this middleware exists to prevent, not cause.
 *
 * The first matching rule wins; a path matching none of them defaults to
 * {@link ProductDomainEnum.ACCOMMODATION} — the ONLY domain this middleware
 * gated before the per-vertical billing split (HOS-688), and still the right
 * default for a domain-agnostic route (posts, destinations, whats-new, ...): a
 * gastronomy debtor must not be blocked from a feature that has nothing to do
 * with gastronomy. This mirrors `subscriptionMatchesDomain`'s own asymmetry —
 * accommodation is the fail-open answer, every other domain is an explicit,
 * narrow match.
 *
 * Commerce (`gastronomy`/`experience`) self-service checkout/plan-change
 * routes mount under `/protected/commerce/...` keyed by an `:entityType` path
 * segment rather than their own prefix (see
 * `routes/commerce/protected/index.ts`), so those are matched by segment
 * rather than by a fixed prefix.
 *
 * Known gap, not attempted here: tourist-tier-gated routes (e.g.
 * `/protected/price-alerts`, `/protected/recommendations`) fall through to the
 * ACCOMMODATION default rather than their own `tourist` domain, so a past-due
 * TOURIST subscription is currently never gated by this middleware at all —
 * matching this middleware's pre-existing (domain-blind) behavior for that
 * case rather than fixing it. Scoping every tourist-gated route correctly
 * needs a fuller route inventory than this fix's bounded scope covers.
 */
const GRACE_DOMAIN_PATH_RULES: ReadonlyArray<{
    readonly test: (path: string) => boolean;
    readonly domain: ProductDomainValue;
}> = [
    {
        test: (path) => path.includes('/protected/gastronomies'),
        domain: ProductDomainEnum.GASTRONOMY
    },
    {
        test: (path) => path.includes('/protected/experiences'),
        domain: ProductDomainEnum.EXPERIENCE
    },
    { test: (path) => path.includes('/protected/partners'), domain: ProductDomainEnum.PARTNER },
    {
        test: (path) => /\/protected\/commerce\/.*gastronomy/.test(path),
        domain: ProductDomainEnum.GASTRONOMY
    },
    {
        test: (path) => /\/protected\/commerce\/.*experience/.test(path),
        domain: ProductDomainEnum.EXPERIENCE
    }
];

/**
 * Resolves which product domain's past-due status should gate a request path.
 *
 * @param path - `c.req.path` of the incoming request.
 * @returns The domain to check, defaulting to {@link ProductDomainEnum.ACCOMMODATION}.
 */
function resolveGraceCheckDomain(path: string): ProductDomainValue {
    return (
        GRACE_DOMAIN_PATH_RULES.find((rule) => rule.test(path))?.domain ??
        ProductDomainEnum.ACCOMMODATION
    );
}

/**
 * Resolves the most urgent past-due subscription, SCOPED to `domain`, for a
 * given billing customer (HOS-1277).
 *
 * Fetches all subscriptions, hydrates their `productDomain` (qzpay's mapper
 * never populates it — see `hydrateSubscriptionProductDomains`'s doc), filters
 * to the requested domain, and returns the past-due one with the fewest grace
 * days remaining (most urgent) among THAT domain's subscriptions only. When
 * multiple past-due subscriptions exist in the same domain, the one closest to
 * (or most beyond) grace expiry controls access. Returns `null` if the
 * customer has no past-due subscription in `domain`.
 *
 * @param customerId - QZPay billing customer identifier
 * @param domain - The product domain this request belongs to (see
 *   {@link resolveGraceCheckDomain}).
 * @returns The most urgent past-due subscription with helpers, in `domain`, or `null`
 */
async function findPastDueSubscription(
    customerId: string,
    domain: ProductDomainValue
): Promise<QZPaySubscriptionWithHelpers | null> {
    const billing = getQZPayBilling();

    if (!billing) {
        return null;
    }

    const rawSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
    const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);
    const domainSubscriptions = subscriptions.filter((sub) =>
        subscriptionMatchesDomain(sub, domain)
    );

    // HOS-1310: normalized, NOT `sub.isPastDue()`. That qzpay helper compares the
    // RAW status against `'past_due'`, so it is blind to qzpay's own `unpaid` —
    // a value the repo's alias map calls the same state, and one
    // `isLiveSubscriptionStatus` now accepts as live.
    //
    // Leaving this side on the raw spelling is the asymmetry that bites: an
    // `unpaid` row would pass the content-editing gate (`edit-eligibility`) and
    // block a second checkout (`start-paid`) FOREVER, because the 7-day
    // `GRACE_PERIOD_EXPIRED` this middleware owns is the only thing that ever
    // ends that state, and it would never fire. The side that grants and the side
    // that revokes have to read the same vocabulary, or the grace has no exit.
    //
    // No writer produces `unpaid` today — which is exactly the argument for
    // keeping `past_due` in the live set in the first place: the day the write
    // appears is not the day anyone remembers to add it here.
    //
    // The `deletedAt === null` half of `isPastDue()` is preserved explicitly.
    const pastDueSubs = domainSubscriptions.filter(
        (sub) =>
            normalizeStoredSubscriptionStatus(sub.status) === SubscriptionStatusEnum.PAST_DUE &&
            sub.deletedAt === null
    );
    if (pastDueSubs.length === 0) return null;
    if (pastDueSubs.length === 1) return pastDueSubs[0] ?? null;

    // Multiple past_due: use the one with fewest grace days remaining (most urgent)
    return pastDueSubs.reduce((mostUrgent, current) => {
        const urgentDays = mostUrgent.daysRemainingInGrace() ?? 0;
        const currentDays = current.daysRemainingInGrace() ?? 0;
        return currentDays < urgentDays ? current : mostUrgent;
    });
}

/**
 * Past-due grace period middleware factory.
 *
 * Checks whether an authenticated user's subscription is in `past_due` status
 * and, if so, enforces the grace period window. Requests are blocked with
 * **402 Payment Required** once the grace period has expired.
 *
 * Must run AFTER:
 * - `billingMiddleware` (sets `billingEnabled` and `qzpay` on context)
 * - `billingCustomerMiddleware` (sets `billingCustomerId` on context)
 *
 * @returns Hono middleware handler bound to `AppBindings`
 *
 * @example
 * ```typescript
 * import { pastDueGraceMiddleware } from './middlewares/past-due-grace.middleware';
 *
 * // Apply globally after billing middlewares
 * app.use('*', billingMiddleware);
 * app.use('*', billingCustomerMiddleware());
 * app.use('*', pastDueGraceMiddleware());
 *
 * // Or apply selectively on protected routes
 * app.use('/api/v1/protected/*', pastDueGraceMiddleware());
 * ```
 */
export function pastDueGraceMiddleware(): AppMiddleware {
    return async (c, next) => {
        // Skip if billing is not enabled in this environment
        const billingEnabled = c.get('billingEnabled');

        if (!billingEnabled) {
            await next();
            return;
        }

        // Skip if the request is not associated with a billing customer
        const billingCustomerId = c.get('billingCustomerId');

        if (!billingCustomerId) {
            await next();
            return;
        }

        // Allow recovery paths — and whole exempt tiers — through even when the
        // grace period has expired.
        const requestPath = c.req.path;
        const isExemptPath =
            GRACE_EXEMPT_PATH_SUFFIXES.some((suffix) => requestPath.endsWith(suffix)) ||
            GRACE_EXEMPT_PATH_PREFIXES.some((prefix) => requestPath.startsWith(prefix));
        if (isExemptPath) {
            await next();
            return;
        }

        try {
            const requestDomain = resolveGraceCheckDomain(requestPath);
            const pastDueSub = await findPastDueSubscription(billingCustomerId, requestDomain);

            // No past-due subscription found - pass through normally (the
            // single `next()` at the bottom, outside the try).
            if (!pastDueSub) {
                return await next();
            }

            const isInGrace = pastDueSub.isInGracePeriod();

            if (isInGrace) {
                // Grace period is active: allow the request but inform the client
                const daysRemaining = pastDueSub.daysRemainingInGrace() ?? 0;

                c.header(GRACE_DAYS_HEADER, String(daysRemaining));

                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: pastDueSub.id,
                        daysRemaining,
                        path: c.req.path
                    },
                    'Request allowed within past-due grace period'
                );
            } else {
                // Grace period has expired: calculate how many days overdue.
                //
                // qzpay-core's `daysRemainingInGrace()` returns `null` (not a negative
                // number) once `isInGracePeriod()` is false, so the previous
                // `Math.abs(daysRemainingInGrace() ?? 0)` would always collapse to 0.
                // We compute the value directly from `current_period_end`:
                //
                //   daysOverdue = days since current_period_end - grace window length
                //
                // This matches what the helper would return if it had negative semantics.
                const periodEnd = pastDueSub.currentPeriodEnd;
                const daysSincePeriodEnd =
                    periodEnd instanceof Date
                        ? Math.ceil((Date.now() - periodEnd.getTime()) / ONE_DAY_MS)
                        : 0;
                const daysOverdue = Math.max(0, daysSincePeriodEnd - QZPAY_GRACE_WINDOW_DAYS);

                apiLogger.warn(
                    {
                        customerId: billingCustomerId,
                        subscriptionId: pastDueSub.id,
                        daysOverdue,
                        path: c.req.path
                    },
                    'Blocked request: grace period expired'
                );

                // Thrown, not `c.json`-ed, so the body goes through the one error
                // formatter every client already parses. The previous hand-rolled
                // shape put a STRING in `error` instead of the `{code, message}`
                // envelope, so `parseError` in the web client read `code`/`message`
                // as undefined and the UI fell back to generic copy — the same class
                // of bug HOS-283 fixes for the trial gate.
                throw new HTTPException(402, {
                    message:
                        'Your grace period has expired. Please update your payment method to continue.',
                    cause: {
                        code: 'GRACE_PERIOD_EXPIRED',
                        daysOverdue
                    }
                });
            }
        } catch (error) {
            // An entitlement gate is a decision, not a failure: it must escape
            // the fail-open below or a past-due customer would be let through
            // by the very handler meant to block them.
            if (error instanceof HTTPException) {
                throw error;
            }

            // Log unexpected errors but do not block the request (fail open)
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId: billingCustomerId,
                    path: c.req.path,
                    error: errorMessage
                },
                'Unexpected error in past-due grace middleware - allowing request'
            );
        }

        // Single exit for every non-blocking path, deliberately OUTSIDE the try:
        // if `next()` sat inside it, a downstream error would land in the
        // fail-open catch above and call `next()` a second time, which Hono
        // rejects with "next() called multiple times" — masking the real error.
        // The blocking path never reaches here; it throws.
        await next();
    };
}
