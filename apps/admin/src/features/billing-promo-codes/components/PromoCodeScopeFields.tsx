import { VerticalEnum } from '@repo/schemas';
import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PromoCodeFormValues } from './promo-code-form-values';

/** Reach, quota, validity and promo-only stacking controls. */
export function PromoCodeScopeFields({
    form,
    t
}: {
    readonly form: ReactFormExtendedApi<PromoCodeFormValues>;
    readonly t: (key: string) => string;
}) {
    return (
        <>
            <form.Field name="allVerticals">
                {(field) => (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={field.state.value}
                            onChange={(event) => field.handleChange(event.target.checked)}
                        />
                        {t('admin-billing.promoCodes.editor.form.allVerticals')}
                    </label>
                )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.allVerticals}>
                {(all) =>
                    all ? null : (
                        <fieldset className="space-y-2">
                            <legend className="font-medium text-sm">
                                {t('admin-billing.promoCodes.editor.form.verticals')}
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
                                                checked={field.state.value.includes(vertical)}
                                                onChange={(event) =>
                                                    field.handleChange(
                                                        event.target.checked
                                                            ? [...field.state.value, vertical]
                                                            : field.state.value.filter(
                                                                  (value) => value !== vertical
                                                              )
                                                    )
                                                }
                                            />
                                            {t(
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
                            {t('admin-billing.promoCodes.editor.form.totalQuota')}
                        </Label>
                        <Input
                            id={field.name}
                            type="number"
                            min="1"
                            placeholder={t('admin-billing.promoCodes.editor.unlimited')}
                            value={field.state.value}
                            onChange={(event) => field.handleChange(event.target.value)}
                        />
                        <p className="text-muted-foreground text-sm">
                            {t('admin-billing.promoCodes.editor.form.onePerPerson')}
                        </p>
                    </div>
                )}
            </form.Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <form.Field name="validFrom">
                    {(field) => (
                        <div className="space-y-1">
                            <Label htmlFor={field.name}>
                                {t('admin-billing.promoCodes.editor.form.validFrom')}
                            </Label>
                            <Input
                                id={field.name}
                                type="date"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                            />
                        </div>
                    )}
                </form.Field>
                <form.Field name="validUntil">
                    {(field) => (
                        <div className="space-y-1">
                            <Label htmlFor={field.name}>
                                {t('admin-billing.promoCodes.editor.form.validUntil')}
                            </Label>
                            <Input
                                id={field.name}
                                type="date"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                            />
                            <p className="text-muted-foreground text-sm">
                                {t('admin-billing.promoCodes.editor.form.noEndDate')}
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
                            onChange={(event) => field.handleChange(event.target.checked)}
                        />
                        {t('admin-billing.promoCodes.editor.form.stackable')}
                    </label>
                )}
            </form.Field>
            <form.Field name="usableWithAnotherActive">
                {(field) => (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={field.state.value}
                            onChange={(event) => field.handleChange(event.target.checked)}
                        />
                        {t('admin-billing.promoCodes.editor.form.usableWithAnother')}
                    </label>
                )}
            </form.Field>
            <p className="text-muted-foreground text-sm">
                {t('admin-billing.promoCodes.editor.form.stackableHelp')}
            </p>
        </>
    );
}
