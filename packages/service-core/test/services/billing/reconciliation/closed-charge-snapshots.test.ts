import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanChargeDeadlines } from '../../../../src/services/billing/coverage/can-charge.js';

const { findByChargeIds } = vi.hoisted(() => ({ findByChargeIds: vi.fn() }));
vi.mock('@repo/db', () => ({ providerChargeSnapshotModel: { findByChargeIds } }));

import { createClosedChargeSnapshots } from '../../../../src/services/billing/reconciliation/charge-snapshots/closed-charge-snapshots.js';

const now = new Date('2026-10-12T00:00:00.000Z');
const row = (overrides: Record<string, unknown> = {}) => ({
    chargeId: 'charge',
    providerCreatedAt: new Date('2026-09-01T00:00:00Z'),
    expiresAt: null,
    status: 'approved',
    purpose: 'charge',
    authorizationId: 'auth',
    reference: null,
    amountMinor: 100,
    refundedAmountMinor: 0,
    currency: 'ARS',
    chargedBack: false,
    ...overrides
});

describe('createClosedChargeSnapshots', () => {
    beforeEach(() => findByChargeIds.mockReset());

    it('closes expired rejections and approved charges older than deadline 18 only', async () => {
        findByChargeIds.mockResolvedValue([
            row({
                chargeId: 'expired-rejected',
                status: 'rejected',
                expiresAt: new Date('2026-10-11T00:00:00Z')
            }),
            row({
                chargeId: 'open-rejected',
                status: 'rejected',
                expiresAt: new Date('2026-10-13T00:00:00Z')
            }),
            row({ chargeId: 'old-approved', providerCreatedAt: new Date('2026-09-01T00:00:00Z') }),
            row({
                chargeId: 'young-approved',
                providerCreatedAt: new Date('2026-10-01T00:00:00Z')
            }),
            row({ chargeId: 'pending', status: 'pending' })
        ]);
        const deadlines = {
            current: vi.fn(async () => ({ values: { '18': { days: 18 } } }))
        } as unknown as CanChargeDeadlines;
        const port = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            deadlines
        });
        await expect(port.find({ chargeIds: ['x'] })).resolves.toMatchObject([
            { chargeId: 'expired-rejected' },
            { chargeId: 'old-approved' }
        ]);
    });

    it('re-evaluates the deadline at each read and fails open when it is missing', async () => {
        findByChargeIds.mockResolvedValue([
            row({ providerCreatedAt: new Date('2026-09-20T00:00:00Z') })
        ]);
        let days = 18;
        const deadlines = {
            current: vi.fn(async () => ({ values: { '18': { days } } }))
        } as unknown as CanChargeDeadlines;
        const port = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            deadlines
        });
        expect(await port.find({ chargeIds: ['charge'] })).toHaveLength(1);
        days = 30;
        expect(await port.find({ chargeIds: ['charge'] })).toEqual([]);
        const missing = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            deadlines: {
                current: vi.fn(async () => ({ values: {} }))
            } as unknown as CanChargeDeadlines
        });
        await expect(missing.find({ chargeIds: ['charge'] })).resolves.toEqual([]);
    });
});
