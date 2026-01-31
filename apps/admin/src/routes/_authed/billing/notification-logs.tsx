/**
 * Notification Logs Page
 *
 * Displays billing notification logs with filtering and detail view.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
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
import {
    type NotificationChannel,
    type NotificationLog,
    type NotificationStatus,
    type NotificationType,
    useNotificationLogsQuery
} from '@/features/billing-notification-logs';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarIcon, FilterIcon, MailIcon } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/notification-logs')({
    component: NotificationLogsPage
});

/**
 * Get status badge variant
 */
function getStatusVariant(
    status: NotificationStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variants: Record<
        NotificationStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        sent: 'default',
        pending: 'secondary',
        failed: 'destructive'
    };
    return variants[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: NotificationStatus): string {
    const labels: Record<NotificationStatus, string> = {
        sent: 'Enviado',
        pending: 'Pendiente',
        failed: 'Fallido'
    };
    return labels[status];
}

/**
 * Get notification type label
 */
function getTypeLabel(type: NotificationType): string {
    const labels: Record<NotificationType, string> = {
        payment_success: 'Pago Exitoso',
        payment_failed: 'Pago Fallido',
        trial_ending: 'Prueba Finalizando',
        trial_expired: 'Prueba Expirada',
        subscription_cancelled: 'Suscripción Cancelada',
        payment_reminder: 'Recordatorio de Pago',
        payment_receipt: 'Recibo de Pago'
    };
    return labels[type];
}

/**
 * Get channel label
 */
