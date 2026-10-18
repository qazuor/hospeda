import type { TranslationKey } from '@repo/i18n';
import {
    type AdminPromoCodeCreateRequest,
    AdminPromoCodeCreateRequestSchema,
    VerticalEnum
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
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
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { adminLogger } from '@/utils/logger';
import { useCreatePromoCodeMutation } from '../hooks/usePromoCodes';
import {
    describePromoCodeDraft,
    type PromoCodeDraft,
    promoCodeRejectionLabel,
    toMinorUnits
} from '../promo-code-draft';

type FormValues = {
    code: string;
    kind: 'DISCOUNT' | 'TRIAL_EXTENSION';
    discountKind: 'PERCENTAGE' | 'FIXED';
    value: string;
    durationKind: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
    durationCharges: string;
    extensionDays: string;
    allVerticals: boolean;
    verticals: VerticalEnum[];
    totalQuota: string;
    validFrom: string;
    validUntil: string;
    stackable: boolean;
    usableWithAnotherActive: boolean;
};

const initialValues: FormValues = {
    code: '',
    kind: 'DISCOUNT',
    discountKind: 'PERCENTAGE',
    value: '',
    durationKind: 'N_CHARGES',
    durationCharges: '3',
    extensionDays: '30',
    allVerticals: true,
    verticals: [],
    totalQuota: '',
    validFrom: '',
    validUntil: '',
    stackable: false,
    usableWithAnotherActive: false
};

/** Two-step create dialog: review the consequences, then send the validated request. */
export function PromoCodeCreateDialog({
    open,
    onOpenChange
}: {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
}) {
    const { t, locale } = useTranslations();
    const { addToast } = useToast();
    const mutation = useCreatePromoCodeMutation();
    const [candidate, setCandidate] = useState<AdminPromoCodeCreateRequest | null>(null);
    const [summary, setSummary] = useState<ReturnType<typeof describePromoCodeDraft> | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const key = (value: string) => t(value as TranslationKey);

    const form = useForm<FormValues>({
        defaultValues: initialValues,
        onSubmit: ({ value }) => {
            setValidationError(null);
            setApiError(null);
            try {
                const request = makeRequest(value);
                const parsed = AdminPromoCodeCreateRequestSchema.safeParse(request);
                if (!parsed.success) {
                    setValidationError(key('admin-billing.promoCodes.editor.form.invalid'));
                    setCandidate(null);
                    return;
                }
                const draft: PromoCodeDraft = {
                    ...parsed.data,
                    effect:
                        parsed.data.effect.kind === 'DISCOUNT' &&
                        parsed.data.effect.discountKind === 'FIXED'
                            ? { ...parsed.data.effect, pesos: value.value }
                            : parsed.data.effect
                };
                setCandidate(parsed.data);
                setSummary(describePromoCodeDraft({ draft, locale, t: key }));
            } catch {
                setValidationError(key('admin-billing.promoCodes.editor.form.invalid'));
                setCandidate(null);
            }
        }
    });

    const create = async () => {
        if (!candidate || mutation.isPending) return;
        setApiError(null);
        try {
            await mutation.mutateAsync(candidate);
            addToast({
                title: key('admin-billing.promoCodes.editor.toasts.created'),
                message: key('admin-billing.promoCodes.editor.toasts.created'),
                variant: 'success'
            });
            form.reset();
            setCandidate(null);
            setSummary(null);
            onOpenChange(false);
        } catch (error) {
            adminLogger.error('[PromoCodeCreateDialog] Failed to create a promo code', { error });
            const reason = isApiError(error)
                ? (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason
                : undefined;
            setApiError(
                reason
                    ? promoCodeRejectionLabel({ reason, t: key })
                    : key('admin-billing.promoCodes.editor.toasts.createError')
            );
        }
    };

    const close = (next: boolean) => {
        if (!next) {
            setCandidate(null);
            setSummary(null);
            setValidationError(null);
            setApiError(null);
        }
        onOpenChange(next);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={close}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {key(
                            candidate
                                ? 'admin-billing.promoCodes.editor.reviewTitle'
                                : 'admin-billing.promoCodes.editor.form.title'
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {key('admin-billing.promoCodes.editor.form.description')}
                    </DialogDescription>
                </DialogHeader>
                {candidate && summary ? (
                    <div
                        data-testid="promo-code-confirmation"
                        className="space-y-3"
                    >
                        <p>
                            <strong>
                                {key('admin-billing.promoCodes.editor.columns.effect')}:
                            </strong>{' '}
                            <span data-testid="promo-code-confirmation-effect">
                                {summary.effect}
                            </span>
                        </p>
                        <p>
                            <strong>{key('admin-billing.promoCodes.editor.columns.reach')}:</strong>{' '}
                            <span data-testid="promo-code-confirmation-reach">{summary.reach}</span>
                        </p>
                        <p>
                            <strong>{key('admin-billing.promoCodes.editor.columns.uses')}:</strong>{' '}
                            <span data-testid="promo-code-confirmation-uses">{summary.uses}</span>
                        </p>
                        <p>
                            <strong>
                                {key('admin-billing.promoCodes.editor.columns.validity')}:
                            </strong>{' '}
                            <span data-testid="promo-code-confirmation-validity">
                                {summary.validity}
                            </span>
                        </p>
                        {apiError ? <p role="alert">{apiError}</p> : null}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setCandidate(null);
                                    setSummary(null);
                                }}
                            >
                                {key('admin-billing.promoCodes.editor.back')}
                            </Button>
                            <Button
                                disabled={mutation.isPending}
                                onClick={() => void create()}
                            >
                                {key('admin-billing.promoCodes.editor.create')}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void form.handleSubmit();
                        }}
                        className="space-y-4"
                    >
                        <form.Field name="code">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor={field.name}>
                                        {key('admin-billing.promoCodes.editor.form.code')}
                                    </Label>
                                    <Input
                                        id={field.name}
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.value.toUpperCase())
                                        }
                                    />
                                </div>
                            )}
                        </form.Field>
                        <form.Field name="kind">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor={field.name}>
                                        {key('admin-billing.promoCodes.editor.form.effectKind')}
                                    </Label>
                                    <select
                                        id={field.name}
                                        className="h-10 w-full rounded-md border bg-background px-3"
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value as FormValues['kind']
                                            )
                                        }
                                    >
                                        <option value="DISCOUNT">
                                            {key('admin-billing.promoCodes.editor.form.discount')}
                                        </option>
                                        <option value="TRIAL_EXTENSION">
                                            {key(
                                                'admin-billing.promoCodes.editor.form.trialExtension'
                                            )}
                                        </option>
                                    </select>
                                </div>
                            )}
                        </form.Field>
                        <form.Subscribe selector={(state) => state.values.kind}>
                            {(kind) =>
                                kind === 'DISCOUNT' ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <form.Field name="discountKind">
                                            {(field) => (
                                                <div className="space-y-1">
                                                    <Label htmlFor={field.name}>
                                                        {key(
                                                            'admin-billing.promoCodes.editor.form.discountKind'
                                                        )}
                                                    </Label>
                                                    <select
                                                        id={field.name}
                                                        className="h-10 w-full rounded-md border bg-background px-3"
                                                        value={field.state.value}
                                                        onChange={(event) =>
                                                            field.handleChange(
                                                                event.target
                                                                    .value as FormValues['discountKind']
                                                            )
                                                        }
                                                    >
                                                        <option value="PERCENTAGE">
                                                            {key(
                                                                'admin-billing.promoCodes.editor.form.percentage'
                                                            )}
                                                        </option>
                                                        <option value="FIXED">
                                                            {key(
                                                                'admin-billing.promoCodes.editor.form.fixed'
                                                            )}
                                                        </option>
                                                    </select>
                                                </div>
                                            )}
                                        </form.Field>
                                        <form.Field name="value">
                                            {(field) => (
                                                <div className="space-y-1">
                                                    <Label htmlFor={field.name}>
                                                        {key(
                                                            'admin-billing.promoCodes.editor.form.value'
                                                        )}
                                                    </Label>
                                                    <Input
                                                        id={field.name}
                                                        inputMode="decimal"
                                                        value={field.state.value}
                                                        onChange={(event) =>
                                                            field.handleChange(event.target.value)
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </form.Field>
                                        <form.Field name="durationKind">
                                            {(field) => (
                                                <div className="space-y-1">
                                                    <Label htmlFor={field.name}>
                                                        {key(
                                                            'admin-billing.promoCodes.editor.form.duration'
                                                        )}
                                                    </Label>
                                                    <select
                                                        id={field.name}
                                                        className="h-10 w-full rounded-md border bg-background px-3"
                                                        value={field.state.value}
                                                        onChange={(event) =>
                                                            field.handleChange(
                                                                event.target
                                                                    .value as FormValues['durationKind']
                                                            )
                                                        }
                                                    >
                                                        <option value="FIRST_CHARGE">
                                                            {key(
                                                                'admin-billing.promoCodes.editor.form.firstCharge'
                                                            )}
                                                        </option>
                                                        <option value="N_CHARGES">
                                                            {key(
                                                                'admin-billing.promoCodes.editor.form.nCharges'
                                                            )}
                                                        </option>
                                                        <option value="FOREVER">
                                                            {key(
                                                                'admin-billing.promoCodes.editor.form.forever'
                                                            )}
                                                        </option>
                                                    </select>
                                                </div>
                                            )}
                                        </form.Field>
                                        <form.Subscribe
                                            selector={(state) => state.values.durationKind}
                                        >
                                            {(duration) =>
                                                duration === 'N_CHARGES' ? (
                                                    <form.Field name="durationCharges">
                                                        {(field) => (
                                                            <div className="space-y-1">
                                                                <Label htmlFor={field.name}>
                                                                    {key(
                                                                        'admin-billing.promoCodes.editor.form.chargeCount'
                                                                    )}
                                                                </Label>
                                                                <Input
                                                                    id={field.name}
                                                                    type="number"
                                                                    min="1"
                                                                    value={field.state.value}
                                                                    onChange={(event) =>
                                                                        field.handleChange(
                                                                            event.target.value
                                                                        )
                                                                    }
                                                                />
                                                            </div>
                                                        )}
                                                    </form.Field>
                                                ) : null
                                            }
                                        </form.Subscribe>
                                    </div>
                                ) : (
                                    <form.Field name="extensionDays">
                                        {(field) => (
                                            <div className="space-y-1">
                                                <Label htmlFor={field.name}>
                                                    {key(
                                                        'admin-billing.promoCodes.editor.form.extensionDays'
                                                    )}
                                                </Label>
                                                <Input
                                                    id={field.name}
                                                    type="number"
                                                    min="1"
                                                    value={field.state.value}
                                                    onChange={(event) =>
                                                        field.handleChange(event.target.value)
                                                    }
                                                />
                                            </div>
                                        )}
                                    </form.Field>
                                )
                            }
                        </form.Subscribe>
                        <form.Field name="allVerticals">
                            {(field) => (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.checked)
                                        }
                                    />
                                    {key('admin-billing.promoCodes.editor.form.allVerticals')}
                                </label>
                            )}
                        </form.Field>
                        <form.Subscribe selector={(state) => state.values.allVerticals}>
                            {(all) =>
                                all ? null : (
                                    <fieldset className="space-y-2">
                                        <legend className="font-medium text-sm">
                                            {key('admin-billing.promoCodes.editor.form.verticals')}
                                        </legend>
                                        {Object.values(VerticalEnum).map((vertical) => (
                                            <form.Field
                                                key={vertical}
                                                name="verticals"
                                            >
                                                {(field) => (
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.state.value.includes(
                                                                vertical
                                                            )}
                                                            onChange={(event) =>
                                                                field.handleChange(
                                                                    event.target.checked
                                                                        ? [
                                                                              ...field.state.value,
                                                                              vertical
                                                                          ]
                                                                        : field.state.value.filter(
                                                                              (value) =>
                                                                                  value !== vertical
                                                                          )
                                                                )
                                                            }
                                                        />
                                                        {key(
                                                            `admin-billing.promoCodes.editor.verticals.${vertical}`
                                                        )}
                                                    </label>
                                                )}
                                            </form.Field>
                                        ))}
                                    </fieldset>
                                )
                            }
                        </form.Subscribe>
                        <form.Field name="totalQuota">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor={field.name}>
                                        {key('admin-billing.promoCodes.editor.form.totalQuota')}
                                    </Label>
                                    <Input
                                        id={field.name}
                                        type="number"
                                        min="1"
                                        placeholder={key(
                                            'admin-billing.promoCodes.editor.unlimited'
                                        )}
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                    <p className="text-muted-foreground text-sm">
                                        {key('admin-billing.promoCodes.editor.form.onePerPerson')}
                                    </p>
                                </div>
                            )}
                        </form.Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <form.Field name="validFrom">
                                {(field) => (
                                    <div className="space-y-1">
                                        <Label htmlFor={field.name}>
                                            {key('admin-billing.promoCodes.editor.form.validFrom')}
                                        </Label>
                                        <Input
                                            id={field.name}
                                            type="date"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                        />
                                    </div>
                                )}
                            </form.Field>
                            <form.Field name="validUntil">
                                {(field) => (
                                    <div className="space-y-1">
                                        <Label htmlFor={field.name}>
                                            {key('admin-billing.promoCodes.editor.form.validUntil')}
                                        </Label>
                                        <Input
                                            id={field.name}
                                            type="date"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(event.target.value)
                                            }
                                        />
                                        <p className="text-muted-foreground text-sm">
                                            {key('admin-billing.promoCodes.editor.form.noEndDate')}
                                        </p>
                                    </div>
                                )}
                            </form.Field>
                        </div>
                        <form.Field name="stackable">
                            {(field) => (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.checked)
                                        }
                                    />
                                    {key('admin-billing.promoCodes.editor.form.stackable')}
                                </label>
                            )}
                        </form.Field>
                        <form.Field name="usableWithAnotherActive">
                            {(field) => (
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(event.target.checked)
                                        }
                                    />
                                    {key('admin-billing.promoCodes.editor.form.usableWithAnother')}
                                </label>
                            )}
                        </form.Field>
                        <p className="text-muted-foreground text-sm">
                            {key('admin-billing.promoCodes.editor.form.stackableHelp')}
                        </p>
                        {validationError ? <p role="alert">{validationError}</p> : null}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() => close(false)}
                            >
                                {key('admin-billing.promoCodes.editor.cancel')}
                            </Button>
                            <Button type="submit">
                                {key('admin-billing.promoCodes.editor.review')}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function makeRequest(value: FormValues) {
    const effect =
        value.kind === 'TRIAL_EXTENSION'
            ? { kind: 'TRIAL_EXTENSION' as const, extensionDays: Number(value.extensionDays) }
            : {
                  kind: 'DISCOUNT' as const,
                  discountKind: value.discountKind,
                  value:
                      value.discountKind === 'FIXED'
                          ? toMinorUnits({ pesos: value.value })
                          : Number(value.value),
                  durationKind: value.durationKind,
                  durationCharges:
                      value.durationKind === 'N_CHARGES' ? Number(value.durationCharges) : null
              };
    return {
        code: value.code,
        effect,
        allVerticals: value.allVerticals,
        verticals: value.allVerticals ? null : value.verticals,
        totalQuota: value.totalQuota === '' ? null : Number(value.totalQuota),
        ...(value.validFrom ? { validFrom: value.validFrom } : {}),
        validUntil: value.validUntil || null,
        stackable: value.stackable,
        usableWithAnotherActive: value.usableWithAnotherActive
    };
}
