/**
 * @file EditorAutoSaveChip.client.tsx
 * @description The save signal of an `auto` editor section (HOS-2487, spec
 * HOS-2415 §6.2). The editor shell mounts it once, next to the page title,
 * only when the registry says the section saves `auto`.
 *
 * It renders the kit `AutoSaveChip` for whatever the section's islands report
 * through `editor-auto-save-signal` (`runEditorAutoSave` /
 * `reportEditorAutoSave`), and nothing while idle. The wrapper is always in the
 * markup with `data-editor-save-signal="auto"`, so a render test can tell which
 * signal a page carries.
 */

import { useSyncExternalStore } from 'react';
// From the component file, not the kit index (which would pull the whole kit
// into this small island).
import { AutoSaveChip } from '@/components/account/ui/AutoSaveChip';
import type { SupportedLocale } from '@/lib/i18n';
import {
    getEditorAutoSave,
    getEditorAutoSaveServerSnapshot,
    subscribeEditorAutoSave
} from './editor-auto-save-signal';

/** Props of {@link EditorAutoSaveChip}. */
export interface EditorAutoSaveChipProps {
    /** Locale for the chip copy. */
    readonly locale: SupportedLocale;
}

/**
 * The shell's autosave chip.
 *
 * @param props - See {@link EditorAutoSaveChipProps}.
 * @returns The signal wrapper, with the chip once a save was reported.
 */
export function EditorAutoSaveChip({ locale }: EditorAutoSaveChipProps) {
    const state = useSyncExternalStore(
        subscribeEditorAutoSave,
        getEditorAutoSave,
        getEditorAutoSaveServerSnapshot
    );

    return (
        <span data-editor-save-signal="auto">
            {state.status === 'idle' ? null : (
                <AutoSaveChip
                    status={state.status}
                    savedAt={state.savedAt}
                    onRetry={state.retry}
                    locale={locale}
                />
            )}
        </span>
    );
}
