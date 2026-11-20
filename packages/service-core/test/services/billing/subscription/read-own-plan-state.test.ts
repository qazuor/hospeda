/**
 * HOS-2328 — the shared own plan-state reader. The queries moved unchanged from
 * the route folder (the route's frozen-body test covers what it answers); this
 * suite pins the pure predicate it carries and the export the assistant reuses.
 */

import { describe, expect, it } from 'vitest';
import * as serviceCore from '../../../../src';
import {
    isNextChargeShown,
    readOwnPlanState,
    readOwnSubscriptions
} from '../../../../src/services/billing/subscription/read-own-plan-state';

const NOW = new Date('2026-11-19T12:00:00.000Z');
const LATER = new Date('2026-12-19T12:00:00.000Z');

describe('isNextChargeShown', () => {
    it('shows the next charge only for an ACTIVE card subscription with a future date', () => {
        // Act + Assert
        expect(
            isNextChargeShown({
                status: 'ACTIVE',
                paymentMethod: 'CARD',
                nextChargeAt: LATER,
                now: NOW
            })
        ).toBe(true);
        expect(
            isNextChargeShown({
                status: 'GRACE_PERIOD',
                paymentMethod: 'CARD',
                nextChargeAt: LATER,
                now: NOW
            })
        ).toBe(false);
        expect(
            isNextChargeShown({
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                nextChargeAt: LATER,
                now: NOW
            })
        ).toBe(false);
        expect(
            isNextChargeShown({
                status: 'ACTIVE',
                paymentMethod: 'CARD',
                nextChargeAt: NOW,
                now: NOW
            })
        ).toBe(false);
        expect(
            isNextChargeShown({
                status: 'ACTIVE',
                paymentMethod: 'CARD',
                nextChargeAt: null,
                now: NOW
            })
        ).toBe(false);
    });
});

describe('package exports', () => {
    it('exposes the one shared reader from the package root', () => {
        // Assert
        expect(serviceCore.readOwnPlanState).toBe(readOwnPlanState);
        expect(serviceCore.readOwnSubscriptions).toBe(readOwnSubscriptions);
    });
});
