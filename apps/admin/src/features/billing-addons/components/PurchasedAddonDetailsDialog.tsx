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
import { useTranslations } from '@/hooks/use-translations';
import { formatCentsToArs, formatDateWithTime } from '@/lib/format-helpers';
import type { PurchasedAddon } from '../types';

interface PurchasedAddonDetailsDialogProps {
    addon: PurchasedAddon | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Get status badge variant based on status value
 */
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
    switch (status) {
        case 'active':
            return 'default';
        case 'expired':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'default';
    }
}

export function PurchasedAddonDetailsDialog({
    addon,
    open,
    onOpenChange
}: PurchasedAddonDetailsDialogProps) {
    const { t, locale } = useTranslations();

    if (!addon) return null;

    const statusLabel = t(`admin-billing.addons.purchasedStatuses.${addon.status}`) || addon.status;
    const statusVariant = getStatusVariant(addon.status);

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.addons.detailsDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.addons.detailsDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Customer Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">
                            {t('admin-billing.addons.detailsDialog.customerSection')}
                        </h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.emailLabel')}
                                    </span>
                                    <span className="font-medium">{addon.customerEmail}</span>
                                </div>
                                {addon.customerName && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.addons.detailsDialog.nameLabel')}
                                        </span>
                                        <span className="font-medium">{addon.customerName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.customerIdLabel')}
                                    </span>
                                    <span className="font-mono text-xs">{addon.customerId}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Add-on Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">
                            {t('admin-billing.addons.detailsDialog.addonSection')}
                        </h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.addonNameLabel')}
                                    </span>
                                    <span className="font-medium">{addon.addonName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.addonSlugLabel')}
                                    </span>
                                    <span className="font-mono text-xs">{addon.addonSlug}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.statusLabel')}
                                    </span>
                                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Purchase Info */}
                    <div>
                        <h3 className="mb-3 font-medium text-sm">
                            {t('admin-billing.addons.detailsDialog.purchaseSection')}
                        </h3>
                        <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.priceLabel')}
                                    </span>
                                    <span className="font-semibold">
                                        {formatCentsToArs({ cents: addon.priceArs, locale })}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-billing.addons.detailsDialog.purchasedAtLabel')}
                                    </span>
                                    <span>
                                        {formatDateWithTime({ date: addon.purchasedAt, locale })}
                                    </span>
                                </div>
                                {addon.expiresAt && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.addons.detailsDialog.expiresAtLabel')}
                                        </span>
                                        <span>
                                            {formatDateWithTime({ date: addon.expiresAt, locale })}
                                        </span>
                                    </div>
                                )}
                                {addon.paymentId && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            {t('admin-billing.addons.detailsDialog.paymentIdLabel')}
                                        </span>
                                        <span className="font-mono text-xs">{addon.paymentId}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Record ID */}
                    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                                {t('admin-billing.addons.detailsDialog.recordIdLabel')}
                            </span>
                            <span className="font-mono">{addon.id}</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
