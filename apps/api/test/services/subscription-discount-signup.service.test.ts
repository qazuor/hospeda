/**
 * SPEC-262 T-014 / HOS-244 — subscription-discount-signup.service unit test.
 *
 * After HOS-244 this module only exposes `computeSignupDiscountCycleSeed` — the
 * discount bookkeeping (stamp + seed + redeem) moved inline into
 * `link-preapproval.service.ts`'s `applyPendingDiscountBestEffort` (covered by the
 * link-preapproval tests). The seed constant is the load-bearing SANDBOX-VERIFY
 * decision, so it keeps its own focused test.
 *
 * @module test/services/subscription-discount-signup.service
 */

import { describe, expect, it } from 'vitest';
import { computeSignupDiscountCycleSeed } from '../../src/services/subscription-discount-signup.service';

describe('computeSignupDiscountCycleSeed', () => {
    it('seeds N (full duration) — SANDBOX-VERIFY constant', () => {
        expect(computeSignupDiscountCycleSeed(3)).toBe(3);
        expect(computeSignupDiscountCycleSeed(1)).toBe(1);
    });
});
