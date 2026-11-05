import type { AccommodationImportAccessResponse } from '@repo/schemas';
import {
    ACCOMMODATION_IMPORT_NEW_USER_MAX,
    getAccommodationImportAccessPorts
} from './accommodation-import-access-ports';

/** Resolve the authoritative importer permission state for the API and create-flow UI. */
export async function getAccommodationImportAccess(input: {
    readonly userId: string;
    readonly hasEntitlement?: boolean;
}): Promise<AccommodationImportAccessResponse> {
    const ports = getAccommodationImportAccessPorts();
    const hasEntitlement = input.hasEntitlement ?? (await ports.hasImportEntitlement(input));
    const [hadTrial, hadSubscription, hasPublishedAccommodation] = await Promise.all([
        ports.hasHadTrial(input),
        ports.hasHadSubscription(input),
        ports.hasPublishedAccommodation(input)
    ]);
    const isNewUser = !hadTrial && !hadSubscription && !hasPublishedAccommodation;
    if (hasEntitlement) {
        return { allowed: true, isNewUser, hasEntitlement, remainingNewUserImports: null };
    }
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

/** Claim an AI import slot for a new user; denial falls back to structured import. */
export async function requireAccommodationImportAccess(input: {
    readonly userId: string;
    readonly hasEntitlement?: boolean;
}): Promise<AccommodationImportAccessResponse> {
    const access = await getAccommodationImportAccess(input);
    if (access.hasEntitlement || !access.isNewUser || !access.allowed) return access;
    const consumed = await getAccommodationImportAccessPorts().consumeNewUserImport(input);
    if (consumed) return access;
    return { ...access, allowed: false, remainingNewUserImports: 0, reason: 'new_user_cap' };
}
