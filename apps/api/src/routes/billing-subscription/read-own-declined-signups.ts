import {
    type DeclinedSignupNotice,
    type ExpiredDeclinedSignupNotice,
    readOwnDeclinedSignupNotices,
    readOwnExpiredDeclinedSignups
} from '@repo/service-core';
import { getClock } from '../../utils/clock';

export type { DeclinedSignupNotice, ExpiredDeclinedSignupNotice } from '@repo/service-core';

/**
 * Reads the caller's declined signups with the API clock. The rule itself lives in
 * service-core (`declined-signup-notices.ts`), shared with every reader that shows a
 * `CHARGE_DECLINED` row (HOS-2553).
 *
 * @param userId - The authenticated owner.
 * @returns The declined signups the owner should still hear about.
 */
export async function readOwnDeclinedSignups(userId: string): Promise<DeclinedSignupNotice[]> {
    return readOwnDeclinedSignupNotices({ userId, now: getClock().clock.now() });
}

/**
 * Reads the caller's declined signups whose seven-day retry window has passed (HOS-2193), with
 * the API clock. The page offers a fresh start for each one's vertical.
 *
 * @param userId - The authenticated owner.
 * @returns The expired declined signups, one per vertical at most.
 */
export async function readOwnExpiredDeclinedSignupNotices(
    userId: string
): Promise<ExpiredDeclinedSignupNotice[]> {
    return readOwnExpiredDeclinedSignups({ userId, now: getClock().clock.now() });
}
