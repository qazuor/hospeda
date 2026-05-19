/**
 * @file SubscriberStatsBar.tsx
 * @description 5-tile stats bar for the admin subscribers list page
 * (SPEC-101 T-101-38). Reads from useNewsletterSubscriberStats() and
 * renders one badge per lifecycle status.
 */

import { useNewsletterSubscriberStats } from '@/hooks/newsletter';
import { useTranslations } from '@/hooks/use-translations';

interface StatTile {
    readonly key:
        | 'account.newsletter.statusActive'
        | 'account.newsletter.statusPending'
        | 'account.newsletter.statusUnsubscribed'
        | 'account.newsletter.statusBounced'
        | 'account.newsletter.statusComplained';
    readonly value: number;
    readonly badgeClass: string;
}

export function SubscriberStatsBar() {
    const { t } = useTranslations();
    const { data, isLoading } = useNewsletterSubscriberStats();

    const tiles: ReadonlyArray<StatTile> = [
        {
            key: 'account.newsletter.statusActive',
            value: data?.totalActive ?? 0,
            badgeClass: 'bg-green-100 text-green-800'
        },
        {
            key: 'account.newsletter.statusPending',
            value: data?.totalPending ?? 0,
            badgeClass: 'bg-yellow-100 text-yellow-800'
        },
        {
            key: 'account.newsletter.statusUnsubscribed',
            value: data?.totalUnsubscribed ?? 0,
            badgeClass: 'bg-gray-100 text-gray-700'
        },
        {
            key: 'account.newsletter.statusBounced',
            value: data?.totalBounced ?? 0,
            badgeClass: 'bg-red-100 text-red-800'
        },
        {
            key: 'account.newsletter.statusComplained',
            value: data?.totalComplained ?? 0,
            badgeClass: 'bg-red-100 text-red-800'
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map((tile) => (
                <div
                    key={tile.key}
                    className="rounded-lg border bg-card p-4"
                >
                    <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${tile.badgeClass}`}
                    >
                        {t(tile.key)}
                    </span>
                    <p className="mt-2 font-bold text-2xl">
                        {isLoading ? '—' : tile.value.toLocaleString('es-AR')}
                    </p>
                </div>
            ))}
        </div>
    );
}
