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
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CalendarIcon, FilterIcon, LoaderIcon, MailIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
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
function getStatusLabel(status: NotificationStatus, t: (key: TranslationKey) => string): string {
    const labels: Record<NotificationStatus, string> = {
        sent: t('admin-billing.notificationLogs.statuses.sent'),
        pending: t('admin-billing.notificationLogs.statuses.pending'),
        failed: t('admin-billing.notificationLogs.statuses.failed')
    };
    return labels[status];
}

/**
 * Get notification type label
 */
function getTypeLabel(type: NotificationType, t: (key: TranslationKey) => string): string {
    const labels: Record<NotificationType, string> = {
        payment_success: t('admin-billing.notificationLogs.types.paymentSuccess'),
        payment_failed: t('admin-billing.notificationLogs.types.paymentFailed'),
        trial_ending: t('admin-billing.notificationLogs.types.trialEnding'),
        trial_expired: t('admin-billing.notificationLogs.types.trialExpired'),
        subscription_cancelled: t('admin-billing.notificationLogs.types.subscriptionCancelled'),
        payment_reminder: t('admin-billing.notificationLogs.types.paymentReminder'),
        payment_receipt: t('admin-billing.notificationLogs.types.paymentReceipt')
    };
    return labels[type];
}

/**
 * Get channel label
 */
