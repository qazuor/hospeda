import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, isSystemActor, ServiceError } from '@repo/service-core';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';

/**
 * Step 3 of administrative action 24 (ACC:24), run before any read (error
 * contract: permission 403 before existence 404). `permitted` comes ONLY from
 * this action's own permission, and the very same `action` goes to the resolver
 * (Coord-174, Coord-178): never a fixed `true`, never another action's permission.
 *
 * The subject is the account for the closure, and `null` for a partner
 * application made without an account (AC:V8a:12): that subject is identified by
 * the application's mailbox, so its `actor = subject` comparison runs later, by
 * mailbox, inside the replacement transaction (H15).
 *
 * @param input.actor - The acting admin.
 * @param input.subjectId - The account id, or `null` when the subject is not an account.
 * @throws {ServiceError} FORBIDDEN for a system actor, an actor without
 *   `USER_CLOSE_ON_REQUEST`, or an actor targeting its own account.
 */
export function assertAction24Step3(input: {
    readonly actor: Actor;
    readonly subjectId: string | null;
}): void {
    const action = 'ACC_24' as const;
    const permitted = isAdministrativeActionPermitted({
        action,
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action,
        actorId: input.actor.id,
        subjectId: input.subjectId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
}
