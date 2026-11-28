/**
 * Tag edits as a DIFF (HOS-2679 I2).
 *
 * The API replaces a code's whole tag set, but a form or a row editor holds a
 * selection it read some time ago — the list cache stays fresh for minutes. A
 * PUT of that selection would undo whatever another operator (or another tab)
 * changed meanwhile. So the panel keeps what the operator DID — the ids they
 * added and removed relative to what they opened — and applies it to the set
 * the server holds at save time.
 *
 * @module features/qr-codes/qr-code-tags.diff
 */

/** What an operator changed in a tag selection. */
export interface QrCodeTagDiff {
    readonly added: readonly string[];
    readonly removed: readonly string[];
}

/**
 * The operator's edit, relative to the selection they opened.
 *
 * @param input.before - The selection the editor opened with.
 * @param input.after - The selection being saved.
 * @returns Ids added and removed; both empty when nothing changed.
 */
export function diffTagSelection(input: {
    readonly before: readonly string[];
    readonly after: readonly string[];
}): QrCodeTagDiff {
    const before = new Set(input.before);
    const after = new Set(input.after);
    return {
        added: [...after].filter((id) => !before.has(id)),
        removed: [...before].filter((id) => !after.has(id))
    };
}

/**
 * Applies a diff to the set the server holds now.
 *
 * @param input.current - The server's set, read at save time.
 * @param input.diff - The operator's edit.
 * @returns The set to write, in `current` order then additions.
 */
export function applyTagDiff(input: {
    readonly current: readonly string[];
    readonly diff: QrCodeTagDiff;
}): readonly string[] {
    const removed = new Set(input.diff.removed);
    const kept = input.current.filter((id) => !removed.has(id));
    const present = new Set(kept);
    return [...kept, ...input.diff.added.filter((id) => !present.has(id))];
}

/** Whether a diff changes anything. */
export const isEmptyTagDiff = (diff: QrCodeTagDiff): boolean =>
    diff.added.length === 0 && diff.removed.length === 0;
