import { UserModel } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import {
    isAdministrativeActionPermitted,
    resolveAdministrativeActionStep,
    resolveRoleAssignmentAction
} from '@repo/verticals';
import type { Actor, ServiceContext } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import { isSystemActor } from '../../utils/system-actor.js';
import { grantRole, revokeRole } from './user-role.service.js';

/** Input for assigning or removing the SUPER_ADMIN role via action 26. */
export interface ChangeSuperAdminRoleInput {
    readonly actor: Actor;
    readonly userId: string;
    readonly change: 'ASSIGN' | 'REMOVE';
    readonly reason?: string | null;
    readonly ctx?: ServiceContext;
}

/** Outcome of the underlying idempotent role mutation. */
export interface ChangeSuperAdminRoleOutcome {
    readonly changed: boolean;
}

/**
 * Assigns or removes SUPER_ADMIN through administrative action 26.
 * Step 3 is evaluated before input or subject reads; the primitive writes the
 * `user_role_audit` record in the same transaction as the role change.
 * @param input - Actor, subject, direction, mandatory reason, and optional transaction context.
 * @returns Whether the role relation changed.
 * @throws {ServiceError} FORBIDDEN, VALIDATION_ERROR, or NOT_FOUND in contract order.
 */
export async function changeSuperAdminRole(
    input: ChangeSuperAdminRoleInput
): Promise<ChangeSuperAdminRoleOutcome> {
    const action = resolveRoleAssignmentAction({ role: RoleEnum.SUPER_ADMIN });
    if (action === null)
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Action 26 unavailable');
    const permitted = isAdministrativeActionPermitted({
        action,
        actorPermissions: input.actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action,
        actorId: input.actor.id,
        subjectId: input.userId,
        permitted,
        isSystemActor: isSystemActor(input.actor)
    });
    if (!step.allowed) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');

    const reason = input.reason?.trim();
    if (!reason) throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason required');
    if (reason.length > 500)
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Reason too long');

    const user = await new UserModel().findById(input.userId, input.ctx?.tx);
    if (!user) throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'User not found');

    let result: Awaited<ReturnType<typeof grantRole>>;
    switch (input.change) {
        case 'ASSIGN':
            result = await grantRole({
                userId: input.userId,
                role: RoleEnum.SUPER_ADMIN,
                grantedBy: input.actor.id,
                reason,
                ctx: input.ctx
            });
            break;
        case 'REMOVE':
            result = await revokeRole({
                userId: input.userId,
                role: RoleEnum.SUPER_ADMIN,
                revokedBy: input.actor.id,
                reason,
                ctx: input.ctx
            });
            break;
        default: {
            const exhaustive: never = input.change;
            throw new Error(`Unsupported role change: ${exhaustive}`);
        }
    }

    if (result.error) {
        throw new ServiceError(
            result.error.code,
            result.error.message,
            undefined,
            result.error.reason
        );
    }
    return { changed: result.data?.changed ?? false };
}
