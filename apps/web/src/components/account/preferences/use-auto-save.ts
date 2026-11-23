/**
 * @file use-auto-save.ts
 * @description Drives one {@link AutoSaveChip} for a group of direct-action
 * controls (HOS-2479). Every control in the group runs its save through
 * `run`; the chip then says saving, saved or failed, and `retry` repeats the
 * last failed save.
 */

import { useCallback, useRef, useState } from 'react';
import type { AutoSaveStatus } from '../ui';

/** What {@link useAutoSave} returns. */
export interface UseAutoSaveResult {
    /** Chip status, or `null` before the first save. */
    readonly status: AutoSaveStatus | null;
    /** When the last successful save finished. */
    readonly savedAt: Date | undefined;
    /**
     * Runs a save, updating the chip. Resolves on success and REJECTS on
     * failure so a `SwitchRow` can revert.
     */
    readonly run: (input: { readonly save: () => Promise<void> }) => Promise<void>;
    /** Repeats the last failed save. */
    readonly retry: () => void;
}

/**
 * Autosave chip state for one section.
 *
 * @returns See {@link UseAutoSaveResult}.
 */
export function useAutoSave(): UseAutoSaveResult {
    const [status, setStatus] = useState<AutoSaveStatus | null>(null);
    const [savedAt, setSavedAt] = useState<Date | undefined>(undefined);
    const lastSaveRef = useRef<(() => Promise<void>) | null>(null);

    const run = useCallback(async ({ save }: { readonly save: () => Promise<void> }) => {
        lastSaveRef.current = save;
        setStatus('saving');
        try {
            await save();
            setSavedAt(new Date());
            setStatus('saved');
        } catch (error) {
            setStatus('error');
            throw error;
        }
    }, []);

    const retry = useCallback(() => {
        const save = lastSaveRef.current;
        if (!save) return;
        void run({ save }).catch(() => undefined);
    }, [run]);

    return { status, savedAt, run, retry };
}
