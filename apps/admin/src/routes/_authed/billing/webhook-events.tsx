/**
 * Webhook Events Page
 *
 * Displays webhook events with filtering, detail view, and dead letter queue management.
 */
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
import {
    type WebhookEvent,
    type WebhookEventStatus,
    type WebhookEventType,
    useDeadLetterEventsQuery,
    useRetryWebhookEventMutation,
    useWebhookEventsQuery
} from '@/features/billing-webhook-events';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithSeconds } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';
import {
    AlertCircleIcon,
    CalendarIcon,
    FilterIcon,
    LoaderIcon,
    RefreshIcon,
    WebhookIcon
} from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/webhook-events')({
    component: WebhookEventsPage
});

type TabValue = 'events' | 'dead-letter';

/**
 * Get status badge variant
 */
function getStatusVariant(
    status: WebhookEventStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
    const variants: Record<
        WebhookEventStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        processed: 'default',
        pending: 'secondary',
        failed: 'destructive'
    };
    return variants[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: WebhookEventStatus, t: (key: TranslationKey) => string): string {
    const labels: Record<WebhookEventStatus, string> = {
        processed: t('admin-billing.webhookEvents.statuses.processed'),
        pending: t('admin-billing.webhookEvents.statuses.pending'),
        failed: t('admin-billing.webhookEvents.statuses.failed')
    };
    return labels[status];
}

/**
 * Get event type label
 */
function getTypeLabel(type: WebhookEventType, t: (key: TranslationKey) => string): string {
    const labels: Record<WebhookEventType, string> = {
        'payment.created': t('admin-billing.webhookEvents.types.paymentCreated'),
        'payment.updated': t('admin-billing.webhookEvents.types.paymentUpdated'),
        'subscription.created': t('admin-billing.webhookEvents.types.subscriptionCreated'),
        'subscription.updated': t('admin-billing.webhookEvents.types.subscriptionUpdated'),
        'subscription.cancelled': t('admin-billing.webhookEvents.types.subscriptionCancelled'),
        'invoice.created': t('admin-billing.webhookEvents.types.invoiceCreated'),
        'invoice.paid': t('admin-billing.webhookEvents.types.invoicePaid'),
        'invoice.failed': t('admin-billing.webhookEvents.types.invoiceFailed')
    };
    return labels[type] || type;
}

/**
 * Webhook event detail dialog component
 */
