/**
 * @file usage-alert-tone.ts
 * @description Maps a published-listings usage threshold to the kit `Alert`
 * tone (HOS-2483 / HOS-2484), shared by the properties and the venue and
 * experience lists so both say the same thing about the same number.
 *
 * HOS-2443: reaching the cap exactly is a state, not a problem: `info`, never
 * an error tone. Approaching it is a `warning`; going PAST it (a downgrade, a
 * lapsed grant) is a `warning` too, because nothing is broken: the owner has a
 * decision to make, and `danger` is kept for failures.
 */

import type { AlertTone } from '@/components/account/ui';
import type { UsageBadgeData } from '@/lib/host/usage-badge';

/**
 * Resolves the Alert tone of a usage threshold.
 *
 * @param input.threshold - The threshold from `getUsageThreshold`.
 * @returns The kit Alert tone.
 */
export function resolveUsageAlertTone({
    threshold
}: {
    readonly threshold: UsageBadgeData['threshold'];
}): AlertTone {
    switch (threshold) {
        case 'warning':
        case 'critical':
        case 'exceeded':
            return 'warning';
        default:
            return 'info';
    }
}
