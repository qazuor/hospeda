import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { useCreateOwnTag } from '@/hooks/use-own-tags';
import type { TagCreateInput } from '@repo/schemas';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { OwnTagForm } from './OwnTagForm';

interface CreateOwnTagDialogProps {
    /** Element that triggers the dialog (e.g. a "+ Crear tag personal" button). */
    readonly trigger: ReactNode;
    /** Called after successful creation. */
    readonly onCreated?: () => void;
    /** Whether the user has reached their tag quota. */
    readonly isAtQuota?: boolean;
}

/**
 * Modal dialog for creating a new own USER tag.
 *
 * Wraps `OwnTagForm` in a Dialog. The dialog is disabled when the user
 * has reached their personal tag quota (isAtQuota=true).
 *
 * The API injects `type=USER` and `ownerId` from the authenticated session
 * on the server side — the form does not send those fields.
 *
 * @see AC-003-01, AC-003-02, US-003, D-002
 * @see SPEC-086 T-032
 */
export function CreateOwnTagDialog({
    trigger,
    onCreated,
    isAtQuota = false
}: CreateOwnTagDialogProps) {
    const [open, setOpen] = useState(false);
    const { mutateAsync, isPending } = useCreateOwnTag();

    async function handleSubmit(values: Omit<TagCreateInput, 'type' | 'ownerId'>) {
        await mutateAsync(values);
        setOpen(false);
        onCreated?.();
    }

    if (isAtQuota) {
        return (
            <Button
                type="button"
                disabled
                title="Alcanzaste el límite de tags personales"
                aria-disabled="true"
            >
                {trigger}
            </Button>
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent
                className="sm:max-w-md"
                aria-labelledby="create-own-tag-title"
            >
                <DialogHeader>
                    <DialogTitle id="create-own-tag-title">Crear tag personal</DialogTitle>
                    <DialogDescription>
                        Los tags personales son privados y solo vos podés verlos.
                    </DialogDescription>
                </DialogHeader>
                <OwnTagForm
                    mode="create"
                    onSubmit={handleSubmit}
                    isSubmitting={isPending}
                />
            </DialogContent>
        </Dialog>
    );
}
