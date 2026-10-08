import { describe, expect, it } from 'vitest';
import {
    FLOOR_PLAN_ROLE,
    isNonSellablePlanRole,
    NON_SELLABLE_PLAN_ROLES,
    PLAN_ROLES,
    PlanRoleSchema,
    PRE_TRIAL_PLAN_ROLE,
    TRIAL_PLAN_ROLE
} from '../../src/catalog/plan-role.js';

describe('HOS-1436 V2.3 — plan roles (AC:V2:6/7)', () => {
    it('fixes the closed list of the three non-sellable roles', () => {
        expect([...PLAN_ROLES]).toEqual(['trial', 'pre_trial', 'floor']);
        expect(TRIAL_PLAN_ROLE).toBe('trial');
        expect(PRE_TRIAL_PLAN_ROLE).toBe('pre_trial');
        expect(FLOOR_PLAN_ROLE).toBe('floor');
        expect([...NON_SELLABLE_PLAN_ROLES]).toEqual(['pre_trial', 'floor']);
    });

    it('accepts every role and rejects an unknown one', () => {
        for (const role of PLAN_ROLES) expect(PlanRoleSchema.safeParse(role).success).toBe(true);
        expect(PlanRoleSchema.safeParse('premium').success).toBe(false);
        expect(PlanRoleSchema.safeParse('').success).toBe(false);
    });

    it('tells a non-sellable role from a sellable (NULL) plan', () => {
        for (const role of PLAN_ROLES) expect(isNonSellablePlanRole(role)).toBe(true);
        expect(isNonSellablePlanRole(null)).toBe(false);
        expect(isNonSellablePlanRole(undefined)).toBe(false);
    });
});
