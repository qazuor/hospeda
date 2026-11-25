/**
 * @file EditorAutoSaveChip.client.tsx
 * @description Shared editor status chip. Bar sections start clean during SSR;
 * auto sections remain idle until an action reports its state.
 *
 * It renders the kit `AutoSaveChip` for whatever the section's islands report
 * through `editor-auto-save-signal` (`runEditorAutoSave` /
 * `reportEditorAutoSave`), and nothing while idle. The wrapper is always in the
 * markup with `data-editor-save-signal`, so a render test can tell which
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
    /** Persistence model; changes the wrapper and the initial presentation only. */
    readonly saveModel?: 'auto' | 'bar';
}

/**
 * The shell's autosave chip.
 *
 * @param props - See {@link EditorAutoSaveChipProps}.
 * @returns The signal wrapper, with the chip once a save was reported.
 */
export function EditorAutoSaveChip({ locale, saveModel = 'auto' }: EditorAutoSaveChipProps) {
    const state = useSyncExternalStore(
        subscribeEditorAutoSave,
        getEditorAutoSave,
        getEditorAutoSaveServerSnapshot
    );
    const status = state.status === 'idle' && saveModel === 'bar' ? 'clean' : state.status;

    return (
        <span data-editor-save-signal={saveModel}>
            {status === 'idle' ? null : (
                <AutoSaveChip
                    status={status}
                    savedAt={state.status === 'idle' ? undefined : state.savedAt}
                    onRetry={state.status === 'idle' ? undefined : state.retry}
                    locale={locale}
                />
            )}
        </span>
    );
}
