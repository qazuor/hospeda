import { isUnlimitedLimit } from '@repo/schemas';
import { useEffect, useSyncExternalStore } from 'react';
import { useMyEntitlements } from '@/hooks/useMyEntitlements';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';
import type { PluralTranslationFn, TranslationFn } from '@/lib/i18n';

let totalSnapshot: { readonly account: string; readonly total?: number } | undefined;
let pendingTotal: Promise<number | undefined> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            totalSnapshot = undefined;
            pendingTotal = undefined;
        }
    };
}

function readTotal({
    account,
    refresh = false
}: {
    readonly account: string;
    readonly refresh?: boolean;
}) {
    if (!refresh && totalSnapshot?.account === account) {
        return pendingTotal ?? Promise.resolve(totalSnapshot.total);
    }
    const request = Promise.resolve()
        .then(() => userBookmarksApi.list({ pageSize: 1 }))
        .then((result) => {
            const total = result.ok ? result.data.total : undefined;
            return total !== undefined && Number.isSafeInteger(total) && total >= 0
                ? total
                : undefined;
        })
        .catch(() => undefined);
    totalSnapshot = { account };
    pendingTotal = request;
    for (const listener of listeners) listener();
    return request.then((total) => {
        // An older request must never overwrite the newest mutation or another account.
        if (pendingTotal !== request) return undefined;
        totalSnapshot = { account, total };
        pendingTotal = undefined;
        for (const listener of listeners) listener();
        return total;
    });
}

/** Share the authenticated bookmark total across hearts and format the effective catalog allowance. */
export function useFavoriteUsage({
    account,
    showUsage,
    t,
    tPlural
}: {
    readonly account: string | undefined;
    readonly showUsage: boolean | 'tooltip';
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
}) {
    const { limit, isLoading, error } = useMyEntitlements({ vertical: 'tourist', skip: !account });
    const max = limit('max_favorites');
    const known = Boolean(account) && !isLoading && !error && Number.isSafeInteger(max) && max > 0;
    const unlimited = known && isUnlimitedLimit({ value: max });
    const finite = known && !unlimited;
    const total = useSyncExternalStore(
        subscribe,
        () => (account && totalSnapshot?.account === account ? totalSnapshot.total : undefined),
        () => undefined
    );
    useEffect(() => {
        if (account && finite && showUsage) void readTotal({ account });
    }, [account, finite, showUsage]);
    let label: string | undefined;
    let counter: string | undefined;
    if (showUsage) {
        if (unlimited) {
            label = t('common.card.favoritesUnlimited');
            counter = '∞';
        } else if (finite && total !== undefined) {
            label =
                showUsage === 'tooltip'
                    ? tPlural('ui.favorite.audit.usage', max, { current: total })
                    : t('common.card.favoriteUsage', undefined, { count: total, max });
            counter = `${total}/${max}`;
        }
    }
    return {
        label,
        counter: showUsage === true ? counter : undefined,
        afterToggle: async ({ saved }: { readonly saved: boolean }) => {
            const refreshed =
                account && finite ? await readTotal({ account, refresh: true }) : undefined;
            if (!saved) {
                // HOS-2666 (CARD-039 H-2): the remove toast carries the same
                // "N de 5" counter as the add toast for a limited (Free) plan.
                if (refreshed === undefined) return undefined;
                const usage = tPlural('ui.favorite.audit.usage', max, { current: refreshed });
                return t('ui.favorite.audit.removedUsage', undefined, { usage });
            }
            if (unlimited) return t('ui.favorite.audit.savedUnlimited');
            if (refreshed !== undefined) {
                const usage = tPlural('ui.favorite.audit.usage', max, { current: refreshed });
                return t('ui.favorite.audit.savedUsage', undefined, { usage });
            }
            return undefined;
        }
    };
}
