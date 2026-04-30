import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { useUpdateOwnTag } from '@/hooks/use-own-tags';
import type { Tag, TagUpdateInput } from '@repo/schemas';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { OwnTagForm } from './OwnTagForm';

interface EditOwnTagDialogProps {
    /** The tag to edit. */
    readonly tag: Tag;
    /** Element that triggers the dialog (e.g. an edit icon button). */
    readonly trigger: ReactNode;
    /** Called after successful update. */
    readonly onUpdated?: () => void;
}

/**
 * Modal dialog for editing an existing own USER tag.
 *
 * Wraps `OwnTagForm` in edit mode inside a Dialog.
 * Pre-populates form values from the provided `tag` object.
 *
 * @see US-003, D-002
 * @see SPEC-086 T-032
 */
export function EditOwnTagDialog({ tag, trigger, onUpdated }: EditOwnTagDialogProps) {
    const [open, setOpen] = useState(false);
    const { mutateAsync, isPending } = useUpdateOwnTag(tag.id);

    async function handleSubmit(values: TagUpdateInput) {
        await mutateAsync(values);
        setOpen(false);
        onUpdated?.();
    }

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent
                className="sm:max-w-md"
                aria-labelledby="edit-own-tag-title"
            >
                <DialogHeader>
                    <DialogTitle id="edit-own-tag-title">Editar tag personal</DialogTitle>
                    <DialogDescription>
                        Modificá el nombre, color o descripción de tu tag personal.
                    </DialogDescription>
                </DialogHeader>
                <OwnTagForm
                    mode="edit"
                    onSubmit={handleSubmit}
                    isSubmitting={isPending}
                    defaultValues={{
                        name: tag.name,
                        color: tag.color,
                        icon: tag.icon ?? '',
                        description: tag.description ?? '',
                        lifecycleState: tag.lifecycleState
                    }}
                />
            </DialogContent>
        </Dialog>
    );
}
