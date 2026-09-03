import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';
import { hasPermission } from '../../utils/permission';

/**
 * Permission gates for QR codes (HOS-981).
 *
 * PR 1 leaned on the existing `SETTINGS_MANAGE` because no admin route existed
 * yet, and a permission with nothing behind it is a `role_permission` row nobody
 * can explain later. PR 3 brought six routes and with them the reason to split:
 * under the borrowed gate, handing the QR manager to somebody in marketing also
 * hands them SEO defaults, system tags and everything else `SETTINGS_MANAGE`
 * opens.
 *
 * So the gates are now four verbs of their own. `platform.qrCode.view` covers
 * reading AND downloading — a download renders an existing row and writes
 * nothing — which is what makes "let them find and print a code, but not repoint
 * every sticker in the province" expressible at all.
 *
 * Both roles that held `SETTINGS_MANAGE` receive all four in the same release
 * (seed baseline plus data-migration `0084`), so nobody gains or loses access on
 * the day this ships. What changes is that the set became delegable on its own.
 */

/**
 * Asserts the actor holds `permission`.
 *
 * The absent-actor branch is separate from the missing-permission one only so
 * the log says which happened; both answer FORBIDDEN, because telling a caller
 * "you are not authenticated" apart from "you lack the permission" is a
 * distinction that only helps somebody probing.
 */
const assertPermission = (actor: Actor, permission: PermissionEnum, action: string): void => {
    if (!actor) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    }
    if (!hasPermission(actor, permission)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            `Permission denied to ${action} QR codes`
        );
    }
};

/**
 * Checks that the actor may READ QR codes — list, detail and download alike.
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor is absent or lacks the permission.
 */
export const checkCanViewQrCode = (actor: Actor): void => {
    assertPermission(actor, PermissionEnum.QR_CODE_VIEW, 'view');
};

/**
 * Checks that the actor may CREATE a QR code.
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor is absent or lacks the permission.
 */
export const checkCanCreateQrCode = (actor: Actor): void => {
    assertPermission(actor, PermissionEnum.QR_CODE_CREATE, 'create');
};

/**
 * Checks that the actor may UPDATE a QR code — above all, retarget it.
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor is absent or lacks the permission.
 */
export const checkCanUpdateQrCode = (actor: Actor): void => {
    assertPermission(actor, PermissionEnum.QR_CODE_UPDATE, 'update');
};

/**
 * Checks that the actor may DELETE — or restore — a QR code.
 *
 * Restore shares the delete gate rather than getting one of its own: undoing a
 * soft delete is the same authority as performing it, and a `restore` verb no
 * route ever demands would be dead letter.
 *
 * @param actor - The user or system performing the action.
 * @throws {ServiceError} FORBIDDEN when the actor is absent or lacks the permission.
 */
export const checkCanDeleteQrCode = (actor: Actor): void => {
    assertPermission(actor, PermissionEnum.QR_CODE_DELETE, 'delete');
};