function WebhookEventDetailDialog({
    event,
    open,
    onOpenChange
}: {
    event: WebhookEvent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t, locale } = useTranslations();

    if (!event) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.webhookEvents.dialog.title')}</DialogTitle>
                    <DialogDescription>ID: {event.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Basic Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.webhookEvents.dialog.basicInfo')}
                        </h3>
                        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.providerLabel')}
                                </p>
                                <p className="font-medium">{event.provider}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.typeLabel')}
                                </p>
                                <p className="font-medium">{getTypeLabel(event.type, t)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.statusLabel')}
                                </p>
                                <Badge variant={getStatusVariant(event.status)}>
                                    {getStatusLabel(event.status, t)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.providerIdLabel')}
                                </p>
                                <p className="font-mono text-xs">{event.providerEventId}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.receivedLabel')}
                                </p>
                                <p className="text-xs">
                                    {formatDateWithSeconds({ date: event.receivedAt, locale })}
                                </p>
                            </div>
                            {event.processedAt && (
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-billing.webhookEvents.dialog.processedLabel')}
                                    </p>
                                    <p className="text-xs">
                                        {formatDateWithSeconds({ date: event.processedAt, locale })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Retry Information */}
                    {event.retryCount !== undefined && event.retryCount > 0 && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-sm">
                                {t('admin-billing.webhookEvents.dialog.retriesSection')}
                            </h3>
                            <div className="rounded-md bg-muted p-3 text-sm">
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.dialog.retryCountLabel')}{' '}
                                    <span className="font-medium">{event.retryCount}</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {event.status === 'failed' && event.errorMessage && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-destructive text-sm">
                                {t('admin-billing.webhookEvents.dialog.errorMessage')}
                            </h3>
                            <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                                <p className="font-mono text-destructive text-xs">
                                    {event.errorMessage}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Payload */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.webhookEvents.dialog.payloadJson')}
                        </h3>
                        <div className="rounded-md bg-muted p-3">
                            <pre className="overflow-x-auto font-mono text-xs">
                                {JSON.stringify(event.payload, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function WebhookEventsPage() {
    const { t, tPlural, locale } = useTranslations();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabValue>('events');
    const [typeFilter, setTypeFilter] = useState<WebhookEventType | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<WebhookEventStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch webhook events with filters
    const {
        data: eventsData = [],
        isLoading: isLoadingEvents,
        isError: isErrorEvents
    } = useWebhookEventsQuery({
        type: typeFilter,
        status: statusFilter,
        q: searchQuery,
        startDate,
        endDate
    });
    const events = eventsData as unknown as WebhookEvent[];

    // Fetch dead letter queue
    const {
        data: deadLetterEventsData = [],
        isLoading: isLoadingDeadLetter,
        isError: isErrorDeadLetter
    } = useDeadLetterEventsQuery();
    const deadLetterEvents = deadLetterEventsData as unknown as WebhookEvent[];

    // Retry mutation
    const retryMutation = useRetryWebhookEventMutation();

    const filteredEvents = events.filter((event: WebhookEvent) => {
        const matchesType = typeFilter === 'all' || event.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
        const matchesSearch =
            searchQuery === '' ||
            event.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.providerEventId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            event.provider.toLowerCase().includes(searchQuery.toLowerCase());

        // Date range filter
        const eventDate = new Date(event.receivedAt);
        const matchesStartDate = !startDate || eventDate >= new Date(startDate);
        const matchesEndDate = !endDate || eventDate <= new Date(endDate);

        return matchesType && matchesStatus && matchesSearch && matchesStartDate && matchesEndDate;
    });

    const handleViewDetails = (event: WebhookEvent) => {
        setSelectedEvent(event);
        setDetailDialogOpen(true);
    };

    const handleRetry = (eventId: string) => {
        retryMutation.mutate(eventId, {
            onSuccess: () => {
                addToast({
                    message: t('admin-billing.webhookEvents.toasts.retrySuccess'),
                    variant: 'success'
                });
            },
            onError: (error) => {
                addToast({
                    message: `${t('admin-billing.webhookEvents.toasts.retryError')} ${error.message}`,
                    variant: 'error'
                });
            }
        });
    };

    const isLoading = activeTab === 'events' ? isLoadingEvents : isLoadingDeadLetter;
    const isError = activeTab === 'events' ? isErrorEvents : isErrorDeadLetter;
    const displayEvents = activeTab === 'events' ? filteredEvents : deadLetterEvents;

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.webhookEvents.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.webhookEvents.description')}
                    </p>
                </div>

                {/* Tabs */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-4 border-b">
                            <button
                                type="button"
                                className={`relative px-4 pb-3 font-medium text-sm transition-colors ${
                                    activeTab === 'events'
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setActiveTab('events')}
                            >
                                {t('admin-billing.webhookEvents.tabs.events')}
                                {activeTab === 'events' && (
                                    <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />
                                )}
                            </button>
                            <button
                                type="button"
                                className={`relative px-4 pb-3 font-medium text-sm transition-colors ${
                                    activeTab === 'dead-letter'
                                        ? 'text-primary'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setActiveTab('dead-letter')}
                            >
                                {t('admin-billing.webhookEvents.tabs.deadLetter')}
                                {deadLetterEvents.length > 0 && (
                                    <Badge
                                        className="ml-2"
                                        variant="destructive"
                                    >
                                        {deadLetterEvents.length}
                                    </Badge>
                                )}
                                {activeTab === 'dead-letter' && (
                                    <div className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />
                                )}
                            </button>
                        </div>
                    </CardHeader>
                </Card>

                {/* Filters (only show for events tab) */}
                {activeTab === 'events' && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>
                                    {t('admin-billing.webhookEvents.searchAndFilters')}
                                </CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <FilterIcon className="mr-2 size-4" />
                                    {showFilters
                                        ? t('admin-billing.webhookEvents.hideFilters')
                                        : t('admin-billing.webhookEvents.moreFilters')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label
                                        htmlFor="webhook-search"
                                        className="mb-2 block font-medium text-sm"
                                    >
                                        {t('admin-billing.webhookEvents.searchLabel')}
                                    </label>
                                    <Input
                                        id="webhook-search"
                                        placeholder={t(
                                            'admin-billing.webhookEvents.searchPlaceholder'
                                        )}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="webhook-type-filter"
                                        className="mb-2 block font-medium text-sm"
                                    >
                                        {t('admin-billing.webhookEvents.typeFilter')}
                                    </label>
                                    <select
                                        id="webhook-type-filter"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={typeFilter}
                                        onChange={(e) =>
                                            setTypeFilter(
                                                e.target.value as WebhookEventType | 'all'
                                            )
                                        }
                                    >
                                        <option value="all">
                                            {t('admin-billing.webhookEvents.allFilter')}
                                        </option>
                                        <option value="payment.created">
                                            {t('admin-billing.webhookEvents.types.paymentCreated')}
                                        </option>
                                        <option value="payment.updated">
                                            {t('admin-billing.webhookEvents.types.paymentUpdated')}
                                        </option>
                                        <option value="subscription.created">
                                            {t(
                                                'admin-billing.webhookEvents.types.subscriptionCreated'
                                            )}
                                        </option>
                                        <option value="subscription.updated">
                                            {t(
                                                'admin-billing.webhookEvents.types.subscriptionUpdated'
                                            )}
                                        </option>
                                        <option value="subscription.cancelled">
                                            {t(
                                                'admin-billing.webhookEvents.types.subscriptionCancelled'
                                            )}
                                        </option>
                                        <option value="invoice.created">
                                            {t('admin-billing.webhookEvents.types.invoiceCreated')}
                                        </option>
                                        <option value="invoice.paid">
                                            {t('admin-billing.webhookEvents.types.invoicePaid')}
                                        </option>
                                        <option value="invoice.failed">
                                            {t('admin-billing.webhookEvents.types.invoiceFailed')}
                                        </option>
                                    </select>
                                </div>
                                <div>
                                    <label
                                        htmlFor="webhook-status-filter"
                                        className="mb-2 block font-medium text-sm"
                                    >
                                        {t('admin-billing.webhookEvents.statusFilter')}
                                    </label>
                                    <select
                                        id="webhook-status-filter"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={statusFilter}
                                        onChange={(e) =>
                                            setStatusFilter(
                                                e.target.value as WebhookEventStatus | 'all'
                                            )
                                        }
                                    >
                                        <option value="all">
                                            {t('admin-billing.webhookEvents.allFilter')}
                                        </option>
                                        <option value="processed">
                                            {t('admin-billing.webhookEvents.statuses.processed')}
                                        </option>
                                        <option value="pending">
                                            {t('admin-billing.webhookEvents.statuses.pending')}
                                        </option>
                                        <option value="failed">
                                            {t('admin-billing.webhookEvents.statuses.failed')}
                                        </option>
                                    </select>
                                </div>
                            </div>

                            {/* Advanced Filters */}
                            {showFilters && (
                                <div className="mt-4 grid gap-4 rounded-md border bg-muted/50 p-4 md:grid-cols-2">
                                    <div className="col-span-2 font-medium text-sm">
                                        {t('admin-billing.webhookEvents.advancedFilters')}
                                    </div>

                                    {/* Date Range */}
                                    <div>
                                        <label
                                            htmlFor="webhook-start-date"
                                            className="mb-2 flex items-center gap-2 font-medium text-sm"
                                        >
                                            <CalendarIcon className="size-4" />
                                            {t('admin-billing.webhookEvents.dateFrom')}
                                        </label>
                                        <Input
                                            id="webhook-start-date"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="webhook-end-date"
                                            className="mb-2 flex items-center gap-2 font-medium text-sm"
                                        >
                                            <CalendarIcon className="size-4" />
                                            {t('admin-billing.webhookEvents.dateTo')}
                                        </label>
                                        <Input
                                            id="webhook-end-date"
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
                                            {t('admin-billing.webhookEvents.clearAdvancedFilters')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Events Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {activeTab === 'events'
                                ? t('admin-billing.webhookEvents.eventsHistoryTitle')
                                : t('admin-billing.webhookEvents.deadLetterTitle')}
                        </CardTitle>
                        <CardDescription>
                            {isLoading
                                ? t('admin-billing.common.loading')
                                : isError
                                  ? t('admin-billing.webhookEvents.errorLoading')
                                  : displayEvents.length === 0
                                    ? activeTab === 'events'
                                        ? t('admin-billing.webhookEvents.noEvents')
                                        : t('admin-billing.webhookEvents.noDeadLetterEvents')
                                    : tPlural(
                                          'admin-billing.webhookEvents.eventCount',
                                          displayEvents.length
                                      )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.webhookEvents.loadingEvents')}
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    {t('admin-billing.webhookEvents.errorLoading')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.webhookEvents.apiCheckError')}
                                </p>
                            </div>
                        ) : displayEvents.length === 0 ? (
                            <div className="py-12 text-center">
                                {activeTab === 'events' ? (
                                    <WebhookIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                ) : (
                                    <AlertCircleIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                )}
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {activeTab === 'events'
                                        ? t('admin-billing.webhookEvents.emptyEventsTitle')
                                        : t('admin-billing.webhookEvents.emptyDeadLetterTitle')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {activeTab === 'events'
                                        ? t('admin-billing.webhookEvents.emptyEventsHint')
                                        : t('admin-billing.webhookEvents.emptyDeadLetterHint')}
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
                                                Proveedor
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Tipo
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                ID Proveedor
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            {activeTab === 'dead-letter' && (
                                                <th className="px-4 py-3 text-center font-medium">
                                                    Reintentos
                                                </th>
                                            )}
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayEvents.map((event: WebhookEvent) => (
                                            <tr
                                                key={event.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDateWithSeconds({
                                                        date: event.receivedAt,
                                                        locale
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-sm">
                                                    {event.provider}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {getTypeLabel(event.type, t)}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs">
                                                    {event.providerEventId.slice(0, 12)}...
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant={getStatusVariant(event.status)}>
                                                        {getStatusLabel(event.status, t)}
                                                    </Badge>
                                                </td>
                                                {activeTab === 'dead-letter' && (
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline">
                                                            {event.retryCount || 0}
                                                        </Badge>
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewDetails(event)}
                                                        >
                                                            Ver
                                                        </Button>
                                                        {activeTab === 'dead-letter' && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleRetry(event.id)
                                                                }
                                                                disabled={retryMutation.isPending}
                                                            >
                                                                <RefreshIcon className="mr-1 h-3 w-3" />
                                                                Reintentar
                                                            </Button>
                                                        )}
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

                {/* Detail Dialog */}
                <WebhookEventDetailDialog
                    event={selectedEvent}
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                />
            </div>
        </SidebarPageLayout>
    );
}
