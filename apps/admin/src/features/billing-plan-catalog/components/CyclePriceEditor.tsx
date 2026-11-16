import type { TranslationKey } from '@repo/i18n';
import type { AdminCatalogPlanVersion, BillingCycle, CyclePriceConfirmation } from '@repo/schemas';
import { CyclePricePreviewRequestSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { usePreviewCyclePrice, useSetCyclePrice } from '../hooks/usePlanCatalog';

const EDITABLE_CYCLES = ['monthly', 'annual'] as const satisfies readonly BillingCycle[];

function rejectionReason(error: unknown): string | null {
    if (!isApiError(error)) return null;
    const body = error.body as { readonly error?: { readonly reason?: unknown } } | undefined;
    const reason = body?.error?.reason;
    return typeof reason === 'string' ? reason : null;
}

/** Edits one monthly or annual price through an explicit preview and confirmation. */
export function CyclePriceEditor({
    planVersionId,
    version,
    onClose
}: {
    readonly planVersionId: string;
    readonly version: AdminCatalogPlanVersion;
    readonly onClose: () => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const root = 'admin-billing.planCatalogEditor.cyclePrice.';
    const cycles = EDITABLE_CYCLES.filter((cycle) => version.cycles.includes(cycle));
    const previewMutation = usePreviewCyclePrice();
    const setMutation = useSetCyclePrice();
    const [preview, setPreview] = useState<CyclePriceConfirmation | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conflict, setConflict] = useState(false);
    const form = useForm({
        defaultValues: { cycle: cycles[0] ?? 'monthly', amount: '' },
        onSubmit: async ({ value }) => {
            setError(null);
            setConflict(false);
            setPreview(null);
            const parsed = CyclePricePreviewRequestSchema.safeParse({
                planVersionId,
                cycle: value.cycle,
                amount: Number(value.amount)
            });
            if (!parsed.success) {
                setError(tr(`${root}invalid`));
                return;
            }
            try {
                setPreview(await previewMutation.mutateAsync(parsed.data));
            } catch (reason) {
                setError(errorMessage(reason));
                setConflict(isCyclePriceConflict(reason));
            }
        }
    });
    const submitPrice = async () => {
        if (!preview || !confirmed || setMutation.isPending) return;
        setError(null);
        setConflict(false);
        try {
            await setMutation.mutateAsync({
                planVersionId,
                cycle: preview.cycle,
                amount: preview.newAmount,
                expectedPreviousAmount: preview.previousAmount
            });
            onClose();
        } catch (reason) {
            setError(errorMessage(reason));
            setConflict(isCyclePriceConflict(reason));
        }
    };
    const errorMessage = (reason: unknown) => {
        const rejection = rejectionReason(reason);
        if (rejection === 'PLAN_VERSION_HAS_CUSTOMERS') return tr(`${root}errors.hasCustomers`);
        if (rejection === 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW')
            return tr(`${root}errors.changedSincePreview`);
        if (isApiError(reason) && reason.status === 403) return tr(`${root}errors.forbidden`);
        return tr(`${root}errors.generic`);
    };

    return (
        <section
            className="space-y-3 rounded-md border p-4"
            data-testid="cycle-price-editor"
        >
            <h3 className="font-semibold">{tr(`${root}title`)}</h3>
            <form
                className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void form.handleSubmit();
                }}
            >
                <form.Field name="cycle">
                    {(field) => (
                        <label className="space-y-1 text-sm">
                            {tr(`${root}cycle`)}
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3"
                                value={field.state.value}
                                onChange={(event) => {
                                    field.handleChange(
                                        event.target.value as typeof field.state.value
                                    );
                                    setPreview(null);
                                    setConfirmed(false);
                                    setError(null);
                                    setConflict(false);
                                }}
                            >
                                {cycles.map((cycle) => (
                                    <option
                                        key={cycle}
                                        value={cycle}
                                    >
                                        {tr(`admin-billing.planCatalogEditor.cycles.${cycle}`)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </form.Field>
                <form.Field name="amount">
                    {(field) => (
                        <label className="space-y-1 text-sm">
                            {tr(`${root}amount`)}
                            <input
                                className="h-10 w-full rounded-md border bg-background px-3"
                                type="number"
                                min="1"
                                step="1"
                                inputMode="numeric"
                                value={field.state.value}
                                onChange={(event) => {
                                    field.handleChange(event.target.value);
                                    setPreview(null);
                                    setConfirmed(false);
                                    setError(null);
                                    setConflict(false);
                                }}
                            />
                        </label>
                    )}
                </form.Field>
                <Button
                    type="submit"
                    disabled={previewMutation.isPending}
                >
                    {tr(`${root}preview`)}
                </Button>
            </form>
            {error ? (
                <div
                    role="alert"
                    className="space-y-1"
                >
                    <p>{error}</p>
                    {conflict ? (
                        <a href="/billing/plan-migration">{tr(`${root}migrationLink`)}</a>
                    ) : null}
                </div>
            ) : null}
            {preview ? (
                <div
                    className="space-y-3 rounded-md bg-muted p-3"
                    data-testid="cycle-price-preview"
                >
                    <p>
                        {tr(`${root}summary`, {
                            cycle: tr(`admin-billing.planCatalogEditor.cycles.${preview.cycle}`),
                            previous: formatAmount(preview.previousAmount),
                            next: formatAmount(preview.newAmount)
                        })}
                    </p>
                    <p>{tr(`${root}reach`)}</p>
                    <label className="flex items-start gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(event) => setConfirmed(event.target.checked)}
                        />
                        {tr(`${root}explicitConfirmation`)}
                    </label>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            disabled={!confirmed || setMutation.isPending}
                            onClick={() => void submitPrice()}
                        >
                            {setMutation.isPending ? tr(`${root}saving`) : tr(`${root}confirm`)}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            {tr(`${root}cancel`)}
                        </Button>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function isCyclePriceConflict(error: unknown): boolean {
    return (
        rejectionReason(error) === 'PLAN_VERSION_HAS_CUSTOMERS' ||
        rejectionReason(error) === 'CYCLE_PRICE_CHANGED_SINCE_PREVIEW'
    );
}

function formatAmount(amount: number | null): string {
    return amount === null ? '—' : `${amount} centavos ARS`;
}
