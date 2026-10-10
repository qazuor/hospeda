import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { isSystemActor, ServiceError } from '@repo/service-core';
import { resolveListingAccess } from '@repo/verticals';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ListingAccessConfig } from '../types/authorization';
import { getActorFromContext, isGuestActor } from '../utils/actor';
import { getListingAccessPorts } from '../utils/listing-access/ports';

/** Enforce a listing decision inside a validated route handler. */
export async function enforceListingAccess(args: {
    ctx: Context;
    params: Record<string, unknown>;
    config: ListingAccessConfig;
    tier: 'protected' | 'admin';
}): Promise<void> {
    const { ctx, params, config, tier } = args;
    const actor = getActorFromContext(ctx);
    // The API guest carries a real UUID; the resolver's step 1 recognises a
    // guest only as `actorId: null` (V5.7).
    const actorId = isGuestActor(actor) ? null : actor.id;
    const listingId = config.operation === 'CREATE' ? '' : String(params[config.idParam ?? 'id']);
    const ports = getListingAccessPorts();
    const { facts, ownerId } =
        config.operation === 'CREATE'
            ? { facts: null, ownerId: null }
            : await ports.loadFacts({ vertical: config.vertical, listingId });
    const isForeign = config.operation !== 'CREATE' && facts !== null && actorId !== ownerId;
    const hasActionPermission =
        actor.permissions?.includes(PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT) ?? false;
    const adminAction = isForeign
        ? hasActionPermission
            ? { permitted: true, isSystemActor: isSystemActor(actor) }
            : tier === 'admin'
              ? { permitted: false, isSystemActor: isSystemActor(actor) }
              : undefined
        : undefined;
    const subjectId = adminAction?.permitted ? ownerId : actorId;
    const limit =
        config.limit && subjectId ? await config.limit({ ctx, listingId, subjectId }) : undefined;
    const result = await resolveListingAccess({
        actorId,
        vertical: config.vertical,
        declaredVertical: config.vertical,
        facts,
        operation: config.operation,
        adminAction,
        step6Key: config.step6Key,
        limit,
        billing: ports.billing,
        effectiveSet: ports.effectiveSet
    });
    if (result.allowed) {
        ctx.set('listingAccess', {
            subjectId: result.subjectId,
            evaluatedSteps: result.evaluatedSteps
        });
        return;
    }
    const reason = result.reason;
    switch (reason) {
        case 'UNAUTHENTICATED':
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        case 'NOT_FOUND':
            throw new HTTPException(404, { message: `${config.vertical} not found` });
        case 'FORBIDDEN':
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        case 'NO_COVERAGE':
            throw new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Coverage required', {
                entitlementKey: null,
                reason: 'NO_COVERAGE'
            });
        case 'NO_CAPABILITY':
            throw new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Entitlement required', {
                entitlementKey: result.key
            });
        case 'LIMIT_REACHED':
            throw new ServiceError(ServiceErrorCode.LIMIT_REACHED, 'Limit reached', {
                limitKey: result.key,
                currentCount: (result.requested ?? 1) - 1,
                maxAllowed: result.max
            });
        default: {
            const exhaustive: never = reason;
            throw new Error(`Unhandled listing access result: ${exhaustive}`);
        }
    }
}
