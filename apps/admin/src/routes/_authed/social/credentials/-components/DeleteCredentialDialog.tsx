/**
 * Delete social credential confirmation dialog (HOS-64 G-4, T-031).
 *
 * Mirrors `_authed/ai/credentials.tsx`'s `DeleteCredentialDialog`.
 */
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import {
    type SocialCredentialKey,
    getSocialCredentialKeyLabel,
    useDeleteSocialCredentialMutation
} from '@/features/social-credentials';
import { useToast } from '@/hooks/use-toast';
import { DeleteIcon, LoaderIcon } from '@repo/icons';
import { useState } from 'react';

/** Confirmation dialog for soft-deleting a social credential. */
export function DeleteCredentialDialog({
    credentialKey,
    currentLabel
}: {
    readonly credentialKey: SocialCredentialKey;
    readonly currentLabel: string | null;
}) {
    const { addToast } = useToast();
    const deleteMutation = useDeleteSocialCredentialMutation();
    const [open, setOpen] = useState(false);

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(credentialKey);
            addToast({
                title: 'Credencial eliminada',
                message: `La credencial de ${getSocialCredentialKeyLabel(credentialKey)} se eliminó.`,
                variant: 'success'
            });
            setOpen(false);
        } catch (err) {
            addToast({
                title: 'Error al eliminar',
                message: err instanceof Error ? err.message : 'No se pudo eliminar la credencial.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                >
                    <DeleteIcon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Eliminar credencial</DialogTitle>
                    <DialogDescription>
                        ¿Eliminar la credencial de {getSocialCredentialKeyLabel(credentialKey)}
                        {currentLabel ? ` ("${currentLabel}")` : ''}? Esta acción no se puede
                        deshacer.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={deleteMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
