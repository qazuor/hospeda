/**
 * Promotion Detail Dialog
 *
 * Read-only dialog showing full details of an owner promotion.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { OwnerPromotion } from '@/features/owner-promotions/types';
import { useTranslations } from '@/hooks/use-translations';

interface PromotionDetailDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly promotion: OwnerPromotion | null;
}

/**
 * Dialog displaying detailed information about an owner promotion
 */
export function PromotionDetailDialog({
    open,
    onOpenChange,
    promotion
}: PromotionDetailDialogProps) {
    const { t } = useTranslations();
    if (!promotion) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{promotion.title}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.ownerPromotions.detail.subtitle')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t('admin-billing.ownerPromotions.detail.generalInfo')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.statusLabel')}
                                </span>
                                <Badge variant={promotion.isActive ? 'success' : 'secondary'}>
                                    {promotion.isActive
                                        ? t('admin-billing.ownerPromotions.statusActive')
                                        : t('admin-billing.ownerPromotions.statusInactive')}
                                </Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.discountTypeLabel')}
                                </span>
                                <span>{promotion.discountType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.valueLabel')}
                                </span>
                                <span>{promotion.discountValue}</span>
                            </div>
                            {promotion.description && (
                                <div>
                                    <p className="mb-1 text-muted-foreground">
                                        {t('admin-billing.ownerPromotions.detail.descriptionLabel')}
                                    </p>
                                    <p>{promotion.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t('admin-billing.ownerPromotions.detail.usageStats')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.currentRedemptions')}
                                </span>
                                <span>{promotion.currentRedemptions}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.ownerPromotions.detail.maxRedemptions')}
                                </span>
                                <span>
                                    {promotion.maxRedemptions ||
                                        t('admin-billing.ownerPromotions.detail.unlimited')}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
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
