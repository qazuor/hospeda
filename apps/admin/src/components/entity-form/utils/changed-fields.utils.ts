/**
 * Change detection for the generic entity edit form.
 *
 * The edit form used to send every editable field on save. A support edit on a
 * listing that belongs to somebody else (action 15) only accepts content
 * fields, so an unchanged non-content field travelling along made the whole
 * save fail with 403. These helpers keep only what the user actually changed.
 */

/**
 * Error thrown by the save handler when nothing changed, so no request is sent.
 * The edit surface catches it and tells the user there is nothing to save.
 */
export class NoChangesToSaveError extends Error {
    constructor() {
        super('No changes to save');
        this.name = 'NoChangesToSaveError';
    }
}

/**
 * Type guard for {@link NoChangesToSaveError}.
 *
 * @param error - Any caught value.
 * @returns `true` when the save was skipped because nothing changed.
 */
export const isNoChangesToSaveError = (error: unknown): error is NoChangesToSaveError =>
    error instanceof NoChangesToSaveError;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date);

/**
 * Structural equality: primitives by value, dates by time, arrays item by item
 * in order, plain objects key by key (a key holding `undefined` counts as
 * absent). Never compares by reference.
 */
function isDeepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (a instanceof Date || b instanceof Date) {
        return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    }
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, index) => isDeepEqual(item, b[index]));
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of keys) {
            if (!isDeepEqual(a[key], b[key])) return false;
        }
        return true;
    }
    return false;
}

/** Input of {@link pickChangedFields}. */
export interface PickChangedFieldsInput {
    /** Editable field ids, dot-notation allowed (`location.city`). */
    readonly fieldIds: readonly string[];
    /** Reads a field's current value from the live form state. */
    readonly readCurrent: (fieldId: string) => unknown;
    /** Reads a field's value as the form was seeded. */
    readonly readInitial: (fieldId: string) => unknown;
}

/**
 * Keeps only the fields whose value changed since the form was seeded.
 *
 * Dot-notation fields are grouped by their root key (`location.city` and
 * `location.state` both belong to `location`): when any field of a group
 * changed, the whole group travels, so the server receives a complete nested
 * object instead of a fragment its schema may refuse. A field whose current
 * value is `undefined` never travels (same as before this change).
 *
 * @param input - See {@link PickChangedFieldsInput}.
 * @returns `{ changed }`, a flat map keyed by field id (empty when nothing changed).
 */
export function pickChangedFields(input: PickChangedFieldsInput): {
    readonly changed: Record<string, unknown>;
} {
    const { fieldIds, readCurrent, readInitial } = input;
    const uniqueIds = Array.from(new Set(fieldIds));
    const changedRoots = new Set<string>();

    for (const id of uniqueIds) {
        const current = readCurrent(id);
        if (current === undefined) continue;
        if (!isDeepEqual(current, readInitial(id))) {
            changedRoots.add(id.split('.')[0] ?? id);
        }
    }

    const changed: Record<string, unknown> = {};
    for (const id of uniqueIds) {
        if (!changedRoots.has(id.split('.')[0] ?? id)) continue;
        const current = readCurrent(id);
        if (current !== undefined) changed[id] = current;
    }
    return { changed };
}
