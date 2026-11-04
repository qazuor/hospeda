import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import {
    ACCOMMODATION_IMPORT_NEW_USER_MAX,
    getAccommodationImportAccessPorts
} from './accommodation-import-access-ports';

export interface AccommodationImportAccess {
    readonly allowed: boolean;
    readonly isNewUser: boolean;
    readonly hasEntitlement: boolean;
    readonly remainingNewUserImports: number | null;
    readonly reason?: 'entitlement' | 'new_user_cap';
}

/** Resolve the authoritative importer permission state for the API and create-flow UI. */
export async function getAccommodationImportAccess(
    userId: string
): Promise<AccommodationImportAccess> {
    const ports = getAccommodationImportAccessPorts();
    const hasEntitlement = await ports.hasImportEntitlement(userId);
    if (hasEntitlement) {
        return { allowed: true, isNewUser: false, hasEntitlement, remainingNewUserImports: null };
    }
    const [hadTrial, hadSubscription, hasPublishedAccommodation] = await Promise.all([
        ports.hasHadTrial(userId),
        ports.hasHadSubscription(userId),
        ports.hasPublishedAccommodation(userId)
    ]);
    const isNewUser = !hadTrial && !hadSubscription && !hasPublishedAccommodation;
    if (!isNewUser) {
        return {
            allowed: false,
            isNewUser,
            hasEntitlement,
            remainingNewUserImports: null,
            reason: 'entitlement'
        };
    }
    const used = await ports.countNewUserImports(userId);
    return {
        allowed: used < ACCOMMODATION_IMPORT_NEW_USER_MAX,
        isNewUser,
        hasEntitlement,
        remainingNewUserImports: Math.max(0, ACCOMMODATION_IMPORT_NEW_USER_MAX - used),
        ...(used >= ACCOMMODATION_IMPORT_NEW_USER_MAX ? { reason: 'new_user_cap' as const } : {})
    };
}

/** Enforce import access; new users consume one of their rolling-window slots. */
export async function requireAccommodationImportAccess(
    userId: string
): Promise<AccommodationImportAccess> {
    const access = await getAccommodationImportAccess(userId);
    if (access.hasEntitlement) return access;
    if (!access.isNewUser) {
        throw new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Entitlement required', {
            entitlementKey: 'ai_accommodation_import'
        });
    }
    if (!(await getAccommodationImportAccessPorts().consumeNewUserImport(userId))) {
        throw new HTTPException(429, { message: 'New-user import limit reached.' });
    }
    return access;
}
