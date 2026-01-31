import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    useCancelSubscriptionMutation,
    useChangePlanMutation,
    useSubscriptionsQuery
} from '@/features/billing-subscriptions/hooks';
import { ALL_PLANS, type PlanDefinition } from '@repo/billing';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarIcon, CreditCardIcon, XCircleIcon } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/subscriptions')({
    component: BillingSubscriptionsPage
});

/**
 * Subscription status types matching billing system
 */
type SubscriptionStatus = 'active' | 'trialing' | 'cancelled' | 'past_due' | 'expired';

/**
 * Subscription data structure
 */
interface Subscription {
    readonly id: string;
    readonly userId: string;
    readonly userName: string;
    readonly userEmail: string;
    readonly planSlug: string;
    readonly status: SubscriptionStatus;
    readonly startDate: string;
    readonly currentPeriodEnd: string;
    readonly monthlyAmount: number;
    readonly cancelAtPeriodEnd: boolean;
    readonly trialEnd?: string;
    readonly discountPercent?: number;
}

/**
 * Payment history entry
 */
interface PaymentHistory {
    readonly id: string;
    readonly date: string;
    readonly amount: number;
    readonly status: 'paid' | 'pending' | 'failed';
}

/**
 * Get status badge variant based on subscription status
 */
function getStatusVariant(
    status: SubscriptionStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variantMap: Record<
        SubscriptionStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        active: 'default',
        trialing: 'secondary',
        cancelled: 'destructive',
        past_due: 'outline',
        expired: 'outline'
    };
    return variantMap[status];
}

/**
 * Get status label in Spanish
 */
function getStatusLabel(status: SubscriptionStatus): string {
    const labels: Record<SubscriptionStatus, string> = {
        active: 'Activa',
        trialing: 'En prueba',
        cancelled: 'Cancelada',
        past_due: 'Pago pendiente',
        expired: 'Expirada'
    };
    return labels[status];
}

/**
 * Format date to Spanish locale
 */
function formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(new Date(date));
}

/**
 * Format ARS currency
 */
