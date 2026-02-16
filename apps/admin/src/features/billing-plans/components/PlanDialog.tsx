/**
 * Plan Create/Edit Dialog
 *
 * Modal dialog for creating new plans or editing existing ones.
 * Uses TanStack Form with sections for basic info, pricing, trial,
 * entitlements, limits, and configuration.
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
import { ENTITLEMENT_DEFINITIONS, EntitlementKey, LIMIT_METADATA, LimitKey } from '@repo/billing';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import type { CreatePlanPayload, PlanDefinition } from '../types';

interface PlanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    plan?: PlanDefinition | null;
    onSubmit: (payload: CreatePlanPayload) => Promise<void>;
    isSubmitting?: boolean;
}

/**
 * Group entitlements by category for organized display
 */
const ENTITLEMENT_GROUPS: {
    label: string;
    keys: EntitlementKey[];
}[] = [
    {
        label: 'Propietario',
        keys: [
            EntitlementKey.PUBLISH_ACCOMMODATIONS,
            EntitlementKey.EDIT_ACCOMMODATION_INFO,
            EntitlementKey.VIEW_BASIC_STATS,
            EntitlementKey.VIEW_ADVANCED_STATS,
            EntitlementKey.RESPOND_REVIEWS,
            EntitlementKey.PRIORITY_SUPPORT,
            EntitlementKey.FEATURED_LISTING,
            EntitlementKey.CUSTOM_BRANDING,
            EntitlementKey.API_ACCESS,
            EntitlementKey.DEDICATED_MANAGER,
            EntitlementKey.CREATE_PROMOTIONS,
            EntitlementKey.SOCIAL_MEDIA_INTEGRATION
        ]
    },
    {
        label: 'Alojamiento',
        keys: [
            EntitlementKey.CAN_USE_RICH_DESCRIPTION,
            EntitlementKey.CAN_EMBED_VIDEO,
            EntitlementKey.CAN_USE_CALENDAR,
            EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
            EntitlementKey.HAS_VERIFICATION_BADGE
        ]
    },
    {
        label: 'Complejo',
        keys: [
            EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
            EntitlementKey.CONSOLIDATED_ANALYTICS,
            EntitlementKey.CENTRALIZED_BOOKING,
            EntitlementKey.STAFF_MANAGEMENT,
            EntitlementKey.WHITE_LABEL,
            EntitlementKey.MULTI_CHANNEL_INTEGRATION
        ]
    },
    {
        label: 'Turista',
        keys: [
            EntitlementKey.SAVE_FAVORITES,
            EntitlementKey.WRITE_REVIEWS,
            EntitlementKey.READ_REVIEWS,
            EntitlementKey.AD_FREE,
            EntitlementKey.PRICE_ALERTS,
            EntitlementKey.EARLY_ACCESS_EVENTS,
            EntitlementKey.EXCLUSIVE_DEALS,
            EntitlementKey.VIP_SUPPORT,
            EntitlementKey.CONCIERGE_SERVICE,
            EntitlementKey.AIRPORT_TRANSFERS,
            EntitlementKey.VIP_PROMOTIONS_ACCESS
        ]
    }
];

/**
 * Get display name for an entitlement key
 */
function getEntitlementName(key: EntitlementKey): string {
    const definition = ENTITLEMENT_DEFINITIONS.find((d) => d.key === key);
    return definition?.name || key.replace(/_/g, ' ');
}

