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
    if (hasEntitlement) {
        return {
            aiEntitlementAllowed: true,
            isNewUser: false,
            hasEntitlement: true,
            remainingNewUserImports: null
        };
    }
    const [hadTrial, hadSubscription, hasPublishedAccommodation] = await Promise.all([
        ports.hasHadTrial(input),
        ports.hasHadSubscription(input),
        ports.hasPublishedAccommodation(input)
    ]);
    const isNewUser = !hadTrial && !hadSubscription && !hasPublishedAccommodation;
    if (!isNewUser) {
        return {
            aiEntitlementAllowed: false,
            isNewUser,
            hasEntitlement,
            remainingNewUserImports: null,
            reason: 'entitlement'
        };
    }
    const used = await ports.countNewUserImports(input);
    return {
        aiEntitlementAllowed: used < ACCOMMODATION_IMPORT_NEW_USER_MAX,
        isNewUser,
        hasEntitlement,
        remainingNewUserImports: Math.max(0, ACCOMMODATION_IMPORT_NEW_USER_MAX - used),
        ...(used >= ACCOMMODATION_IMPORT_NEW_USER_MAX ? { reason: 'new_user_cap' as const } : {})
    };
}

/** Claim an AI import slot for a new user; a denied claim disables AI extraction (the route falls back to the structured import). */
export async function requireAccommodationImportAccess(input: {
    readonly userId: string;
    readonly hasEntitlement?: boolean;
}): Promise<AccommodationImportAccessResponse> {
    const access = await getAccommodationImportAccess(input);
    if (access.hasEntitlement || !access.isNewUser || !access.aiEntitlementAllowed) return access;
    const consumed = await getAccommodationImportAccessPorts().consumeNewUserImport(input);
    if (consumed)
        return {
            ...access,
            remainingNewUserImports: Math.max(0, (access.remainingNewUserImports ?? 1) - 1)
        };
    return {
        ...access,
        aiEntitlementAllowed: false,
        remainingNewUserImports: 0,
        reason: 'new_user_cap'
    };
}
