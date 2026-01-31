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
import { usePaymentsQuery, useRefundPaymentMutation } from '@/features/billing-payments/hooks';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarIcon, DollarSignIcon, FilterIcon } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/payments')({
    component: BillingPaymentsPage
});

type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';
type PaymentMethod = 'credit_card' | 'debit_card' | 'mercado_pago' | 'bank_transfer';

interface Payment {
    id: string;
    userName: string;
    userEmail: string;
    amount: number;
    status: PaymentStatus;
    date: string;
    method: PaymentMethod;
    planName: string;
    subscriptionId: string;
    invoiceId: string;
    transactionId: string;
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: PaymentStatus) {
    const variants = {
        completed: 'success',
        pending: 'default',
        failed: 'destructive',
        refunded: 'outline'
    } as const;
    return variants[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: PaymentStatus): string {
    const labels = {
        completed: 'Completado',
        pending: 'Pendiente',
        failed: 'Fallido',
        refunded: 'Reembolsado'
    };
    return labels[status];
}

/**
 * Get payment method label
 */
function getPaymentMethodLabel(method: PaymentMethod): string {
    const labels = {
        credit_card: 'Tarjeta de Crédito',
        debit_card: 'Tarjeta de Débito',
        mercado_pago: 'Mercado Pago',
        bank_transfer: 'Transferencia Bancaria'
    };
    return labels[method];
}

/**
 * Format date to Spanish locale
 */
function formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
 * Payment detail dialog component
 */
function PaymentDetailDialog({
    payment,
    open,
    onOpenChange
}: {
    payment: Payment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!payment) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detalles del Pago</DialogTitle>
                    <DialogDescription>ID: {payment.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* User Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Información del Usuario</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Nombre</p>
                                <p className="font-medium">{payment.userName}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Email</p>
                                <p className="font-medium">{payment.userEmail}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Información del Pago</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Monto</p>
                                <p className="font-semibold text-lg">{formatArs(payment.amount)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Estado</p>
                                <Badge variant={getStatusVariant(payment.status)}>
                                    {getStatusLabel(payment.status)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Fecha</p>
                                <p className="font-medium">{formatDate(payment.date)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Método</p>
                                <p className="font-medium">
                                    {getPaymentMethodLabel(payment.method)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Plan</p>
                                <p className="font-medium">{payment.planName}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">ID Transacción</p>
                                <p className="font-mono text-xs">{payment.transactionId}</p>
                            </div>
                        </div>
                    </div>

                    {/* Related Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Referencias</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Suscripción</p>
                                <p className="font-mono text-xs">{payment.subscriptionId}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Factura</p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 font-mono text-xs"
                                    disabled
                                >
                                    {payment.invoiceId}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Refund dialog component
 */
function RefundDialog({
    payment,
    open,
    onOpenChange,
    refundMutation,
    addToast
}: {
    payment: Payment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refundMutation: ReturnType<typeof useRefundPaymentMutation>;
    addToast: ReturnType<typeof useToast>['addToast'];
}) {
    const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
    const [partialAmount, setPartialAmount] = useState('');
    const [reason, setReason] = useState('');

    if (!payment) return null;

    const handleRefund = () => {
        if (!payment) return;

        const refundAmount =
            refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

        refundMutation.mutate(
            {
                id: payment.id,
                amount: refundType === 'partial' ? refundAmount : undefined,
                reason
            },
            {
                onSuccess: () => {
                    addToast({
                        message: 'Reembolso procesado correctamente',
                        variant: 'success'
                    });
                    onOpenChange(false);
                    setRefundType('full');
                    setPartialAmount('');
                    setReason('');
                },
                onError: (error) => {
                    addToast({
                        message: `Error al procesar reembolso: ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const refundAmount =
        refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reembolsar Pago</DialogTitle>
                    <DialogDescription>
                        Procesar reembolso para el pago {payment.id}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Payment Info */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">{payment.userName}</p>
                                <p className="text-muted-foreground text-xs">{payment.userEmail}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-lg">{formatArs(payment.amount)}</p>
                                <p className="text-muted-foreground text-xs">
                                    {formatDate(payment.date)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Refund Type */}
                    <div className="grid gap-2">
                        <Label>Tipo de Reembolso</Label>
                        <div className="flex gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="full"
                                    checked={refundType === 'full'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">Reembolso Completo</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="partial"
                                    checked={refundType === 'partial'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">Reembolso Parcial</span>
                            </label>
                        </div>
                    </div>

                    {/* Partial Amount */}
                    {refundType === 'partial' && (
                        <div className="grid gap-2">
                            <Label htmlFor="partialAmount">Monto a Reembolsar</Label>
                            <Input
                                id="partialAmount"
                                type="number"
                                placeholder="0.00"
                                value={partialAmount}
                                onChange={(e) => setPartialAmount(e.target.value)}
                                min="0"
                                max={payment.amount}
                                step="0.01"
                            />
                            <p className="text-muted-foreground text-xs">
                                Máximo: {formatArs(payment.amount)}
                            </p>
                        </div>
                    )}

                    {/* Reason */}
                    <div className="grid gap-2">
                        <Label htmlFor="reason">Motivo del Reembolso</Label>
                        <textarea
                            id="reason"
                            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Describe el motivo del reembolso..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between font-semibold text-sm">
                            <span>Total a Reembolsar:</span>
                            <span className="text-lg">{formatArs(refundAmount)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={refundMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRefund}
                        disabled={
                            refundMutation.isPending ||
                            (refundType === 'partial' && (!partialAmount || refundAmount <= 0)) ||
                            !reason
                        }
                    >
                        {refundMutation.isPending ? 'Procesando...' : 'Confirmar Reembolso'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BillingPaymentsPage() {
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
    const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch payments with filters
    const {
        data: payments = [],
        isLoading,
        isError
    } = usePaymentsQuery({
        status: statusFilter,
        method: methodFilter,
        q: searchQuery,
        startDate,
        endDate,
        minAmount: minAmount ? Number.parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? Number.parseFloat(maxAmount) : undefined
    });

    // Refund mutation
    const refundMutation = useRefundPaymentMutation();

    const filteredPayments = payments.filter((payment: Payment) => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
        const matchesSearch =
            searchQuery === '' ||
            payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        // Date range filter
        const paymentDate = new Date(payment.date);
        const matchesStartDate = !startDate || paymentDate >= new Date(startDate);
        const matchesEndDate = !endDate || paymentDate <= new Date(endDate);

        // Amount range filter
        const matchesMinAmount = !minAmount || payment.amount >= Number.parseFloat(minAmount);
        const matchesMaxAmount = !maxAmount || payment.amount <= Number.parseFloat(maxAmount);

        return (
            matchesStatus &&
            matchesMethod &&
            matchesSearch &&
            matchesStartDate &&
            matchesEndDate &&
            matchesMinAmount &&
            matchesMaxAmount
        );
    });

    const handleViewDetails = (payment: Payment) => {
        setSelectedPayment(payment);
        setDetailDialogOpen(true);
    };

    const handleRefund = (payment: Payment) => {
        setSelectedPayment(payment);
        setRefundDialogOpen(true);
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Pagos</h2>
                    <p className="text-muted-foreground">
                        Gestiona y monitorea todos los pagos del sistema
                    </p>
                </div>

                {/* Search and Quick Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Búsqueda</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <FilterIcon className="mr-2 size-4" />
                                {showFilters ? 'Ocultar Filtros' : 'Más Filtros'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label
                                    htmlFor="payment-search"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Buscar por ID o usuario
                                </label>
                                <Input
                                    id="payment-search"
                                    placeholder="ID, nombre o email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="payment-status-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Estado
                                </label>
                                <select
                                    id="payment-status-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(e.target.value as PaymentStatus | 'all')
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="completed">Completado</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="failed">Fallido</option>
                                    <option value="refunded">Reembolsado</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="payment-method-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Método de Pago
                                </label>
                                <select
                                    id="payment-method-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={methodFilter}
                                    onChange={(e) =>
                                        setMethodFilter(e.target.value as PaymentMethod | 'all')
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="credit_card">Tarjeta de Crédito</option>
                                    <option value="debit_card">Tarjeta de Débito</option>
                                    <option value="mercado_pago">Mercado Pago</option>
                                    <option value="bank_transfer">Transferencia Bancaria</option>
                                </select>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="mt-4 grid gap-4 rounded-md border bg-muted/50 p-4 md:grid-cols-2">
                                <div className="col-span-2 font-medium text-sm">
                                    Filtros Avanzados
                                </div>

                                {/* Date Range */}
                                <div>
                                    <label
                                        htmlFor="payment-start-date"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <CalendarIcon className="size-4" />
                                        Fecha Desde
                                    </label>
                                    <Input
                                        id="payment-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="payment-end-date"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <CalendarIcon className="size-4" />
                                        Fecha Hasta
                                    </label>
                                    <Input
                                        id="payment-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>

                                {/* Amount Range */}
                                <div>
                                    <label
                                        htmlFor="payment-min-amount"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <DollarSignIcon className="size-4" />
                                        Monto Mínimo
                                    </label>
                                    <Input
                                        id="payment-min-amount"
                                        type="number"
                                        placeholder="0.00"
                                        value={minAmount}
                                        onChange={(e) => setMinAmount(e.target.value)}
                                        min="0"
                                        step="100"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="payment-max-amount"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <DollarSignIcon className="size-4" />
                                        Monto Máximo
                                    </label>
                                    <Input
                                        id="payment-max-amount"
                                        type="number"
                                        placeholder="0.00"
                                        value={maxAmount}
                                        onChange={(e) => setMaxAmount(e.target.value)}
                                        min="0"
                                        step="100"
                                    />
                                </div>

                                {/* Reset Button */}
                                <div className="col-span-2 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setStartDate('');
                                            setEndDate('');
                                            setMinAmount('');
                                            setMaxAmount('');
                                        }}
                                    >
                                        Limpiar Filtros Avanzados
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payments Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Pagos</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? 'Cargando...'
                                : isError
                                  ? 'Error al cargar pagos'
                                  : filteredPayments.length === 0
                                    ? 'No hay pagos'
                                    : `${filteredPayments.length} pago${filteredPayments.length !== 1 ? 's' : ''}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Cargando pagos...
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">Error al cargar pagos</p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Verifica que la API esté disponible
                                </p>
                            </div>
                        ) : filteredPayments.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay pagos registrados aún.
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Los pagos aparecerán aquí cuando los usuarios realicen
                                    transacciones.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">ID</th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Usuario
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Monto
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Fecha
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Método
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Plan
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.map((payment: Payment) => (
                                            <tr
                                                key={payment.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="px-4 py-3 font-mono text-xs">
                                                    {payment.id.slice(0, 8)}...
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className="font-medium">
                                                            {payment.userName}
                                                        </div>
                                                        <div className="text-muted-foreground text-xs">
                                                            {payment.userEmail}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatArs(payment.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={getStatusVariant(payment.status)}
                                                    >
                                                        {getStatusLabel(payment.status)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDate(payment.date)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {getPaymentMethodLabel(payment.method)}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {payment.planName}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetails(payment)
                                                            }
                                                        >
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRefund(payment)}
                                                            disabled={
                                                                payment.status !== 'completed'
                                                            }
                                                            title={
                                                                payment.status !== 'completed'
                                                                    ? 'Solo se pueden reembolsar pagos completados'
                                                                    : 'Reembolsar pago'
                                                            }
                                                        >
                                                            Reembolsar
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Dialogs */}
                <PaymentDetailDialog
                    payment={selectedPayment}
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                />
                <RefundDialog
                    payment={selectedPayment}
                    open={refundDialogOpen}
                    onOpenChange={setRefundDialogOpen}
                    refundMutation={refundMutation}
                    addToast={addToast}
                />
            </div>
        </SidebarPageLayout>
    );
}
