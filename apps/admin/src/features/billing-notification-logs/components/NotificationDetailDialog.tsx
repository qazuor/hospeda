/**
 * Notification Detail Dialog
 *
 * Modal dialog showing full details of a billing notification log entry.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type {
    NotificationChannel,
    NotificationLog,
    NotificationStatus,
    NotificationType
} from '@/features/billing-notification-logs';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';

/**
 * Get status badge variant
 */
export function getStatusVariant(
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
export function getStatusLabel(
    status: NotificationStatus,
    t: (key: TranslationKey) => string
): string {
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
export function getTypeLabel(type: NotificationType, t: (key: TranslationKey) => string): string {
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
export function getChannelLabel(
    channel: NotificationChannel,
    t: (key: TranslationKey) => string
): string {
    const labels: Record<NotificationChannel, string> = {
        email: t('admin-billing.notificationLogs.channels.email'),
        sms: t('admin-billing.notificationLogs.channels.sms'),
        push: t('admin-billing.notificationLogs.channels.push')
    };
    return labels[channel];
}

interface NotificationDetailDialogProps {
    readonly notification: NotificationLog | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * Notification detail dialog component
 */
export function NotificationDetailDialog({
    notification,
    open,
    onOpenChange
}: NotificationDetailDialogProps) {
    const { t, locale } = useTranslations();

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
                                <p className="font-medium">
                                    {formatDateWithTime({ date: notification.sentAt, locale })}
                                </p>
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
