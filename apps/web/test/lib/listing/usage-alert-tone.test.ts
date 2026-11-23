/**
 * @file usage-alert-tone.test.ts
 * @description HOS-2443 / HOS-2483: the cap is informational, never an error.
 */
import { describe, expect, it } from 'vitest';
import { resolveUsageAlertTone } from '../../../src/lib/listing/usage-alert-tone';

describe('resolveUsageAlertTone', () => {
    it.each([
        ['ok', 'info'],
        ['atLimit', 'info'],
        ['warning', 'warning'],
        ['critical', 'warning'],
        ['exceeded', 'warning']
    ] as const)('%s → %s (never danger)', (threshold, tone) => {
        expect(resolveUsageAlertTone({ threshold })).toBe(tone);
    });
});
