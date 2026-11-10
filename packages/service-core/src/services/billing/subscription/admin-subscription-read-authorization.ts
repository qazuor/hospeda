import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { hasPermission } from '../../../utils/permission.js';

/** Require the existing subscription inspection permission for administrative reads. */
export function assertAdminSubscriptionReadPermitted(input: { readonly actor?: Actor }): void {
    if (!input.actor || !hasPermission(input.actor, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden');
    }
}
