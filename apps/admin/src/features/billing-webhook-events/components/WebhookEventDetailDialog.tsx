/**
 * Webhook Event Detail Dialog
 *
 * Modal dialog showing full details of a webhook event including
 * payload, retry info, and error messages.
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
    WebhookEvent,
    WebhookEventStatus,
    WebhookEventType
} from '@/features/billing-webhook-events';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithSeconds } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';

/**
 * Get status badge variant
 */
export function getStatusVariant(
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
export function getStatusLabel(
    status: WebhookEventStatus,
    t: (key: TranslationKey) => string
): string {
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
export function getTypeLabel(type: WebhookEventType, t: (key: TranslationKey) => string): string {
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

interface WebhookEventDetailDialogProps {
    readonly event: WebhookEvent | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * Webhook event detail dialog component
 */
export function WebhookEventDetailDialog({
    event,
    open,
    onOpenChange
}: WebhookEventDetailDialogProps) {
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
