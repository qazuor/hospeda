/**
 * @file handler.server-error-lockout.test.ts
 *
 * Regression tests for H-56 — "a 500 on login locks the user's account out and
 * is recorded as invalid credentials".
 *
 * Read against what production runs: `handler.ts` decided success with
 * `response.status === 200` and excluded exactly one status from counting as a
 * failed attempt — Better Auth's 429. Everything else, a 500 included, fell into
 * the failure branch and did two harmful things: it called
 * `recordFailedAttempt()`, which increments the counter and can LOCK the
 * account, and it wrote an audit entry claiming `reason: 'invalid_credentials'`,
 * which is simply false.
 *
 * The consequence inverts responsibility: while the API or database is down,
 * every person who tries to sign in spends attempts against their own lockout,
 * and whoever tried hardest is the one who cannot get in once service returns.
 *
 * The asymmetry is what gives it away — the 429 exclusion carries a comment
 * explaining that it must not count as a failed login. The category "this was
 * not the user's fault" was already recognised in the file; it was just missing
 * its other member.
 */

import { describe, expect, it } from 'vitest';
import { shouldCountAuthAttempt } from '../../../src/routes/auth/handler';

describe('shouldCountAuthAttempt (H-56)', () => {
    it('does NOT count a 500 — our outage is not the user’s failed attempt', () => {
        expect(shouldCountAuthAttempt({ status: 500 })).toBe(false);
    });

    it('does NOT count any other 5xx', () => {
        // A gateway/proxy failure in front of the API is just as much our
        // problem as a 500 from the handler itself.
        for (const status of [501, 502, 503, 504, 599]) {
            expect(shouldCountAuthAttempt({ status })).toBe(false);
        }
    });

    it('still does NOT count Better Auth’s 429 (behaviour that already existed)', () => {
        expect(shouldCountAuthAttempt({ status: 429 })).toBe(false);
    });

    it('DOES count a genuine credential rejection (positive control)', () => {
        // The whole point of the lockout. If this returned false the brute-force
        // protection would be silently disabled and every test above would still
        // pass.
        expect(shouldCountAuthAttempt({ status: 401 })).toBe(true);
        expect(shouldCountAuthAttempt({ status: 400 })).toBe(true);
        expect(shouldCountAuthAttempt({ status: 403 })).toBe(true);
    });

    it('DOES count a 200 — the caller decides success separately', () => {
        // Sign-in inspects the body too (Better Auth issue #7035 can return an
        // error payload under a 200), so this predicate only answers "was this
        // attempt attributable to the user at all".
        expect(shouldCountAuthAttempt({ status: 200 })).toBe(true);
    });

    it('treats 499 and 500 correctly across the boundary', () => {
        // Buckets lie at the edge unless the edge is asserted explicitly.
        expect(shouldCountAuthAttempt({ status: 499 })).toBe(true);
        expect(shouldCountAuthAttempt({ status: 500 })).toBe(false);
    });
});
