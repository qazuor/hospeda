/**
 * UserEditDirtyGuard — blocks navigation away from the user edit page when
 * the form has unsaved changes and prompts the user to confirm or cancel.
 *
 * Mounted as a sibling of `EntityEditContent` inside `EntityPageBase`, so it
 * has access to:
 * - `useEntityFormContext` (we are inside the EntityFormProvider).
 * - `useBlocker` from TanStack Router (we are inside a route).
 *
 * Covers all navigation attempts (tab links, sidebar nav, browser back),
 * not just the in-header tabs.
 */

import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useBlocker } from '@tanstack/react-router';

export function UserEditDirtyGuard() {
    const { hasUnsavedChanges } = useEntityFormContext();

    const { proceed, reset, status } = useBlocker({
        shouldBlockFn: () => hasUnsavedChanges(),
        withResolver: true
    });

    return (
        <AlertDialog open={status === 'blocked'}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
                    <AlertDialogDescription>
                        Tenés cambios en este usuario que todavía no guardaste. Si salís ahora los
                        vas a perder. ¿Querés salir igual o seguir editando?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => reset?.()}>Seguir editando</AlertDialogCancel>
                    <AlertDialogAction onClick={() => proceed?.()}>
                        Descartar y salir
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
