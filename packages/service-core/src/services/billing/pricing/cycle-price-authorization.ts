import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/** Administrative action 19, which owns cycle price changes. */
export const CYCLE_PRICE_ACTION = 'ACC_19' as const;

/** Closed list of cycle price rejection reasons. */
export const CYCLE_PRICE_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PLAN_VERSION_NOT_FOUND',
    'CYCLE_PRICE_BELOW_PROVIDER_MINIMUM',
    'CYCLE_NOT_LONGER_THAN_GRACE',
    'PLAN_VERSION_HAS_CUSTOMERS',
    'CYCLE_PRICE_CHANGED_SINCE_PREVIEW',
    'CYCLE_PRICE_UNCHANGED',
    'INVALID_CYCLE_PRICE_INPUT'
] as const;

/** A typed rejection from action 19. */
export type CyclePriceRejection = (typeof CYCLE_PRICE_REJECTIONS)[number];

/** Service error code for each action 19 rejection. */
export const REJECTION_CODES: Readonly<Record<CyclePriceRejection, ServiceErrorCode>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
    PLAN_VERSION_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    CYCLE_PRICE_BELOW_PROVIDER_MINIMUM: ServiceErrorCode.VALIDATION_ERROR,
    CYCLE_NOT_LONGER_THAN_GRACE: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_VERSION_HAS_CUSTOMERS: ServiceErrorCode.ALREADY_EXISTS,
    CYCLE_PRICE_CHANGED_SINCE_PREVIEW: ServiceErrorCode.ALREADY_EXISTS,
    CYCLE_PRICE_UNCHANGED: ServiceErrorCode.VALIDATION_ERROR,
    INVALID_CYCLE_PRICE_INPUT: ServiceErrorCode.VALIDATION_ERROR
};

/** Build a typed action 19 rejection without leaking query details. */
export function cyclePriceRejection(args: {
    readonly reason: CyclePriceRejection;
    readonly message: string;
}): ServiceError {
    return new ServiceError(REJECTION_CODES[args.reason], args.message, undefined, args.reason);
}

/** Fail closed before any database read when the actor cannot perform ACC_19. */
export function assertCyclePriceActionPermitted(args: { readonly actor?: Actor }): void {
    const actor = args.actor;
    if (
        !actor ||
        !Array.isArray(actor.permissions) ||
        isSystemActor(actor) ||
        !isAdministrativeActionPermitted({
            action: CYCLE_PRICE_ACTION,
            actorPermissions: actor.permissions
        })
    ) {
        throw cyclePriceRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
}

/** Map only owned write constraints, including errors wrapped by Drizzle. */
export function mapCyclePriceWriteError(args: { readonly error: unknown }): never {
    if (args.error instanceof ServiceError) throw args.error;
    const cause = extractPostgresErrorCause(args.error);
    if (cause?.code === '23505' && cause.constraint === 'uq_billing_option_version_cycle') {
        throw cyclePriceRejection({
            reason: 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW',
            message: 'El precio cambió desde la confirmación previa.'
        });
    }
    if (cause?.code === '23514' && cause.constraint?.startsWith('ck_billing_option_')) {
        throw cyclePriceRejection({
            reason: 'INVALID_CYCLE_PRICE_INPUT',
            message: 'El precio del ciclo no cumple las restricciones de la opción.'
        });
    }
    throw args.error;
}
