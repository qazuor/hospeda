import type { SubscriptionData } from '../../lib/api/endpoints-protected';
import { STATUS_BADGE_CLASSES } from './subscription-card.types';

/** Props for the SubscriptionStatusBadge component */
interface SubscriptionStatusBadgeProps {
    readonly statusKey: SubscriptionData['status'] | 'free';
    readonly label: string;
}

/**
 * Accessible status pill badge for subscription state.
 * Uses both color AND visible text (WCAG requirement - not color alone).
 *
 * @param statusKey - Subscription status key used to derive color classes
 * @param label - Visible text label for the badge
 */
export function SubscriptionStatusBadge({ statusKey, label }: SubscriptionStatusBadgeProps) {
    const colorClasses = STATUS_BADGE_CLASSES[statusKey];
    return (
        <output
            className={`inline-block rounded-full px-2 py-1 font-medium text-sm ${colorClasses}`}
        >
            {label}
        </output>
    );
}
