/** Separator between the three parts of a dedup key. */
const DEDUP_SEPARATOR = '|';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Thrown when a dedup-key part is empty, malformed or contains the separator. */
export class EmailOutboxKeyError extends Error {
    constructor(field: string, reason: string) {
        super(`Invalid email outbox key part "${field}": ${reason}`);
        this.name = 'EmailOutboxKeyError';
    }
}

/**
 * Validates one key part and returns it trimmed.
 *
 * Validation is manual because `@repo/db` does not depend on zod; the inputs
 * are plain strings, so a Zod schema would add a dependency for three checks.
 */
function requirePart(field: string, value: string, forbidden: readonly string[] = []): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed.length === 0) throw new EmailOutboxKeyError(field, 'must not be empty');
    if (trimmed.includes(DEDUP_SEPARATOR)) {
        throw new EmailOutboxKeyError(field, `must not contain "${DEDUP_SEPARATOR}"`);
    }
    for (const char of forbidden) {
        if (trimmed.includes(char)) {
            throw new EmailOutboxKeyError(field, `must not contain "${char}"`);
        }
    }
    return trimmed;
}

/** Input of {@link buildScheduleOccurrence}. */
export interface ScheduleOccurrenceInput {
    /** Subject kind, e.g. `trial`, `sub`, `listing`. */
    readonly subjectKind: string;
    /** Subject id. */
    readonly subjectId: string;
    /** Milestone, e.g. `pre:-2d`. */
    readonly milestone: string;
    /** Target date the milestone points at, `YYYY-MM-DD`. NOT the job's clock. */
    readonly targetDate: string;
}

/** Input of {@link buildEventOccurrence}. */
export interface EventOccurrenceInput {
    /** Id of the domain event that caused the mail. */
    readonly eventId: string;
}

/** Input of {@link buildEmailDedupKey}. */
export interface EmailDedupKeyInput {
    /** Recipient reference: the user id when there is one, else the normalized address. */
    readonly recipient: string;
    /** Template identifier. */
    readonly template: string;
    /** Occurrence, built with {@link buildScheduleOccurrence} or {@link buildEventOccurrence}. */
    readonly occurrence: string;
}

/**
 * Occurrence of a SCHEDULE mail: subject, milestone and the CURRENT target
 * date of that milestone, e.g. `trial:<id>:pre:-2d:2026-10-04`.
 *
 * The target date is "which day the notice points at", never "when the job
 * evaluated it": the job clock must not enter the key, or a job running twice
 * in a day would send twice. And when the target date moves (a trial
 * extension, a renewal, a retention-clock reset) the new milestone has a
 * different occurrence and is enqueued.
 *
 * @param input - Subject, milestone and target date.
 * @returns The occurrence string.
 * @throws EmailOutboxKeyError when a part is empty, contains `|`, or the date is not `YYYY-MM-DD`.
 */
export function buildScheduleOccurrence(input: ScheduleOccurrenceInput): string {
    // ':' joins the parts below, so it is forbidden inside them or two different
    // inputs could produce the same occurrence. The milestone keeps its own ':'
    // (e.g. `pre:-2d`) because it is the last free-form part before the date.
    const subjectKind = requirePart('subjectKind', input.subjectKind, [':']);
    const subjectId = requirePart('subjectId', input.subjectId, [':']);
    const milestone = requirePart('milestone', input.milestone);
    const targetDate = requirePart('targetDate', input.targetDate);
    if (!DATE_PATTERN.test(targetDate)) {
        throw new EmailOutboxKeyError('targetDate', 'must be YYYY-MM-DD');
    }
    return `${subjectKind}:${subjectId}:${milestone}:${targetDate}`;
}

/**
 * Occurrence of an EVENT mail: the id of the domain event that caused it.
 *
 * @param input - The event id.
 * @returns The occurrence string.
 * @throws EmailOutboxKeyError when the id is empty or contains `|`.
 */
export function buildEventOccurrence(input: EventOccurrenceInput): string {
    return `event:${requirePart('eventId', input.eventId)}`;
}

/**
 * Computes the outbox dedup key `(recipient, template, occurrence)`.
 *
 * Pure and clock-free: call it BEFORE enqueueing. The recipient is compared
 * case-insensitively so an address cannot dodge the key by changing case.
 *
 * @param input - Recipient, template and occurrence.
 * @returns The dedup key.
 * @throws EmailOutboxKeyError when a part is empty or contains `|`.
 */
export function buildEmailDedupKey(input: EmailDedupKeyInput): string {
    const recipient = requirePart('recipient', input.recipient).toLowerCase();
    const template = requirePart('template', input.template);
    const occurrence = requirePart('occurrence', input.occurrence);
    return [recipient, template, occurrence].join(DEDUP_SEPARATOR);
}
