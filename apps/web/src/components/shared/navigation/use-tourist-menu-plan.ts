import { useEffect, useState } from 'react';
import type { MenuPlan } from './tourist-menu-plan';

/** Load the account's tourist plan only while its navigation menu is open. */
export function useTouristMenuPlan({
    account,
    open
}: {
    readonly account?: string;
    readonly open: boolean;
}): MenuPlan | null {
    const [state, setState] = useState<{
        readonly account: string;
        readonly plan: MenuPlan | null;
    } | null>(null);
    useEffect(() => {
        if (!account || !open) return;
        let current = true;
        void import('./tourist-menu-plan')
            .then(({ readMenuPlan }) => (current ? readMenuPlan() : null))
            .catch(() => null)
            .then((plan) => {
                if (current) setState({ account, plan });
            });
        return () => {
            current = false;
        };
    }, [account, open]);
    return account && state?.account === account ? state.plan : null;
}
