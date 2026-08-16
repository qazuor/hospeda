/**
 * @file checkout-poll-schedule.test.ts
 * @description Unit tests for the checkout status-poll retry schedule (H-78).
 *
 * The schedule is a pure function precisely so these properties can be asserted
 * directly rather than inferred from a component driven by fake timers.
 */

import { describe, expect, it } from 'vitest';

import {
    CHECKOUT_POLL_BASE_DELAY_MS,
    CHECKOUT_POLL_MAX_ATTEMPTS,
    CHECKOUT_POLL_MAX_DELAY_MS,
    nextPollDelayMs,
    totalPollBudgetMs
} from '../../../src/lib/billing/checkout-poll-schedule';

describe('nextPollDelayMs (H-78)', () => {
    it('starts at the base delay', () => {
        expect(nextPollDelayMs({ attempt: 1 })).toBe(CHECKOUT_POLL_BASE_DELAY_MS);
    });

    it('grows monotonically across the attempt budget', () => {
        // Asserts the SHAPE of the curve, not memorised values — retuning the
        // growth factor must not require editing this test, but flattening the
        // curve back to a constant interval must fail it.
        const delays = Array.from({ length: CHECKOUT_POLL_MAX_ATTEMPTS }, (_, i) =>
            nextPollDelayMs({ attempt: i + 1 })
        );

        for (let i = 1; i < delays.length; i += 1) {
            expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1] as number);
        }
        // It must actually grow somewhere — a constant sequence satisfies
        // "monotonic" and would silently reinstate the flat 2s interval.
        expect(delays.at(-1)).toBeGreaterThan(delays[0] as number);
    });

    it('never exceeds the per-attempt ceiling', () => {
        for (let attempt = 1; attempt <= CHECKOUT_POLL_MAX_ATTEMPTS * 3; attempt += 1) {
            expect(nextPollDelayMs({ attempt })).toBeLessThanOrEqual(CHECKOUT_POLL_MAX_DELAY_MS);
        }
    });

    it('clamps a non-positive attempt to the base delay instead of returning zero', () => {
        // A zero delay would busy-loop against the API.
        expect(nextPollDelayMs({ attempt: 0 })).toBe(CHECKOUT_POLL_BASE_DELAY_MS);
        expect(nextPollDelayMs({ attempt: -5 })).toBe(CHECKOUT_POLL_BASE_DELAY_MS);
    });
});

describe('totalPollBudgetMs (H-78)', () => {
    it('watches for at least the 90s the flat schedule used to cover', () => {
        // The regression this guards: H-78's buyer was still unresolved after
        // the old 90s budget elapsed. A change that shortens the window back
        // below the old one must fail here.
        expect(totalPollBudgetMs()).toBeGreaterThan(90_000);
    });

    it('stays bounded — the page must never watch forever', () => {
        expect(totalPollBudgetMs()).toBeLessThan(600_000);
    });
});
