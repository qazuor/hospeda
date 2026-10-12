import { UserModel } from '@repo/db';
import { NO_PLANS_AVAILABLE_MESSAGE, ServiceErrorCode } from '@repo/schemas';
import {
    isSystemActor,
    runWithAdministrativeAuthorization,
    ServiceError
} from '@repo/service-core';
import {
    isAdministrativeActionPermitted,
    OPERATION_STEP6_KEY,
    resolveListingAccess
} from '@repo/verticals';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { setRequestContextActionReason } from '../lib/request-context';
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

/** Header carrying the "why" of an administrative action (ACC:15, H6). */
export const ACTION_REASON_HEADER = 'x-action-reason';

/** Upper bound of a decoded action reason, the same as action 23's body reason. */
const ACTION_REASON_MAX_LENGTH = 2000;

/**
 * Reads the optional `x-action-reason` header: UTF-8 percent-encoded, 1..2000
 * characters after `decodeURIComponent` and `trim`. Absent → `null`.
 *
 * @throws {ServiceError} VALIDATION_ERROR when present but malformed, blank or too long.
 */
function readActionReasonHeader({ ctx }: { readonly ctx: Context }): string | null {
    const raw = ctx.req.header(ACTION_REASON_HEADER);
    if (raw === undefined) return null;
    let decoded: string;
    try {
        decoded = decodeURIComponent(raw).trim();
    } catch {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Malformed action reason');
    }
    if (decoded.length === 0 || decoded.length > ACTION_REASON_MAX_LENGTH)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Invalid action reason');
    return decoded;
}

/**
 * The owner named by the body of a CREATE route that admits action 15 (H12),
 * or `null` when the route does not declare `createSubjectFromBody`, the field
 * is absent, or it names the actor (an own create runs as today).
 */
function readForeignCreateSubject(args: {
    readonly config: ListingAccessConfig;
    readonly body?: Record<string, unknown>;
    readonly actorId: string | null;
}): string | null {
    const { config, body, actorId } = args;
    if (config.operation !== 'CREATE' || !config.createSubjectFromBody) return null;
    const value = body?.[config.createSubjectFromBody];
    if (typeof value !== 'string' || value.length === 0 || value === actorId) return null;
    return value;
}

/**
 * Runs ONE content call of a route under the action-15 authorization its
 * listing-access chain granted (ACC:15, HOS-1493). The scope opens only when
 * step 3 ran and resolved a subject other than the actor; otherwise `run` runs
 * as is. Wrap only the route's own content service call — never a whole
 * handler nor several calls (coordinator decision, corrida 4).
 *
 * @param input.ctx - The request context after `enforceListingAccess`.
 * @param input.run - The single content service call.
 * @returns Whatever `run` returns.
 */
export function runListingContentCall<T>(input: {
    readonly ctx: Context;
    readonly run: () => Promise<T>;
}): Promise<T> {
    const { ctx, run } = input;
    const access = ctx.get('listingAccess');
    const actor = getActorFromContext(ctx);
    if (!access?.evaluatedSteps.includes(3) || !access.subjectId || access.subjectId === actor.id)
        return run();
    return runWithAdministrativeAuthorization({
        authorization: { action: 'ACC_15', subjectId: access.subjectId },
        run
    });
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
    // A route that declares its administrative action (ACC_23) is that action
    // even on the actor's own listing, so step 3 refuses actor = subject
    // instead of letting the owner path run it (AC:V8a:13 edge).
    // A CREATE on behalf of another owner (H12) is action 15 too: there is no
    // listing yet, so the subject comes from the validated body.
    const createSubjectId = readForeignCreateSubject({ config, body, actorId });
    // An own create on a route that admits action 15 runs as before the route
    // declared listing access, still demanding the route's own create permission
    // (the route gate is an OR with action 15's permission, so it is re-checked here).
    if (config.createSubjectFromBody && createSubjectId === null) {
        if (config.ownCreatePermission && !actor.permissions.includes(config.ownCreatePermission))
            throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
        return;
    }
    // Resolved only past the own-create exit: an own create never reads the
    // ports, so building them (and the real coverage reader) is not its cost.
    const ports = getListingAccessPorts();
    const { facts, ownerId } =
        config.operation === 'CREATE'
            ? { facts: null, ownerId: null }
            : await ports.loadFacts({ vertical: config.vertical, listingId });
    const isForeign =
        createSubjectId !== null ||
        (config.operation !== 'CREATE' &&
            facts !== null &&
            (actorId !== ownerId || config.administrativeAction !== undefined));
    // One source for the route's administrative action: the same value gates
    // the permission check and is handed to the resolver (AC:V8a:8, AC:V8a:9).
    const action = config.administrativeAction ?? 'ACC_15';
    const hasActionPermission = isAdministrativeActionPermitted({
        action,
        actorPermissions: actor.permissions
    });
    const adminAction = isForeign
        ? hasActionPermission
            ? { action, permitted: true, isSystemActor: isSystemActor(actor) }
            : tier === 'admin'
              ? { action, permitted: false, isSystemActor: isSystemActor(actor) }
              : undefined
        : undefined;
    if (adminAction?.permitted && createSubjectId !== null) {
        const owner = await new UserModel().findById(createSubjectId);
        if (!owner || owner.deletedAt) throw new HTTPException(404, { message: 'Owner not found' });
    }
    const subjectId = adminAction?.permitted ? (createSubjectId ?? ownerId) : actorId;
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
        createSubjectId,
        step6Key: config.step6Key,
        requiredKeys,
        limit,
        billing: ports.billing,
        effectiveSet: ports.effectiveSet
    });
    if (result.allowed) {
        // H6: the reason is recorded only once the administrative action is permitted.
        if (adminAction?.permitted) {
            const actionReason = readActionReasonHeader({ ctx });
            if (actionReason !== null) setRequestContextActionReason({ actionReason });
        }
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
