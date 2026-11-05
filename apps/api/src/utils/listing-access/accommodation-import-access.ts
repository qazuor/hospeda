import { type AccommodationImportAccessResponse, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import {
    ACCOMMODATION_IMPORT_NEW_USER_MAX,
    getAccommodationImportAccessPorts
} from './accommodation-import-access-ports';
import { AI_ENTITLEMENT_KEY_BY_FEATURE } from './ai-quota-catalog';

/** Resolve the authoritative importer permission state for the API and create-flow UI. */
export async function getAccommodationImportAccess(input: {
    readonly userId: string;
}): Promise<AccommodationImportAccessResponse> {
    const ports = getAccommodationImportAccessPorts();
    const hasEntitlement = await ports.hasImportEntitlement(input);
    if (hasEntitlement) {
        return { allowed: true, isNewUser: false, hasEntitlement, remainingNewUserImports: null };
    }
    const [hadTrial, hadSubscription, hasPublishedAccommodation] = await Promise.all([
        ports.hasHadTrial(input),
        ports.hasHadSubscription(input),
        ports.hasPublishedAccommodation(input)
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
    const used = await ports.countNewUserImports(input);
    return {
        allowed: used < ACCOMMODATION_IMPORT_NEW_USER_MAX,
        isNewUser,
        hasEntitlement,
        remainingNewUserImports: Math.max(0, ACCOMMODATION_IMPORT_NEW_USER_MAX - used),
        ...(used >= ACCOMMODATION_IMPORT_NEW_USER_MAX ? { reason: 'new_user_cap' as const } : {})
    };
}

/** Enforce import access; new users consume one of their rolling-window slots. */
export async function requireAccommodationImportAccess(input: {
    readonly userId: string;
}): Promise<AccommodationImportAccessResponse> {
    const access = await getAccommodationImportAccess(input);
    if (access.hasEntitlement) return access;
    if (!access.isNewUser) {
        throw new ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED, 'Entitlement required', {
            entitlementKey: AI_ENTITLEMENT_KEY_BY_FEATURE.accommodation_import
        });
    }
    if (!(await getAccommodationImportAccessPorts().consumeNewUserImport(input))) {
        throw new HTTPException(429, { message: 'New-user import limit reached.' });
    }
    return access;
}
