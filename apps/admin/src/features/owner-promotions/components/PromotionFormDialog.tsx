/**
 * Promotion Form Dialog (Create/Edit)
 *
 * Modal dialog for creating or editing owner promotions.
 */
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateOwnerPromotionMutation,
    useUpdateOwnerPromotionMutation
} from '@/features/owner-promotions/hooks';
import type { CreateOwnerPromotionInput, OwnerPromotion } from '@/features/owner-promotions/types';
import { useTranslations } from '@/hooks/use-translations';
import { LifecycleStatusEnum } from '@repo/schemas';
import { useState } from 'react';

interface PromotionFormDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly promotion: OwnerPromotion | null;
    readonly mode: 'create' | 'edit';
}

/**
 * Dialog for creating or editing an owner promotion
 */
export function PromotionFormDialog({
    open,
    onOpenChange,
    promotion,
    mode
}: PromotionFormDialogProps) {
    const { t } = useTranslations();
    const [formData, setFormData] = useState<CreateOwnerPromotionInput>({
        ownerId: promotion?.ownerId || '',
        accommodationId: promotion?.accommodationId || '',
        title: promotion?.title || '',
        description: promotion?.description || '',
        discountType: promotion?.discountType || 'PERCENTAGE',
        discountValue: promotion?.discountValue || 0,
        minNights: promotion?.minNights || undefined,
        validFrom: promotion?.validFrom || '',
        validUntil: promotion?.validUntil || '',
        maxRedemptions: promotion?.maxRedemptions || undefined,
        lifecycleState: promotion?.lifecycleState ?? LifecycleStatusEnum.ACTIVE
    });

    const createMutation = useCreateOwnerPromotionMutation();
    const updateMutation = useUpdateOwnerPromotionMutation();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (mode === 'create') {
            createMutation.mutate(formData, {
                onSuccess: () => {
                    onOpenChange(false);
                }
            });
        } else if (promotion) {
            updateMutation.mutate(
                { ...formData, id: promotion.id },
                {
                    onSuccess: () => {
                        onOpenChange(false);
                    }
                }
            );
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create'
                            ? t('admin-billing.ownerPromotions.form.createTitle')
                            : t('admin-billing.ownerPromotions.form.editTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? t('admin-billing.ownerPromotions.form.createDescription')
                            : t('admin-billing.ownerPromotions.form.editDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">
                                {t('admin-billing.ownerPromotions.form.titleLabel')}
                            </Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData((prev) => ({ ...prev, title: e.target.value }))
                                }
                                required
                                placeholder={t(
                                    'admin-billing.ownerPromotions.form.titlePlaceholder'
                                )}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">
                                {t('admin-billing.ownerPromotions.form.descriptionLabel')}
                            </Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        description: e.target.value
                                    }))
                                }
                                rows={3}
                                placeholder={t(
                                    'admin-billing.ownerPromotions.form.descriptionPlaceholder'
                                )}
                            />
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="discountType">
                                    {t('admin-billing.ownerPromotions.form.discountTypeLabel')}
                                </Label>
                                <select
                                    id="discountType"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.discountType}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountType: e.target.value as
                                                | 'PERCENTAGE'
                                                | 'FIXED_AMOUNT'
                                                | 'FREE_NIGHT'
                                                | 'SPECIAL_PRICE'
                                        }))
                                    }
                                >
                                    <option value="PERCENTAGE">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.percentage'
                                        )}
                                    </option>
                                    <option value="FIXED_AMOUNT">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.fixedAmount'
                                        )}
                                    </option>
                                    <option value="FREE_NIGHT">
                                        {t('admin-billing.ownerPromotions.discountTypes.freeNight')}
                                    </option>
                                    <option value="SPECIAL_PRICE">
                                        {t(
                                            'admin-billing.ownerPromotions.discountTypes.specialPrice'
                                        )}
                                    </option>
                                </select>
                            </div>

                            <div>
                                <Label htmlFor="discountValue">
                                    {t('admin-billing.ownerPromotions.form.valueLabel')}
                                </Label>
                                <Input
                                    id="discountValue"
                                    type="number"
                                    value={formData.discountValue}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            discountValue: Number(e.target.value)
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                            <div>
                                <Label htmlFor="validFrom">
                                    {t('admin-billing.ownerPromotions.form.validFromLabel')}
                                </Label>
                                <Input
                                    id="validFrom"
                                    type="date"
                                    value={formData.validFrom}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validFrom: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="validUntil">
                                    {t('admin-billing.ownerPromotions.form.validUntilLabel')}
                                </Label>
                                <Input
                                    id="validUntil"
                                    type="date"
                                    value={formData.validUntil}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            validUntil: e.target.value
                                        }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="lifecycleState">
                                {t('admin-billing.ownerPromotions.form.lifecycleStateLabel')}
                            </Label>
                            <select
                                id="lifecycleState"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.lifecycleState}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        lifecycleState: e.target.value as LifecycleStatusEnum
                                    }))
                                }
                            >
                                <option value={LifecycleStatusEnum.DRAFT}>
                                    {t('admin-billing.ownerPromotions.statusDraft')}
                                </option>
                                <option value={LifecycleStatusEnum.ACTIVE}>
                                    {t('admin-billing.ownerPromotions.statusActive')}
                                </option>
                                <option value={LifecycleStatusEnum.ARCHIVED}>
                                    {t('admin-billing.ownerPromotions.statusArchived')}
                                </option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('admin-billing.ownerPromotions.form.cancelButton')}
                        </Button>
                        <Button type="submit">
                            {mode === 'create'
                                ? t('admin-billing.ownerPromotions.form.createSubmit')
                                : t('admin-billing.ownerPromotions.form.editSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