function formatArs(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Get plan details by slug
 */
function getPlanBySlug(slug: string): PlanDefinition | undefined {
    return ALL_PLANS.find((plan) => plan.slug === slug);
}

/**
 * Cancel confirmation dialog component
 */
function CancelSubscriptionDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (immediate: boolean, reason?: string) => void;
}) {
    const [cancelImmediate, setCancelImmediate] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const handleConfirm = () => {
        onConfirm(cancelImmediate, cancelReason || undefined);
        setCancelReason('');
        setCancelImmediate(false);
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cancelar suscripción</DialogTitle>
                    <DialogDescription>
                        Confirma la cancelación de la suscripción de {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="cancel-timing">Momento de cancelación</Label>
                        <select
                            id="cancel-timing"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelImmediate ? 'immediate' : 'end_of_period'}
                            onChange={(e) => setCancelImmediate(e.target.value === 'immediate')}
                        >
                            <option value="end_of_period">
                                Al finalizar el período actual (
                                {formatDate(subscription.currentPeriodEnd)})
                            </option>
                            <option value="immediate">Inmediatamente</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
                        <select
                            id="cancel-reason"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        >
                            <option value="">Seleccionar motivo...</option>
                            <option value="too_expensive">Muy costoso</option>
                            <option value="missing_features">Faltan funcionalidades</option>
                            <option value="technical_issues">Problemas técnicos</option>
                            <option value="switching_competitor">Cambiando a competencia</option>
                            <option value="business_closed">Negocio cerrado</option>
                            <option value="other">Otro</option>
                        </select>
                    </div>

                    {cancelImmediate && (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                            <p className="text-destructive text-sm">
                                ⚠️ La cancelación inmediata desactivará el acceso del usuario de
                                forma instantánea y no se emitirá reembolso.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Volver
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                    >
                        Confirmar cancelación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Change plan dialog component
 */
function ChangePlanDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (newPlanSlug: string) => void;
}) {
    const currentPlan = getPlanBySlug(subscription.planSlug);
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    const availablePlans = ALL_PLANS.filter(
        (plan) => plan.category === currentPlan?.category && plan.slug !== subscription.planSlug
    );

    const handleConfirm = () => {
        if (selectedPlan) {
            onConfirm(selectedPlan);
            setSelectedPlan('');
        }
    };

    const selectedPlanDef = selectedPlan ? getPlanBySlug(selectedPlan) : null;
    const proratedAmount =
        selectedPlanDef && currentPlan
            ? (selectedPlanDef.monthlyPriceArs - currentPlan.monthlyPriceArs) / 100
            : 0;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cambiar plan de suscripción</DialogTitle>
                    <DialogDescription>
                        Selecciona el nuevo plan para {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="mb-2 font-medium text-sm">Plan actual</p>
                        <div className="rounded-md border p-3">
                            <p className="font-medium">{currentPlan?.name}</p>
                            <p className="text-muted-foreground text-sm">
                                {formatArs(currentPlan?.monthlyPriceArs ?? 0)}/mes
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-plan">Nuevo plan</Label>
                        <select
                            id="new-plan"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                        >
                            <option value="">Seleccionar plan...</option>
                            {availablePlans.map((plan) => (
                                <option
                                    key={plan.slug}
                                    value={plan.slug}
                                >
                                    {plan.name} - {formatArs(plan.monthlyPriceArs)}/mes
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedPlanDef && (
                        <div className="rounded-md border bg-muted p-3">
                            <p className="mb-2 font-medium text-sm">Prorrateo estimado</p>
                            <p className="text-muted-foreground text-sm">
                                {proratedAmount > 0 && (
                                    <span>
                                        Se cobrará aproximadamente {formatArs(proratedAmount)} hoy
                                    </span>
                                )}
                                {proratedAmount < 0 && (
                                    <span>
                                        Se acreditará aproximadamente{' '}
                                        {formatArs(Math.abs(proratedAmount))} a la cuenta
                                    </span>
                                )}
                                {proratedAmount === 0 && <span>Sin cargo adicional</span>}
                            </p>
                            <p className="mt-2 text-muted-foreground text-xs">
                                El siguiente cobro completo será el{' '}
                                {formatDate(subscription.currentPeriodEnd)}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedPlan}
                    >
                        Cambiar plan
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Subscription details dialog component
 */
function SubscriptionDetailsDialog({
    subscription,
    isOpen,
    onClose,
    onCancel,
    onChangePlan,
    onExtendTrial
}: {
    readonly subscription: Subscription | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onCancel: (sub: Subscription) => void;
    readonly onChangePlan: (sub: Subscription) => void;
    readonly onExtendTrial: (sub: Subscription) => void;
}) {
    if (!subscription) return null;

    const plan = getPlanBySlug(subscription.planSlug);

    // TODO: Payment history should come from API endpoint
    // Expected endpoint: GET /api/v1/billing/subscriptions/:id/payments
    const paymentHistory: PaymentHistory[] = [];

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detalles de la suscripción</DialogTitle>
                    <DialogDescription>Información completa de la suscripción</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* User info */}
                    <div>
                        <h3 className="mb-2 font-medium text-sm">Usuario</h3>
                        <div className="rounded-md border p-3">
                            <p className="font-medium">{subscription.userName}</p>
                            <p className="text-muted-foreground text-sm">
                                {subscription.userEmail}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">
                                ID: {subscription.userId}
                            </p>
                        </div>
                    </div>

                    {/* Subscription info */}
                    <div>
                        <h3 className="mb-2 font-medium text-sm">Suscripción</h3>
                        <div className="space-y-2 rounded-md border p-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">ID:</span>
                                <span className="font-mono text-sm">{subscription.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">Plan:</span>
                                <span className="text-sm">{plan?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">Estado:</span>
                                <Badge variant={getStatusVariant(subscription.status)}>
                                    {getStatusLabel(subscription.status)}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">Inicio:</span>
                                <span className="text-sm">
                                    {formatDate(subscription.startDate)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    Fin de período:
                                </span>
                                <span className="text-sm">
                                    {formatDate(subscription.currentPeriodEnd)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">
                                    Monto mensual:
                                </span>
                                <span className="font-medium text-sm">
                                    {formatArs(subscription.monthlyAmount)}
                                </span>
                            </div>
                            {subscription.discountPercent && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-sm">
                                        Descuento:
                                    </span>
                                    <span className="text-green-600 text-sm">
                                        {subscription.discountPercent}%
                                    </span>
                                </div>
                            )}
                            {subscription.trialEnd && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-sm">
                                        Fin de prueba:
                                    </span>
                                    <span className="text-sm">
                                        {formatDate(subscription.trialEnd)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Entitlements */}
                    {plan && (
                        <div>
                            <h3 className="mb-2 font-medium text-sm">Funcionalidades incluidas</h3>
                            <div className="rounded-md border p-3">
                                <ul className="space-y-1 text-sm">
                                    {plan.entitlements.slice(0, 5).map((entitlement) => (
                                        <li key={entitlement}>
                                            • {entitlement.replace(/_/g, ' ')}
                                        </li>
                                    ))}
                                    {plan.entitlements.length > 5 && (
                                        <li className="text-muted-foreground text-xs">
                                            +{plan.entitlements.length - 5} más...
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Payment history */}
                    <div>
                        <h3 className="mb-2 font-medium text-sm">Historial de pagos</h3>
                        {paymentHistory.length === 0 ? (
                            <div className="rounded-md border p-6 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay historial de pagos disponible
                                </p>
                                <p className="mt-1 text-muted-foreground text-xs">
                                    El historial se mostrará cuando se procesen los pagos
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-md border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">
                                                Fecha
                                            </th>
                                            <th className="px-3 py-2 text-right font-medium">
                                                Monto
                                            </th>
                                            <th className="px-3 py-2 text-center font-medium">
                                                Estado
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paymentHistory.map((payment) => (
                                            <tr
                                                key={payment.id}
                                                className="border-t"
                                            >
                                                <td className="px-3 py-2">
                                                    {formatDate(payment.date)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {formatArs(payment.amount)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <Badge
                                                        variant={
                                                            payment.status === 'paid'
                                                                ? 'default'
                                                                : payment.status === 'pending'
                                                                  ? 'secondary'
                                                                  : 'destructive'
                                                        }
                                                    >
                                                        {payment.status === 'paid'
                                                            ? 'Pagado'
                                                            : payment.status === 'pending'
                                                              ? 'Pendiente'
                                                              : 'Fallido'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onChangePlan(subscription)}
                        >
                            <CreditCardIcon className="mr-2 h-4 w-4" />
                            Cambiar plan
                        </Button>
                        {subscription.status === 'trialing' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onExtendTrial(subscription)}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                Extender prueba
                            </Button>
                        )}
                        {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onCancel(subscription)}
                            >
                                <XCircleIcon className="mr-2 h-4 w-4" />
                                Cancelar suscripción
                            </Button>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Main subscriptions page component
 */
function BillingSubscriptionsPage() {
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
    const [planFilter, setPlanFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [changePlanDialogOpen, setChangePlanDialogOpen] = useState(false);

    // Fetch subscriptions with filters
    const {
        data: subscriptions = [],
        isLoading,
        isError
    } = useSubscriptionsQuery({
        status: statusFilter,
        planSlug: planFilter,
        q: searchQuery
    });

    // Mutations
    const cancelMutation = useCancelSubscriptionMutation();
    const changePlanMutation = useChangePlanMutation();

    const filteredSubscriptions = subscriptions.filter((sub: Subscription) => {
        const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
        const matchesPlan = planFilter === 'all' || sub.planSlug === planFilter;
        const matchesSearch =
            searchQuery === '' ||
            sub.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sub.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesStatus && matchesPlan && matchesSearch;
    });

    const handleViewDetails = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setDetailsDialogOpen(true);
    };

    const handleCancelClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setCancelDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleConfirmCancel = (immediate: boolean, reason?: string) => {
        if (!selectedSubscription) return;

        cancelMutation.mutate(
            {
                id: selectedSubscription.id,
                immediate,
                reason
            },
            {
                onSuccess: () => {
                    addToast({
                        message: `Suscripción ${immediate ? 'cancelada inmediatamente' : 'programada para cancelación'}`,
                        variant: 'success'
                    });
                    setCancelDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `Error al cancelar suscripción: ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleChangePlanClick = (subscription: Subscription) => {
        setSelectedSubscription(subscription);
        setChangePlanDialogOpen(true);
        setDetailsDialogOpen(false);
    };

    const handleConfirmChangePlan = (newPlanSlug: string) => {
        if (!selectedSubscription) return;

        changePlanMutation.mutate(
            {
                subscriptionId: selectedSubscription.id,
                newPlanSlug
            },
            {
                onSuccess: () => {
                    const newPlan = getPlanBySlug(newPlanSlug);
                    addToast({
                        message: `Plan cambiado a ${newPlan?.name}`,
                        variant: 'success'
                    });
                    setChangePlanDialogOpen(false);
                    setSelectedSubscription(null);
                },
                onError: (error) => {
                    addToast({
                        message: `Error al cambiar plan: ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const handleExtendTrial = (_subscription: Subscription) => {
        addToast({
            message: 'Período de prueba extendido por 7 días',
            variant: 'success'
        });

        // TODO: Implement API call to extend trial
        // API call would go here: await extendTrial({ subscriptionId: subscription.id })
    };

    // Get unique plan categories for filter
    const planCategories = Array.from(new Set(ALL_PLANS.map((plan) => plan.category)));

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Suscripciones</h2>
                    <p className="text-muted-foreground">
                        Gestiona las suscripciones activas de los usuarios
                    </p>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <Label htmlFor="search">Buscar por usuario</Label>
                                <Input
                                    id="search"
                                    placeholder="Nombre o email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="mt-2"
                                />
                            </div>
                            <div>
                                <Label htmlFor="status">Estado</Label>
                                <select
                                    id="status"
                                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value as SubscriptionStatus | 'all'
                                        )
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="active">Activa</option>
                                    <option value="trialing">En prueba</option>
                                    <option value="past_due">Pago pendiente</option>
                                    <option value="cancelled">Cancelada</option>
                                    <option value="expired">Expirada</option>
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="plan">Categoría de plan</Label>
                                <select
                                    id="plan"
                                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={planFilter}
                                    onChange={(e) => setPlanFilter(e.target.value)}
                                >
                                    <option value="all">Todas</option>
                                    {planCategories.map((category) => (
                                        <option
                                            key={category}
                                            value={category}
                                        >
                                            {category === 'owner'
                                                ? 'Propietario'
                                                : category === 'complex'
                                                  ? 'Complejo'
                                                  : 'Turista'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Subscriptions Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Suscripciones</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? 'Cargando...'
                                : isError
                                  ? 'Error al cargar suscripciones'
                                  : filteredSubscriptions.length === 0
                                    ? 'No hay suscripciones'
                                    : `${filteredSubscriptions.length} suscripción${filteredSubscriptions.length !== 1 ? 'es' : ''}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Cargando suscripciones...
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    Error al cargar suscripciones
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Verifica que la API esté disponible
                                </p>
                            </div>
                        ) : filteredSubscriptions.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay suscripciones registradas aún.
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Las suscripciones aparecerán aquí cuando los usuarios se
                                    suscriban a un plan.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                Usuario
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Plan
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Inicio
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Fin de período
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Monto mensual
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSubscriptions.map((subscription: Subscription) => {
                                            const plan = getPlanBySlug(subscription.planSlug);
                                            return (
                                                <tr
                                                    key={subscription.id}
                                                    className="border-b hover:bg-muted/50"
                                                >
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <div className="font-medium">
                                                                {subscription.userName}
                                                            </div>
                                                            <div className="text-muted-foreground text-xs">
                                                                {subscription.userEmail}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <div className="font-medium">
                                                                {plan?.name}
                                                            </div>
                                                            <div className="text-muted-foreground text-xs">
                                                                {plan?.category === 'owner'
                                                                    ? 'Propietario'
                                                                    : plan?.category === 'complex'
                                                                      ? 'Complejo'
                                                                      : 'Turista'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge
                                                            variant={getStatusVariant(
                                                                subscription.status
                                                            )}
                                                        >
                                                            {getStatusLabel(subscription.status)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                                        {formatDate(subscription.startDate)}
                                                    </td>
                                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                                        {formatDate(subscription.currentPeriodEnd)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {formatArs(subscription.monthlyAmount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleViewDetails(subscription)
                                                                }
                                                            >
                                                                Ver
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleCancelClick(subscription)
                                                                }
                                                            >
                                                                Cancelar
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs */}
            <SubscriptionDetailsDialog
                subscription={selectedSubscription}
                isOpen={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                onCancel={handleCancelClick}
                onChangePlan={handleChangePlanClick}
                onExtendTrial={handleExtendTrial}
            />

            {selectedSubscription && (
                <>
                    <CancelSubscriptionDialog
                        subscription={selectedSubscription}
                        isOpen={cancelDialogOpen}
                        onClose={() => setCancelDialogOpen(false)}
                        onConfirm={handleConfirmCancel}
                    />

                    <ChangePlanDialog
                        subscription={selectedSubscription}
                        isOpen={changePlanDialogOpen}
                        onClose={() => setChangePlanDialogOpen(false)}
                        onConfirm={handleConfirmChangePlan}
                    />
                </>
            )}
        </SidebarPageLayout>
    );
}
