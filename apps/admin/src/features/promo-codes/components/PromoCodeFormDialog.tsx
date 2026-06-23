/**
 * Promo Code Create/Edit Dialog Component
 *
 * Form dialog for creating new promo codes or editing existing ones. The form
 * state matches the API request contract (CreatePromoCodePayload). Plan
 * restrictions are selected from the real billing plans (plan IDs), not
 * hard-coded categories.
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { usePlansQuery } from '@/features/billing-plans';
import {
    type CreatePromoCodePayload,
    type DiscountType,
    type EffectKind,
    type PromoCode,
    buildEffect
} from '@/features/promo-codes';
import { useTranslations } from '@/hooks/use-translations';
import { PromoEffectSchema } from '@repo/schemas';
import { useState } from 'react';

interface PromoCodeFormDialogProps {
    readonly promoCode: PromoCode | null;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (data: CreatePromoCodePayload) => void;
}

/** ISO datetime string -> yyyy-mm-dd for a native date input. */
function toDateInput(iso: string | null): string {
    return iso ? (iso.split('T')[0] ?? '') : '';
}

/** yyyy-mm-dd from a date input -> ISO datetime string (or null when empty). */
function fromDateInput(value: string): string | null {
    return value ? new Date(value).toISOString() : null;
}

/**
 * Derive the flat effect-state fields from a promo code being edited.
 *
 * Prefers the typed `effect` (SPEC-262) when present; otherwise falls back to
 * the legacy `type` + `value` shape (treated as a one-shot discount) so codes
 * created before the effect migration still hydrate correctly.
 */
function deriveEffectState(
    promoCode: PromoCode | null
): Pick<
    CreatePromoCodePayload,
    | 'effectKind'
    | 'valueKind'
    | 'discountValue'
    | 'durationCycles'
    | 'durationForever'
    | 'extraDays'
> {
    const effect = promoCode?.effect;
    // Note: fields that don't apply to a given effect kind carry harmless
    // sentinel defaults (the form hides those inputs and `effectKind` is the
    // submit-time discriminant), so they never reach the assembled effect.
    if (effect?.kind === 'trial_extension') {
        return {
            effectKind: 'trial_extension',
            valueKind: 'percentage',
            discountValue: 0,
            durationCycles: 1,
            durationForever: false,
            extraDays: effect.extraDays
        };
    }
    if (effect?.kind === 'comp') {
        return {
            effectKind: 'comp',
            valueKind: 'percentage',
            discountValue: 0,
            durationCycles: 1,
            durationForever: false,
            extraDays: 30
        };
    }
    if (effect?.kind === 'discount') {
        return {
            effectKind: 'discount',
            valueKind: effect.valueKind,
            discountValue: effect.value,
            durationCycles: effect.durationCycles ?? 1,
            durationForever: effect.durationCycles === null,
            extraDays: 30
        };
    }
    // Legacy fallback (no typed effect): one-shot discount from type + value.
    return {
        effectKind: 'discount',
        valueKind: promoCode?.type ?? 'percentage',
        discountValue: promoCode?.value ?? 0,
        durationCycles: 1,
        durationForever: false,
        extraDays: 30
    };
}

function buildInitialState(promoCode: PromoCode | null): CreatePromoCodePayload {
    return {
        code: promoCode?.code ?? '',
        description: promoCode?.description ?? '',
        ...deriveEffectState(promoCode),
        maxUses: promoCode?.maxUses ?? null,
        maxUsesPerUser: promoCode?.maxUsesPerUser ?? null,
        validFrom: promoCode?.validFrom ?? null,
        expiryDate: promoCode?.expiresAt ?? null,
        planRestrictions: promoCode ? [...promoCode.validPlans] : [],
        isStackable: promoCode?.isStackable ?? false,
        isActive: promoCode?.active ?? true,
        firstPurchaseOnly: promoCode?.newCustomersOnly ?? false,
        minAmount: promoCode?.minAmount ?? null
    };
}

/**
 * Create/Edit Dialog Component for promo codes
 */
