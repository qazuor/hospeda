import type { AdministrativeAction } from './administrative-actions';
import type { StepOutcome } from './resource-step';

/** Step 3 compares accounts (V5 §3.2 rule 5); account identifiers are case-insensitive. */
export function resolveAdministrativeActionStep(args: {
    readonly action: AdministrativeAction;
    readonly actorId: string;
    readonly subjectId: string | null;
    readonly permitted: boolean;
    readonly isSystemActor: boolean;
}): StepOutcome<'FORBIDDEN'> {
    if (args.isSystemActor) return { allowed: false, reason: 'FORBIDDEN' };
    return !args.permitted ||
        (args.subjectId !== null && args.subjectId.toLowerCase() === args.actorId.toLowerCase())
        ? { allowed: false, reason: 'FORBIDDEN' }
        : { allowed: true };
}
