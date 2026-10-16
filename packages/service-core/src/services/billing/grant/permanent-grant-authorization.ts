import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted, resolveAdministrativeActionStep } from '@repo/verticals';
import type { Actor } from '../../../types';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/**
 * Shared ACC_2 authorization for permanent grant writes and the future
 * revocation service. Revocation must pass `s21Cause: 'GRANT_REVOKED'` to
 * orphanhood when it turns off addons covered by the grant.
 * @module services/billing/grant/permanent-grant-authorization
 */

/** ACC_2: the administrative action for complimentary permanent grants. */
export const PERMANENT_GRANT_ACTION = 'ACC_2' as const;

/** All typed rejection reasons produced by permanent grant acts. */
export const PERMANENT_GRANT_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'INVALID_PERMANENT_GRANT_INPUT',
    'PERMANENT_GRANT_NOT_FOUND',
    'PERMANENT_GRANT_NOT_LIVE',
    'PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED',
    'PERMANENT_GRANT_ALREADY_LIVE',
    'PERMANENT_GRANT_REFERENCE_NOT_FOUND',
    'PERMANENT_GRANT_FLOOR_NOT_CURRENT'
] as const;

/** A typed rejection reason of a permanent grant act. */
export type PermanentGrantRejection = (typeof PERMANENT_GRANT_REJECTIONS)[number];

const REJECTION_CODES: Readonly<Record<PermanentGrantRejection, ServiceErrorCode>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
    INVALID_PERMANENT_GRANT_INPUT: ServiceErrorCode.VALIDATION_ERROR,
    PERMANENT_GRANT_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    PERMANENT_GRANT_NOT_LIVE: ServiceErrorCode.VALIDATION_ERROR,
    PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED: ServiceErrorCode.ALREADY_EXISTS,
    PERMANENT_GRANT_ALREADY_LIVE: ServiceErrorCode.ALREADY_EXISTS,
    PERMANENT_GRANT_REFERENCE_NOT_FOUND: ServiceErrorCode.VALIDATION_ERROR,
    PERMANENT_GRANT_FLOOR_NOT_CURRENT: ServiceErrorCode.VALIDATION_ERROR
};

const LIVE_BENEFICIARY_CONSTRAINT = 'uq_permanent_grant_live_beneficiary';
const BENEFICIARY_USER_CONSTRAINT = 'permanent_grant_beneficiary_user_id_users_id_fk';
const VERTICAL_PLAN_CONSTRAINT = 'fk_permanent_grant_vertical_plan';
const VERTICAL_FLOOR_CONSTRAINT = 'fk_permanent_grant_vertical_floor';

/**
 * Construct a safe typed rejection without query details or raw input.
 * @param args Rejection reason and developer-facing message.
 * @returns The matching ServiceError.
 */
export function permanentGrantRejection(args: {
    readonly reason: PermanentGrantRejection;
    readonly message: string;
}): ServiceError {
    return new ServiceError(REJECTION_CODES[args.reason], args.message, undefined, args.reason);
}

/**
 * Check the ACC_2 permission before reading data or validating the request shape.
 * @param args Actor attempting the permanent grant action.
 * @throws {ServiceError} With ADMINISTRATIVE_ACTION_FORBIDDEN when permission is absent.
 */
export function assertPermanentGrantPermitted(args: { readonly actor?: Actor }): void {
    const actor = args.actor;
    if (
        !actor ||
        !Array.isArray(actor.permissions) ||
        !isAdministrativeActionPermitted({
            action: PERMANENT_GRANT_ACTION,
            actorPermissions: actor.permissions
        })
    ) {
        throw permanentGrantRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
}

/**
 * Apply ACC_2 step 3 against the actual subject, rejecting system and self actors.
 * @param args Actor and beneficiary read from the input or locked grant row.
 * @throws {ServiceError} With ADMINISTRATIVE_ACTION_FORBIDDEN when the step is denied.
 */
export function assertPermanentGrantSubject(args: {
    readonly actor?: Actor;
    readonly beneficiaryUserId: string;
}): void {
    const actor = args.actor;
    if (!actor || !Array.isArray(actor.permissions)) {
        throw permanentGrantRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
    const permitted = isAdministrativeActionPermitted({
        action: PERMANENT_GRANT_ACTION,
        actorPermissions: actor.permissions
    });
    const step = resolveAdministrativeActionStep({
        action: PERMANENT_GRANT_ACTION,
        actorId: actor.id,
        subjectId: args.beneficiaryUserId,
        permitted,
        isSystemActor: isSystemActor(actor)
    });
    if (!step.allowed)
        throw permanentGrantRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
}

/**
 * Map the known permanent grant uniqueness and reference violations safely.
 * @param args Error thrown by a database write.
 * @throws {ServiceError} For known constraints; otherwise rethrows the original error.
 */
export function mapPermanentGrantWriteError(args: { readonly error: unknown }): never {
    if (args.error instanceof ServiceError) throw args.error;
    const cause = extractPostgresErrorCause(args.error);
    if (cause?.code === '23505' && cause.constraint === LIVE_BENEFICIARY_CONSTRAINT)
        throw permanentGrantRejection({
            reason: 'PERMANENT_GRANT_ALREADY_LIVE',
            message: 'A live permanent grant already exists for this beneficiary'
        });
    if (
        cause?.code === '23503' &&
        [BENEFICIARY_USER_CONSTRAINT, VERTICAL_PLAN_CONSTRAINT, VERTICAL_FLOOR_CONSTRAINT].includes(
            cause.constraint ?? ''
        )
    )
        throw permanentGrantRejection({
            reason: 'PERMANENT_GRANT_REFERENCE_NOT_FOUND',
            message: 'Permanent grant reference not found'
        });
    throw args.error;
}
