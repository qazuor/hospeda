/**
 * The content-editing subscription gate (HOS-1275).
 *
 * Mounted on every route that MUTATES a listing's content in the three
 * verticals — accommodation, gastronomy and experience — it refuses an owner
 * whose subscription in THAT vertical has lapsed.
 *
 * The verdict itself, and every reason behind it, lives in
 * {@link resolveEditEligibility} (`services/billing/edit-eligibility.service.ts`).
 * Read that module before changing anything here — in particular the reason
 * `'pre_trial'` must keep passing, which is not obvious and is the one edit that
 * would take the platform's largest vertical down.
 *
 * ## Why 402 and not 403
 *
 * A lapsed subscription is a business gate, not a permission failure. The API
 * error contract (`apps/api/docs/error-contract.md`) reserves **403
 * `ENTITLEMENT_REQUIRED`** for a plan/limit gate — "your plan does not include
 * this feature" — and the web client routes that to generic upgrade copy. The
 * two existing paywalls in this codebase both answer **402** with a
 * cause-specific reason instead: `trialMiddleware` → `TRIAL_EXPIRED`,
 * `pastDueGraceMiddleware` → `GRACE_PERIOD_EXPIRED`. This gate joins them with
 * `NO_ACTIVE_SUBSCRIPTION`, which is already whitelisted in
 * `utils/entitlement-cause.ts` and already has resolving i18n copy — the same
 * pair the (deleted, never-mounted) `requireActiveSubscription` emitted.
 *
 * `readEntitlementCause` forwards only whitelisted `cause.code` values, so
 * spelling this reason differently would silently degrade the client to generic
 * copy rather than fail loudly.
 *
 * ## Where it goes in the chain
 *
 * After `commerceVerticalEntitlementMiddleware(vertical)` on commerce routes
 * (that middleware REPLACES `userEntitlements` wholesale, and this gate must
 * not run against a half-built context), and after `requireEntitlement(...)`
 * wherever one is mounted, so the cheaper in-memory check answers first. On
 * accommodation routes it is mounted on its own.
 *
 * It never runs ahead of auth: `createCRUDRoute`'s protected tier resolves the
 * actor before `options.middlewares` execute, so a signed-out caller is already
 * a 401 by the time this is reached (error-contract R2).
 *
 * @module middlewares/require-live-subscription
 */

import type { ProductDomainValue } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { resolveEditEligibility } from '../services/billing/edit-eligibility.service';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { isStaffBypassRole } from '../utils/staff-roles';

/**
 * Requires a live subscription in `domain` before a content mutation proceeds.
 *
 * Platform staff (SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER) bypass
 * unconditionally, exactly as they do in `entitlementMiddleware` and
 * `commerceVerticalEntitlementMiddleware`. Staff operate without a billing
 * customer of their own, so resolving this gate against them would refuse every
 * platform editor fixing somebody else's listing — a regression, not
 * enforcement.
 *
 * @param domain - The product domain the mutated listing belongs to.
 * @returns A Hono middleware that throws `HTTPException(402)` when the owner's
 *   subscription in `domain` has lapsed, and calls `next()` otherwise.
 *
 * @example
 * ```ts
 * options: {
 *   middlewares: [
 *     commerceVerticalEntitlementMiddleware('gastronomy'),
 *     requireEntitlement(EntitlementKey.EDIT_GASTRONOMY_INFO),
 *     requireLiveSubscription(ProductDomainEnum.GASTRONOMY)
 *   ]
 * }
 * ```
 */
export function requireLiveSubscription(
    domain: ProductDomainValue
): MiddlewareHandler<AppBindings> {
    return async (c, next) => {
        const actor = c.get('actor');
        if (isStaffBypassRole(actor?.roles)) {
            await next();
            return;
        }

        const eligibility = await resolveEditEligibility({
            customerId: c.get('billingCustomerId'),
            domain
        });

        if (eligibility === 'lapsed') {
            apiLogger.warn(
                {
                    customerId: c.get('billingCustomerId'),
                    domain,
                    path: c.req.path
                },
                'HOS-1275: blocked a content edit — no live subscription in this domain'
            );

            // Thrown, not `c.json`-ed, so the body goes through the one error
            // formatter every client already parses — the same reasoning
            // `pastDueGraceMiddleware` documents for its own 402.
            throw new HTTPException(402, {
                message:
                    'Your subscription is no longer active. Please subscribe again to keep editing this listing.',
                cause: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    subscribeUrl: '/billing/plans'
                }
            });
        }

        await next();
    };
}
