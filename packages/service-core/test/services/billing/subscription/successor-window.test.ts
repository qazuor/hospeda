import { describe, expect, it } from 'vitest';
import { resolveSuccessorWindow } from '../../../../src/services/billing/subscription/successor-window.js';

const chargeAt = new Date('2026-11-20T15:00:00.000Z');
const predecessor = {
    status: 'ACTIVE',
    paymentMethod: 'CARD',
    nextChargeAt: chargeAt,
    hasCreditedCharge: true
};
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
        {
            status: 'ACTIVE',
            paymentMethod: 'MANUAL',
            nextChargeAt: chargeAt,
            hasCreditedCharge: true
        },
        {
            status: 'CANCEL_SCHEDULED',
            paymentMethod: 'CARD',
            nextChargeAt: chargeAt,
            hasCreditedCharge: true
        },
        {
            status: 'SUSPENDED',
            paymentMethod: 'CARD',
            nextChargeAt: chargeAt,
            hasCreditedCharge: true
        },
        { status: 'ACTIVE', paymentMethod: 'CARD', nextChargeAt: null, hasCreditedCharge: true }
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

    describe('HOS-2223: a predecessor with no credited charge yet', () => {
        it('offers the full window although S2 copied a first charge about now', () => {
            // Arrange: S2 copied the provider's first-charge instant, minutes away; P1 never ran.
            const now = new Date('2026-11-16T12:00:00.000Z');
            const firstChargeAt = new Date('2026-11-16T12:05:00.000Z');

            // Act
            const window = resolveSuccessorWindow({
                now,
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor: {
                    ...predecessor,
                    nextChargeAt: firstChargeAt,
                    hasCreditedCharge: false
                }
            });

            // Assert
            expect(window).toEqual({
                kind: 'OFFERED',
                endsAt: new Date(now.getTime() + hours(72)),
                reduced: false
            });
        });

        it('still cuts the window at the charge day once a charge is credited', () => {
            // Arrange: same instants, but the predecessor's cycle is paid (P1 wrote a covered period).
            const now = new Date('2026-11-16T12:00:00.000Z');
            const firstChargeAt = new Date('2026-11-16T12:05:00.000Z');

            // Act
            const window = resolveSuccessorWindow({
                now,
                cardHours: 72,
                minimumRemainingHours: 24,
                predecessor: {
                    ...predecessor,
                    nextChargeAt: firstChargeAt,
                    hasCreditedCharge: true
                }
            });

            // Assert
            expect(window).toEqual({ kind: 'NOT_OFFERED', availableFrom: firstChargeAt });
        });
    });
});
