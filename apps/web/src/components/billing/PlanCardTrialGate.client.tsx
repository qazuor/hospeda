import type { PricingSituationVertical } from '@repo/schemas';
import { type ReactNode, useEffect, useState } from 'react';
import { loadPricingSituation, resolvePlanCardTrialOffer } from '@/lib/billing/pricing-situation';

/** Keeps the cacheable SSR offer until the account situation says its trial is unavailable. */
export function PlanCardTrialGate({
    vertical,
    children
}: {
    readonly vertical: PricingSituationVertical | null;
    readonly children: ReactNode;
}) {
    const [showOffer, setShowOffer] = useState(true);

    useEffect(() => {
        if (vertical === null) return;
        void loadPricingSituation({ vertical }).then((result) => {
            setShowOffer(resolvePlanCardTrialOffer({ result }));
        });
    }, [vertical]);

    return showOffer ? children : null;
}
