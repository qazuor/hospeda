import type { Clock } from '@repo/billing-verticals-contract';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../types';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import { getCurrentBillingDeadlines } from '../../deadlines/billing-deadlines.service';

const DAY_MS = 86_400_000;

/**
 * The lower bound of the window of the credited-payments check, and of the
 * paid-orders check (PLAZO:18, HOS-1605 H1 and H15): now minus the 18th
 * deadline's days, read from the deadline version in force (the payment keeps
 * no version of its own). Millisecond arithmetic only.
 *
 * @param input.clock - The sweep's clock
 * @param input.deadlines - The billing deadlines; defaults to the version in force
 * @returns The inclusive lower bound on the payment's `fact_at`
 * @throws ServiceError `CONFIGURATION_ERROR` (`BILLING_DEADLINE_18_MISSING`) without the 18th deadline
 */
export async function reconciliationWindowSince(input: {
    readonly clock: Clock;
    readonly deadlines?: CanChargeDeadlines;
}): Promise<Date> {
    const deadlines = input.deadlines ?? { current: getCurrentBillingDeadlines };
    const { values } = await deadlines.current();
    const days = values['18']?.days;
    if (typeof days !== 'number' || !Number.isFinite(days))
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'The billing deadlines in force have no 18th deadline',
            undefined,
            'BILLING_DEADLINE_18_MISSING'
        );
    return new Date(input.clock.now().getTime() - days * DAY_MS);
}
