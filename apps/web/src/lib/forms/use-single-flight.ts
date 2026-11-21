/**
 * @file use-single-flight.ts
 * @description Ignores a second trigger while the first is still running
 * (HOS-2429). The confirmation dialogs are asynchronous: a double-click on
 * "Remove" would otherwise open two dialogs, and confirming both would fire two
 * deletes for the same row.
 */

import { useCallback, useRef } from 'react';

/**
 * Returns a runner that executes `task` only when no previous task from the same
 * component is still pending.
 *
 * @returns `run(task)`: resolves with the task's result, or `undefined` when it
 * was ignored because another run was in flight. Use a result that cannot be
 * `undefined` for the real outcome (e.g. a boolean) to tell the two apart.
 */
export function useSingleFlight(): <T>(task: () => Promise<T>) => Promise<T | undefined> {
    const pendingRef = useRef(false);
    return useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
        if (pendingRef.current) return undefined;
        pendingRef.current = true;
        try {
            return await task();
        } finally {
            pendingRef.current = false;
        }
    }, []);
}
