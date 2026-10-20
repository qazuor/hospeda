import { describe, expect, it } from 'vitest';
import { classifyAddonWhenOff } from '../../../../src/services/billing/subscription/cancellation-preview.js';

describe('classifyAddonWhenOff', () => {
    it.each([
        ['ACTIVE', true, 'CHARGE_CUT_TODAY'],
        ['ACTIVE', false, 'AT_SERVICE_END'],
        ['GRACE_PERIOD', true, 'TODAY'],
        ['GRACE_PERIOD', false, 'TODAY'],
        ['SUSPENDED', true, 'TODAY'],
        ['SUSPENDED', false, 'TODAY']
    ] as const)('%s with cutToday=%s yields %s', (origin, cutToday, expected) => {
        expect(classifyAddonWhenOff({ origin, cutToday })).toBe(expected);
    });
});
