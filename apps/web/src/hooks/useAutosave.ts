/**
 * @file useAutosave.ts
 * @description React hook for autosaving form state with debounce and blur trigger.
 * Supports both POST (first save) and PATCH (subsequent saves) to the
 * protected accommodations endpoint. Retries once on failure after 5s.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for the useAutosave hook. */
export type UseAutosaveProps<T> = {
    /** Current form data to persist on every debounced change or manual trigger. */
    readonly formData: T;
    /**
     * ID of the accommodation being edited.
     * - `undefined` → first save issues a POST; the returned `id` is stored
     *   internally so subsequent saves use PATCH automatically.
     * - A string value → all saves use PATCH against that ID.
     */
    readonly accommodationId?: string;
    /**
     * Milliseconds to wait after the last `formData` change before firing a save.
     * Defaults to 30 000 (30 seconds).
     */
    readonly debounceMs?: number;
    /** Called after a successful save with the persisted accommodation ID. */
    readonly onSaveSuccess?: (result: { readonly id: string }) => void;
    /** Called after all retry attempts have been exhausted. */
    readonly onSaveError?: (error: Error) => void;
};

/** Result returned by the useAutosave hook. */
export type UseAutosaveResult = {
    /** Current save lifecycle status. */
    readonly saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    /** Timestamp of the last successful save, or `null` if none has occurred. */
    readonly lastSavedAt: Date | null;
    /**
     * Manually trigger a save immediately (bypassing the debounce timer).
     * Intended to be called on blur events so the form persists when the user
     * moves focus away.
     */
    readonly triggerSave: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 30_000;
const RETRY_DELAY_MS = 5_000;
const ACCOMMODATIONS_PATH = '/api/v1/protected/accommodations';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Autosave hook for the host property form.
 *
 * Behaviour:
 * 1. **Debounced autosave** – after `formData` changes, waits `debounceMs`
 *    (default 30s) before issuing a network request.
 * 2. **Blur trigger** – callers invoke `triggerSave()` to save immediately
 *    without waiting for the debounce timer.
 * 3. **First save** – when `accommodationId` is `undefined` (and no previous
 *    save has returned an ID), sends a `POST`. The returned `id` is stored
 *    internally; all subsequent saves use `PATCH` automatically.
 * 4. **Subsequent saves** – `PATCH /api/v1/protected/accommodations/{id}`.
 * 5. **Error handling** – on failure the hook sets `saveStatus: 'error'`,
 *    calls `onSaveError`, and schedules one automatic retry after 5s. If the
 *    retry also fails, the hook stays in `error` state.
 * 6. **Cleanup** – all pending timers are cleared on unmount.
 *
 * @param props - Hook configuration.
 * @returns Save status, last-saved timestamp, and manual trigger function.
 *
 * @example
 * ```tsx
 * const { saveStatus, lastSavedAt, triggerSave } = useAutosave({
 *   formData,
 *   accommodationId: existingId,
 *   onSaveSuccess: ({ id }) => setAccommodationId(id),
 *   onSaveError: (err) => console.error(err),
 * });
 * ```
 */
export const useAutosave = <T>(props: UseAutosaveProps<T>): UseAutosaveResult => {
    const {
        formData,
        accommodationId,
        debounceMs = DEFAULT_DEBOUNCE_MS,
        onSaveSuccess,
        onSaveError
    } = props;

    const [saveStatus, setSaveStatus] = useState<UseAutosaveResult['saveStatus']>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    // Mutable refs so closures always have access to the latest values without
    // re-subscribing effects.
    const resolvedIdRef = useRef<string | undefined>(accommodationId);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef(true);

    // Keep the resolved ID in sync when the caller provides one externally
    // (e.g. the parent receives it from onSaveSuccess and passes it back down).
    useEffect(() => {
        resolvedIdRef.current = accommodationId;
    }, [accommodationId]);

    // Track mount state for safe async state updates.
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ---------------------------------------------------------------------------
    // Core save function
    // ---------------------------------------------------------------------------

    const executeSave = useCallback(
        async (isRetry = false): Promise<void> => {
            if (!isMountedRef.current) return;

            setSaveStatus('saving');

            const currentId = resolvedIdRef.current;
            const isFirstSave = currentId === undefined;

            const url = isFirstSave ? ACCOMMODATIONS_PATH : `${ACCOMMODATIONS_PATH}/${currentId}`;
            const method = isFirstSave ? 'POST' : 'PATCH';

            try {
                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    throw new Error(`Save failed: HTTP ${response.status}`);
                }

                const body: unknown = await response.json().catch(() => ({}));
                const id = extractId(body, currentId);

                if (!isMountedRef.current) return;

                resolvedIdRef.current = id;
                setSaveStatus('saved');
                setLastSavedAt(new Date());
                onSaveSuccess?.({ id });
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));

                if (!isMountedRef.current) return;

                if (isRetry) {
                    // Retry also failed: stay in error state and notify caller.
                    setSaveStatus('error');
                    onSaveError?.(error);
                } else {
                    // First failure: schedule one automatic retry after 5 s.
                    setSaveStatus('error');
                    retryTimerRef.current = setTimeout(() => {
                        if (isMountedRef.current) {
                            void executeSave(true);
                        }
                    }, RETRY_DELAY_MS);
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [formData, onSaveSuccess, onSaveError]
    );

    // ---------------------------------------------------------------------------
    // Debounced autosave on formData changes
    // ---------------------------------------------------------------------------

    useEffect(() => {
        // Clear any pending debounce timer so only the latest change is acted on.
        if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            void executeSave();
        }, debounceMs);

        return () => {
            if (debounceTimerRef.current !== null) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [debounceMs, executeSave]);

    // ---------------------------------------------------------------------------
    // Cleanup on unmount
    // ---------------------------------------------------------------------------

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current !== null) {
                clearTimeout(debounceTimerRef.current);
            }
            if (retryTimerRef.current !== null) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, []);

    // ---------------------------------------------------------------------------
    // Manual trigger (blur)
    // ---------------------------------------------------------------------------

    const triggerSave = useCallback((): void => {
        // Cancel any pending debounce so we don't double-save.
        if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        void executeSave();
    }, [executeSave]);

    return { saveStatus, lastSavedAt, triggerSave };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the accommodation `id` from the API response body.
 * Falls back to the previously resolved ID if the body structure is unexpected.
 */
function extractId(body: unknown, fallbackId: string | undefined): string {
    if (body && typeof body === 'object') {
        // Handle { data: { id } } (service-core standard envelope)
        const asRecord = body as Record<string, unknown>;
        const data = asRecord.data;
        if (data && typeof data === 'object') {
            const id = (data as Record<string, unknown>).id;
            if (typeof id === 'string') return id;
        }
        // Handle flat { id }
        const id = asRecord.id;
        if (typeof id === 'string') return id;
    }

    if (fallbackId !== undefined) return fallbackId;

    throw new Error('Save response did not include an accommodation id');
}
