import { describe, expect, it } from 'vitest';
import { computeApplicationDate } from '../../../../src/services/billing/plan-migration/plan-migration-application-date.js';

describe('AC:B12:2 first charge strictly after the local notice day', () => {
    it('gives the customer the following cycle on an exact-day tie', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-03-02T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-04-02');
    });
    it('moves monthly and quarterly anchors to their first eligible charge', () => {
        const announcedAt = new Date('2026-01-01T15:00:00Z');
        expect(
            computeApplicationDate({
                announcedAt,
                noticeDays: 60,
                nextChargeAt: new Date('2026-01-15T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-03-15');
        expect(
            computeApplicationDate({
                announcedAt,
                noticeDays: 60,
                nextChargeAt: new Date('2026-01-15T15:00:00Z'),
                cycle: 'quarterly'
            })
        ).toBe('2026-04-15');
    });
    it('does not skip an annual charge ten months after notice', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-11-01T15:00:00Z'),
                cycle: 'annual'
            })
        ).toBe('2026-11-01');
    });
    it('clamps month ends including leap years', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 0,
                nextChargeAt: new Date('2026-01-31T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-01-31');
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-31T15:00:00Z'),
                noticeDays: 0,
                nextChargeAt: new Date('2026-01-31T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-02-28');
        expect(
            computeApplicationDate({
                announcedAt: new Date('2028-01-31T15:00:00Z'),
                noticeDays: 0,
                nextChargeAt: new Date('2028-01-31T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2028-02-29');
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-03-31T15:00:00Z'),
                noticeDays: 0,
                nextChargeAt: new Date('2026-03-31T15:00:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-04-30');
    });
    it('compares Argentina local days across a UTC date boundary', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-02T01:30:00Z'),
                noticeDays: 0,
                nextChargeAt: new Date('2026-01-02T02:30:00Z'),
                cycle: 'monthly'
            })
        ).toBe('2026-02-01');
    });
    it('uses the next local day when no charge is anchored yet', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 60,
                nextChargeAt: null,
                cycle: 'annual'
            })
        ).toBe('2026-03-03');
    });
});
