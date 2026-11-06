import { describe, expect, it } from 'vitest';
import { resolveSuccessorWindow } from '../../../../src/services/billing/subscription/successor-window.js';

const chargeAt = new Date('2026-11-20T15:00:00.000Z');
const predecessor = { status: 'ACTIVE', paymentMethod: 'CARD', nextChargeAt: chargeAt };
const hours = (count: number) => count * 60 * 60 * 1000;

describe('TEST:B8b:18 successor window', () => {
    it('uses midnight of the charge day at UTC-4', () => {
        expect(
            resolveSuccessorWindow({
                now: new Date('2026-11-19T00:00:00.000Z'),
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor
            })
        ).toEqual({ kind: 'OFFERED', endsAt: new Date('2026-11-20T04:00:00.000Z'), reduced: true });
    });

    it('uses the previous local day for a 03:30Z charge', () => {
        expect(
            resolveSuccessorWindow({
                now: new Date('2026-11-18T00:00:00.000Z'),
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor: { ...predecessor, nextChargeAt: new Date('2026-11-20T03:30:00.000Z') }
            })
        ).toEqual({ kind: 'OFFERED', endsAt: new Date('2026-11-19T04:00:00.000Z'), reduced: true });
    });

    it('keeps 72 hours when it ends before the cutoff', () => {
        const now = new Date('2026-11-16T00:00:00.000Z');
        expect(
            resolveSuccessorWindow({ now, cardHours: 72, minimumRemainingHours: 24, predecessor })
        ).toEqual({
            kind: 'OFFERED',
            endsAt: new Date(now.getTime() + hours(72)),
            reduced: false
        });
    });

    it('offers exactly 24 hours and rejects 23 hours with the next charge instant', () => {
        expect(
            resolveSuccessorWindow({
                now: new Date('2026-11-19T04:00:00.000Z'),
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor
            })
        ).toEqual({ kind: 'OFFERED', endsAt: new Date('2026-11-20T04:00:00.000Z'), reduced: true });
        expect(
            resolveSuccessorWindow({
                now: new Date('2026-11-19T05:00:00.000Z'),
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor
            })
        ).toEqual({ kind: 'NOT_OFFERED', availableFrom: chargeAt });
    });

    it.each([
        { status: 'ACTIVE', paymentMethod: 'MANUAL', nextChargeAt: chargeAt },
        { status: 'CANCEL_SCHEDULED', paymentMethod: 'CARD', nextChargeAt: chargeAt },
        { status: 'SUSPENDED', paymentMethod: 'CARD', nextChargeAt: chargeAt },
        { status: 'ACTIVE', paymentMethod: 'CARD', nextChargeAt: null }
    ])('keeps 72 hours for %j', (source) => {
        const now = new Date('2026-11-20T03:00:00.000Z');
        expect(
            resolveSuccessorWindow({
                now,
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor: source
            })
        ).toEqual({
            kind: 'OFFERED',
            endsAt: new Date(now.getTime() + hours(72)),
            reduced: false
        });
    });
});
