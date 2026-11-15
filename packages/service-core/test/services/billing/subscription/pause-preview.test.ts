import { describe, expect, it } from 'vitest';
import { previewPause } from '../../../../src/services/billing/subscription/pause-preview.js';
import { pauseExpectedEndAt } from '../../../../src/services/billing/subscription/pause-subscription.service.js';

const ports = {
    clock: { now: () => new Date('2026-01-31T12:00:00.000Z') },
    planPolicy: async () => {
        throw new Error('Unexpected plan policy call');
    },
    complements: {
        addonPolicy: async () => {
            throw new Error('Unexpected addon policy call');
        },
        listing: async () => {
            throw new Error('Unexpected listing call');
        }
    }
};

describe('TEST:B8b:25 pause preview boundary', () => {
    it('rejects an invalid subscription id before any reader is called', async () => {
        await expect(previewPause({ subscriptionId: 'invalid' }, ports)).rejects.toThrow();
    });
    it('uses S8 UTC calendar arithmetic even across month boundaries', () => {
        expect(pauseExpectedEndAt(new Date('2026-01-31T12:00:00.000Z'), 1).toISOString()).toBe(
            '2026-03-03T12:00:00.000Z'
        );
    });
});
