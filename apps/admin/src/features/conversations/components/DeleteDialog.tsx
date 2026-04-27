/**
 * DeleteDialog component.
 *
 * Shadcn AlertDialog for soft-deleting a conversation.
 * Only rendered when the current actor has CONVERSATION_DELETE_ANY permission.
 * Navigates to /conversations after successful deletion.
 */

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';
import { useDeleteConversationMutation } from '../hooks/useDeleteConversationMutation';

/** Props for DeleteDialog */
export interface DeleteDialogProps {
    /** Conversation ID to delete */
    conversationId: string;
    /** Callback after successful deletion (e.g., navigate away) */
    onSuccess?: () => void;
}

/**
 * Confirmation dialog for hard-soft-deleting a conversation.
 * Only renders when the user has CONVERSATION_DELETE_ANY permission.
 *
 * @param props - DeleteDialogProps
 */
export function DeleteDialog({ conversationId, onSuccess }: DeleteDialogProps) {
    const { t } = useTranslations();
    const canDelete = useHasPermission(PermissionEnum.CONVERSATION_DELETE_ANY);
    const [open, setOpen] = useState(false);
    const mutation = useDeleteConversationMutation();

    // Do not render at all without the delete permission
    if (!canDelete) return null;

    const handleConfirm = async () => {
        await mutation.mutateAsync(conversationId);
        setOpen(false);
        onSuccess?.();
    };

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
        >
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                >
                    {t('conversations.actions.deleteConversation')}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t('conversations.actions.deleteConversation')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('conversations.dialogs.deleteDescription')}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {mutation.isError && (
                    <p className="text-destructive text-sm">
                        {(mutation.error as Error)?.message ??
                            t('conversations.errors.deleteFailed')}
                    </p>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>{t('admin-entities.actions.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={mutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {t('admin-entities.actions.delete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
