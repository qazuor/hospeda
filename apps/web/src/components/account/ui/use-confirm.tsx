/**
 * useConfirm — ask for a confirmation and await the answer (HOS-2413 T-013).
 *
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm({ locale });
 * const ok = await confirm({
 *     title: 'Eliminar carta',
 *     description: 'Se pierden las secciones y los platos.',
 *     confirmLabel: 'Eliminar carta'
 * });
 * // render {confirmDialog} once in the component tree
 * ```
 *
 * Resolves `true` once the confirm work finished, `false` on cancel, Escape or
 * scrim click. With `onConfirm` the dialog runs the (async) work itself: it
 * stays open on a rejection and the promise stays pending until the user
 * retries or cancels.
 *
 * Relation to `lib/forms/show-confirmation-dialog` (open decision, see the
 * PR): that helper is imperative and mounts its own React root, which the
 * leave-warning flow needs outside any component. `useConfirm` is declarative
 * and renders the kit ConfirmDialog. They coexist until the owner decides to
 * point the imperative helper at the kit dialog.
 *
 * @module components/account/ui/use-confirm
 */

import { type ReactNode, useCallback, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog';

/** What a `confirm()` call asks. */
export interface ConfirmRequest {
    /** Title: what is about to happen. */
    readonly title: ReactNode;
    /** Body: what will be lost or changed. */
    readonly description: ReactNode;
    /** Confirm label: verb + object. */
    readonly confirmLabel: string;
    /** Cancel label (defaults to the translated «Cancelar»). */
    readonly cancelLabel?: string;
    /** @default 'destructive' */
    readonly tone?: ConfirmTone;
    /** Work to run on confirm; a rejection keeps the dialog open. */
    readonly onConfirm?: () => void | Promise<void>;
}

/** Result of {@link useConfirm}. */
export interface UseConfirmResult {
    /** Opens the dialog and resolves with the answer. */
    readonly confirm: (request: ConfirmRequest) => Promise<boolean>;
    /** Render this once in the tree. */
    readonly confirmDialog: ReactNode;
}

/**
 * Imperative confirmation over the declarative kit dialog.
 *
 * @param input - Options object.
 * @param input.locale - Locale for the default copy.
 * @returns `{ confirm, confirmDialog }`.
 */
export function useConfirm({ locale }: { readonly locale: SupportedLocale }): UseConfirmResult {
    const [request, setRequest] = useState<ConfirmRequest | null>(null);
    const resolver = useRef<((answer: boolean) => void) | null>(null);

    const settle = useCallback((answer: boolean) => {
        resolver.current?.(answer);
        resolver.current = null;
        setRequest(null);
    }, []);

    const confirm = useCallback((next: ConfirmRequest) => {
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setRequest(next);
        });
    }, []);

    const confirmDialog = (
        <ConfirmDialog
            open={request !== null}
            title={request?.title}
            description={request?.description}
            confirmLabel={request?.confirmLabel ?? ''}
            cancelLabel={request?.cancelLabel}
            tone={request?.tone}
            locale={locale}
            onConfirm={async () => {
                await request?.onConfirm?.();
                settle(true);
            }}
            onCancel={() => settle(false)}
        />
    );

    return { confirm, confirmDialog };
}
