import { describe, expect, it } from 'vitest';
import { CancellationReasonEnum, CancellationReasonSchema } from '../../src/enums/index.js';

describe('CancellationReasonEnum', () => {
    it('contains the closed list of cancellation reasons in order', () => {
        expect(Object.values(CancellationReasonEnum)).toEqual([
            'TOO_EXPENSIVE',
            'NOT_ENOUGH_RESULTS',
            'MISSING_FEATURES',
            'SEASONAL_PAUSE',
            'CLOSING_BUSINESS',
            'SWITCHING_PLATFORM',
            'TECHNICAL_PROBLEMS',
            'OTHER'
        ]);
        for (const value of Object.values(CancellationReasonEnum))
            expect(CancellationReasonSchema.safeParse(value).success).toBe(true);
        expect(CancellationReasonSchema.safeParse('DECLINED').success).toBe(false);
    });
});
