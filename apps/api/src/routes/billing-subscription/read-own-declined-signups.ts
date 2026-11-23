import { type DeclinedSignupNotice, readOwnDeclinedSignupNotices } from '@repo/service-core';
import { getClock } from '../../utils/clock';

export type { DeclinedSignupNotice } from '@repo/service-core';

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
