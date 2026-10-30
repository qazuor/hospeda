import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PromoCodeFormValues } from './promo-code-form-values';

/** Code and effect controls for the action 21 create form. */
export function PromoCodeEffectFields({
    form,
    t
}: {
    readonly form: ReactFormExtendedApi<PromoCodeFormValues>;
    readonly t: (key: string) => string;
}) {
    return (
        <>
            <form.Field name="code">
                {(field) => (
                    <div className="space-y-1">
                        <Label htmlFor={field.name}>
                            {t('admin-billing.promoCodes.editor.form.code')}
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
                            {t('admin-billing.promoCodes.editor.form.effectKind')}
                        </Label>
                        <select
                            id={field.name}
                            className="h-10 w-full rounded-md border bg-background px-3"
                            value={field.state.value}
                            onChange={(event) =>
                                field.handleChange(
                                    event.target.value as PromoCodeFormValues['kind']
                                )
                            }
                        >
                            <option value="DISCOUNT">
                                {t('admin-billing.promoCodes.editor.form.discount')}
                            </option>
                            <option value="TRIAL_EXTENSION">
                                {t('admin-billing.promoCodes.editor.form.trialExtension')}
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
                                            {t('admin-billing.promoCodes.editor.form.discountKind')}
                                        </Label>
                                        <select
                                            id={field.name}
                                            className="h-10 w-full rounded-md border bg-background px-3"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(
                                                    event.target
                                                        .value as PromoCodeFormValues['discountKind']
                                                )
                                            }
                                        >
                                            <option value="PERCENTAGE">
                                                {t(
                                                    'admin-billing.promoCodes.editor.form.percentage'
                                                )}
                                            </option>
                                            <option value="FIXED">
                                                {t('admin-billing.promoCodes.editor.form.fixed')}
                                            </option>
                                        </select>
                                    </div>
                                )}
                            </form.Field>
                            <form.Field name="value">
                                {(field) => (
                                    <div className="space-y-1">
                                        <Label htmlFor={field.name}>
                                            {t('admin-billing.promoCodes.editor.form.value')}
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
                                            {t('admin-billing.promoCodes.editor.form.duration')}
                                        </Label>
                                        <select
                                            id={field.name}
                                            className="h-10 w-full rounded-md border bg-background px-3"
                                            value={field.state.value}
                                            onChange={(event) =>
                                                field.handleChange(
                                                    event.target
                                                        .value as PromoCodeFormValues['durationKind']
                                                )
                                            }
                                        >
                                            <option value="FIRST_CHARGE">
                                                {t(
                                                    'admin-billing.promoCodes.editor.form.firstCharge'
                                                )}
                                            </option>
                                            <option value="N_CHARGES">
                                                {t('admin-billing.promoCodes.editor.form.nCharges')}
                                            </option>
                                            <option value="FOREVER">
                                                {t('admin-billing.promoCodes.editor.form.forever')}
                                            </option>
                                        </select>
                                    </div>
                                )}
                            </form.Field>
                            <form.Subscribe selector={(state) => state.values.durationKind}>
                                {(duration) =>
                                    duration === 'N_CHARGES' ? (
                                        <form.Field name="durationCharges">
                                            {(field) => (
                                                <div className="space-y-1">
                                                    <Label htmlFor={field.name}>
                                                        {t(
                                                            'admin-billing.promoCodes.editor.form.chargeCount'
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
                                    ) : null
                                }
                            </form.Subscribe>
                        </div>
                    ) : (
                        <form.Field name="extensionDays">
                            {(field) => (
                                <div className="space-y-1">
                                    <Label htmlFor={field.name}>
                                        {t('admin-billing.promoCodes.editor.form.extensionDays')}
                                    </Label>
                                    <Input
                                        id={field.name}
                                        type="number"
                                        min="1"
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                </div>
                            )}
                        </form.Field>
                    )
                }
            </form.Subscribe>
        </>
    );
}
