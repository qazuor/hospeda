import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/** The resolved authority or stable denial reason for an S11 request. */
export type CancellationAuthority =
    | { readonly allowed: true; readonly as: 'OWNER' | 'ADMIN' }
    | { readonly allowed: false; readonly reason: 'FORBIDDEN' | 'NOT_VISIBLE' };

/**
 * Resolve S11 authority from identity and ACC_8 permission, without consulting roles.
 *
 * @param input.actor - The authenticated actor making the request
 * @param input.subjectUserId - Owner read under the subscription lock
 * @returns Owner/admin authority, forbidden for system actors, or hidden for strangers
 */
export function resolveCancellationAuthority(input: {
    readonly actor: Actor;
    readonly subjectUserId: string | null;
}): CancellationAuthority {
    if (isSystemActor(input.actor)) return { allowed: false, reason: 'FORBIDDEN' };
    if (input.actor.id === input.subjectUserId) return { allowed: true, as: 'OWNER' };
    const permitted = isAdministrativeActionPermitted({
        action: 'ACC_8',
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: 'ACC_8',
        actorId: input.actor.id,
        subjectId: input.subjectUserId,
        permitted,
        isSystemActor: false
    });
    return step.allowed
        ? { allowed: true, as: 'ADMIN' }
        : { allowed: false, reason: 'NOT_VISIBLE' };
}
