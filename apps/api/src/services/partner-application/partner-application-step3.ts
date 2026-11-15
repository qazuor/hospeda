import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, isSystemActor, ServiceError } from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';

/** Enforces step 3 of administrative action 5 before application data is read. */
export function assertAction5Step3({ actor }: { readonly actor: Actor }): void {
    const action = 'ACC_5' as const;
    const permitted = isAdministrativeActionPermitted({
        action,
        actorPermissions: actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action,
        actorId: actor.id,
        subjectId: null,
        permitted,
        isSystemActor: isSystemActor(actor)
    });
    if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
}
