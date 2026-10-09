import type { StepOutcome } from './resource-step';

/** The closed list available before email verification. */
export const EMAIL_UNVERIFIED_ALLOWED_OPERATIONS = [
    'VERIFY_EMAIL',
    'CHANGE_EMAIL',
    'READ_OWN',
    'EXPORT',
    'REACTIVATE_LISTING',
    'DELETE_LISTING',
    'REGULARIZE_CHARGE',
    'CLOSE_ACCOUNT'
] as const;
export type EmailUnverifiedAllowedOperation = (typeof EMAIL_UNVERIFIED_ALLOWED_OPERATIONS)[number];

/**
 * Step 2 runs before permissions and returns the same refusal regardless of them.
 * Unlike Actor.emailVerified's JSDoc, undefined passes: visitors, system actors
 * and hand-built route test actors omit the field. Real users have a NOT NULL
 * database column; undefined for one means its session omitted the boolean.
 */
export function resolvePersonStateStep(args: {
    readonly emailVerified: boolean | undefined;
    readonly operation?: EmailUnverifiedAllowedOperation;
    readonly hasPartnerLink?: boolean;
}): StepOutcome<'EMAIL_NOT_VERIFIED'> {
    if (args.emailVerified !== false) return { allowed: true };
    if (args.operation === 'CHANGE_EMAIL' && args.hasPartnerLink === true) {
        return { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
    }
    return args.operation !== undefined &&
        EMAIL_UNVERIFIED_ALLOWED_OPERATIONS.includes(args.operation)
        ? { allowed: true }
        : { allowed: false, reason: 'EMAIL_NOT_VERIFIED' };
}
