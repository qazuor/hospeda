/** Connect any explicit-save form to the shared header chip without a second dirty tracker. */
import { useEffect } from 'react';
import type { useSaveBar } from '@/components/account/ui/use-save-bar';
import { reportEditorAutoSave } from './editor-auto-save-signal';

export function useEditorSaveSignal({
    status,
    savedAt,
    save
}: ReturnType<typeof useSaveBar>): void {
    useEffect(() => {
        reportEditorAutoSave({
            status,
            savedAt: status === 'saved' ? savedAt : undefined,
            retry: status === 'error' ? () => void save() : undefined
        });
    }, [status, savedAt, save]);

    useEffect(() => () => reportEditorAutoSave({ status: 'idle' }), []);
}
