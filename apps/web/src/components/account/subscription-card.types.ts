import type { SubscriptionData } from '../../lib/api/endpoints-protected';

/** Translation function type used by subscription sub-components */
export type TFunction = (
    key: string,
    fallback?: string,
    params?: Record<string, unknown>
) => string;

/** Callback type for subscription action buttons */
export type ActionCallback = () => void;

/** Status badge color classes by subscription status */
export const STATUS_BADGE_CLASSES: Readonly<Record<SubscriptionData['status'] | 'free', string>> = {
    active: 'bg-secondary/15 text-secondary-foreground',
    trial: 'bg-accent/15 text-accent-foreground',
    cancelled: 'bg-destructive/15 text-destructive-foreground',
    expired: 'bg-muted text-muted-foreground',
    past_due: 'bg-destructive/15 text-destructive-foreground',
    pending: 'bg-primary/15 text-primary-foreground',
    free: 'bg-muted text-muted-foreground'
} as const;
