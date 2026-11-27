import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { DynamicBlockConfigPanel } from './DynamicBlockConfigPanel';
import type { DynamicBlockEditInput } from './dynamic-block.extension';

/** Edits by stable key so document edits cannot invalidate a saved node position. */
export function DynamicBlockDialog({
    editor,
    selection,
    onClose
}: {
    readonly editor: Editor;
    readonly selection: DynamicBlockEditInput;
    readonly onClose: () => void;
}) {
    const { t } = useTranslations();
    const count = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            let total = 0;
            current.state.doc.forEach((node) => {
                if (node.type.name === 'dynamicBlock') total++;
            });
            return total;
        }
    });
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('admin-newsletter.dynamicBlock.edit')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-newsletter.dynamicBlock.description')}
                    </DialogDescription>
                </DialogHeader>
                <DynamicBlockConfigPanel
                    selection={selection}
                    dynamicBlockCount={count}
                    onSave={(input) => {
                        if (!editor.isEditable) return;
                        const transaction = editor.state.tr;
                        editor.state.doc.forEach((node, position) => {
                            if (
                                node.type.name === 'dynamicBlock' &&
                                node.attrs.blockKey === input.blockKey
                            ) {
                                transaction.setNodeMarkup(position, undefined, {
                                    ...node.attrs,
                                    config: JSON.stringify(input.config),
                                    ifBelowMinManual: input.ifBelowMinManual
                                });
                            }
                        });
                        editor.view.dispatch(transaction);
                        onClose();
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
