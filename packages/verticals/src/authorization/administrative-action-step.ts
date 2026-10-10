import type { AdministrativeAction } from './administrative-actions';
import type { StepOutcome } from './resource-step';

/** Step 3 is the second layer of V5.md §3.3: a system actor executes none of the 25 NUCLEO/08 §3 actions. */
export function resolveAdministrativeActionStep(args: {
    readonly action: AdministrativeAction;
    readonly actorId: string;
    readonly subjectId: string | null;
    readonly permitted: boolean;
    readonly isSystemActor: boolean;
}): StepOutcome<'FORBIDDEN'> {
    if (args.isSystemActor) return { allowed: false, reason: 'FORBIDDEN' };
    return !args.permitted || (args.subjectId !== null && args.subjectId === args.actorId)
        ? { allowed: false, reason: 'FORBIDDEN' }
        : { allowed: true };
}
