import { describe, expect, it } from 'vitest';
import { shouldShowNeedsPlanBanner } from '../../../src/lib/host/needs-plan-banner';

describe('TEST:B13a:25 needs plan banner from the effective set', () => {
    const base = {
        isEmpty: false,
        fetchError: false,
        effectiveSetReadOk: true,
        hasDraftProperty: true
    };
    it('shows for a host without a live non-trial title and suppresses for one with it', () => {
        expect(shouldShowNeedsPlanBanner({ ...base, hasOwnerPlan: false })).toBe(true);
        expect(shouldShowNeedsPlanBanner({ ...base, hasOwnerPlan: true })).toBe(false);
    });
    it('does not assert plan absence when the protected read failed', () => {
        expect(
            shouldShowNeedsPlanBanner({ ...base, effectiveSetReadOk: false, hasOwnerPlan: false })
        ).toBe(false);
    });
});