function getChannelLabel(channel: NotificationChannel, t: (key: TranslationKey) => string): string {
    const labels: Record<NotificationChannel, string> = {
        email: t('admin-billing.notificationLogs.channels.email'),
        sms: t('admin-billing.notificationLogs.channels.sms'),
        push: t('admin-billing.notificationLogs.channels.push')
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
    const { t } = useTranslations();

    if (!notification) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.notificationLogs.dialog.title')}</DialogTitle>
                    <DialogDescription>ID: {notification.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Basic Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.notificationLogs.dialog.basicInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.dialog.typeLabel')}
                                </p>
                                <p className="font-medium">{getTypeLabel(notification.type, t)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.dialog.statusLabel')}
                                </p>
                                <Badge variant={getStatusVariant(notification.status)}>
                                    {getStatusLabel(notification.status, t)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.dialog.channelLabel')}
                                </p>
                                <p className="font-medium">
                                    {getChannelLabel(notification.channel, t)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.dialog.sentDateLabel')}
                                </p>
                                <p className="font-medium">{formatDate(notification.sentAt)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Recipient Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.notificationLogs.dialog.recipientSection')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.dialog.emailPhoneLabel')}
                                </p>
                                <p className="font-medium">{notification.recipient}</p>
                            </div>
                            {notification.userName && (
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-billing.notificationLogs.dialog.userLabel')}
                                    </p>
                                    <p className="font-medium">{notification.userName}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message Content */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.notificationLogs.dialog.messageContent')}
                        </h3>
                        <div className="rounded-md bg-muted p-3 text-sm">
                            <p className="mb-1 text-muted-foreground text-xs">
                                {t('admin-billing.notificationLogs.dialog.subjectLabel')}
                            </p>
                            <p className="font-medium">{notification.subject}</p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {notification.status === 'failed' && notification.errorMessage && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-destructive text-sm">
                                {t('admin-billing.notificationLogs.dialog.errorMessage')}
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
                            <h3 className="font-semibold text-sm">
                                {t('admin-billing.notificationLogs.dialog.metadata')}
                            </h3>
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
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NotificationLogsPage() {
    const { t } = useTranslations();
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
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-billing.notificationLogs.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.notificationLogs.description')}
                    </p>
                </div>

                {/* Search and Quick Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>
                                {t('admin-billing.notificationLogs.searchAndFilters')}
                            </CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <FilterIcon className="mr-2 size-4" />
                                {showFilters
                                    ? t('admin-billing.notificationLogs.hideFilters')
                                    : t('admin-billing.notificationLogs.moreFilters')}
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
                                    {t('admin-billing.notificationLogs.searchByRecipient')}
                                </label>
                                <Input
                                    id="notification-search"
                                    placeholder={t(
                                        'admin-billing.notificationLogs.searchPlaceholder'
                                    )}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-type-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    {t('admin-billing.notificationLogs.typeFilter')}
                                </label>
                                <select
                                    id="notification-type-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={typeFilter}
                                    onChange={(e) =>
                                        setTypeFilter(e.target.value as NotificationType | 'all')
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.notificationLogs.allFilter')}
                                    </option>
                                    <option value="payment_success">
                                        {t('admin-billing.notificationLogs.types.paymentSuccess')}
                                    </option>
                                    <option value="payment_failed">
                                        {t('admin-billing.notificationLogs.types.paymentFailed')}
                                    </option>
                                    <option value="trial_ending">
                                        {t('admin-billing.notificationLogs.types.trialEnding')}
                                    </option>
                                    <option value="trial_expired">
                                        {t('admin-billing.notificationLogs.types.trialExpired')}
                                    </option>
                                    <option value="subscription_cancelled">
                                        {t(
                                            'admin-billing.notificationLogs.types.subscriptionCancelled'
                                        )}
                                    </option>
                                    <option value="payment_reminder">
                                        {t('admin-billing.notificationLogs.types.paymentReminder')}
                                    </option>
                                    <option value="payment_receipt">
                                        {t('admin-billing.notificationLogs.types.paymentReceipt')}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-status-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    {t('admin-billing.notificationLogs.statusFilter')}
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
                                    <option value="all">
                                        {t('admin-billing.notificationLogs.allFilter')}
                                    </option>
                                    <option value="sent">
                                        {t('admin-billing.notificationLogs.statuses.sent')}
                                    </option>
                                    <option value="pending">
                                        {t('admin-billing.notificationLogs.statuses.pending')}
                                    </option>
                                    <option value="failed">
                                        {t('admin-billing.notificationLogs.statuses.failed')}
                                    </option>
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="notification-channel-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    {t('admin-billing.notificationLogs.channelFilter')}
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
                                    <option value="all">
                                        {t('admin-billing.notificationLogs.allFilter')}
                                    </option>
                                    <option value="email">
                                        {t('admin-billing.notificationLogs.channels.email')}
                                    </option>
                                    <option value="sms">
                                        {t('admin-billing.notificationLogs.channels.sms')}
                                    </option>
                                    <option value="push">
                                        {t('admin-billing.notificationLogs.channels.push')}
                                    </option>
                                </select>
                            </div>
                        </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="mt-4 grid gap-4 rounded-md border bg-muted/50 p-4 md:grid-cols-2">
                                <div className="col-span-2 font-medium text-sm">
                                    {t('admin-billing.notificationLogs.advancedFilters')}
                                </div>

                                {/* Date Range */}
                                <div>
                                    <label
                                        htmlFor="notification-start-date"
                                        className="mb-2 flex items-center gap-2 font-medium text-sm"
                                    >
                                        <CalendarIcon className="size-4" />
                                        {t('admin-billing.notificationLogs.dateFrom')}
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
                                        {t('admin-billing.notificationLogs.dateTo')}
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
                                        {t('admin-billing.notificationLogs.clearAdvancedFilters')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Notifications Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.notificationLogs.historyTitle')}</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? t('admin-billing.common.loading')
                                : isError
                                  ? t('admin-billing.notificationLogs.errorLoading')
                                  : filteredNotifications.length === 0
                                    ? t('admin-billing.notificationLogs.noNotifications')
                                    : filteredNotifications.length === 1
                                      ? t('admin-billing.notificationLogs.notificationCount')
                                      : t(
                                            'admin-billing.notificationLogs.notificationCountPlural'
                                        ).replace(
                                            '{count}',
                                            filteredNotifications.length.toString()
                                        )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.notificationLogs.loadingNotifications')}
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    {t('admin-billing.notificationLogs.errorLoading')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.apiCheckError')}
                                </p>
                            </div>
                        ) : filteredNotifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <MailIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.notificationLogs.emptyTitle')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.notificationLogs.emptyHint')}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.notificationLogs.columns.date')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.notificationLogs.columns.type')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t(
                                                    'admin-billing.notificationLogs.columns.recipient'
                                                )}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t(
                                                    'admin-billing.notificationLogs.columns.subject'
                                                )}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('admin-billing.notificationLogs.columns.status')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t(
                                                    'admin-billing.notificationLogs.columns.channel'
                                                )}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t(
                                                    'admin-billing.notificationLogs.columns.actions'
                                                )}
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
                                                        {getTypeLabel(notification.type, t)}
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
                                                            {getStatusLabel(notification.status, t)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs">
                                                        {getChannelLabel(notification.channel, t)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetails(notification)
                                                            }
                                                        >
                                                            {t(
                                                                'admin-billing.notificationLogs.viewDetails'
                                                            )}
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
