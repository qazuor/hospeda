import { isUnlimitedLimit } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import type { TranslationFn } from '@/lib/i18n';

/** Read the signed-in viewer’s total and effective catalog limit for detail hearts. */
export function useFavoriteUsage({
    account,
    t
}: {
    readonly account: string | undefined;
    readonly t: TranslationFn;
}) {
    const { limit, isLoading, error } = useMyEntitlements({ vertical: 'tourist', skip: !account });
    const max = limit('max_favorites');
    const [revision, setRevision] = useState(0);
    const [usage, setUsage] = useState<{ account: string; total: number; revision: number }>();
    const unlimited = isUnlimitedLimit({ value: max });
    const finite = max > 0 && !unlimited;
    useEffect(() => {
        if (!account || !finite || isLoading || error) return;
        let active = true;
        void userBookmarksApi
            .list({ pageSize: 1 })
            .then((result) => {
                if (active && result.ok) setUsage({ account, total: result.data.total, revision });
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [account, error, finite, isLoading, revision]);
    let label: string | undefined;
    let counter: string | undefined;
    if (account && !isLoading && !error) {
        if (unlimited) {
            label = t('common.card.favoritesUnlimited');
            counter = '∞';
        } else if (finite && usage?.account === account && usage.revision === revision) {
            label = t('common.card.favoriteUsage', undefined, { count: usage.total, max });
            counter = `${usage.total}/${max}`;
        }
    }
    return {
        label,
        counter,
        refresh: () => {
            if (account && finite) setRevision((value) => value + 1);
        }
    };
}
