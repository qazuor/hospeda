/**
 * Rotate social credential dialog (HOS-64 G-4, T-030).
 *
 * Mirrors `_authed/ai/credentials.tsx`'s `RotateCredentialDialog`.
 */

import { LoaderIcon } from '@repo/icons';
import { useState } from 'react';
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
    getSocialCredentialKeyLabel,
    type SocialCredentialKey,
    useRotateSocialCredentialMutation
} from '@/features/social-credentials';
import { useToast } from '@/hooks/use-toast';

/** Dialog for rotating an existing social credential's secret. */
export function RotateCredentialDialog({
    credentialKey,
    currentLabel
}: {
    readonly credentialKey: SocialCredentialKey;
    readonly currentLabel: string | null;
}) {
    const { addToast } = useToast();
    const rotateMutation = useRotateSocialCredentialMutation();
    const [open, setOpen] = useState(false);
    const [newPlaintext, setNewPlaintext] = useState('');

    const handleSubmit = async () => {
        if (!newPlaintext.trim()) return;
        try {
            await rotateMutation.mutateAsync({
                key: credentialKey,
                payload: { newPlaintext }
            });
            addToast({
                title: 'Secreto rotado',
                message: `El secreto de ${getSocialCredentialKeyLabel(credentialKey)} se actualizó correctamente.`,
                variant: 'success'
            });
            setOpen(false);
            setNewPlaintext('');
        } catch (err) {
            addToast({
                title: 'Error al rotar',
                message: err instanceof Error ? err.message : 'No se pudo rotar el secreto.',
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
                    variant="outline"
                    size="sm"
                >
                    Rotar secreto
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Rotar secreto — {getSocialCredentialKeyLabel(credentialKey)}
                    </DialogTitle>
                    <DialogDescription>
                        {currentLabel
                            ? `Reemplaza el secreto actual de "${currentLabel}".`
                            : 'Reemplaza el secreto actual de esta credencial.'}
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <Label htmlFor={`rotate-social-credential-${credentialKey}`}>
                        Nuevo secreto
                    </Label>
                    <Input
                        id={`rotate-social-credential-${credentialKey}`}
                        type="password"
                        value={newPlaintext}
                        onChange={(e) => setNewPlaintext(e.target.value)}
                        placeholder="Pegá el nuevo valor secreto..."
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={rotateMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!newPlaintext.trim() || rotateMutation.isPending}
                    >
                        {rotateMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Rotar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