function getChannelLabel(channel: NotificationChannel): string {
    const labels: Record<NotificationChannel, string> = {
        email: 'Email',
        sms: 'SMS',
        push: 'Push'
    };
    return labels[channel];
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
 * Notification detail dialog component
 */
function NotificationDetailDialog({
    notification,
    open,
    onOpenChange
}: {
    notification: NotificationLog | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    if (!notification) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalles de Notificación</DialogTitle>
                    <DialogDescription>ID: {notification.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Basic Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Información Básica</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Tipo</p>
                                <p className="font-medium">{getTypeLabel(notification.type)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Estado</p>
                                <Badge variant={getStatusVariant(notification.status)}>
                                    {getStatusLabel(notification.status)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Canal</p>
                                <p className="font-medium">
                                    {getChannelLabel(notification.channel)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Fecha de Envío</p>
                                <p className="font-medium">{formatDate(notification.sentAt)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Recipient Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Destinatario</h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Email/Teléfono</p>
                                <p className="font-medium">{notification.recipient}</p>
                            </div>
                            {notification.userName && (
                                <div>
                                    <p className="text-muted-foreground text-xs">Usuario</p>
                                    <p className="font-medium">{notification.userName}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message Content */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">Contenido del Mensaje</h3>
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <p className="mb-1 text-muted-foreground text-xs">Asunto</p>
                            <p className="font-medium">{notification.subject}</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {notification.status === 'failed' && notification.errorMessage && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-destructive text-sm">
                                Mensaje de Error
                            </h3>
                            <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm">
                                <p className="font-mono text-destructive text-xs">
                                    {notification.errorMessage}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Metadata */}
                    {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-sm">Metadata</h3>
                            <div className="rounded-md bg-muted p-3">
                                <pre className="overflow-x-auto font-mono text-xs">
                                    {JSON.stringify(notification.metadata, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}
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

function NotificationLogsPage() {
    const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<NotificationStatus | 'all'>('all');
    const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedNotification, setSelectedNotification] = useState<NotificationLog | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch notification logs with filters
    const {
        data: notifications = [],
        isLoading,
        isError
    } = useNotificationLogsQuery({
        type: typeFilter,
        status: statusFilter,
        channel: channelFilter,
        q: searchQuery,
        startDate,
        endDate
    });

    const filteredNotifications = notifications.filter((notification: NotificationLog) => {
        const matchesType = typeFilter === 'all' || notification.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || notification.status === statusFilter;
        const matchesChannel = channelFilter === 'all' || notification.channel === channelFilter;
        const matchesSearch =
            searchQuery === '' ||
            notification.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            notification.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
            notification.subject.toLowerCase().includes(searchQuery.toLowerCase());

        // Date range filter
        const notificationDate = new Date(notification.sentAt);
        const matchesStartDate = !startDate || notificationDate >= new Date(startDate);
        const matchesEndDate = !endDate || notificationDate <= new Date(endDate);

        return (
            matchesType &&
            matchesStatus &&
            matchesChannel &&
            matchesSearch &&
            matchesStartDate &&
            matchesEndDate
        );
    });

    const handleViewDetails = (notification: NotificationLog) => {
        setSelectedNotification(notification);
        setDetailDialogOpen(true);
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Registro de Notificaciones</h2>
                    <p className="text-muted-foreground">
                        Monitorea todas las notificaciones enviadas por el sistema de facturación
                    </p>
                </div>

                {/* Search and Quick Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Búsqueda y Filtros</CardTitle>
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
                        <div className="grid gap-4 md:grid-cols-4">
                            <div>
                                <label
                                    htmlFor="notification-search"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Buscar por destinatario
                                </label>
                                <Input
                                    id="notification-search"
                                    placeholder="Email, ID o asunto..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-type-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Tipo
                                </label>
                                <select
                                    id="notification-type-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={typeFilter}
                                    onChange={(e) =>
                                        setTypeFilter(e.target.value as NotificationType | 'all')
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="payment_success">Pago Exitoso</option>
                                    <option value="payment_failed">Pago Fallido</option>
                                    <option value="trial_ending">Prueba Finalizando</option>
                                    <option value="trial_expired">Prueba Expirada</option>
                                    <option value="subscription_cancelled">
                                        Suscripción Cancelada
                                    </option>
                                    <option value="payment_reminder">Recordatorio de Pago</option>
                                    <option value="payment_receipt">Recibo de Pago</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-status-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Estado
                                </label>
                                <select
                                    id="notification-status-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value as NotificationStatus | 'all'
                                        )
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="sent">Enviado</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="failed">Fallido</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-channel-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    Canal
                                </label>
                                <select
                                    id="notification-channel-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={channelFilter}
                                    onChange={(e) =>
                                        setChannelFilter(
                                            e.target.value as NotificationChannel | 'all'
                                        )
                                    }
                                >
                                    <option value="all">Todos</option>
                                    <option value="email">Email</option>
                                    <option value="sms">SMS</option>
                                    <option value="push">Push</option>
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
                                        htmlFor="notification-start-date"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <CalendarIcon className="size-4" />
                                        Fecha Desde
                                    </label>
                                    <Input
                                        id="notification-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="notification-end-date"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <CalendarIcon className="size-4" />
                                        Fecha Hasta
                                    </label>
                                    <Input
                                        id="notification-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
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
                                        }}
                                    >
                                        Limpiar Filtros Avanzados
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Notifications Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Notificaciones</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? 'Cargando...'
                                : isError
                                  ? 'Error al cargar notificaciones'
                                  : filteredNotifications.length === 0
                                    ? 'No hay notificaciones'
                                    : `${filteredNotifications.length} notificación${filteredNotifications.length !== 1 ? 'es' : ''}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Cargando notificaciones...
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    Error al cargar notificaciones
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Verifica que la API esté disponible
                                </p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <MailIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    No hay notificaciones registradas aún.
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Las notificaciones aparecerán aquí cuando el sistema las envíe.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                Fecha
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Tipo
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Destinatario
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Asunto
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Canal
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredNotifications.map(
                                            (notification: NotificationLog) => (
                                                <tr
                                                    key={notification.id}
                                                    className="border-b hover:bg-muted/50"
                                                >
                                                    <td className="px-4 py-3 text-muted-foreground text-xs">
                                                        {formatDate(notification.sentAt)}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {getTypeLabel(notification.type)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-sm">
                                                            {notification.recipient}
                                                        </div>
                                                        {notification.userName && (
                                                            <div className="text-muted-foreground text-xs">
                                                                {notification.userName}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="max-w-xs truncate px-4 py-3 text-sm">
                                                        {notification.subject}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge
                                                            variant={getStatusVariant(
                                                                notification.status
                                                            )}
                                                        >
                                                            {getStatusLabel(notification.status)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs">
                                                        {getChannelLabel(notification.channel)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetails(notification)
                                                            }
                                                        >
                                                            Ver Detalles
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Detail Dialog */}
                <NotificationDetailDialog
                    notification={selectedNotification}
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                />
            </div>
        </SidebarPageLayout>
    );
}
