import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { recordScheduledChangeFailure } from '../../../../src/services/billing/subscription/scheduled-change-attempts';

const HOOK = 'scheduled-change-attempts-validation-test';

afterEach(() => unregisterHook(HOOK));

describe('recordScheduledChangeFailure input validation', () => {
    it('logs and skips the counter write instead of throwing on invalid input', async () => {
        const errors: LogEntry[] = [];
        registerHook(HOOK, (entry) => {
            if (entry.level === 'ERROR' && entry.category === 'scheduled-change-attempts')
                errors.push(entry);
        });

        await expect(
            recordScheduledChangeFailure({
                scheduledChangeId: 'not-a-uuid',
                subscriptionId: crypto.randomUUID(),
                effectiveAt: new Date('2026-10-11T00:00:00.000Z'),
                now: new Date('2026-10-11T00:00:00.000Z'),
                error: new Error('synthetic failure')
            })
        ).resolves.toEqual({ attemptCount: null });

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toMatch(/failed validation/i);
    });
});
