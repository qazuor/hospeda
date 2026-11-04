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
            deadlines,
            floorDays: 0
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
            deadlines,
            floorDays: 0
        });
        expect(await port.find({ chargeIds: ['charge'] })).toHaveLength(1);
        days = 30;
        expect(await port.find({ chargeIds: ['charge'] })).toEqual([]);
        const missing = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            floorDays: 0,
            deadlines: {
                current: vi.fn(async () => ({ values: {} }))
            } as unknown as CanChargeDeadlines
        });
        await expect(missing.find({ chargeIds: ['charge'] })).resolves.toEqual([]);
    });

    it('never closes an approved charge younger than the 180-day floor, however short deadline 18 is set', async () => {
        findByChargeIds.mockResolvedValue([
            row({ chargeId: 'day-100', providerCreatedAt: new Date('2026-07-04T00:00:00Z') }),
            row({ chargeId: 'day-179', providerCreatedAt: new Date('2026-04-16T00:00:00Z') }),
            row({ chargeId: 'day-200', providerCreatedAt: new Date('2026-03-26T00:00:00Z') })
        ]);
        const port = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            deadlines: {
                current: vi.fn(async () => ({ values: { '18': { days: 1 } } }))
            } as unknown as CanChargeDeadlines
        });
        await expect(port.find({ chargeIds: ['x'] })).resolves.toMatchObject([
            { chargeId: 'day-200' }
        ]);
    });

    it('lets a deadline 18 longer than the floor keep charges open past it', async () => {
        findByChargeIds.mockResolvedValue([
            row({ chargeId: 'day-200', providerCreatedAt: new Date('2026-03-26T00:00:00Z') })
        ]);
        const port = createClosedChargeSnapshots({
            provider: 'MP',
            clock: { now: () => now },
            deadlines: {
                current: vi.fn(async () => ({ values: { '18': { days: 365 } } }))
            } as unknown as CanChargeDeadlines
        });
        await expect(port.find({ chargeIds: ['x'] })).resolves.toEqual([]);
    });
});
