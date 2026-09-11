/**
 * Frozen-value tests for the trial email series offsets (HOS-1012 T-001).
 *
 * These offsets are product decisions, not implementation details: each one
 * carries its own template and its own tone, so a silent edit to any of them
 * ships copy that no longer matches when it arrives. The assertions below are
 * written against LITERALS on purpose — an assertion derived from the constant
 * it is checking passes for every possible value and catches nothing.
 *
 * @module test/services/billing/trial-notification-offsets
 */

import { describe, expect, it } from 'vitest';
import {
    EXPIRY_DAY_OFFSET,
    POST_EXPIRY_OFFSET_DAYS,
    PRE_EXPIRY_OFFSET_DAYS,
    TOTAL_TRIAL_SERIES_EMAILS
} from '../../../src/services/billing/trial-notification-offsets';

describe('trial notification offsets', () => {
    it('sends the three pre-expiry warnings at 10, 5 and 1 days out, in that order', () => {
        // Order is part of the contract, not incidental: the array is the
        // sequence the subscriber lives through, and each position is bound to
        // a template written for that distance.
        expect(PRE_EXPIRY_OFFSET_DAYS).toEqual([10, 5, 1]);
    });

    it('sends the five win-backs at 1, 5, 10, 30 and 60 days after expiry', () => {
        expect(POST_EXPIRY_OFFSET_DAYS).toEqual([1, 5, 10, 30, 60]);
    });

    it('places the expiry mail itself at offset 0', () => {
        expect(EXPIRY_DAY_OFFSET).toBe(0);
    });

    it('sends nothing after day 60', () => {
        expect(Math.max(...POST_EXPIRY_OFFSET_DAYS)).toBe(60);
    });

    it('the declared series size matches what the three groups actually add up to', () => {
        // This is the assertion that catches an offset added to one array
        // without the series size being reconsidered — the two are declared
        // independently precisely so they can disagree here.
        expect(TOTAL_TRIAL_SERIES_EMAILS).toBe(9);
        expect(PRE_EXPIRY_OFFSET_DAYS.length + 1 + POST_EXPIRY_OFFSET_DAYS.length).toBe(
            TOTAL_TRIAL_SERIES_EMAILS
        );
    });

    it('every offset is a distinct positive integer within its own group', () => {
        for (const group of [PRE_EXPIRY_OFFSET_DAYS, POST_EXPIRY_OFFSET_DAYS]) {
            expect(new Set(group).size).toBe(group.length);
            for (const day of group) {
                expect(Number.isInteger(day)).toBe(true);
                expect(day).toBeGreaterThan(0);
            }
        }
    });
});
