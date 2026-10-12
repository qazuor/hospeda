import { NO_PLANS_AVAILABLE_MESSAGE, ServiceErrorCode } from '@repo/schemas';
import { isSystemActor, ServiceError } from '@repo/service-core';
import {
    isAdministrativeActionPermitted,
    OPERATION_STEP6_KEY,
    resolveListingAccess
} from '@repo/verticals';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { resolveSubscribeDestinationForUser } from '../services/listing-publication/subscribe-destination.service';
import type { ListingAccessConfig } from '../types/authorization';
import { getActorFromContext, isGuestActor } from '../utils/actor';
import { getListingAccessPorts } from '../utils/listing-access/ports';
import { apiLogger } from '../utils/logger';

/** Whether `key` is one of the step-6 capabilities that admit publishing in `vertical`. */
function isPublishCapabilityKey({
    vertical,
    key
}: {
    readonly vertical: ListingAccessConfig['vertical'];
    readonly key: string;
}): boolean {
    const requirement = OPERATION_STEP6_KEY.PUBLISH;
    switch (requirement.kind) {
        case 'ANY_OF_VERTICAL':
            return requirement.keys[vertical].includes(key);
        case 'VERTICAL_KEY':
            return requirement.keys[vertical] === key;
        case 'KEY':
            return requirement.key === key;
        case 'NONE':
        case 'CALLER_KEY':
            return false;
    }
}

/** Enforce a listing decision inside a validated route handler. */
export async function enforceListingAccess(args: {
    ctx: Context;
    params: Record<string, unknown>;
    config: ListingAccessConfig;
    tier: 'protected' | 'admin';
    body?: Record<string, unknown>;
}): Promise<void> {
    const { ctx, params, config, tier, body } = args;
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
    const hasActionPermission = isAdministrativeActionPermitted({
        action: 'ACC_15',
        actorPermissions: actor.permissions
    });
    const adminAction = isForeign
        ? hasActionPermission
            ? { action: 'ACC_15' as const, permitted: true, isSystemActor: isSystemActor(actor) }
            : tier === 'admin'
              ? { action: 'ACC_15' as const, permitted: false, isSystemActor: isSystemActor(actor) }
              : undefined
        : undefined;
    const subjectId = adminAction?.permitted ? ownerId : actorId;
    const limit =
        config.limit && subjectId ? await config.limit({ ctx, listingId, subjectId }) : undefined;
    // Resolve route-level capabilities (HOS-1643): array as-is, function with body.
    const requiredKeys =
        typeof config.capabilities === 'function'
            ? config.capabilities({ body })
            : config.capabilities;
    const result = await resolveListingAccess({
        actorId,
        vertical: config.vertical,
        declaredVertical: config.vertical,
        facts,
        operation: config.operation,
        adminAction,
        step6Key: config.step6Key,
        requiredKeys,
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
            if (
                config.operation === 'PUBLISH' &&
                subjectId !== null &&
                result.key &&
                isPublishCapabilityKey({ vertical: config.vertical, key: result.key }) &&
                !(
                    await ports.effectiveSet({
                        userId: subjectId,
                        vertical: config.vertical
                    })
                ).hasLiveNonTrialTitle
            ) {
                let destination: Awaited<ReturnType<typeof resolveSubscribeDestinationForUser>>;
                try {
                    destination = await resolveSubscribeDestinationForUser({
                        userId: subjectId,
                        vertical: config.vertical
                    });
                } catch (error) {
                    apiLogger.error(
                        {
                            userId: subjectId,
                            vertical: config.vertical,
                            error: error instanceof Error ? error.message : String(error)
                        },
                        'Failed to resolve listing publication subscribe destination'
                    );
                    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
                }
                if (destination.destination === 'NO_PLANS_AVAILABLE')
                    throw new ServiceError(ServiceErrorCode.FORBIDDEN, NO_PLANS_AVAILABLE_MESSAGE);
                throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'subscription_required');
            }
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
