import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/** Administrative action 20 owns addon product version publication. */
export const ADDON_VERSION_PUBLICATION_ACTION = 'ACC_20' as const;

/** Closed rejection catalog for administrative action 20. */
export const ADDON_VERSION_PUBLICATION_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'ADDON_PRODUCT_NOT_FOUND',
    'ADDON_VERSION_NOT_FOUND',
    'ADDON_VERSION_OF_ANOTHER_ADDON',
    'ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND',
    'ADDON_PRICE_BELOW_PROVIDER_MINIMUM',
    'ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM',
    'ADDON_PRODUCT_HAS_LIVE_INSTANCES',
    'ADDON_PRODUCT_CHANGED_SINCE_PREVIEW',
    'ADDON_PRODUCT_UNCHANGED',
    'INVALID_ADDON_VERSION_PUBLICATION_INPUT'
] as const;

/** One rejection reason for action 20. */
export type AddonVersionPublicationRejection =
    (typeof ADDON_VERSION_PUBLICATION_REJECTIONS)[number];

/** Service code for every action 20 rejection. */
export const REJECTION_CODES: Readonly<Record<AddonVersionPublicationRejection, ServiceErrorCode>> =
    {
        ADMINISTRATIVE_ACTION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
        ADDON_PRODUCT_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
        ADDON_VERSION_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
        ADDON_VERSION_OF_ANOTHER_ADDON: ServiceErrorCode.VALIDATION_ERROR,
        ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND: ServiceErrorCode.VALIDATION_ERROR,
        ADDON_PRICE_BELOW_PROVIDER_MINIMUM: ServiceErrorCode.VALIDATION_ERROR,
        ADDON_PRICE_ABOVE_PROVIDER_MAXIMUM: ServiceErrorCode.VALIDATION_ERROR,
        ADDON_PRODUCT_HAS_LIVE_INSTANCES: ServiceErrorCode.ALREADY_EXISTS,
        ADDON_PRODUCT_CHANGED_SINCE_PREVIEW: ServiceErrorCode.ALREADY_EXISTS,
        ADDON_PRODUCT_UNCHANGED: ServiceErrorCode.VALIDATION_ERROR,
        INVALID_ADDON_VERSION_PUBLICATION_INPUT: ServiceErrorCode.VALIDATION_ERROR
    };

/** Build an action 20 rejection without exposing persistence details. */
export function addonVersionPublicationRejection(args: {
    readonly reason: AddonVersionPublicationRejection;
    readonly message: string;
}): ServiceError {
    return new ServiceError(REJECTION_CODES[args.reason], args.message, undefined, args.reason);
}

/** Reject an unauthorized or system actor before any database read. */
export function assertAddonVersionPublicationPermitted(args: { readonly actor?: Actor }): void {
    const actor = args.actor;
    if (
        !actor ||
        !Array.isArray(actor.permissions) ||
        isSystemActor(actor) ||
        !isAdministrativeActionPermitted({
            action: ADDON_VERSION_PUBLICATION_ACTION,
            actorPermissions: actor.permissions
        })
    ) {
        throw addonVersionPublicationRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
}

/** Map only the two constraints owned by action 20; rethrow all other errors. */
export function mapAddonVersionPublicationWriteError(args: { readonly error: unknown }): never {
    if (args.error instanceof ServiceError) throw args.error;
    const cause = extractPostgresErrorCause(args.error);
    if (cause?.code === '23503' && cause.constraint === 'fk_addon_product_version_addon') {
        throw addonVersionPublicationRejection({
            reason: 'ADDON_VERSION_OF_ANOTHER_ADDON',
            message: 'The version belongs to another addon'
        });
    }
    if (
        cause?.code === '23514' &&
        cause.constraint === 'ck_addon_product_periodic_not_fixed_days'
    ) {
        throw addonVersionPublicationRejection({
            reason: 'ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND',
            message: 'The version is incompatible with the product charge kind'
        });
    }
    throw args.error;
}
