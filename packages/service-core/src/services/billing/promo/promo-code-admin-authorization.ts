import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/** ACC_21: administrative action for creating and closing promotional codes. */
export const PROMO_CODE_ACTION = 'ACC_21' as const;

/** Rejection reasons for ACC_21 promotional code administration. */
export const PROMO_CODE_ADMIN_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PROMO_CODE_NOT_FOUND',
    'PROMO_CODE_ALREADY_EXISTS',
    'PROMO_CODE_ALREADY_CLOSED',
    'INVALID_PROMO_CODE_INPUT'
] as const;

/** A typed rejection reason produced by a promotional code admin act. */
export type PromoCodeAdminRejection = (typeof PROMO_CODE_ADMIN_REJECTIONS)[number];

const REJECTION_CODES: Readonly<Record<PromoCodeAdminRejection, ServiceErrorCode>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
    PROMO_CODE_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    PROMO_CODE_ALREADY_EXISTS: ServiceErrorCode.ALREADY_EXISTS,
    PROMO_CODE_ALREADY_CLOSED: ServiceErrorCode.ALREADY_EXISTS,
    INVALID_PROMO_CODE_INPUT: ServiceErrorCode.VALIDATION_ERROR
};

/** Construct a safe typed rejection without exposing raw query details. */
export function promoCodeAdminRejection(args: {
    readonly reason: PromoCodeAdminRejection;
    readonly message: string;
}): ServiceError {
    return new ServiceError(REJECTION_CODES[args.reason], args.message, undefined, args.reason);
}

/** Check ACC_21 permission and reject system actors before database access. */
export function assertPromoCodeActionPermitted(args: { readonly actor?: Actor }): void {
    const actor = args.actor;
    if (
        !actor ||
        !Array.isArray(actor.permissions) ||
        isSystemActor(actor) ||
        !isAdministrativeActionPermitted({
            action: PROMO_CODE_ACTION,
            actorPermissions: actor.permissions
        })
    ) {
        throw promoCodeAdminRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
}

/** Map only the promo-code constraints owned by ACC_21; rethrow all others. */
export function mapPromoCodeWriteError(args: { readonly error: unknown }): never {
    if (args.error instanceof ServiceError) throw args.error;
    const cause = extractPostgresErrorCause(args.error);
    if (cause?.code === '23505' && cause.constraint === 'uq_promo_code_code') {
        throw promoCodeAdminRejection({
            reason: 'PROMO_CODE_ALREADY_EXISTS',
            message: 'Promotional code already exists'
        });
    }
    if (cause?.code === '23514' && cause.constraint?.startsWith('ck_promo_code_')) {
        throw promoCodeAdminRejection({
            reason: 'INVALID_PROMO_CODE_INPUT',
            message: 'Promotional code input violates a database constraint'
        });
    }
    throw args.error;
}
