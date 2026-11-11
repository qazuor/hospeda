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

describe('HOS-2108 the stored date is a floor that only lands on a charge day', () => {
    it('keeps a stored date that already is a charge day of the series', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-10-11T13:00:00.000Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-11-11T13:00:00.000Z'),
                cycle: 'monthly',
                notBefore: '2027-02-11'
            })
        ).toBe('2027-02-11');
    });

    it('moves a stored date outside the series to the next charge day', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-10-11T13:00:00.000Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-12-12T13:00:00.000Z'),
                cycle: 'monthly',
                notBefore: '2026-12-15'
            })
        ).toBe('2027-01-12');
    });

    it('does not pull a stored date earlier than the notice end', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-10-11T13:00:00.000Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-12-05T13:00:00.000Z'),
                cycle: 'monthly',
                notBefore: '2026-11-01'
            })
        ).toBe('2027-01-05');
    });

    it('without a next charge returns the greater of deadline plus one and the floor', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 60,
                nextChargeAt: null,
                cycle: 'annual',
                notBefore: '2026-05-10'
            })
        ).toBe('2026-05-10');
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-01-01T15:00:00Z'),
                noticeDays: 60,
                nextChargeAt: null,
                cycle: 'annual',
                notBefore: '2026-02-01'
            })
        ).toBe('2026-03-03');
    });

    it('moves an annual stored date outside the series to the next annual charge', () => {
        expect(
            computeApplicationDate({
                announcedAt: new Date('2026-10-11T13:00:00.000Z'),
                noticeDays: 60,
                nextChargeAt: new Date('2026-12-12T13:00:00.000Z'),
                cycle: 'annual',
                notBefore: '2027-03-01'
            })
        ).toBe('2027-12-12');
    });
});
