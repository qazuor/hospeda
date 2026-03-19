/**
 * Tests for Addon Status Transitions
 *
 * Covers:
 * - All valid state machine transitions
 * - All invalid transitions throw InvalidStateTransitionError
 * - Error message content and properties
 * - Terminal states have no outgoing transitions
 */

import { describe, expect, it } from 'vitest';
import {
    ADDON_PURCHASE_STATUSES,
    type AddonPurchaseStatus,
    InvalidStateTransitionError,
    validateAddonStatusTransition
} from '../../src/services/addon-status-transitions';

describe('ADDON_PURCHASE_STATUSES', () => {
    it('should export the correct status constants', () => {
        expect(ADDON_PURCHASE_STATUSES.PENDING).toBe('pending');
        expect(ADDON_PURCHASE_STATUSES.ACTIVE).toBe('active');
        expect(ADDON_PURCHASE_STATUSES.CANCELED).toBe('canceled');
        expect(ADDON_PURCHASE_STATUSES.EXPIRED).toBe('expired');
    });

    it('should use American spelling for canceled (1 L)', () => {
        expect(ADDON_PURCHASE_STATUSES.CANCELED).toBe('canceled');
    });
});

describe('validateAddonStatusTransition', () => {
    describe('valid transitions', () => {
        it('should allow pending → active', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'pending', target: 'active' })
            ).not.toThrow();
        });

        it('should allow pending → canceled', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'pending', target: 'canceled' })
            ).not.toThrow();
        });

        it('should allow active → canceled', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'active', target: 'canceled' })
            ).not.toThrow();
        });

        it('should allow active → expired', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'active', target: 'expired' })
            ).not.toThrow();
        });
    });

    describe('invalid transitions from pending', () => {
        it('should throw for pending → expired', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'pending', target: 'expired' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for pending → pending (self-transition)', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'pending', target: 'pending' })
            ).toThrow(InvalidStateTransitionError);
        });
    });

    describe('invalid transitions from active', () => {
        it('should throw for active → pending', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'active', target: 'pending' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for active → active (self-transition)', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'active', target: 'active' })
            ).toThrow(InvalidStateTransitionError);
        });
    });

    describe('terminal state: canceled', () => {
        it('should throw for canceled → active', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'canceled', target: 'active' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for canceled → pending', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'canceled', target: 'pending' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for canceled → expired', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'canceled', target: 'expired' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for canceled → canceled (self-transition)', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'canceled', target: 'canceled' })
            ).toThrow(InvalidStateTransitionError);
        });
    });

    describe('terminal state: expired', () => {
        it('should throw for expired → active', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'expired', target: 'active' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for expired → pending', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'expired', target: 'pending' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for expired → canceled', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'expired', target: 'canceled' })
            ).toThrow(InvalidStateTransitionError);
        });

        it('should throw for expired → expired (self-transition)', () => {
            expect(() =>
                validateAddonStatusTransition({ current: 'expired', target: 'expired' })
            ).toThrow(InvalidStateTransitionError);
        });
    });

    describe('error details', () => {
        it('should include current and target in the error message', () => {
            let thrown: unknown;
            try {
                validateAddonStatusTransition({ current: 'expired', target: 'active' });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(InvalidStateTransitionError);
            const err = thrown as InvalidStateTransitionError;
            expect(err.message).toContain('expired');
            expect(err.message).toContain('active');
        });

        it('should expose current and target as properties', () => {
            let thrown: unknown;
            try {
                validateAddonStatusTransition({ current: 'canceled', target: 'pending' });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(InvalidStateTransitionError);
            const err = thrown as InvalidStateTransitionError;
            expect(err.current).toBe('canceled');
            expect(err.target).toBe('pending');
        });

        it('should include purchaseId in the error message when provided', () => {
            let thrown: unknown;
            try {
                validateAddonStatusTransition({
                    current: 'expired',
                    target: 'active',
                    purchaseId: 'test-purchase-123'
                });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(InvalidStateTransitionError);
            const err = thrown as InvalidStateTransitionError;
            expect(err.message).toContain('test-purchase-123');
            expect(err.purchaseId).toBe('test-purchase-123');
        });

        it('should not include purchaseId in the error message when omitted', () => {
            let thrown: unknown;
            try {
                validateAddonStatusTransition({ current: 'expired', target: 'active' });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(InvalidStateTransitionError);
            const err = thrown as InvalidStateTransitionError;
            expect(err.message).not.toContain('purchase:');
            expect(err.purchaseId).toBeUndefined();
        });

        it('should set error name to InvalidStateTransitionError', () => {
            let thrown: unknown;
            try {
                validateAddonStatusTransition({ current: 'expired', target: 'active' });
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(InvalidStateTransitionError);
            expect((thrown as InvalidStateTransitionError).name).toBe(
                'InvalidStateTransitionError'
            );
        });
    });

    describe('type safety', () => {
        it('should accept all valid AddonPurchaseStatus values as current', () => {
            const statuses: AddonPurchaseStatus[] = ['pending', 'active', 'canceled', 'expired'];
            // Each status should either succeed or throw InvalidStateTransitionError — never a different error
            for (const status of statuses) {
                try {
                    validateAddonStatusTransition({ current: status, target: 'active' });
                } catch (err) {
                    expect(err).toBeInstanceOf(InvalidStateTransitionError);
                }
            }
        });
    });
});

describe('InvalidStateTransitionError', () => {
    it('should be an instance of Error', () => {
        const err = new InvalidStateTransitionError({
            current: 'expired',
            target: 'active'
        });
        expect(err).toBeInstanceOf(Error);
    });

    it('should construct with purchaseId', () => {
        const err = new InvalidStateTransitionError({
            current: 'canceled',
            target: 'active',
            purchaseId: 'abc-456'
        });
        expect(err.current).toBe('canceled');
        expect(err.target).toBe('active');
        expect(err.purchaseId).toBe('abc-456');
        expect(err.message).toContain('abc-456');
    });

    it('should construct without purchaseId', () => {
        const err = new InvalidStateTransitionError({
            current: 'expired',
            target: 'pending'
        });
        expect(err.purchaseId).toBeUndefined();
        expect(err.message).not.toContain('purchase:');
    });
});
