import type { AddonSubscriptionTarget } from '@/lib/billing/addon-purchase';
import type { AddonTarget } from './AddonTargetPicker';

/** The purchase screen's steps; shared by the screen and its back navigation. */
export type AddonPurchaseView =
    | 'LOADING'
    | 'OFFERS'
    | 'TARGETS'
    | 'SUBSCRIPTIONS'
    | 'SUMMARY'
    | 'PROCESSING'
    | 'ACTIVE'
    | 'CLOSED';

/**
 * HOS-2485: the Stepper position of each view (0 add-on, 1 target, 2 confirm).
 * Views outside the three choosing steps (loading, processing, the outcome)
 * show no Stepper.
 */
export const ADDON_PURCHASE_STEP_INDEX: Readonly<Partial<Record<AddonPurchaseView, number>>> = {
    OFFERS: 0,
    TARGETS: 1,
    SUBSCRIPTIONS: 1,
    SUMMARY: 2
};

/**
 * HOS-2441: the step a "Back" from `view` returns to, or `null` when there is none. A single
 * eligible subscription is auto-selected (no picker was shown), so the summary goes back to
 * the offers.
 */
export function resolveBackView(input: {
    readonly view: AddonPurchaseView;
    readonly target: AddonTarget | null;
    readonly subscriptionTarget: AddonSubscriptionTarget | null;
    readonly subscriptionTargetCount: number;
}): AddonPurchaseView | null {
    if (input.view === 'TARGETS' || input.view === 'SUBSCRIPTIONS') return 'OFFERS';
    if (input.view !== 'SUMMARY') return null;
    if (input.target) return 'TARGETS';
    if (input.subscriptionTarget && input.subscriptionTargetCount > 1) return 'SUBSCRIPTIONS';
    return 'OFFERS';
}

/** State setters the back navigation resets. */
export interface AddonPurchaseBackSetters {
    readonly setError: (value: string | null) => void;
    readonly setPurchasesPaused: (value: boolean) => void;
    readonly setOffer: (value: null) => void;
    readonly setTarget: (value: null) => void;
    readonly setSubscriptionTarget: (value: null) => void;
    readonly setOrderRequestId: (value: null) => void;
    readonly setView: (value: AddonPurchaseView) => void;
}

/**
 * Back navigation of the addon purchase screen: the step to return to and the handler that
 * clears what the abandoned step had chosen (a new order identity is minted on the next pick).
 */
export function useAddonPurchaseBack(
    input: Parameters<typeof resolveBackView>[0] & {
        readonly busy: boolean;
    } & AddonPurchaseBackSetters
): { readonly backView: AddonPurchaseView | null; readonly goBack: () => void } {
    const backView = resolveBackView(input);
    const goBack = () => {
        if (!backView || input.busy) return;
        input.setError(null);
        input.setPurchasesPaused(false);
        if (backView === 'OFFERS') {
            input.setOffer(null);
            input.setTarget(null);
            input.setSubscriptionTarget(null);
        } else if (backView === 'TARGETS') input.setTarget(null);
        else if (backView === 'SUBSCRIPTIONS') input.setSubscriptionTarget(null);
        input.setOrderRequestId(null);
        input.setView(backView);
    };
    return { backView, goBack };
}
