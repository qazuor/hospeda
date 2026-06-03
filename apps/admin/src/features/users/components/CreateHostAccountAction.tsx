/**
 * @file CreateHostAccountAction.tsx
 * @description SPEC-182 T-012 — staff "Create host account" header action on the
 * admin users list (D2: modal, not a separate route).
 *
 * Renders a permission-gated button that opens a modal to provision a new HOST
 * account via the admin signup-as-host endpoint (T-011). The button is hidden
 * entirely for actors without USER_CREATE — the same permission the endpoint
 * enforces server-side, so the UI gate mirrors the API gate.
 */

import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';
import { adminLogger } from '@/utils/logger';
import { AddIcon } from '@repo/icons';
import { PermissionEnum } from '@repo/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';

/**
 * Mirrors the server-side SignupAsHostBodySchema (apps/api). Kept local because
 * it is a tiny, UI-only validation surface; the endpoint re-validates regardless.
 */
const CreateHostSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio').max(255),
    email: z.string().email('Ingresá un email válido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

type FormState = z.infer<typeof CreateHostSchema>;

const INITIAL_STATE: FormState = { name: '', email: '', password: '' };

export function CreateHostAccountAction() {
    const canCreate = useHasPermission(PermissionEnum.USER_CREATE);
    const { addToast } = useToast();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [values, setValues] = useState<FormState>(INITIAL_STATE);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [submitting, setSubmitting] = useState(false);

    // Hide the action entirely when the actor cannot create users — the API
    // enforces USER_CREATE too, so this is a UX mirror, not the security gate.
    if (!canCreate) {
        return null;
    }

    const setField = (key: keyof FormState, value: string) => {
        setValues((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const reset = () => {
        setValues(INITIAL_STATE);
        setErrors({});
    };

    const handleSubmit = async () => {
        const parsed = CreateHostSchema.safeParse(values);
        if (!parsed.success) {
            const fieldErrors: Partial<Record<keyof FormState, string>> = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path[0] as keyof FormState;
                if (key && !fieldErrors[key]) {
                    fieldErrors[key] = issue.message;
                }
            }
            setErrors(fieldErrors);
            return;
        }

        setSubmitting(true);
        try {
            await fetchApi({
                path: '/api/v1/admin/auth/signup-as-host',
                method: 'POST',
                body: parsed.data
            });
            addToast({
                title: 'Cuenta de host creada',
                message: `Se creó la cuenta de ${parsed.data.email} con rol HOST.`,
                variant: 'success'
            });
            // Refresh the users list so the new host appears without a manual reload.
            await queryClient.invalidateQueries({
                queryKey: createEntityQueryKeys('users').lists()
            });
            reset();
            setOpen(false);
        } catch (error) {
            adminLogger.error('[CreateHostAccountAction] Submit failed', error);
            addToast({
                title: 'No se pudo crear la cuenta',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Ocurrió un error al crear la cuenta de host. Probá de nuevo.',
                variant: 'error'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(true)}
            >
                <AddIcon className="mr-2 h-4 w-4" />
                Crear host
            </Button>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next) reset();
                    setOpen(next);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear cuenta de host</DialogTitle>
                        <DialogDescription>
                            Creá una cuenta con rol HOST. El nuevo host inicia sesión con la
                            contraseña temporal que definas acá.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="ch-name">Nombre*</Label>
                            <Input
                                id="ch-name"
                                value={values.name}
                                onChange={(e) => setField('name', e.target.value)}
                                placeholder="Nombre del host"
                            />
                            {errors.name && (
                                <p className="text-destructive text-sm">{errors.name}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="ch-email">Email*</Label>
                            <Input
                                id="ch-email"
                                type="email"
                                value={values.email}
                                onChange={(e) => setField('email', e.target.value)}
                                placeholder="host@ejemplo.com"
                            />
                            {errors.email && (
                                <p className="text-destructive text-sm">{errors.email}</p>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="ch-password">Contraseña temporal*</Label>
                            <Input
                                id="ch-password"
                                type="password"
                                value={values.password}
                                onChange={(e) => setField('password', e.target.value)}
                                placeholder="Mínimo 8 caracteres"
                            />
                            {errors.password && (
                                <p className="text-destructive text-sm">{errors.password}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? 'Creando...' : 'Crear host'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
