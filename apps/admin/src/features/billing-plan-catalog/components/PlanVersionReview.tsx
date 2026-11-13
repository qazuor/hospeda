import type { TranslationKey } from '@repo/i18n';
import type {
    PlanPublicationConfirmation,
    PlanVersionContentInput,
    PublishedPlanVersion
} from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { usePublishPlanVersion } from '../hooks/usePlanCatalog';

/** Shows a server preview and publishes its exact reviewed content. */
export function PlanVersionReview({
    planId,
    content,
    confirmation,
    onBack,
    onPublished
}: {
    readonly planId: string;
    readonly content: PlanVersionContentInput;
    readonly confirmation: PlanPublicationConfirmation;
    readonly onBack: () => void;
    readonly onPublished: (version: PublishedPlanVersion) => void;
}) {
    const { t, tPlural } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(key as TranslationKey, values);
    const publish = usePublishPlanVersion();
    const [error, setError] = useState<string | null>(null);
    const root = 'admin-billing.planCatalogEditor.';
    const review = confirmation.changes;
    const absent = tr(`${root}review.absent`);
    const display = (value: unknown) =>
        value == null ? absent : typeof value === 'string' ? value : JSON.stringify(value);
    const publishVersion = async () => {
        setError(null);
        try {
            onPublished(await publish.mutateAsync({ planId, content }));
        } catch (reason) {
            setError(
                isApiError(reason) && reason.status === 403
                    ? tr(`${root}errors.forbidden`)
                    : isApiError(reason) && (reason.status === 400 || reason.status === 409)
                      ? tr(`${root}errors.rejected`, { message: reason.message })
                      : tr(`${root}errors.generic`)
            );
        }
    };
    return (
        <section
            data-testid={`plan-version-review-${planId}`}
            className="space-y-4 rounded-md border p-4"
        >
            <h3 className="font-semibold">{tr(`${root}review.title`)}</h3>
            <p>{confirmation.message}</p>
            {review.length === 0 ? (
                <p>{tr(`${root}review.noChanges`)}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th>{tr(`${root}review.key`)}</th>
                                <th>{tr(`${root}review.kind`)}</th>
                                <th>{tr(`${root}review.from`)}</th>
                                <th>{tr(`${root}review.to`)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {review.map((change) => (
                                <tr
                                    key={`${change.kind}-${change.key}`}
                                    data-testid={`plan-change-${change.kind}-${change.key}`}
                                >
                                    <td>{change.key}</td>
                                    <td>{tr(`${root}review.kinds.${change.kind}`)}</td>
                                    <td>{display(change.from)}</td>
                                    <td>{display(change.to)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p>
                {tPlural(`${root}review.reach` as TranslationKey, confirmation.anchoredCustomers)}
            </p>
            {error ? <p role="alert">{error}</p> : null}
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                >
                    {tr(`${root}review.back`)}
                </Button>
                <Button
                    type="button"
                    disabled={publish.isPending}
                    onClick={() => void publishVersion()}
                >
                    {tr(`${root}review.confirm`)}
                </Button>
            </div>
        </section>
    );
}
