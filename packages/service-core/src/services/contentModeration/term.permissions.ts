import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

function assertPermission(actor: Actor, permission: PermissionEnum, message: string): void {
    if (!actor || !actor.id || !actor.permissions.includes(permission)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, message);
    }
}

export function checkCanCreateTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_CREATE,
        'Permission denied: Insufficient permissions to create moderation terms'
    );
}

export function checkCanUpdateTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_UPDATE,
        'Permission denied: Insufficient permissions to update moderation terms'
    );
}

export function checkCanDeleteTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_DELETE,
        'Permission denied: Insufficient permissions to delete moderation terms'
    );
}

export function checkCanRestoreTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_RESTORE,
        'Permission denied: Insufficient permissions to restore moderation terms'
    );
}

export function checkCanHardDeleteTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_HARD_DELETE,
        'Permission denied: Insufficient permissions to hard delete moderation terms'
    );
}

export function checkCanViewTerm(actor: Actor): void {
    assertPermission(
        actor,
        PermissionEnum.MODERATION_TERM_VIEW,
        'Permission denied: Insufficient permissions to view moderation terms'
    );
}
