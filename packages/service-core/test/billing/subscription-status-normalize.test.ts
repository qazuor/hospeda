/**
 * Unit tests for subscription-status-normalize.ts (HOS-108)
 *
 * `normalizeStoredSubscriptionStatus` is the single source of truth for turning
 * a stored `billing_subscriptions.status` value (which may be in qzpay's
 * creation-time vocabulary OR already in Hospeda's vocabulary) into a
 * `SubscriptionStatusEnum` value that the transition state machine understands.
 *
 * Coverage:
 * 1. qzpay-vocabulary values map to their Hospeda equivalents (the HOS-108 core:
 *    `incomplete` → `pending_provider`).
 * 2. Already-Hospeda values pass through unchanged.
 * 3. Unknown strings and non-string inputs return `null` (data-integrity signal).
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { normalizeStoredSubscriptionStatus } from '../../src/services/billing/subscription/subscription-status-normalize.js';

describe('normalizeStoredSubscriptionStatus', () => {
    describe('qzpay vocabulary → Hospeda vocabulary', () => {
        it.each([
            ['incomplete', SubscriptionStatusEnum.PENDING_PROVIDER],
            ['incomplete_expired', SubscriptionStatusEnum.ABANDONED],
            ['canceled', SubscriptionStatusEnum.CANCELLED], // American (1 L) → British (2 L's)
            ['unpaid', SubscriptionStatusEnum.PAST_DUE],
            ['active', SubscriptionStatusEnum.ACTIVE],
            ['trialing', SubscriptionStatusEnum.TRIALING],
            ['past_due', SubscriptionStatusEnum.PAST_DUE],
            ['paused', SubscriptionStatusEnum.PAUSED]
        ] as const)('maps qzpay %s → %s', (raw, expected) => {
            expect(normalizeStoredSubscriptionStatus(raw)).toBe(expected);
        });

        it('maps qzpay `incomplete` to `pending_provider` (HOS-108 core)', () => {
            expect(normalizeStoredSubscriptionStatus('incomplete')).toBe(
                SubscriptionStatusEnum.PENDING_PROVIDER
            );
        });
    });

    describe('already-Hospeda vocabulary passes through unchanged', () => {
        it.each(Object.values(SubscriptionStatusEnum))('passes through %s', (status) => {
            expect(normalizeStoredSubscriptionStatus(status)).toBe(status);
        });
    });

    describe('unknown / invalid input returns null', () => {
        it.each([
            ['unknown string', 'bogus_status'],
            ['empty string', ''],
            ['wrong case (case-sensitive)', 'INCOMPLETE']
        ])('returns null for %s', (_label, value) => {
            expect(normalizeStoredSubscriptionStatus(value)).toBeNull();
        });

        it.each([
            ['undefined', undefined],
            ['null', null],
            ['number', 123],
            ['object', {}]
        ])('returns null for non-string %s', (_label, value) => {
            expect(normalizeStoredSubscriptionStatus(value)).toBeNull();
        });
    });
});
