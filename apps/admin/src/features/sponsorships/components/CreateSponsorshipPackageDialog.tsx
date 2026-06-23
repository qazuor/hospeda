/**
 * Create Sponsorship Package Dialog
 *
 * SPEC-117 D-SPONSORSHIP.1 — wires the previously no-op Create button on the
 * Packages tab. Mirrors `CreateSponsorshipDialog` patterns.
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import { translateAdminApiError } from '@/lib/errors';
import { adminLogger } from '@/utils/logger';
import type { ApiErrorShape } from '@repo/i18n';
import { useState } from 'react';
import { useCreateSponsorshipPackageMutation } from '../hooks/useSponsorshipQueries';

interface CreateSponsorshipPackageDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

interface FormState {
    name: string;
    description: string;
    priceAmount: string;
    priceCurrency: string;
    includedPosts: string;
    includedEvents: string;
    isActive: boolean;
    slug: string;
}

const INITIAL_STATE: FormState = {
    name: '',
    description: '',
    priceAmount: '0',
    priceCurrency: 'ARS',
    includedPosts: '0',
    includedEvents: '0',
    isActive: true,
    slug: ''
};

export function CreateSponsorshipPackageDialog({
    open,
    onOpenChange
}: CreateSponsorshipPackageDialogProps) {
    const { addToast } = useToast();
    const { t } = useTranslations();
    const mutation = useCreateSponsorshipPackageMutation();
    const [values, setValues] = useState<FormState>(INITIAL_STATE);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
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
        const nextErrors: Partial<Record<keyof FormState, string>> = {};
        if (!values.name.trim()) nextErrors.name = 'El nombre es obligatorio';
        const priceAmount = Number(values.priceAmount);
        if (!Number.isFinite(priceAmount) || priceAmount < 0) {
            nextErrors.priceAmount = 'El precio debe ser un número >= 0';
        }
        const includedPosts = Number(values.includedPosts);
        if (!Number.isInteger(includedPosts) || includedPosts < 0) {
            nextErrors.includedPosts = 'Debe ser un entero >= 0';
        }
        const includedEvents = Number(values.includedEvents);
        if (!Number.isInteger(includedEvents) || includedEvents < 0) {
            nextErrors.includedEvents = 'Debe ser un entero >= 0';
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        const payload: Record<string, unknown> = {
            name: values.name.trim(),
            priceAmount,
            priceCurrency: values.priceCurrency,
            includedPosts,
            includedEvents,
            isActive: values.isActive
        };
        if (values.description.trim()) payload.description = values.description.trim();
        if (values.slug.trim()) payload.slug = values.slug.trim();

        try {
            await mutation.mutateAsync(payload);
            addToast({
                title: 'Paquete creado',
                message: 'El paquete se creó exitosamente',
                variant: 'success'
            });
            reset();
            onOpenChange(false);
        } catch (error) {
            adminLogger.error('[CreateSponsorshipPackageDialog] Submit failed', error);
            addToast({
                title: 'Error al crear el paquete',
                message: translateAdminApiError({
                    error: error as ApiErrorShape,
                    t,
                    fallback: 'No pudimos crear el paquete. Probá de nuevo.'
                }),
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Crear paquete de patrocinio</DialogTitle>
                    <DialogDescription>
                        Configurá un paquete con precio, posts y eventos incluidos.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label htmlFor="cp-name">Nombre*</Label>
                        <Input
                            id="cp-name"
                            value={values.name}
                            onChange={(e) => setField('name', e.target.value)}
                            placeholder="Ej: Plan Oro"
                        />
                        {errors.name && <p className="text-destructive text-sm">{errors.name}</p>}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="cp-description">Descripción</Label>
                        <Textarea
                            id="cp-description"
                            value={values.description}
                            onChange={(e) => setField('description', e.target.value)}
                            rows={3}
                            placeholder="Beneficios e inclusiones del paquete"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cp-price">Precio* (centavos)</Label>
                            <Input
                                id="cp-price"
                                type="number"
                                min="0"
                                step="1"
                                value={values.priceAmount}
                                onChange={(e) => setField('priceAmount', e.target.value)}
                            />
                            {errors.priceAmount && (
                                <p className="text-destructive text-sm">{errors.priceAmount}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cp-currency">Moneda*</Label>
                            <Select
                                value={values.priceCurrency}
                                onValueChange={(v) => setField('priceCurrency', v)}
                            >
                                <SelectTrigger id="cp-currency">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="BRL">BRL</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cp-posts">Posts incluidos*</Label>
                            <Input
                                id="cp-posts"
                                type="number"
                                min="0"
                                step="1"
                                value={values.includedPosts}
                                onChange={(e) => setField('includedPosts', e.target.value)}
                            />
                            {errors.includedPosts && (
                                <p className="text-destructive text-sm">{errors.includedPosts}</p>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cp-events">Eventos incluidos*</Label>
                            <Input
                                id="cp-events"
                                type="number"
                                min="0"
                                step="1"
                                value={values.includedEvents}
                                onChange={(e) => setField('includedEvents', e.target.value)}
                            />
                            {errors.includedEvents && (
                                <p className="text-destructive text-sm">{errors.includedEvents}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cp-slug">Slug (opcional)</Label>
                            <Input
                                id="cp-slug"
                                value={values.slug}
                                onChange={(e) => setField('slug', e.target.value)}
                                placeholder="Auto si vacío"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="cp-active"
                                    checked={values.isActive}
                                    onCheckedChange={(v: boolean) => setField('isActive', v)}
                                />
                                <Label htmlFor="cp-active">Activo</Label>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={mutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? 'Creando...' : 'Crear paquete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
