/**
 * @file EditorSaveBar.tsx
 * @description The save signal of a `bar` editor section (HOS-2487, spec
 * HOS-2415 §6.2, D8 «dos modelos de guardado»).
 *
 * One adapter from an editor form engine to the kit: it drives `useSaveBar`
 * and renders `StickySaveBar`, which is hidden while the form is clean and
 * otherwise offers «Guardar cambios», «Descartar» and, after a failed save,
 * «Ir al primer error». Ctrl/Cmd+S saves.
 *
 * The leave warning lives in `useSaveBar` (through the shared
 * `useUnsavedChangesGuard`), so a form engine that renders this must NOT
 * register its own guard: one warning per form.
 *
 * ## How a section plugs in
 *
 * Render it INSIDE the section's island, once, with the engine's dirty flag
 * and two callbacks:
 *
 * ```tsx
 * <EditorSaveBar
 *     locale={locale}
 *     isDirty={form.isDirty}
 *     onSave={form.save}        // () => Promise<SaveOutcome>
 *     onDiscard={form.discard}
 *     idPrefix={ACCOMMODATION_FIELD_PREFIX}
 *     suffixes={ACCOMMODATION_FIELD_ID_SUFFIXES}
 * />
 * ```
 *
 * `onSave` resolves `{ ok: true }`, or `{ ok: false, invalidFields }` so «Ir al
 * primer error» can focus the first invalid field.
 */

// Straight from the component files, not the kit index: this lives inside
// every bar section's island, and the index would pull the whole kit (and its
// logger) into it.
import { StickySaveBar } from '@/components/account/ui/StickySaveBar';
import { type SaveOutcome, useSaveBar } from '@/components/account/ui/use-save-bar';
import type { SupportedLocale } from '@/lib/i18n';

/** Props of {@link EditorSaveBar}. */
export interface EditorSaveBarProps {
    /** Locale for the bar copy. */
    readonly locale: SupportedLocale;
    /** Whether the form holds unsaved edits. */
    readonly isDirty: boolean;
    /** Persists the form. */
    readonly onSave: () => Promise<SaveOutcome>;
    /** Resets the form to its saved values. */
    readonly onDiscard: () => void;
    /** The editor's field id namespace, for «Ir al primer error». */
    readonly idPrefix?: string;
    /** The editor's sub-control suffix map, if any. */
    readonly suffixes?: Readonly<Record<string, string>>;
}

/**
 * The editor section save bar.
 *
 * @param props - See {@link EditorSaveBarProps}.
 * @returns The signal wrapper with the kit bar (empty while clean).
 */
export function EditorSaveBar({
    locale,
    isDirty,
    onSave,
    onDiscard,
    idPrefix,
    suffixes
}: EditorSaveBarProps) {
    const bar = useSaveBar({ locale, isDirty, onSave, onDiscard, idPrefix, suffixes });

    return (
        <div data-editor-save-signal="bar">
            <StickySaveBar
                status={bar.status}
                onSave={() => {
                    void bar.save();
                }}
                onDiscard={bar.discard}
                onGoToFirstError={idPrefix ? () => void bar.goToFirstError() : undefined}
                locale={locale}
            />
        </div>
    );
}
