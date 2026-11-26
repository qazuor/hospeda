import { isUnlimitedLimit } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { fetchPublicPlans } from '@/lib/billing/fetch-plans';
import { touristBadgeCatalog } from '@/lib/billing/plan-badge';
import type { TranslationFn } from '@/lib/i18n';

/** Resolve real guest benefit copy on demand from the public tourist catalog. */
export function useFavoriteGuestBenefit({
    open,
    t
}: {
    readonly open: boolean;
    readonly t: TranslationFn;
}) {
    const [benefit, setBenefit] = useState<{ readonly max: number; readonly plan?: string }>();
    useEffect(() => {
        if (!open) return;
        let active = true;
        void fetchPublicPlans({ vertical: 'tourist' })
            .then((result) => {
                const { floor, plans } = touristBadgeCatalog({ result });
                const max = floor?.limits.max_favorites;
                if (
                    !active ||
                    max === undefined ||
                    !Number.isSafeInteger(max) ||
                    max <= 0 ||
                    isUnlimitedLimit({ value: max })
                )
                    return;
                const paid = plans.find(({ limits }) =>
                    isUnlimitedLimit({ value: limits.max_favorites ?? 0 })
                );
                setBenefit({ max, plan: paid?.name });
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [open]);
    if (!open || !benefit) return undefined;
    return t(
        benefit.plan ? 'ui.favorite.audit.guestBenefit' : 'ui.favorite.audit.guestFree',
        undefined,
        benefit
    );
}
