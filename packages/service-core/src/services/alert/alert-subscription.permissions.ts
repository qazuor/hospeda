import type { PriceAlert } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { entityNotFoundError } from '../../utils/not-found';
import { hasPermission } from '../../utils/permission';
import { PRICE_ALERT_ENTITY_NAME } from '../entity-names';

/**
 * Checks whether an actor is "authenticated" for the narrow purposes of this
 * entity: has a truthy `id`. There is no dedicated `PRICE_ALERT_*` permission
 * in {@link PermissionEnum} — entitlement gating (whether the actor's plan
 * allows price alerts at all, and whether they're under `MAX_ACTIVE_ALERTS`)
 * happens one layer up, in the `gateAlerts()` route middleware (SPEC-286
 * T-005). The service only needs to know "is this a real, logged-in actor".
 *
 * @param actor - The actor to check.
 * @throws {ServiceError} `FORBIDDEN` if the actor has no `id`.
 */
function requireAuthenticated(actor: Actor): void {
    if (!actor?.id) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Authentication required to manage price-alert subscriptions'
        );
    }
}

/**
 * Checks if an actor may create a price-alert subscription.
 *
 * Any authenticated actor may create one for themselves — ownership is
 * enforced by `_beforeCreate` injecting `userId: actor.id` (a caller can never
 * subscribe another user), and plan/limit gating is enforced by the route
 * middleware, not here.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} `FORBIDDEN` if the actor is not authenticated.
 */
export function checkCanCreate(actor: Actor): void {
    requireAuthenticated(actor);
}

/**
 * Checks if an actor may view, or soft-delete, a specific price-alert
 * subscription.
 *
 * Allowed when either:
 * - the actor owns the subscription (`actor.id === entity.userId`), OR
 * - the actor holds `ACCOMMODATION_VIEW_ALL` (the existing "staff sees
 *   everything accommodation-adjacent" convention used elsewhere in the
 *   codebase for tourist-owned, accommodation-scoped entities — see
 *   `accommodation.service.ts`).
 *
 * @param actor - The actor performing the action.
 * @param entity - The price-alert subscription being accessed.
 * @throws {ServiceError} `FORBIDDEN` if neither condition holds.
 */
export function checkCanAccessAlert(actor: Actor, entity: PriceAlert): void {
    if (actor.id === entity.userId || hasPermission(actor, PermissionEnum.ACCOMMODATION_VIEW_ALL)) {
        return;
    }
    // HOS-600: NOT_FOUND, byte-identical to the answer for an id that matches
    // nothing. A 403 here confirmed the alert existed to somebody who had no
    // right to know, and the message said so in words.
    throw entityNotFoundError({ entityName: PRICE_ALERT_ENTITY_NAME });
}

/**
 * Checks if an actor may list/count their OWN price-alert subscriptions.
 *
 * Unlike {@link checkCanAccessAlert}, there is intentionally NO staff bypass
 * here: the task's product design is "no admin list in v1" for price alerts —
 * `list()`/`count()` are always self-scoped to `actor.id` regardless of who's
 * calling (see `AlertSubscriptionService._beforeList` / `_executeCount`),
 * so the permission check only needs to confirm authentication.
 *
 * @param actor - The actor performing the action.
 * @throws {ServiceError} `FORBIDDEN` if the actor is not authenticated.
 */
export function checkCanListOwn(actor: Actor): void {
    requireAuthenticated(actor);
}
