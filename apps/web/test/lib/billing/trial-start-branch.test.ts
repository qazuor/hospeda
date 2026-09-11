/**
 * @file trial-start-branch.test.ts
 * @description HOS-1233 D-2 / AC-3..AC-6 / AC-9 — the three branches of the
 * "Empezar" button, both sides of the 3-day boundary, and the unresolved case.
 *
 * The spec's test plan warns that most of this suite's assertions are about an
 * ABSENCE (no dialog, no checkout), which is the shape that passes for the
 * wrong reason most easily. These tests therefore assert the branch VALUE
 * returned, never "it did not warn" — a typo in a branch name then fails
 * instead of quietly matching nothing.
 */

import { describe, expect, it } from 'vitest';
import {
    resolveTrialScopeForAudience,
    resolveTrialStartBranch,
    TRIAL_WARNING_THRESHOLD_DAYS,
    type TrialClockReading
} from '@/lib/billing/trial-start-branch';
import type { PricingAudience } from '@/lib/billing-i18n';

/** A running trial with `days` left. */
function runningTrial(days: number | null): TrialClockReading {
    return {
        isOnTrial: true,
        isExpired: false,
        daysRemaining: days,
        startedAt: '2026-09-01T00:00:00.000Z'
    };
}

describe('TRIAL_WARNING_THRESHOLD_DAYS (AC-6)', () => {
    it('is pinned at 3 — moving it is a product decision, not a refactor', () => {
        // Deliberately a literal, not derived from the constant: a test that
        // reads the constant to assert the constant proves nothing, and the
        // boundary cases below use literals for the same reason.
        expect(TRIAL_WARNING_THRESHOLD_DAYS).toBe(3);
    });
});

describe('resolveTrialScopeForAudience', () => {
    it.each([
        ['owner', 'accommodation'],
        ['tourist', 'tourist'],
        ['gastronomy', 'gastronomy'],
        ['experience', 'experience']
    ] as ReadonlyArray<
        [PricingAudience, string]
    >)('maps the %s page to the %s trial scope', (audience, expected) => {
        expect(resolveTrialScopeForAudience({ audience })).toBe(expected);
    });

    it('maps partner to null — the API rejects ?productDomain=partner with a 400', () => {
        // Not an oversight and not a gap: `ProductDomainScopeEnumSchema`
        // excludes partner because it owns no trial site. Mapping it to
        // `accommodation` "so it returns something" would show an allies
        // visitor a host's trial.
        expect(resolveTrialScopeForAudience({ audience: 'partner' })).toBeNull();
    });

    it('covers every audience — a sixth one cannot be silently unmapped', () => {
        const audiences: ReadonlyArray<PricingAudience> = [
            'owner',
            'tourist',
            'gastronomy',
            'experience',
            'partner'
        ];
        // Non-vacuity: without this, deleting an entry from the map would only
        // fail the one case above that names it.
        for (const audience of audiences) {
            expect(resolveTrialScopeForAudience({ audience })).not.toBeUndefined();
        }
    });
});

describe('resolveTrialStartBranch — trial not started (AC-3)', () => {
    it('sends a visitor who never had a trial to the create form, not to payment', () => {
        const branch = resolveTrialStartBranch({
            reading: {
                isOnTrial: false,
                isExpired: false,
                daysRemaining: null,
                startedAt: null
            }
        });

        expect(branch).toBe('trial_create_form');
    });
});

describe('resolveTrialStartBranch — trial running (AC-4 / AC-5 / AC-6)', () => {
    it('warns with 4 days left — comfortably above the threshold', () => {
        expect(resolveTrialStartBranch({ reading: runningTrial(4) })).toBe(
            'trial_warn_then_checkout'
        );
    });

    it('warns at EXACTLY 3 days — the boundary AC-6 requires to be defined', () => {
        // D-2 spells only "more than 3" and "fewer than 3". AC-9 decides the
        // case it leaves open, for the side that asks before taking money.
        // Flipping the predicate from `>=` to `>` makes this the only failing
        // test in the file, which is the point of having it.
        expect(resolveTrialStartBranch({ reading: runningTrial(3) })).toBe(
            'trial_warn_then_checkout'
        );
    });

    it('goes straight to checkout at 2 days — the other side of the same boundary', () => {
        expect(resolveTrialStartBranch({ reading: runningTrial(2) })).toBe('trial_checkout');
    });

    it('goes straight to checkout on the last day', () => {
        expect(resolveTrialStartBranch({ reading: runningTrial(0) })).toBe('trial_checkout');
    });
});

describe('resolveTrialStartBranch — nothing left to protect', () => {
    it('sends an elapsed trial to checkout, exactly as before this spec', () => {
        const branch = resolveTrialStartBranch({
            reading: {
                isOnTrial: false,
                isExpired: true,
                daysRemaining: null,
                startedAt: '2026-08-01T00:00:00.000Z'
            }
        });

        expect(branch).toBe('trial_checkout');
    });

    it('sends a started-but-no-longer-running trial to checkout', () => {
        // `startedAt` present with `isExpired` false: the trial ran and ended
        // some other way (converted, cancelled). There are no days to lose, so
        // there is nothing to warn about.
        const branch = resolveTrialStartBranch({
            reading: {
                isOnTrial: false,
                isExpired: false,
                daysRemaining: null,
                startedAt: '2026-08-01T00:00:00.000Z'
            }
        });

        expect(branch).toBe('trial_checkout');
    });
});

describe('resolveTrialStartBranch — the unresolved read (AC-9, R-2)', () => {
    it('WARNS when the clock could not be read at all', () => {
        // The dangerous direction here is the opposite of the usual one: a
        // failed read that skips the warning charges real money without
        // asking. This must never return 'checkout'.
        expect(resolveTrialStartBranch({ reading: null })).toBe('trial_warn_then_checkout');
    });

    it('WARNS on a contradictory payload — on trial with no day count', () => {
        expect(resolveTrialStartBranch({ reading: runningTrial(null) })).toBe(
            'trial_warn_then_checkout'
        );
    });

    it('WARNS on a NaN day count rather than comparing it', () => {
        // `NaN >= 3` is false, so without the explicit guard this would fall
        // through to 'checkout' — a silent charge produced by a comparison
        // that looks correct.
        expect(resolveTrialStartBranch({ reading: runningTrial(Number.NaN) })).toBe(
            'trial_warn_then_checkout'
        );
    });

    it('never returns checkout for any unresolved shape', () => {
        const unresolvedShapes: ReadonlyArray<TrialClockReading | null> = [
            null,
            runningTrial(null),
            runningTrial(Number.NaN)
        ];

        for (const reading of unresolvedShapes) {
            expect(resolveTrialStartBranch({ reading })).not.toBe('trial_checkout');
        }
    });
});
