import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Permission gates for QR codes (HOS-981).
 *
 * These lean on the existing `SETTINGS_MANAGE` gate rather than introducing a
 * `QR_CODE_*` family. That is deliberate for PR 1: the admin surface that would
 * justify a dedicated permission arrives with the admin panel (PR 3), and a
 * permission with no route behind it is a row in `role_permission` nobody can
 * explain later. PR 3 introduces the narrower gate and this file moves to it.
 */

/**
 * Checks that the actor may manage QR codes (create, update, retire, restore, view).
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor is absent or lacks the permission.
 */
export const checkCanManageQrCode = (actor: Actor): void => {
    if (!actor) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }
    if (!hasPermission(actor, PermissionEnum.SETTINGS_MANAGE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Permission denied to manage QR codes');
    }
};
