/**
 * Purchased Add-on Details Dialog
 *
 * Shows full details of a purchased add-on (customer addon)
 */
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { PurchasedAddon } from '../types';

interface PurchasedAddonDetailsDialogProps {
    addon: PurchasedAddon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Format date to Spanish locale
 */
function formatDate(dateString: string | null): string {
    if (!dateString) return '—';

    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(dateString));
}

/**
 * Format price in ARS
 */
function formatPrice(cents: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(cents / 100);
}

/**
 * Get status badge variant
 */
function getStatusBadge(status: string) {
    switch (status) {
        case 'active':
            return { label: 'Activo', variant: 'default' as const };
        case 'expired':
            return { label: 'Expirado', variant: 'secondary' as const };
        case 'cancelled':
            return { label: 'Cancelado', variant: 'destructive' as const };
        default:
            return { label: status, variant: 'default' as const };
    }
}

export function PurchasedAddonDetailsDialog({
    addon,
    open,
    onOpenChange
}: PurchasedAddonDetailsDialogProps) {
    if (!addon) return null;

    const statusBadge = getStatusBadge(addon.status);

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Detalles del Add-on Comprado</DialogTitle>
                    <DialogDescription>
                        Información completa del add-on adquirido por el cliente
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">Información del Cliente</h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Email:</span>
                                    <span className="font-medium">{addon.customerEmail}</span>
                                </div>
                                {addon.customerName && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Nombre:</span>
                                        <span className="font-medium">{addon.customerName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Customer ID:</span>
                                    <span className="font-mono text-xs">{addon.customerId}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add-on Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">Información del Add-on</h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Nombre:</span>
                                    <span className="font-medium">{addon.addonName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Slug:</span>
                                    <span className="font-mono text-xs">{addon.addonSlug}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Estado:</span>
                                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Purchase Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">Información de Compra</h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Precio:</span>
                                    <span className="font-semibold">
                                        {formatPrice(addon.priceArs)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Fecha de compra:</span>
                                    <span>{formatDate(addon.purchasedAt)}</span>
                                </div>
                                {addon.expiresAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Fecha de expiración:
                                        </span>
                                        <span>{formatDate(addon.expiresAt)}</span>
                                    </div>
                                )}
                                {addon.paymentId && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">ID de Pago:</span>
                                        <span className="font-mono text-xs">{addon.paymentId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Record ID */}
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">ID del registro:</span>
                            <span className="font-mono">{addon.id}</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
