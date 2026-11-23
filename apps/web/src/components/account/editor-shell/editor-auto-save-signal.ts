/**
 * @file editor-auto-save-signal.ts
 * @description The page-wide signal behind the editor's `AutoSaveChip`
 * (HOS-2487, spec HOS-2415 §6.2, D8 «dos modelos de guardado»).
 *
 * On an `auto` section the editor shell mounts ONE chip
 * (`EditorAutoSaveChip`, near the page title), but the saves happen inside
 * other islands (photo grid, FAQ list, calendar…). Islands are separate React
 * roots, so they cannot share context; they share this module instead (one
 * instance per page bundle).
 *
 * ## How a section reports a save
 *
 * Wrap the persisting call in {@link runEditorAutoSave}:
 *
 * ```ts
 * const ok = await runEditorAutoSave({
 *     save: async () => (await api.deletePhoto({ id })).ok,
 *     retry: () => removePhoto(id)
 * });
 * ```
 *
 * It reports `saving`, then `saved` (with the time) or `error` (with the retry
 * the chip offers). Or call {@link reportEditorAutoSave} directly when the save
 * does not fit a single promise. A `bar` section never reports here.
 */

import type { AutoSaveStatus } from '@/components/account/ui/AutoSaveChip';

/** The chip's current state; `idle` renders nothing. */
export type EditorAutoSaveState =
    | { readonly status: 'idle' }
    | {
          readonly status: AutoSaveStatus;
          /** When the last save finished (for `saved`). */
          readonly savedAt?: Date;
          /** Re-runs the failed action (for `error`). */
          readonly retry?: () => void;
      };

/** Listener of {@link subscribeEditorAutoSave}. */
type Listener = () => void;

const IDLE: EditorAutoSaveState = { status: 'idle' };

let state: EditorAutoSaveState = IDLE;
const listeners = new Set<Listener>();

/**
 * Publishes a new chip state to every subscriber.
 *
 * @param next - The state to show.
 */
export function reportEditorAutoSave(next: EditorAutoSaveState): void {
    state = next;
    for (const listener of listeners) listener();
}

/**
 * Reads the current chip state (for `useSyncExternalStore`).
 *
 * @returns The state.
 */
export function getEditorAutoSave(): EditorAutoSaveState {
    return state;
}

/**
 * The server snapshot: always idle, so the SSR markup has no chip text.
 *
 * @returns The idle state.
 */
export function getEditorAutoSaveServerSnapshot(): EditorAutoSaveState {
    return IDLE;
}

/**
 * Subscribes to chip state changes (for `useSyncExternalStore`).
 *
 * @param listener - Called after every report.
 * @returns The unsubscribe function.
 */
export function subscribeEditorAutoSave(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Runs one direct-action save and reports it to the chip.
 *
 * @param params - `save` persists and resolves `true` on success (a rejection
 * or `false` is a failure); `retry` is what the chip's «Reintentar» runs.
 * @returns Whether the save succeeded.
 */
export async function runEditorAutoSave({
    save,
    retry
}: {
    readonly save: () => Promise<boolean>;
    readonly retry?: () => void;
}): Promise<boolean> {
    reportEditorAutoSave({ status: 'saving' });
    let ok = false;
    try {
        ok = await save();
    } catch {
        ok = false;
    }
    reportEditorAutoSave(
        ok ? { status: 'saved', savedAt: new Date() } : { status: 'error', retry }
    );
    return ok;
}

/** Test-only reset to idle with no listeners. */
export function __resetEditorAutoSave(): void {
    state = IDLE;
    listeners.clear();
}
