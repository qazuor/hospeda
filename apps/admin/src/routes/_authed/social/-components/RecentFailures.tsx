/**
 * @file RecentFailures.tsx
 * @description Recent failed publish targets section for the social dashboard
 * (SPEC-254 T-041).
 *
 * Shows up to 10 recently failed targets with platform, post title, last error,
 * and retry count. Each row links to the parent post detail page.
 */

import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import type { SocialDashboardFailureItem } from '@repo/schemas';
import { Link } from '@tanstack/react-router';

/** Props for {@link RecentFailures}. */
export interface RecentFailuresProps {
    readonly items: readonly SocialDashboardFailureItem[];
}

/** Stable keys for the loading skeleton rows. */
const SKELETON_KEYS = ['rf-sk-1', 'rf-sk-2', 'rf-sk-3'] as const;

/**
 * Renders the recent failures section.
 *
 * @param props - {@link RecentFailuresProps}
 */
export function RecentFailures({ items }: RecentFailuresProps) {
    const { t, tPlural } = useTranslations();

    if (items.length === 0) {
        return (
            <section
                className="space-y-3"
                data-testid="recent-failures-section"
            >
                <h2 className="font-semibold text-lg">
                    {t('social.dashboard.recentFailures.title' as TranslationKey)}
                </h2>
                <p
                    className="text-muted-foreground text-sm"
                    data-testid="recent-failures-empty"
                >
                    {t('social.dashboard.recentFailures.empty' as TranslationKey)}
                </p>
            </section>
        );
    }

    return (
        <section
            className="space-y-3"
            data-testid="recent-failures-section"
        >
            <h2 className="font-semibold text-lg">
                {t('social.dashboard.recentFailures.title' as TranslationKey)}
            </h2>

            <ul className="space-y-2">
                {items.map((item) => (
                    <li
                        key={item.targetId}
                        className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3"
                        data-testid={`failure-item-${item.targetId}`}
                    >
                        <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-red-700 text-xs uppercase tracking-wide">
                                    {item.platform}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {tPlural(
                                        'social.dashboard.recentFailures.retries' as TranslationKey,
                                        item.retryCount,
                                        { count: item.retryCount }
                                    )}
                                </span>
                            </div>
                            <p
                                className="truncate font-medium text-sm"
                                data-testid={`failure-post-title-${item.targetId}`}
                            >
                                {item.postTitle}
                            </p>
                            {item.lastError != null && (
                                <p
                                    className="truncate text-muted-foreground text-xs"
                                    data-testid={`failure-error-${item.targetId}`}
                                >
                                    {item.lastError}
                                </p>
                            )}
                        </div>
                        <Link
                            to="/social/posts"
                            search={{ status: 'FAILED' }}
                            className="shrink-0 rounded-md border border-red-300 bg-white px-2.5 py-1 text-red-700 text-xs hover:bg-red-50"
                            data-testid={`failure-view-post-${item.targetId}`}
                        >
                            {t('social.dashboard.recentFailures.viewPost' as TranslationKey)}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/** Loading skeleton for the recent failures section. */
export function RecentFailuresSkeleton() {
    return (
        <section
            className="space-y-3"
            data-testid="recent-failures-skeleton"
        >
            <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
            <ul className="space-y-2">
                {SKELETON_KEYS.map((k) => (
                    <li
                        key={k}
                        className="h-16 animate-pulse rounded-md bg-muted"
                    />
                ))}
            </ul>
        </section>
    );
}
