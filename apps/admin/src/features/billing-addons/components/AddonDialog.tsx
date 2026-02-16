/**
 * Add-on Create/Edit Dialog
 *
 * Modal dialog for creating new add-ons or editing existing ones.
 * Uses TanStack Form with Zod validation.
 */
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
import { useToast } from '@/hooks/use-toast';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import type { AddonDefinition, CreateAddonPayload } from '../types';

interface AddonDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    addon?: AddonDefinition | null;
    onSubmit: (payload: CreateAddonPayload) => Promise<void>;
    isSubmitting?: boolean;
}

export function AddonDialog({
    open,
    onOpenChange,
    addon,
    onSubmit,
    isSubmitting = false
}: AddonDialogProps) {
    const { addToast } = useToast();

    const form = useForm({
        defaultValues: {
            slug: addon?.slug || '',
            name: addon?.name || '',
            description: addon?.description || '',
            billingType: (addon?.billingType || 'one_time') as 'one_time' | 'recurring',
            priceArs: addon?.priceArs ? addon.priceArs / 100 : 0, // Convert cents to ARS
            durationDays: addon?.durationDays || null,
            affectsLimitKey: addon?.affectsLimitKey || null,
            limitIncrease: addon?.limitIncrease || null,
            grantsEntitlement: addon?.grantsEntitlement || null,
            targetCategories: (addon?.targetCategories || ['owner']) as ('owner' | 'complex')[],
            isActive: addon?.isActive ?? true,
            sortOrder: addon?.sortOrder || 0
        },
        onSubmit: async ({ value }) => {
            try {
                // Convert ARS to cents for backend
                const payload: CreateAddonPayload = {
                    ...value,
                    priceArs: Math.round(value.priceArs * 100)
                };

                await onSubmit(payload);

                addToast({
                    title: addon ? 'Add-on actualizado' : 'Add-on creado',
                    message: `El add-on "${value.name}" se ${addon ? 'actualizó' : 'creó'} correctamente`,
                    variant: 'success'
                });

                onOpenChange(false);
                form.reset();
            } catch (error) {
                addToast({
                    title: 'Error',
                    message: error instanceof Error ? error.message : 'Error al guardar el add-on',
                    variant: 'error'
                });
            }
        }
    });

    // Reset form when dialog closes or addon changes
    useEffect(() => {
        if (!open) {
            form.reset();
        }
    }, [open, form]);

    const billingTypeValue = form.state.values.billingType;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{addon ? 'Editar Add-on' : 'Crear Add-on'}</DialogTitle>
                    <DialogDescription>
                        {addon
                            ? 'Modifica los detalles del add-on existente'
                            : 'Completa el formulario para crear un nuevo add-on'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-6"
                >
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Información básica</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="slug">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="slug">
                                            Slug <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="slug"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="visibility-boost-7d"
                                            disabled={!!addon}
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="name">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="name">
                                            Nombre <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="Boost de visibilidad (7 días)"
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <form.Field name="description">
                            {(field) => (
                                <div>
                                    <Label htmlFor="description">
                                        Descripción <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder="Describe el add-on..."
                                        rows={3}
                                    />
                                    {field.state.meta.errors && (
                                        <p className="mt-1 text-destructive text-xs">
                                            {field.state.meta.errors[0]}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Facturación</h3>

                        <div className="grid gap-4 md:grid-cols-3">
                            <form.Field name="billingType">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="billingType">
                                            Tipo <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value as 'one_time' | 'recurring'
                                                )
                                            }
                                        >
                                            <SelectTrigger id="billingType">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="one_time">Único</SelectItem>
                                                <SelectItem value="recurring">
                                                    Recurrente
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="priceArs">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="priceArs">
                                            Precio (ARS) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="priceArs"
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="5000"
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="durationDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="durationDays">
                                            Duración (días)
                                            {billingTypeValue === 'one_time' && (
                                                <span className="text-destructive">*</span>
                                            )}
                                        </Label>
                                        <Input
                                            id="durationDays"
                                            type="number"
                                            min={0}
                                            value={field.state.value || ''}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value ? Number(e.target.value) : null
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="7"
                                            disabled={billingTypeValue === 'recurring'}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {billingTypeValue === 'one_time'
                                                ? 'Días que dura el beneficio'
                                                : 'No aplica para recurrentes'}
                                        </p>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Beneficios</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="affectsLimitKey">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="affectsLimitKey">Límite afectado</Label>
                                        <Select
                                            value={field.state.value || 'none'}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value === 'none' ? null : (value as LimitKey)
                                                )
                                            }
                                        >
                                            <SelectTrigger id="affectsLimitKey">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguno</SelectItem>
                                                {Object.values(LimitKey).map((key) => (
                                                    <SelectItem
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="limitIncrease">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="limitIncrease">Incremento</Label>
                                        <Input
                                            id="limitIncrease"
                                            type="number"
                                            min={0}
                                            value={field.state.value || ''}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value ? Number(e.target.value) : null
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="5"
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="grantsEntitlement">
                                {(field) => (
                                    <div className="md:col-span-2">
                                        <Label htmlFor="grantsEntitlement">
                                            Habilita funcionalidad
                                        </Label>
                                        <Select
                                            value={field.state.value || 'none'}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value === 'none'
                                                        ? null
                                                        : (value as EntitlementKey)
                                                )
                                            }
                                        >
                                            <SelectTrigger id="grantsEntitlement">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguna</SelectItem>
                                                {Object.values(EntitlementKey).map((key) => (
                                                    <SelectItem
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Target & Status */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Configuración</h3>

                        <div className="space-y-4">
                            <form.Field name="targetCategories">
                                {(field) => (
                                    <div>
                                        <Label>
                                            Categorías objetivo{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <div className="mt-2 flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={field.state.value.includes('owner')}
                                                    onChange={(e) => {
                                                        const current = field.state.value;
                                                        field.handleChange(
                                                            e.target.checked
                                                                ? [...current, 'owner']
                                                                : current.filter(
                                                                      (c) => c !== 'owner'
                                                                  )
                                                        );
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm">Propietario</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={field.state.value.includes('complex')}
                                                    onChange={(e) => {
                                                        const current = field.state.value;
                                                        field.handleChange(
                                                            e.target.checked
                                                                ? [...current, 'complex']
                                                                : current.filter(
                                                                      (c) => c !== 'complex'
                                                                  )
                                                        );
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm">Complejo</span>
                                            </label>
                                        </div>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field name="sortOrder">
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="sortOrder">Orden</Label>
                                            <Input
                                                id="sortOrder"
                                                type="number"
                                                min={0}
                                                value={field.state.value}
                                                onChange={(e) =>
                                                    field.handleChange(Number(e.target.value))
                                                }
                                                onBlur={field.handleBlur}
                                            />
                                            <p className="mt-1 text-muted-foreground text-xs">
                                                Orden de visualización
                                            </p>
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name="isActive">
                                    {(field) => (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label htmlFor="isActive">Estado</Label>
                                                <p className="text-muted-foreground text-xs">
                                                    Activar add-on
                                                </p>
                                            </div>
                                            <Switch
                                                id="isActive"
                                                checked={field.state.value}
                                                onCheckedChange={field.handleChange}
                                            />
                                        </div>
                                    )}
                                </form.Field>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {addon ? 'Guardar cambios' : 'Crear add-on'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
