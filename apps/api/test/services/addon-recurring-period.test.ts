/**
 * Billing-period arithmetic for recurring add-ons (HOS-847 PR 5).
 *
 * Pure functions, no mocks — which is the point. The two decisions that keep a
 * customer from being charged for a month they already paid for, or from
 * drifting a day forward every February, are arithmetic, and arithmetic is the
 * one part of this PR that can be pinned without a single stub.
 *
 * @module test/services/addon-recurring-period
 */

import { describe, expect, it } from 'vitest';
import {
    addMonthsClamped,
    computeInitialAddonPeriod,
    computeNextAddonPeriod,
    normalizeAddonBillingInterval
} from '../../src/services/addon-recurring-period.js';

const iso = (value: string) => new Date(value);

describe('normalizeAddonBillingInterval', () => {
    it.each([
        ['monthly', 'monthly'],
        ['annual', 'annual']
    ])('passes %s through', (raw, expected) => {
        expect(normalizeAddonBillingInterval(raw)).toBe(expected);
    });

    it.each([
        [null],
        [undefined],
        [''],
        ['month'],
        ['yearly'],
        ['MONTHLY']
    ])('falls back to monthly — the SHORTER window — for %p', (raw) => {
        // Arrange & Act
        const resolved = normalizeAddonBillingInterval(raw as string | null | undefined);

        // Assert: an unrecognised cadence must under-serve, never hand out a
        // year for a month's payment.
        expect(resolved).toBe('monthly');
    });
});

describe('addMonthsClamped', () => {
    it('clamps 31 January to the last day of February instead of rolling into March', () => {
        // Arrange
        const from = iso('2026-01-31T10:00:00.000Z');

        // Act
        const result = addMonthsClamped({ from, months: 1 });

        // Assert: 2026 is not a leap year, so 28 February. `setMonth` alone
        // would have produced 3 March.
        expect(result.toISOString()).toBe('2026-02-28T10:00:00.000Z');
    });

    it('clamps to 29 February in a leap year', () => {
        // Arrange
        const from = iso('2028-01-31T10:00:00.000Z');

        // Act & Assert
        expect(addMonthsClamped({ from, months: 1 }).toISOString()).toBe(
            '2028-02-29T10:00:00.000Z'
        );
    });

    it('crosses a year boundary and preserves the time of day', () => {
        // Arrange
        const from = iso('2026-11-15T23:45:30.500Z');

        // Act & Assert
        expect(addMonthsClamped({ from, months: 3 }).toISOString()).toBe(
            '2027-02-15T23:45:30.500Z'
        );
    });

    it('does not mutate the date it was given', () => {
        // Arrange
        const from = iso('2026-03-15T00:00:00.000Z');
        const before = from.getTime();

        // Act
        addMonthsClamped({ from, months: 6 });

        // Assert
        expect(from.getTime()).toBe(before);
    });
});

describe('computeInitialAddonPeriod', () => {
    it('opens a one-month window for a monthly add-on', () => {
        // Arrange & Act
        const period = computeInitialAddonPeriod({
            from: iso('2026-05-10T12:00:00.000Z'),
            billingInterval: 'monthly'
        });

        // Assert
        expect(period.currentPeriodStart.toISOString()).toBe('2026-05-10T12:00:00.000Z');
        expect(period.currentPeriodEnd.toISOString()).toBe('2026-06-10T12:00:00.000Z');
    });

    it('opens a twelve-month window for an annual add-on', () => {
        // Arrange & Act
        const period = computeInitialAddonPeriod({
            from: iso('2026-05-10T12:00:00.000Z'),
            billingInterval: 'annual'
        });

        // Assert: twelve MONTHS, the unit MercadoPago actually accepts.
        expect(period.currentPeriodEnd.toISOString()).toBe('2027-05-10T12:00:00.000Z');
    });
});

