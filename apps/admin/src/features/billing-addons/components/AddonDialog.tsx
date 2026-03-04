/**
 * Add-on Create/Edit Dialog
 *
 * Modal dialog for creating new add-ons or editing existing ones.
 * Uses TanStack Form with Zod validation.
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { LoaderIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import type { AddonDefinition, CreateAddonPayload } from '../types';

interface AddonDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    addon?: AddonDefinition | null;
    onSubmit: (payload: CreateAddonPayload) => Promise<void>;
    isSubmitting?: boolean;
}

export function AddonDialog({
    open,
    onOpenChange,
    addon,
    onSubmit,
    isSubmitting = false
}: AddonDialogProps) {
    const { addToast } = useToast();
    const { t } = useTranslations();

    const form = useForm({
        defaultValues: {
            slug: addon?.slug || '',
            name: addon?.name || '',
            description: addon?.description || '',
            billingType: (addon?.billingType || 'one_time') as 'one_time' | 'recurring',
            priceArs: addon?.priceArs ? addon.priceArs / 100 : 0, // Convert cents to ARS
            durationDays: addon?.durationDays || null,
            affectsLimitKey: addon?.affectsLimitKey || null,
            limitIncrease: addon?.limitIncrease || null,
            grantsEntitlement: addon?.grantsEntitlement || null,
            targetCategories: (addon?.targetCategories || ['owner']) as ('owner' | 'complex')[],
            isActive: addon?.isActive ?? true,
            sortOrder: addon?.sortOrder || 0
        },
        onSubmit: async ({ value }) => {
            try {
                // Convert ARS to cents for backend
                const payload: CreateAddonPayload = {
                    ...value,
                    priceArs: Math.round(value.priceArs * 100)
                };

                await onSubmit(payload);

                addToast({
                    title: addon
                        ? t('admin-billing.addons.catalogDialog.successUpdate')
                        : t('admin-billing.addons.catalogDialog.successCreate'),
                    message: `${value.name} ${addon ? t('admin-billing.addons.catalogDialog.successMessageUpdate') : t('admin-billing.addons.catalogDialog.successMessageCreate')}`,
                    variant: 'success'
                });

                onOpenChange(false);
                form.reset();
            } catch (error) {
                addToast({
                    title: t('admin-billing.addons.catalogDialog.errorTitle'),
                    message:
                        error instanceof Error
                            ? error.message
                            : t('admin-billing.addons.catalogDialog.errorMessage'),
                    variant: 'error'
                });
            }
        }
    });

    // Reset form when dialog closes or addon changes
    useEffect(() => {
        if (!open) {
            form.reset();
        }
    }, [open, form]);

    const billingTypeValue = form.state.values.billingType;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {addon
                            ? t('admin-billing.addons.catalogDialog.editTitle')
                            : t('admin-billing.addons.catalogDialog.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {addon
                            ? t('admin-billing.addons.catalogDialog.editDescription')
                            : t('admin-billing.addons.catalogDialog.createDescription')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="space-y-6"
                >
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t('admin-billing.addons.catalogDialog.sections.basicInfo')}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="slug">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="slug">
                                            {t('admin-billing.addons.catalogDialog.fields.slug')}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="slug"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder="visibility-boost-7d"
                                            disabled={!!addon}
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="name">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="name">
                                            {t('admin-billing.addons.catalogDialog.fields.name')}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="name"
                                            value={field.state.value}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            onBlur={field.handleBlur}
                                            placeholder={t(
                                                'admin-common.placeholders.billing.addonNameExample'
                                            )}
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>
                        </div>

                        <form.Field name="description">
                            {(field) => (
                                <div>
                                    <Label htmlFor="description">
                                        {t('admin-billing.addons.catalogDialog.fields.description')}{' '}
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t(
                                            'admin-billing.addons.catalogDialog.fields.descriptionPlaceholder'
                                        )}
                                        rows={3}
                                    />
                                    {field.state.meta.errors && (
                                        <p className="mt-1 text-destructive text-xs">
                                            {field.state.meta.errors[0]}
                                        </p>
                                    )}
                                </div>
                            )}
                        </form.Field>
                    </div>

                    {/* Pricing */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t('admin-billing.addons.catalogDialog.sections.billing')}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-3">
                            <form.Field name="billingType">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="billingType">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.billingType'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value as 'one_time' | 'recurring'
                                                )
                                            }
                                        >
                                            <SelectTrigger id="billingType">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="one_time">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.billingTypes.oneTime'
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="recurring">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.billingTypes.recurring'
                                                    )}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="priceArs">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="priceArs">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.priceArs'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="priceArs"
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(Number(e.target.value))
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="5000"
                                        />
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="durationDays">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="durationDays">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.durationDays'
                                            )}
                                            {billingTypeValue === 'one_time' && (
                                                <span className="text-destructive">*</span>
                                            )}
                                        </Label>
                                        <Input
                                            id="durationDays"
                                            type="number"
                                            min={0}
                                            value={field.state.value || ''}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value ? Number(e.target.value) : null
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="7"
                                            disabled={billingTypeValue === 'recurring'}
                                        />
                                        <p className="mt-1 text-muted-foreground text-xs">
                                            {billingTypeValue === 'one_time'
                                                ? t(
                                                      'admin-billing.addons.catalogDialog.fields.durationHintOneTime'
                                                  )
                                                : t(
                                                      'admin-billing.addons.catalogDialog.fields.durationHintRecurring'
                                                  )}
                                        </p>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t('admin-billing.addons.catalogDialog.sections.benefits')}
                        </h3>

                        <div className="grid gap-4 md:grid-cols-2">
                            <form.Field name="affectsLimitKey">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="affectsLimitKey">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.affectsLimitKey'
                                            )}
                                        </Label>
                                        <Select
                                            value={field.state.value || 'none'}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value === 'none' ? null : (value as LimitKey)
                                                )
                                            }
                                        >
                                            <SelectTrigger id="affectsLimitKey">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.none'
                                                    )}
                                                </SelectItem>
                                                {Object.values(LimitKey).map((key) => (
                                                    <SelectItem
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="limitIncrease">
                                {(field) => (
                                    <div>
                                        <Label htmlFor="limitIncrease">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.limitIncrease'
                                            )}
                                        </Label>
                                        <Input
                                            id="limitIncrease"
                                            type="number"
                                            min={0}
                                            value={field.state.value || ''}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value ? Number(e.target.value) : null
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            placeholder="5"
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <form.Field name="grantsEntitlement">
                                {(field) => (
                                    <div className="md:col-span-2">
                                        <Label htmlFor="grantsEntitlement">
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.grantsEntitlement'
                                            )}
                                        </Label>
                                        <Select
                                            value={field.state.value || 'none'}
                                            onValueChange={(value) =>
                                                field.handleChange(
                                                    value === 'none'
                                                        ? null
                                                        : (value as EntitlementKey)
                                                )
                                            }
                                        >
                                            <SelectTrigger id="grantsEntitlement">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.noneEntitlement'
                                                    )}
                                                </SelectItem>
                                                {Object.values(EntitlementKey).map((key) => (
                                                    <SelectItem
                                                        key={key}
                                                        value={key}
                                                    >
                                                        {key}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                    </div>

                    {/* Target & Status */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-sm">
                            {t('admin-billing.addons.catalogDialog.sections.configuration')}
                        </h3>

                        <div className="space-y-4">
                            <form.Field name="targetCategories">
                                {(field) => (
                                    <div>
                                        <Label>
                                            {t(
                                                'admin-billing.addons.catalogDialog.fields.targetCategories'
                                            )}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <div className="mt-2 flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={field.state.value.includes('owner')}
                                                    onChange={(e) => {
                                                        const current = field.state.value;
                                                        field.handleChange(
                                                            e.target.checked
                                                                ? [...current, 'owner']
                                                                : current.filter(
                                                                      (c) => c !== 'owner'
                                                                  )
                                                        );
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.categoryOwner'
                                                    )}
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={field.state.value.includes('complex')}
                                                    onChange={(e) => {
                                                        const current = field.state.value;
                                                        field.handleChange(
                                                            e.target.checked
                                                                ? [...current, 'complex']
                                                                : current.filter(
                                                                      (c) => c !== 'complex'
                                                                  )
                                                        );
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.categoryComplex'
                                                    )}
                                                </span>
                                            </label>
                                        </div>
                                        {field.state.meta.errors && (
                                            <p className="mt-1 text-destructive text-xs">
                                                {field.state.meta.errors[0]}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </form.Field>

                            <div className="grid gap-4 md:grid-cols-2">
                                <form.Field name="sortOrder">
                                    {(field) => (
                                        <div>
                                            <Label htmlFor="sortOrder">
                                                {t(
                                                    'admin-billing.addons.catalogDialog.fields.sortOrder'
                                                )}
                                            </Label>
                                            <Input
                                                id="sortOrder"
                                                type="number"
                                                min={0}
                                                value={field.state.value}
                                                onChange={(e) =>
                                                    field.handleChange(Number(e.target.value))
                                                }
                                                onBlur={field.handleBlur}
                                            />
                                            <p className="mt-1 text-muted-foreground text-xs">
                                                {t(
                                                    'admin-billing.addons.catalogDialog.fields.sortOrderHint'
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name="isActive">
                                    {(field) => (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label htmlFor="isActive">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.isActive'
                                                    )}
                                                </Label>
                                                <p className="text-muted-foreground text-xs">
                                                    {t(
                                                        'admin-billing.addons.catalogDialog.fields.isActiveHint'
                                                    )}
                                                </p>
                                            </div>
                                            <Switch
                                                id="isActive"
                                                checked={field.state.value}
                                                onCheckedChange={field.handleChange}
                                            />
                                        </div>
                                    )}
                                </form.Field>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            {t('admin-billing.addons.catalogDialog.cancelButton')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
                            {addon
                                ? t('admin-billing.addons.catalogDialog.saveButton')
                                : t('admin-billing.addons.catalogDialog.createButton')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
