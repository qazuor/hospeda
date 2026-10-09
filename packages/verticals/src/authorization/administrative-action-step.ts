import type { StepOutcome } from './resource-step';

/** Step 3 compares account IDs for an administrative action. */
export function resolveAdministrativeActionStep(args: {
    readonly actorId: string;
    readonly subjectId: string | null;
    readonly permitted: boolean;
}): StepOutcome<'FORBIDDEN'> {
    return !args.permitted || (args.subjectId !== null && args.subjectId === args.actorId)
        ? { allowed: false, reason: 'FORBIDDEN' }
        : { allowed: true };
}
