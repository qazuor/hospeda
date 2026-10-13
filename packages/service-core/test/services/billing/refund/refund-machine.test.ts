import { REFUND_STATUSES } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    canRefundTransition,
    REFUND_MACHINE_STATUSES,
    REFUND_TRANSITIONS,
    type RefundStatus,
    type RefundTransition,
    RF1_REASONS,
    RF4_REASONS
} from '../../../../src/services/billing/refund/refund-machine.js';

const TRANSITIONS: readonly RefundTransition[] = ['RF1', 'RF2', 'RF3', 'RF4', 'RF5'];
const ORIGINS: readonly (RefundStatus | 'NO_ROW')[] = ['NO_ROW', ...REFUND_MACHINE_STATUSES];

describe('TEST:B5:6 AC:B5:12 the minimal refund machine', () => {
    it('declares exactly the five catalogue transitions', () => {
        // Arrange / Act
        const table = REFUND_TRANSITIONS;

        // Assert
        expect(table).toEqual({
            RF1: { from: ['NO_ROW'], to: 'REQUESTED', via: null, owner: 'B5' },
            RF2: { from: ['REQUESTED'], to: 'CONFIRMED', via: null, owner: 'B6' },
            RF3: { from: ['CONFIRMED'], to: 'EXECUTED', via: 'PROVIDER', owner: 'B6' },
            RF4: { from: ['NO_ROW', 'REQUESTED'], to: 'EXECUTED', via: 'EXTERNAL', owner: 'B5' },
            RF5: { from: ['REQUESTED', 'CONFIRMED'], to: 'FAILED', via: null, owner: 'B6' }
        });
    });

    it('lets only RF4 take a REQUESTED straight to EXECUTED (AC:B5:41)', () => {
        // Arrange
        const toExecutedFromRequested = TRANSITIONS.filter(
            (transition) =>
                REFUND_TRANSITIONS[transition].to === 'EXECUTED' &&
                canRefundTransition({ transition, from: 'REQUESTED' }).allowed
        );

        // Assert
        expect(toExecutedFromRequested).toEqual(['RF4']);
        expect(canRefundTransition({ transition: 'RF4', from: 'NO_ROW' })).toEqual({
            allowed: true
        });
        expect(canRefundTransition({ transition: 'RF4', from: 'CONFIRMED' })).toEqual({
            allowed: false
        });
    });

    it('reaches CONFIRMED only through RF2', () => {
        // Arrange / Act
        const reachers = TRANSITIONS.filter(
            (transition) => REFUND_TRANSITIONS[transition].to === 'CONFIRMED'
        );

        // Assert
        expect(reachers).toEqual(['RF2']);
    });

    it('lets nothing leave EXECUTED or FAILED', () => {
        // Arrange
        const terminal: readonly RefundStatus[] = ['EXECUTED', 'FAILED'];

        // Act
        const exits = terminal.flatMap((from) =>
            TRANSITIONS.filter(
                (transition) => canRefundTransition({ transition, from }).allowed
            ).map((transition) => `${from}:${transition}`)
        );

        // Assert
        expect(exits).toEqual([]);
    });

    it('only RF1 and RF4 are built by B5, and every origin is a known status', () => {
        // Arrange / Act
        const b5 = TRANSITIONS.filter(
            (transition) => REFUND_TRANSITIONS[transition].owner === 'B5'
        );
        const unknownOrigins = TRANSITIONS.flatMap((transition) =>
            REFUND_TRANSITIONS[transition].from.filter((from) => !ORIGINS.includes(from))
        );

        // Assert
        expect(b5).toEqual(['RF1', 'RF4']);
        expect(unknownOrigins).toEqual([]);
    });

    it('declares the same statuses as REFUND_STATUSES of @repo/db', () => {
        // Assert
        expect([...REFUND_MACHINE_STATUSES]).toEqual([...REFUND_STATUSES]);
    });

    it('keeps the RF1 and RF4 reason catalogues closed and disjoint', () => {
        // Assert
        expect(RF1_REASONS).toEqual([
            'REVOCATION',
            'ADDON_ORPHAN',
            'ONE_TIME_ADDON_REVOCATION',
            'MARK_PROPOSAL'
        ]);
        expect(RF4_REASONS).toEqual([
            'OUT_OF_FLOW_REFUND',
            'MANUAL_PAYMENT_REFUND',
            'STALE_CHARGE_REFUND'
        ]);
        expect(
            RF1_REASONS.filter((reason) => (RF4_REASONS as readonly string[]).includes(reason))
        ).toEqual([]);
    });
});
