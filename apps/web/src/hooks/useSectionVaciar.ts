/**
 * @file useSectionVaciar.ts
 * @description Confirmation state for the "Vaciar" action of a `locked`
 * listing section (HOS-1854, DEC-FAC-025 / DEC-FAC-041).
 *
 * Emptying a section is the ONE write a locked section allows: it removes data,
 * it does not build anything, and the API classifies an empty replacement
 * payload as `delete` for exactly this reason. The dialog is shared by the
 * three venue section managers so the confirm is the app's own dialog
 * (`check:no-native-dialogs` forbids `window.confirm`) and the in-flight state
 * disables every close path while the request runs.
 *
 * The hook owns only the interaction state. What "vaciar" means for a section
 * stays with the manager that knows its payload shape — the carta also has an
 * uploaded file and the specials/events do not.
 */

import { useCallback, useState } from 'react';

/** The interaction state {@link useSectionVaciar} exposes. */
export interface SectionVaciarState {
    /** Whether the confirmation dialog is open. */
    readonly isDialogOpen: boolean;
    /** Whether the clear request is in flight. */
    readonly isBusy: boolean;
    /** Opens the confirmation dialog. */
    readonly request: () => void;
    /** Runs the clear request after the owner confirms. */
    readonly confirm: () => void;
    /** Dismisses the dialog without clearing. */
    readonly cancel: () => void;
}

/**
 * Owns the confirmation dialog for one section's "Vaciar" action.
 *
 * @param params.clear - Performs the section's clear request and resolves
 *   `true` only when it succeeded. The manager sets its own messages.
 * @param params.onCleared - Runs after a successful clear, so the manager can
 *   reset its local draft state.
 * @returns The state {@link SectionVaciarState} the panel renders.
 */
export function useSectionVaciar({
    clear,
    onCleared
}: {
    readonly clear: () => Promise<boolean>;
    readonly onCleared?: () => void;
}): SectionVaciarState {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    const request = useCallback(() => {
        setIsDialogOpen(true);
    }, []);

    const cancel = useCallback(() => {
        if (!isBusy) {
            setIsDialogOpen(false);
        }
    }, [isBusy]);

    const confirm = useCallback(() => {
        void (async () => {
            setIsBusy(true);
            const cleared = await clear();
            setIsBusy(false);
            if (cleared) {
                setIsDialogOpen(false);
                onCleared?.();
            }
        })();
    }, [clear, onCleared]);

    return { isDialogOpen, isBusy, request, confirm, cancel };
}
