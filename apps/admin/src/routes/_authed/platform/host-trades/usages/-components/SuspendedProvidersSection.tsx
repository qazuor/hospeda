/**
 * @file SuspendedProvidersSection.tsx
 * @description The providers currently blocked from declaring (HOS-376 T-056).
 *
 * Sits ABOVE the usage table and is never merged into it. The two answer
 * different questions: the table is an audit anyone can read at leisure, while
 * every row here is a provider who cannot record work right now — and one of
 * them may be blocked by a threshold nobody has looked at yet (AC-11).
 *
 * Whether a human decided the suspension is shown explicitly, because the API
 * leaves `declarationSuspendedById` NULL exactly when the rejection threshold
 * fired on its own. Collapsing the two would hide that nobody has reviewed it.
 */

import type { HostTradeAdmin } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';

/** Props for {@link SuspendedProvidersSection}. */
export interface SuspendedProvidersSectionProps {
    readonly items: readonly HostTradeAdmin[];
    readonly isLoading: boolean;
    readonly hasError: boolean;
    readonly onLift: (input: { hostTradeId: string; providerName: string }) => void;
    readonly isDeciding: boolean;
}

/** Renders a date as the admin's locale short date, or an em dash. */
function formatDate(value: Date | string | null | undefined): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

/**
 * The standing declaration suspensions, with the action to lift each one.
 *
 * @param props - {@link SuspendedProvidersSectionProps}
 */
export function SuspendedProvidersSection({
    items,
    isLoading,
    hasError,
    onLift,
    isDeciding
}: SuspendedProvidersSectionProps) {
    const { t, tPlural } = useTranslations();

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <h2 className="font-semibold text-lg">
                        {t('admin-pages.hostTradeUsages.suspensions.title')}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {t('admin-pages.hostTradeUsages.suspensions.description')}
                    </p>
                </div>
                {!isLoading && !hasError && items.length > 0 && (
                    <span className="text-muted-foreground text-sm">
                        {tPlural('admin-pages.hostTradeUsages.suspensions.count', items.length, {
                            count: items.length
                        })}
                    </span>
                )}
            </div>

            {isLoading && (
                <p className="text-muted-foreground text-sm">
                    {t('admin-pages.hostTradeUsages.suspensions.loading')}
                </p>
            )}

            {hasError && (
                <p
                    className="text-destructive text-sm"
                    role="alert"
                >
                    {t('admin-pages.hostTradeUsages.suspensions.error')}
                </p>
            )}

            {/*
             * The empty state is gated on a SUCCESSFUL read. A failed request
             * that fell through to "nobody is suspended" would be the most
             * dangerous screen in this feature: it reads as an all-clear.
             */}
            {!isLoading && !hasError && items.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
                    {t('admin-pages.hostTradeUsages.suspensions.empty')}
                </p>
            )}

            {!isLoading && !hasError && items.length > 0 && (
                <ul className="space-y-2">
                    {items.map((provider) => (
                        <li
                            key={provider.id}
                            className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
                            data-testid={`suspended-row-${provider.id}`}
                        >
                            <div className="space-y-1">
                                <p className="font-medium">{provider.name}</p>
                                <p className="text-muted-foreground text-xs">
                                    {provider.declarationSuspendedById
                                        ? t('admin-pages.hostTradeUsages.suspensions.byAdmin')
                                        : t('admin-pages.hostTradeUsages.suspensions.automatic')}
                                    {' · '}
                                    {t('admin-pages.hostTradeUsages.suspensions.suspendedAtLabel')}
                                    {': '}
                                    {formatDate(provider.declarationSuspendedAt)}
                                </p>
                                <p className="text-sm">
                                    <span className="text-muted-foreground">
                                        {t('admin-pages.hostTradeUsages.suspensions.reasonLabel')}:{' '}
                                    </span>
                                    {provider.declarationSuspendReason ?? (
                                        <span className="text-muted-foreground italic">
                                            {t('admin-pages.hostTradeUsages.suspensions.noReason')}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isDeciding}
                                data-testid={`lift-btn-${provider.id}`}
                                onClick={() =>
                                    onLift({
                                        hostTradeId: provider.id,
                                        providerName: provider.name
                                    })
                                }
                            >
                                {t('admin-pages.hostTradeUsages.suspensions.actions.lift')}
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
