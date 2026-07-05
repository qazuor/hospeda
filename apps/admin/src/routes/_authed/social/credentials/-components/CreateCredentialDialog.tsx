/**
 * Create social credential dialog (HOS-64 G-4, T-030).
 *
 * Mirrors `_authed/ai/credentials.tsx`'s `CreateCredentialDialog`: a
 * password-type input for the plaintext secret (never round-tripped back
 * from the server) and a `Select` restricted to the 4 fixed credential keys.
 */

import { AddIcon, LoaderIcon } from '@repo/icons';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    getSocialCredentialKeyLabel,
    SOCIAL_CREDENTIAL_KEY_LABELS,
    type SocialCredentialKey,
    useCreateSocialCredentialMutation
} from '@/features/social-credentials';
import { useToast } from '@/hooks/use-toast';

const SOCIAL_CREDENTIAL_KEYS = Object.keys(SOCIAL_CREDENTIAL_KEY_LABELS) as SocialCredentialKey[];

/** Dialog for creating a new social credential. */
export function CreateCredentialDialog() {
    const { addToast } = useToast();
    const createMutation = useCreateSocialCredentialMutation();
    const [open, setOpen] = useState(false);
    const [key, setKey] = useState<SocialCredentialKey | ''>('');
    const [plaintext, setPlaintext] = useState('');
    const [label, setLabel] = useState('');

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setKey('');
            setPlaintext('');
            setLabel('');
        }
    };

    const isValid = key !== '' && plaintext.trim().length > 0;

    const handleSubmit = async () => {
        if (key === '') return;
        if (!plaintext.trim()) return;
        try {
            await createMutation.mutateAsync({
                key,
                plaintext,
                label: label || undefined
            });
            addToast({
                title: 'Credencial creada',
                message: `La credencial de ${getSocialCredentialKeyLabel(key)} se creó correctamente.`,
                variant: 'success'
            });
            handleOpenChange(false);
        } catch (err) {
            addToast({
                title: 'Error al crear',
                message: err instanceof Error ? err.message : 'No se pudo crear la credencial.',
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
                <Button>
                    <AddIcon className="mr-2 h-4 w-4" />
                    Agregar credencial
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Agregar credencial social</DialogTitle>
                    <DialogDescription>
                        Seleccioná la clave y pegá el secreto. No se puede recuperar una vez
                        guardado.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <Label>Clave</Label>
                        <Select
                            value={key}
                            onValueChange={(value) => setKey(value as SocialCredentialKey)}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Seleccioná una clave..." />
                            </SelectTrigger>
                            <SelectContent className="z-[1001]">
                                {SOCIAL_CREDENTIAL_KEYS.map((k) => (
                                    <SelectItem
                                        key={k}
                                        value={k}
                                    >
                                        {getSocialCredentialKeyLabel(k)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="create-social-credential-plaintext">Secreto</Label>
                        <Input
                            id="create-social-credential-plaintext"
                            type="password"
                            value={plaintext}
                            onChange={(e) => setPlaintext(e.target.value)}
                            placeholder="Pegá el valor secreto..."
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <Label htmlFor="create-social-credential-label">Etiqueta (opcional)</Label>
                        <Input
                            id="create-social-credential-label"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Mi webhook de producción"
                            className="mt-2"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid || createMutation.isPending}
                    >
                        {createMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Crear
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