export function PlanDialog({
    open,
    onOpenChange,
    plan,
    onSubmit,
    isSubmitting = false
}: PlanDialogProps) {
    const { addToast } = useToast();

    const form = useForm({
        defaultValues: {
            slug: plan?.slug || '',
            name: plan?.name || '',
            description: plan?.description || '',
            category: (plan?.category || 'owner') as 'owner' | 'complex' | 'tourist',
            monthlyPriceArs: plan?.monthlyPriceArs ? plan.monthlyPriceArs / 100 : 0,
            annualPriceArs: plan?.annualPriceArs ? plan.annualPriceArs / 100 : 0,
            monthlyPriceUsdRef: plan?.monthlyPriceUsdRef ?? 0,
            hasTrial: plan?.hasTrial ?? false,
            trialDays: plan?.trialDays ?? 14,
            entitlements: (plan?.entitlements || []) as EntitlementKey[],
            limits: plan?.limits
                ? plan.limits.map((l) => ({ key: l.key, value: l.value }))
                : Object.values(LimitKey).map((key) => ({ key, value: 0 })),
            isDefault: plan?.isDefault ?? false,
            sortOrder: plan?.sortOrder ?? 0,
            isActive: plan?.isActive ?? true
        },
        onSubmit: async ({ value }) => {
            try {
                const payload: CreatePlanPayload = {
                    slug: value.slug,
                    name: value.name,
                    description: value.description,
                    category: value.category,
                    monthlyPriceArs: Math.round(value.monthlyPriceArs * 100),
                    annualPriceArs: value.annualPriceArs
                        ? Math.round(value.annualPriceArs * 100)
                        : null,
                    monthlyPriceUsdRef: value.monthlyPriceUsdRef,
                    hasTrial: value.hasTrial,
                    trialDays: value.hasTrial ? value.trialDays : 0,
                    entitlements: value.entitlements,
                    limits: value.limits.filter((l) => l.value !== 0),
                    isDefault: value.isDefault,
                    sortOrder: value.sortOrder,
                    isActive: value.isActive
                };

                await onSubmit(payload);

                addToast({
                    title: plan ? 'Plan actualizado' : 'Plan creado',
                    message: `El plan "${value.name}" se ${plan ? 'actualizo' : 'creo'} correctamente`,
                    variant: 'success'
                });

                onOpenChange(false);
                form.reset();
            } catch (error) {
                addToast({
                    title: 'Error',
                    message: error instanceof Error ? error.message : 'Error al guardar el plan',
                    variant: 'error'
                });
            }
        }
    });

    // Reset form when dialog closes or plan changes
    useEffect(() => {
        if (!open) {
            form.reset();
        }
    }, [open, form]);

    const hasTrialValue = form.state.values.hasTrial;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{plan ? 'Editar Plan' : 'Crear Plan'}</DialogTitle>
                    <DialogDescription>
                        {plan
                            ? 'Modifica los detalles del plan existente'
                            : 'Completa el formulario para crear un nuevo plan de suscripcion'}
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
                        <h3 className="font-medium text-sm">Informacion basica</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="slug">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-slug">
                                            Slug <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="plan-slug"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="owner-basico"
                                            disabled={!!plan}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            Identificador unico del plan
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="name">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-name">
                                            Nombre <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="plan-name"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="Basico Propietario"
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="category">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-category">
                                            Categoria <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value as 'owner' | 'complex' | 'tourist'
                                                )
                                            }
                                        >
                                            <SelectTrigger id="plan-category">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="owner">Propietario</SelectItem>
                                                <SelectItem value="complex">Complejo</SelectItem>
                                                <SelectItem value="tourist">Turista</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <form.Field name="description">
                            {(field) => (
                                <div>
                                    <Label htmlFor="plan-description">
                                        Descripcion <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="plan-description"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder="Describe el plan..."
                                        rows={3}
                                    />
                                </div>
                            )}
                        </form.Field>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Precios</h3>

                        <div className="grid gap-4 md:grid-cols-3">
                            <form.Field name="monthlyPriceArs">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-monthly-ars">
                                            Mensual (ARS){' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="plan-monthly-ars"
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="15000"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            Precio en pesos (se convierte a centavos)
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="annualPriceArs">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-annual-ars">Anual (ARS)</Label>
                                        <Input
                                            id="plan-annual-ars"
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="150000"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            Dejarlo en 0 si no hay opcion anual
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="monthlyPriceUsdRef">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-usd-ref">Ref. USD</Label>
                                        <Input
                                            id="plan-usd-ref"
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="12"
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            Precio de referencia en dolares
                                        </p>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Trial */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Periodo de prueba</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="hasTrial">
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor="plan-has-trial">Trial habilitado</Label>
                                            <p className="text-muted-foreground text-xs">
                                                Permite probar el plan sin pagar
                                            </p>
                                        </div>
                                        <Switch
                                            id="plan-has-trial"
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="trialDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-trial-days">Dias de prueba</Label>
                                        <Input
                                            id="plan-trial-days"
                                            type="number"
                                            min={1}
                                            max={90}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            disabled={!hasTrialValue}
                                        />
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Entitlements */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Funcionalidades (Entitlements)</h3>

                        <form.Field name="entitlements">
                            {(field) => (
                                <div className="max-h-64 space-y-4 overflow-y-auto rounded-md border p-4">
                                    {ENTITLEMENT_GROUPS.map((group) => (
                                        <div key={group.label}>
                                            <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                                                {group.label}
                                            </p>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {group.keys.map((key) => (
                                                    <label
                                                        key={key}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={field.state.value.includes(
                                                                key
                                                            )}
                                                            onChange={(e) => {
                                                                const current = field.state.value;
                                                                field.handleChange(
                                                                    e.target.checked
                                                                        ? [...current, key]
                                                                        : current.filter(
                                                                              (k) => k !== key
                                                                          )
                                                                );
                                                            }}
                                                            className="rounded"
                                                        />
                                                        <span className="text-sm">
                                                            {getEntitlementName(key)}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form.Field>
                    </div>

                    {/* Limits */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Limites</h3>

                        <form.Field name="limits">
                            {(field) => (
                                <div className="space-y-3 rounded-md border p-4">
                                    {field.state.value.map((limit, index) => {
                                        const meta = LIMIT_METADATA[limit.key];
                                        return (
                                            <div
                                                key={limit.key}
                                                className="grid items-center gap-4 md:grid-cols-3"
                                            >
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {meta?.name || limit.key}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">
                                                        {meta?.description}
                                                    </p>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Input
                                                        type="number"
                                                        min={-1}
                                                        value={limit.value}
                                                        onChange={(e) => {
                                                            const newLimits = [
                                                                ...field.state.value
                                                            ];
                                                            newLimits[index] = {
                                                                ...newLimits[index],
                                                                value: Number(e.target.value)
                                                            };
                                                            field.handleChange(newLimits);
                                                        }}
                                                    />
                                                    <p className="mt-1 text-muted-foreground text-xs">
                                                        -1 = ilimitado, 0 = no aplica
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </form.Field>
                    </div>

                    {/* Configuration */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">Configuracion</h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="sortOrder">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="plan-sort-order">Orden</Label>
                                        <Input
                                            id="plan-sort-order"
                                            type="number"
                                            min={0}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            Orden de visualizacion en tablas de precios
                                        </p>
                                    </div>
                                )}
                            </form.Field>

                            <div className="space-y-4">
                                <form.Field name="isDefault">
                                    {(field) => (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label htmlFor="plan-is-default">
                                                    Plan por defecto
                                                </Label>
                                                <p className="text-muted-foreground text-xs">
                                                    Se asigna automaticamente a nuevos usuarios
                                                </p>
                                            </div>
                                            <Switch
                                                id="plan-is-default"
                                                checked={field.state.value}
                                                onCheckedChange={field.handleChange}
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name="isActive">
                                    {(field) => (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label htmlFor="plan-is-active">Activo</Label>
                                                <p className="text-muted-foreground text-xs">
                                                    Disponible para suscripcion
                                                </p>
                                            </div>
                                            <Switch
                                                id="plan-is-active"
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
                            {plan ? 'Guardar cambios' : 'Crear plan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
