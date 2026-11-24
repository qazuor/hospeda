/**
 * useSaveBar — the state machine behind `StickySaveBar` (HOS-2413 T-026,
 * D8 «dos modelos de guardado»: explicit save).
 *
 * Statuses: `clean` (nothing to show), `dirty`, `saving`, `saved` (shown for a
 * moment, then back to `clean`) and `error`. It also:
 *
 * - saves on Ctrl/Cmd+S while there is something to save;
 * - warns before leaving ONLY through `useUnsavedChangesGuard`: no new
 *   `beforeunload` or click listener lives here;
 * - on a failed save, remembers the invalid field names so «Ir al primer
 *   error» can focus the first one with `focusFirstInvalidField`.
 *
 * @module components/account/ui/use-save-bar
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { focusFirstInvalidField } from '@/lib/forms/focus-first-invalid-field';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** How long «Cambios guardados» stays before the bar hides again. */
export const SAVED_VISIBLE_MS = 3000;

/** Status of a save bar. */
export type SaveBarStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * What an `onSave` reports back. A rejection counts as `{ ok: false }`.
 * `message` is the failure's own reason; the bar shows it instead of the
 * generic error line, and it is the only place a save failure is told (owner
 * decision 7, Mi cuenta UI epic).
 */
export type SaveOutcome =
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly invalidFields?: readonly string[];
          readonly message?: string;
      };

/** Options of {@link useSaveBar}. */
export interface UseSaveBarOptions {
    /** Locale for the leave-warning copy. */
    readonly locale: SupportedLocale;
    /** Whether the form holds unsaved edits. */
    readonly isDirty: boolean;
    /** Persists the form. */
    readonly onSave: () => Promise<SaveOutcome>;
    /** Resets the form to its saved values. */
    readonly onDiscard: () => void;
    /** The editor's id namespace for `focusFirstInvalidField` (e.g. `'acc'`). */
    readonly idPrefix?: string;
    /** The editor's shared sub-control suffix map, if any. */
    readonly suffixes?: Readonly<Record<string, string>>;
}

/** What {@link useSaveBar} returns. */
export interface UseSaveBarResult {
    /** Current status. */
    readonly status: SaveBarStatus;
    /** Runs the save (also bound to Ctrl/Cmd+S). */
    readonly save: () => Promise<void>;
    /** Discards the edits. */
    readonly discard: () => void;
    /** Focuses the first invalid field; `true` when one was found. */
    readonly goToFirstError: () => boolean;
    /** The last failed save's `message`, while the bar is in `error`. */
    readonly errorMessage: string | null;
}

/**
 * Drives a StickySaveBar.
 *
 * @param options - See {@link UseSaveBarOptions}.
 * @returns The status and the actions to hand to `StickySaveBar`.
 */
export function useSaveBar({
    locale,
    isDirty,
    onSave,
    onDiscard,
    idPrefix,
    suffixes
}: UseSaveBarOptions): UseSaveBarResult {
    const [phase, setPhase] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const invalidFields = useRef<readonly string[]>([]);
    const [failureMessage, setFailureMessage] = useState<string | null>(null);
    const t = createT(locale);

    const status: SaveBarStatus =
        phase === 'saving'
            ? 'saving'
            : phase === 'error'
              ? 'error'
              : isDirty
                ? 'dirty'
                : phase === 'saved'
                  ? 'saved'
                  : 'clean';

    // New edits after a save or an error put the bar back to `dirty`.
    useEffect(() => {
        if (isDirty && phase === 'saved') setPhase('idle');
    }, [isDirty, phase]);

    // An error belongs to the edits that caused it: once the form is pristine
    // again (discarded, or edited back) the bar must not keep saying it failed.
    useEffect(() => {
        if (!isDirty && phase === 'error') {
            invalidFields.current = [];
            setPhase('idle');
        }
    }, [isDirty, phase]);

    // «Cambios guardados» disappears on its own.
    useEffect(() => {
        if (phase !== 'saved') return;
        const timer = setTimeout(() => setPhase('idle'), SAVED_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [phase]);

    const save = useCallback(async () => {
        if (phase === 'saving') return;
        setPhase('saving');
        try {
            const outcome = await onSave();
            if (outcome.ok) {
                invalidFields.current = [];
                setFailureMessage(null);
                setPhase('saved');
            } else {
                invalidFields.current = outcome.invalidFields ?? [];
                setFailureMessage(outcome.message ?? null);
                setPhase('error');
            }
        } catch {
            invalidFields.current = [];
            setFailureMessage(null);
            setPhase('error');
        }
    }, [onSave, phase]);

    const discard = useCallback(() => {
        invalidFields.current = [];
        setPhase('idle');
        onDiscard();
    }, [onDiscard]);

    const goToFirstError = useCallback(
        () =>
            idPrefix
                ? focusFirstInvalidField({
                      fieldNames: invalidFields.current,
                      prefix: idPrefix,
                      suffixes
                  })
                : false,
        [idPrefix, suffixes]
    );

    // Ctrl/Cmd+S saves while there is something to save.
    useEffect(() => {
        if (status !== 'dirty' && status !== 'error') return;
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                event.preventDefault();
                void save();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [status, save]);

    // The ONLY leave warning: the shared guard.
    useUnsavedChangesGuard({
        isDirty: status === 'dirty' || status === 'saving' || status === 'error',
        message: t('account.ui.saveBar.leaveMessage'),
        title: t('common.confirmations.unsavedChanges.title'),
        confirmLabel: t('common.confirmations.unsavedChanges.confirm'),
        cancelLabel: t('common.confirmations.unsavedChanges.cancel'),
        locale
    });

    return {
        status,
        save,
        discard,
        goToFirstError,
        errorMessage: status === 'error' ? failureMessage : null
    };
}
