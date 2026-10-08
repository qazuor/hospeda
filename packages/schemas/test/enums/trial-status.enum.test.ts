import { describe, expect, it } from 'vitest';
import { TrialStatusEnum, TrialStatusEnumSchema } from '../../src/enums/index.js';

describe('TrialStatusEnum', () => {
    it('holds the three states that live in the trial column, and not PRE_TRIAL', () => {
        expect(Object.values(TrialStatusEnum)).toEqual([
            'TRIAL_ACTIVE',
            'TRIAL_EXPIRED',
            'TRIAL_CONVERTED'
        ]);
    });

    it('parses each state and rejects PRE_TRIAL (it has no row) and anything else', () => {
        for (const value of Object.values(TrialStatusEnum)) {
            expect(TrialStatusEnumSchema.safeParse(value).success).toBe(true);
        }
        for (const value of ['PRE_TRIAL', 'trial_active', '', null, 1]) {
            expect(TrialStatusEnumSchema.safeParse(value).success).toBe(false);
        }
    });
});