export function PromoCodeFormDialog({
    promoCode,
    isOpen,
    onClose,
    onSubmit
}: PromoCodeFormDialogProps) {
    const { t } = useTranslations();
    const isEdit = !!promoCode;

    const [formData, setFormData] = useState<CreatePromoCodePayload>(() =>
        buildInitialState(promoCode)
    );
    const [effectError, setEffectError] = useState<string | null>(null);

    const { data: plansData } = usePlansQuery({ isActive: true });
    const plans = plansData?.items ?? [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // On edit the effect is immutable (UpdatePromoCodeSchema is strict and
        // ignores effect fields), so only validate it on create.
        if (!isEdit) {
            const parsed = PromoEffectSchema.safeParse(buildEffect(formData));
            if (!parsed.success) {
                setEffectError(t('admin-billing.promoCodes.form.effect.validationError'));
                return;
            }
        }
        setEffectError(null);
        onSubmit({ ...formData, code: formData.code.toUpperCase() });
    };

    const handlePlanToggle = (planId: string) => {
        const current = formData.planRestrictions;
        const next = current.includes(planId)
            ? current.filter((id) => id !== planId)
            : [...current, planId];
        setFormData({ ...formData, planRestrictions: next });
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit
                            ? t('admin-billing.promoCodes.form.editTitle')
                            : t('admin-billing.promoCodes.form.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? t('admin-billing.promoCodes.form.editDescription')
                            : t('admin-billing.promoCodes.form.createDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Code */}
                    <div className="space-y-2">
                        <Label htmlFor="code">{t('admin-billing.promoCodes.form.codeLabel')}</Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) =>
                                setFormData({ ...formData, code: e.target.value.toUpperCase() })
                            }
                            placeholder={t('admin-billing.promoCodes.form.codePlaceholder')}
                            className="font-mono uppercase"
                            required
                            disabled={isEdit}
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">
                            {t('admin-billing.promoCodes.form.descriptionLabel')}
                        </Label>
                        <Input
                            id="description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder={t('admin-billing.promoCodes.form.descriptionPlaceholder')}
                            required
                        />
                    </div>

                    {/* Effect kind (SPEC-262) — immutable once created */}
                    <div className="space-y-2">
                        <Label htmlFor="effectKind">
                            {t('admin-billing.promoCodes.form.effect.kindLabel')}
                        </Label>
                        <Select
                            value={formData.effectKind}
                            onValueChange={(value) =>
                                setFormData({
                                    ...formData,
                                    effectKind: value as EffectKind
                                })
                            }
                            disabled={isEdit}
                        >
                            <SelectTrigger id="effectKind">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="discount">
                                    {t('admin-billing.promoCodes.form.effect.kindDiscount')}
                                </SelectItem>
                                <SelectItem value="trial_extension">
                                    {t('admin-billing.promoCodes.form.effect.kindTrialExtension')}
                                </SelectItem>
                                <SelectItem value="comp">
                                    {t('admin-billing.promoCodes.form.effect.kindComp')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {isEdit && (
                            <p className="text-muted-foreground text-xs">
                                {t('admin-billing.promoCodes.form.effect.immutableHint')}
                            </p>
                        )}
                    </div>

                    {/* discount params */}
                    {formData.effectKind === 'discount' && (
                        <div className="space-y-4 rounded-md border p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="valueKind">
                                        {t('admin-billing.promoCodes.form.discountTypeLabel')}
                                    </Label>
                                    <Select
                                        value={formData.valueKind}
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                valueKind: value as DiscountType
                                            })
                                        }
                                        disabled={isEdit}
                                    >
                                        <SelectTrigger id="valueKind">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="percentage">
                                                {t('admin-billing.promoCodes.form.typePercentage')}
                                            </SelectItem>
                                            <SelectItem value="fixed">
                                                {t('admin-billing.promoCodes.form.typeFixed')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="discountValue">
                                        {t('admin-billing.promoCodes.form.valueLabel')}{' '}
                                        {formData.valueKind === 'percentage'
                                            ? t(
                                                  'admin-billing.promoCodes.form.valuePercentageSuffix'
                                              )
                                            : t('admin-billing.promoCodes.form.valueFixedSuffix')}
                                    </Label>
                                    <Input
                                        id="discountValue"
                                        type="number"
                                        value={formData.discountValue}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                discountValue: Number(e.target.value)
                                            })
                                        }
                                        min={1}
                                        max={formData.valueKind === 'percentage' ? 100 : undefined}
                                        disabled={isEdit}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 items-end gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="durationCycles">
                                        {t(
                                            'admin-billing.promoCodes.form.effect.durationCyclesLabel'
                                        )}
                                    </Label>
                                    <Input
                                        id="durationCycles"
                                        type="number"
                                        value={
                                            formData.durationForever
                                                ? ''
                                                : (formData.durationCycles ?? '')
                                        }
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                durationCycles: e.target.value
                                                    ? Number(e.target.value)
                                                    : null
                                            })
                                        }
                                        min={1}
                                        disabled={isEdit || formData.durationForever}
                                    />
                                </div>
                                <div className="flex items-center justify-between pb-2">
                                    <Label htmlFor="durationForever">
                                        {t('admin-billing.promoCodes.form.effect.foreverLabel')}
                                    </Label>
                                    <Switch
                                        id="durationForever"
                                        checked={formData.durationForever}
                                        onCheckedChange={(checked) =>
                                            setFormData({ ...formData, durationForever: checked })
                                        }
                                        disabled={isEdit}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* trial_extension params */}
                    {formData.effectKind === 'trial_extension' && (
                        <div className="space-y-2 rounded-md border p-4">
                            <Label htmlFor="extraDays">
                                {t('admin-billing.promoCodes.form.effect.extraDaysLabel')}
                            </Label>
                            <Input
                                id="extraDays"
                                type="number"
                                value={formData.extraDays}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        extraDays: Number(e.target.value)
                                    })
                                }
                                min={1}
                                disabled={isEdit}
                                required
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-billing.promoCodes.form.effect.extraDaysHint')}
                            </p>
                        </div>
                    )}

                    {/* comp note */}
                    {formData.effectKind === 'comp' && (
                        <div className="rounded-md border p-4">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-billing.promoCodes.form.effect.compNote')}
                            </p>
                        </div>
                    )}

                    {effectError && <p className="text-destructive text-sm">{effectError}</p>}

                    {/* Usage limits */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxUses">
                                {t('admin-billing.promoCodes.form.maxUsesLabel')}
                            </Label>
                            <Input
                                id="maxUses"
                                type="number"
                                value={formData.maxUses ?? ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUses: e.target.value ? Number(e.target.value) : null
                                    })
                                }
                                placeholder={t(
                                    'admin-billing.promoCodes.form.unlimitedPlaceholder'
                                )}
                                min={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxUsesPerUser">
                                {t('admin-billing.promoCodes.form.maxUsesPerUserLabel')}
                            </Label>
                            <Input
                                id="maxUsesPerUser"
                                type="number"
                                value={formData.maxUsesPerUser ?? ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxUsesPerUser: e.target.value
                                            ? Number(e.target.value)
                                            : null
                                    })
                                }
                                placeholder={t(
                                    'admin-billing.promoCodes.form.unlimitedPlaceholder'
                                )}
                                min={1}
                            />
                        </div>
                    </div>

                    {/* Validity dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="validFrom">
                                {t('admin-billing.promoCodes.form.validFromLabel')}
                            </Label>
                            <Input
                                id="validFrom"
                                type="date"
                                value={toDateInput(formData.validFrom)}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        validFrom: fromDateInput(e.target.value)
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="validUntil">
                                {t('admin-billing.promoCodes.form.validUntilLabel')}
                            </Label>
                            <Input
                                id="validUntil"
                                type="date"
                                value={toDateInput(formData.expiryDate)}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        expiryDate: fromDateInput(e.target.value)
                                    })
                                }
                                placeholder={t('admin-billing.promoCodes.form.noDateLimit')}
                            />
                        </div>
                    </div>

                    {/* Minimum amount */}
                    <div className="space-y-2">
                        <Label htmlFor="minimumAmount">
                            {t('admin-billing.promoCodes.form.minimumAmountLabel')}
                        </Label>
                        <Input
                            id="minimumAmount"
                            type="number"
                            value={formData.minAmount ?? ''}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    minAmount: e.target.value ? Number(e.target.value) : null
                                })
                            }
                            placeholder={t('admin-billing.promoCodes.form.noMinimum')}
                            min={0}
                        />
                    </div>

                    {/* Applicable plans (real plans, plan IDs) */}
                    <div className="space-y-2">
                        <Label>{t('admin-billing.promoCodes.form.applicablePlansLabel')}</Label>
                        <div className="flex flex-wrap gap-4">
                            {plans.length === 0 ? (
                                <span className="text-muted-foreground text-sm">
                                    {t('admin-billing.promoCodes.columns.allPlans')}
                                </span>
                            ) : (
                                plans.map((plan) => (
                                    <label
                                        key={plan.id}
                                        className="flex items-center gap-2"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.planRestrictions.includes(plan.id)}
                                            onChange={() => handlePlanToggle(plan.id)}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm">{plan.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Switches */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="isActive">
                                {t('admin-billing.promoCodes.form.isActiveLabel')}
                            </Label>
                            <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isActive: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="isStackable">
                                {t('admin-billing.promoCodes.form.isStackableLabel')}
                            </Label>
                            <Switch
                                id="isStackable"
                                checked={formData.isStackable}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, isStackable: checked })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label htmlFor="requiresFirstPurchase">
                                {t('admin-billing.promoCodes.form.requiresFirstPurchaseLabel')}
                            </Label>
                            <Switch
                                id="requiresFirstPurchase"
                                checked={formData.firstPurchaseOnly}
                                onCheckedChange={(checked) =>
                                    setFormData({ ...formData, firstPurchaseOnly: checked })
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {t('admin-billing.promoCodes.form.cancelButton')}
                        </Button>
                        <Button type="submit">
                            {isEdit
                                ? t('admin-billing.promoCodes.form.editSubmit')
                                : t('admin-billing.promoCodes.form.createSubmit')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
