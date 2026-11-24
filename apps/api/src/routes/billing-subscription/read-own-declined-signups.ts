import {
    type DeclinedSignupNotice,
    type ExpiredDeclinedSignupNotice,
    readOwnDeclinedSignupsForPage
} from '@repo/service-core';
import { getClock } from '../../utils/clock';

export type { DeclinedSignupNotice, ExpiredDeclinedSignupNotice } from '@repo/service-core';

/** The caller's two declined-signup notices, from one read and one clock instant. */
export interface OwnDeclinedSignups {
    /** Declined signups still inside the seven-day retry window (HOS-2064). */
    readonly retry: DeclinedSignupNotice[];
    /** Declined signups past the window, offered a fresh start (HOS-2193). */
    readonly expired: ExpiredDeclinedSignupNotice[];
}

/**
 * Reads the caller's declined signups with the API clock, once. The rules live in service-core
 * (`declined-signup-notices.ts`); both lists come from the same rows and the same instant, so a
 * signup is never in both (HOS-2553, HOS-2193).
 *
 * @param userId - The authenticated owner.
 * @returns The retry notices and the expired notices.
 */
export async function readOwnDeclinedSignups(userId: string): Promise<OwnDeclinedSignups> {
    return readOwnDeclinedSignupsForPage({ userId, now: getClock().clock.now() });
}