describe('computeNextAddonPeriod', () => {
    it('opens a window from the charge when no period was ever recorded', () => {
        // Arrange: the activation webhook never arrived and this settled charge
        // is the first thing we have heard about the preapproval.
        const settledAt = iso('2026-05-10T12:00:00.000Z');

        // Act
        const next = computeNextAddonPeriod({
            currentPeriodEnd: null,
            settledAt,
            billingInterval: 'monthly'
        });

        // Assert
        expect(next).not.toBeNull();
        expect(next?.currentPeriodStart.toISOString()).toBe('2026-05-10T12:00:00.000Z');
        expect(next?.currentPeriodEnd.toISOString()).toBe('2026-06-10T12:00:00.000Z');
    });

    it('advances NOTHING for the initial charge that lands inside the window activation just opened', () => {
        // Arrange: this is the real sequence. MercadoPago authorizes the
        // preapproval, activation opens [now, now + 1 month], and the very first
        // charge settles seconds later — INSIDE that window.
        const activatedAt = iso('2026-05-10T12:00:00.000Z');
        const periodEnd = computeInitialAddonPeriod({
            from: activatedAt,
            billingInterval: 'monthly'
        }).currentPeriodEnd;

        // Act
        const next = computeNextAddonPeriod({
            currentPeriodEnd: periodEnd,
            settledAt: iso('2026-05-10T12:00:04.000Z'),
            billingInterval: 'monthly'
        });

        // Assert: null means "do not move the period". Advancing here would hand
        // this buyer two months for one payment.
        expect(next).toBeNull();
    });

    it('advances NOTHING for a MercadoPago retry inside the same window, even though it is a different payment', () => {
        // Arrange: a failed charge retried three days later carries a NEW MP
        // payment id, so the ledger's per-payment dedupe never sees it. This
        // window check is the only thing standing between that retry and a
        // second period.
        const next = computeNextAddonPeriod({
            currentPeriodEnd: iso('2026-06-10T12:00:00.000Z'),
            settledAt: iso('2026-05-13T09:00:00.000Z'),
            billingInterval: 'monthly'
        });

        // Assert
        expect(next).toBeNull();
    });

    it('advances when the charge settles exactly at the period end', () => {
        // Arrange: the boundary is inclusive on the advancing side — a charge AT
        // the period end is the renewal, not the charge that funded it.
        const periodEnd = iso('2026-06-10T12:00:00.000Z');

        // Act
        const next = computeNextAddonPeriod({
            currentPeriodEnd: periodEnd,
            settledAt: periodEnd,
            billingInterval: 'monthly'
        });

        // Assert
        expect(next?.currentPeriodStart.toISOString()).toBe('2026-06-10T12:00:00.000Z');
        expect(next?.currentPeriodEnd.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    });

    it('anchors a late renewal on the OLD period end, never on when the webhook happened to arrive', () => {
        // Arrange: MercadoPago charged on schedule but the webhook took two days
        // to reach us.
        const next = computeNextAddonPeriod({
            currentPeriodEnd: iso('2026-06-10T12:00:00.000Z'),
            settledAt: iso('2026-06-12T08:30:00.000Z'),
            billingInterval: 'monthly'
        });

        // Assert: the next charge is still due on the 10th. Anchoring on
        // `settledAt` would walk the billing date forward by every delivery
        // delay, for the life of the subscription.
        expect(next?.currentPeriodStart.toISOString()).toBe('2026-06-10T12:00:00.000Z');
        expect(next?.currentPeriodEnd.toISOString()).toBe('2026-07-10T12:00:00.000Z');
    });

    it('advances an annual add-on by twelve months', () => {
        // Arrange & Act
        const next = computeNextAddonPeriod({
            currentPeriodEnd: iso('2026-06-10T12:00:00.000Z'),
            settledAt: iso('2026-06-10T12:00:00.000Z'),
            billingInterval: 'annual'
        });

        // Assert
        expect(next?.currentPeriodEnd.toISOString()).toBe('2027-06-10T12:00:00.000Z');
    });

    it('keeps the billing day-of-month stable across a short month over a full year', () => {
        // Arrange: a purchase made on the 31st. Walking twelve renewals forward
        // must land back on the 31st every time the month has one — a clamp that
        // did not re-read the ORIGINAL day would permanently settle on the 28th
        // after the first February.
        let periodEnd = iso('2026-01-31T12:00:00.000Z');
        const seen: string[] = [];

        // Act
        for (let i = 0; i < 12; i++) {
            const next = computeNextAddonPeriod({
                currentPeriodEnd: periodEnd,
                settledAt: periodEnd,
                billingInterval: 'monthly'
            });
            // `settledAt === periodEnd` always advances, so `next` is never null
            // here. Asserted rather than non-null-asserted, so a regression that
            // made it null fails on THIS line instead of throwing further down.
            expect(next).not.toBeNull();
            periodEnd = (next as NonNullable<typeof next>).currentPeriodEnd;
            seen.push(periodEnd.toISOString().slice(0, 10));
        }

        // Assert: February clamps to the 28th and — this is the part worth
        // pinning — March does NOT stay clamped there.
        expect(seen[0]).toBe('2026-02-28');
        expect(seen[1]).toBe('2026-03-28');
    });
});
