import { ServiceErrorCode } from '@repo/schemas';
import { resolvePersonStateStep } from '@repo/verticals';
import type { MiddlewareHandler } from 'hono';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createErrorResponse } from '../../../utils/response-helpers';

/** Applies person-state step 2 to accounts while allowing guests to submit. */
export function partnerApplicationPersonStateStep(): MiddlewareHandler {
    return async (c, next) => {
        const actor = getActorFromContext(c);
        if (isGuestActor(actor)) {
            await next();
            return;
        }
        const personState = resolvePersonStateStep({ emailVerified: actor.emailVerified });
        if (!personState.allowed) {
            auditLog({
                auditEvent: AuditEventType.ACCESS_DENIED,
                actorId: actor.id,
                actorRole: actor.roles.join(','),
                resource: c.req.path,
                method: c.req.method,
                statusCode: 403,
                reason: 'email_not_verified'
            });
            return createErrorResponse(
                {
                    code: ServiceErrorCode.EMAIL_NOT_VERIFIED,
                    message: 'Email verification required'
                },
                c,
                403
            );
        }
        await next();
    };
}
