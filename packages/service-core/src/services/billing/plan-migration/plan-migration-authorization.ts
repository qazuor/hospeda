import { ServiceErrorCode } from '@repo/schemas';
import { isAdministrativeActionPermitted } from '@repo/verticals';
import type { Actor } from '../../../types/index.js';
import { ServiceError } from '../../../types/index.js';
import { isSystemActor } from '../../../utils/system-actor.js';

/** Administrative action 17 owns plan retirement migrations. */
export const PLAN_MIGRATION_ACTION = 'ACC_17' as const;
/** Closed set of action 17 rejection reasons. */
export const PLAN_MIGRATION_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'PLAN_VERSION_NOT_FOUND',
    'PLAN_MIGRATION_SOURCE_NOT_RETIRED',
    'PLAN_MIGRATION_TARGET_NOT_SELLABLE',
    'PLAN_MIGRATION_VERTICAL_MISMATCH',
    'PLAN_MIGRATION_SAME_VERSION',
    'PLAN_MIGRATION_EMPTY_COHORT',
    'PLAN_MIGRATION_COHORT_CHANGED',
    'INVALID_PLAN_MIGRATION_INPUT',
    'PLAN_MIGRATION_INCREASE_OTHER_PLAN',
    'PLAN_MIGRATION_INCREASE_SOURCE_CURRENT',
    'PLAN_MIGRATION_INCREASE_CYCLE_MISSING',
    'PLAN_MIGRATION_NOT_FOUND',
    'PLAN_MIGRATION_ALREADY_CANCELLED'
] as const;
/** One typed action 17 rejection. */
export type PlanMigrationRejection = (typeof PLAN_MIGRATION_REJECTIONS)[number];
/** Stable service error mapping for action 17. */
export const REJECTION_CODES: Readonly<Record<PlanMigrationRejection, ServiceErrorCode>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN: ServiceErrorCode.FORBIDDEN,
    PLAN_VERSION_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    PLAN_MIGRATION_SOURCE_NOT_RETIRED: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_TARGET_NOT_SELLABLE: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_VERTICAL_MISMATCH: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_SAME_VERSION: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_EMPTY_COHORT: ServiceErrorCode.ALREADY_EXISTS,
    PLAN_MIGRATION_COHORT_CHANGED: ServiceErrorCode.ALREADY_EXISTS,
    INVALID_PLAN_MIGRATION_INPUT: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_INCREASE_OTHER_PLAN: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_INCREASE_SOURCE_CURRENT: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_INCREASE_CYCLE_MISSING: ServiceErrorCode.VALIDATION_ERROR,
    PLAN_MIGRATION_NOT_FOUND: ServiceErrorCode.NOT_FOUND,
    PLAN_MIGRATION_ALREADY_CANCELLED: ServiceErrorCode.ALREADY_EXISTS
};

/** Build an action 17 rejection without leaking query details. */
export function planMigrationRejection(args: {
    readonly reason: PlanMigrationRejection;
    readonly message: string;
}): ServiceError {
    return new ServiceError(REJECTION_CODES[args.reason], args.message, undefined, args.reason);
}

/** Fail closed before any database read when the actor cannot perform ACC_17. */
export function assertPlanMigrationActionPermitted(args: { readonly actor?: Actor }): void {
    const actor = args.actor;
    if (
        !actor ||
        !Array.isArray(actor.permissions) ||
        isSystemActor(actor) ||
        !isAdministrativeActionPermitted({
            action: PLAN_MIGRATION_ACTION,
            actorPermissions: actor.permissions
        })
    ) {
        throw planMigrationRejection({
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN',
            message: 'Forbidden'
        });
    }
}
