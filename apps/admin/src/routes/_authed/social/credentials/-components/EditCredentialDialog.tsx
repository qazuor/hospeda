/**
 * Edit social credential metadata dialog (HOS-64 G-4, T-031).
 *
 * Mirrors `_authed/ai/credentials.tsx`'s `EditCredentialDialog`, scoped to
 * the only mutable metadata field the social vault has: `label`. Never
 * touches the encrypted secret.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    type SocialCredentialMasked,
    getSocialCredentialKeyLabel,
    useUpdateSocialCredentialMutation
} from '@/features/social-credentials';
import { useToast } from '@/hooks/use-toast';
import { EditIcon, LoaderIcon } from '@repo/icons';
import { useState } from 'react';

/** Dialog for editing a social credential's label metadata. */
export function EditCredentialDialog({
    credential
}: {
    readonly credential: SocialCredentialMasked;
}) {
    const { addToast } = useToast();
    const updateMutation = useUpdateSocialCredentialMutation();
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState('');

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            setLabel(credential.label ?? '');
        }
    };

    const handleSubmit = async () => {
        try {
            await updateMutation.mutateAsync({
                key: credential.key,
                payload: { label: label || undefined }
            });
            addToast({
                title: 'Credencial actualizada',
                message: `La etiqueta de ${getSocialCredentialKeyLabel(credential.key)} se actualizó.`,
                variant: 'success'
            });
            setOpen(false);
        } catch (err) {
            addToast({
                title: 'Error al actualizar',
                message: err instanceof Error ? err.message : 'No se pudo actualizar la etiqueta.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                >
                    <EditIcon className="mr-1 h-3.5 w-3.5" />
                    Editar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Editar — {getSocialCredentialKeyLabel(credential.key)}
                    </DialogTitle>
                    <DialogDescription>
                        Actualizá la etiqueta. El secreto no se modifica.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <Label htmlFor={`edit-social-credential-label-${credential.key}`}>
                        Etiqueta
                    </Label>
                    <Input
                        id={`edit-social-credential-label-${credential.key}`}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Mi webhook de producción"
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={updateMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
