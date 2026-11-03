import type { TranslationKey } from '@repo/i18n';
import type {
    AdminCatalogPlan,
    BillingCycle,
    PlanPublicationConfirmation,
    PlanVersionContentInput,
    PublishedPlanVersion
} from '@repo/schemas';
import { BILLING_CYCLES, PlanVersionContentSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { usePreviewPlanVersion } from '../hooks/usePlanCatalog';
import { type PlanVersionDraft, toContent, toDraft } from '../lib/plan-version-draft';
import { PlanVersionKeyRows } from './PlanVersionKeyRows';
import { PlanVersionReview } from './PlanVersionReview';

/** Edits a plan version, previews the full payload, and hosts its review step. */
export function PlanVersionForm({
    plan,
    onCancel,
    onPublished
}: {
    readonly plan: AdminCatalogPlan;
    readonly onCancel: () => void;
    readonly onPublished: (version: PublishedPlanVersion) => void;
}) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const root = 'admin-billing.planCatalogEditor.';
    const initial = toDraft({ currentVersion: plan.currentVersion });
    const preview = usePreviewPlanVersion();
    const [review, setReview] = useState<{
        content: PlanVersionContentInput;
        confirmation: PlanPublicationConfirmation;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const form = useForm<PlanVersionDraft>({
        defaultValues: initial,
        onSubmit: async ({ value }) => {
            setError(null);
            const content = toContent({ draft: value });
            const parsed = PlanVersionContentSchema.safeParse(content);
            const emptyRequiredNumber = [value.rank, value.trialDays, value.graceDays].some(
                (item) => !item.trim()
            );
            if (!parsed.success || emptyRequiredNumber) {
                setError(
                    tr(`${root}errors.invalid`, {
                        message: parsed.success
                            ? tr(`${root}errors.emptyRequiredNumber`)
                            : (parsed.error.issues[0]?.message ?? '')
                    })
                );
                return;
            }
            try {
                const confirmation = await preview.mutateAsync({
                    planId: plan.planId,
                    content: parsed.data
                });
                setReview({ content: parsed.data, confirmation });
            } catch (reason) {
                setError(errorMessage(reason));
            }
        }
    });
    const errorMessage = (reason: unknown) => {
        if (isApiError(reason) && reason.status === 403) return tr(`${root}errors.forbidden`);
        if (isApiError(reason) && (reason.status === 400 || reason.status === 409)) {
            return tr(`${root}errors.rejected`, { message: reason.message });
        }
        return tr(`${root}errors.generic`);
    };
    return (
        <section
            data-testid={`plan-version-form-${plan.planId}`}
            className="space-y-4 rounded-md border p-4"
        >
            <h3 className="font-semibold">{tr(`${root}form.title`, { name: plan.name })}</h3>
            <p className="text-muted-foreground text-sm">{tr(`${root}form.current`)}</p>
            <CurrentVersionSummary plan={plan} />
            {review ? (
                <PlanVersionReview
                    planId={plan.planId}
                    content={review.content}
                    confirmation={review.confirmation}
                    onBack={() => {
                        setReview(null);
                        setError(null);
                    }}
                    onPublished={onPublished}
                />
            ) : (
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FormNumberField
                            form={form}
                            name="rank"
                            label={tr(`${root}columns.rank`)}
                        />
                        <FormNumberField
                            form={form}
                            name="trialDays"
                            label={tr(`${root}columns.trialDays`)}
                        />
                        <FormNumberField
                            form={form}
                            name="graceDays"
                            label={tr(`${root}columns.graceDays`)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-5">
                        <FormBooleanField
                            form={form}
                            name="sellable"
                            label={tr(`${root}columns.sellable`)}
                        />
                        <FormBooleanField
                            form={form}
                            name="allowsPause"
                            label={tr(`${root}columns.allowsPause`)}
                        />
                        <FormBooleanField
                            form={form}
                            name="inheritsTouristVip"
                            label={tr(`${root}columns.inheritsTouristVip`)}
                        />
                    </div>
                    <fieldset className="flex flex-wrap gap-4 rounded-md border p-4">
                        <legend className="px-1">{tr(`${root}form.cyclesLegend`)}</legend>
                        {BILLING_CYCLES.map((cycle) => (
                            <form.Field
                                key={cycle}
                                name="cycles"
                            >
                                {(field) => (
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={field.state.value.includes(cycle)}
                                            onChange={(event) => {
                                                const next = event.target.checked
                                                    ? [...field.state.value, cycle]
                                                    : field.state.value.filter(
                                                          (item) => item !== cycle
                                                      );
                                                field.handleChange(next as BillingCycle[]);
                                            }}
                                        />
                                        {tr(`${root}cycles.${cycle}`)}
                                    </label>
                                )}
                            </form.Field>
                        ))}
                    </fieldset>
                    <form.Subscribe selector={(state) => state.values}>
                        {(draft) => (
                            <PlanVersionKeyRows
                                draft={draft}
                                setDraft={(value) => {
                                    form.setFieldValue('entitlements', value.entitlements);
                                    form.setFieldValue('limits', value.limits);
                                }}
                                trialRole={plan.role === 'trial'}
                            />
                        )}
                    </form.Subscribe>
                    {error ? <p role="alert">{error}</p> : null}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                        >
                            {tr(`${root}form.cancel`)}
                        </Button>
                        <Button
                            type="submit"
                            disabled={preview.isPending}
                        >
                            {tr(`${root}form.review`)}
                        </Button>
                    </div>
                </form>
            )}
        </section>
    );
}

function FormNumberField({
    form,
    name,
    label
}: {
    readonly form: ReturnType<typeof useForm<PlanVersionDraft>>;
    readonly name: 'rank' | 'trialDays' | 'graceDays';
    readonly label: string;
}) {
    return (
        <form.Field name={name}>
            {(field) => (
                <label className="space-y-1 text-sm">
                    {label}
                    <input
                        className="h-10 w-full rounded-md border bg-background px-3"
                        type="number"
                        value={field.state.value}
                        onChange={(event) => field.handleChange(event.target.value)}
                    />
                </label>
            )}
        </form.Field>
    );
}

function FormBooleanField({
    form,
    name,
    label
}: {
    readonly form: ReturnType<typeof useForm<PlanVersionDraft>>;
    readonly name: 'sellable' | 'allowsPause' | 'inheritsTouristVip';
    readonly label: string;
}) {
    return (
        <form.Field name={name}>
            {(field) => (
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={field.state.value}
                        onChange={(event) => field.handleChange(event.target.checked)}
                    />
                    {label}
                </label>
            )}
        </form.Field>
    );
}

function CurrentVersionSummary({ plan }: { readonly plan: AdminCatalogPlan }) {
    const { t } = useTranslations();
    const tr = (key: string) => t(key as TranslationKey);
    const root = 'admin-billing.planCatalogEditor.';
    const version = plan.currentVersion;
    if (!version) return <p className="text-sm">{tr(`${root}noCurrentVersion`)}</p>;
    return (
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
                <dt>{tr(`${root}columns.rank`)}</dt>
                <dd>{version.rank}</dd>
            </div>
            <div>
                <dt>{tr(`${root}columns.trialDays`)}</dt>
                <dd>{version.trialDays}</dd>
            </div>
            <div>
                <dt>{tr(`${root}columns.graceDays`)}</dt>
                <dd>{version.graceDays}</dd>
            </div>
            <div>
                <dt>{tr(`${root}columns.cycles`)}</dt>
                <dd>{version.cycles.map((cycle) => tr(`${root}cycles.${cycle}`)).join(', ')}</dd>
            </div>
            <div className="col-span-full">
                <dt>
                    {tr(`${root}columns.entitlements`)} / {tr(`${root}columns.limits`)}
                </dt>
                <dd>
                    {[
                        ...version.entitlements.map(
                            (item) =>
                                `${item.key}${item.planQuota != null || item.trialQuota != null ? ` (${item.planQuota ?? '—'} / ${item.trialQuota ?? '—'})` : ''}`
                        ),
                        ...version.limits.map((item) => `${item.key}: ${item.value}`)
                    ].join(', ') || '—'}
                </dd>
            </div>
        </dl>
    );
}
