/**
 * Unit tests for subscription-status-transitions.ts (SPEC-194 T-194-01)
 *
 * Tests the subscription state-machine transition table and guard helpers:
 *
 * 1. checkSubscriptionStatusTransition — discriminated-union, never throws.
 *    - Every legal edge returns { valid: true }.
 *    - A representative matrix of illegal edges returns { valid: false, reason }.
 *    - Terminal states (expired, abandoned) reject all outgoing transitions.
 *    - Unknown source status is caught.
 *    - Same-status self-transitions are rejected (no no-ops in the table).
 *
 * 2. validateSubscriptionStatusTransition — assert variant, throws on invalid.
 *    - Valid edges pass silently.
 *    - Invalid edges throw InvalidSubscriptionTransitionError.
 *    - Error message contains from, to, and subscriptionId when provided.
 *    - Error instance has correct .from, .to, .subscriptionId, .name fields.
 *
 * 3. getAllowedTransitions — utility, returns the allowed set.
 *    - Returns the correct set for representative states.
 *    - Returns empty set for terminal states.
 *    - Returns undefined for unknown status values.
 *
 * 4. Full matrix exhaustion — loops every (from, to) pair in the status enum to
 *    verify the table has no silent gaps.
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    InvalidSubscriptionTransitionError,
    checkSubscriptionStatusTransition,
    getAllowedTransitions,
    validateSubscriptionStatusTransition
} from '../../src/services/billing/subscription/subscription-status-transitions.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Canonical map of every legal transition, sourced directly from the
 * state-machine design (mirrors VALID_TRANSITIONS in the module under test).
 * Used to generate both the "legal" and "illegal" test cases exhaustively.
 */
const LEGAL_TRANSITIONS: ReadonlyMap<
    SubscriptionStatusEnum,
    ReadonlySet<SubscriptionStatusEnum>
> = new Map([
    [
        SubscriptionStatusEnum.PENDING_PROVIDER,
        new Set([SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.ABANDONED])
    ],
    [
        SubscriptionStatusEnum.TRIALING,
        new Set([
            SubscriptionStatusEnum.ACTIVE,
            SubscriptionStatusEnum.CANCELLED,
            SubscriptionStatusEnum.EXPIRED,
            SubscriptionStatusEnum.PAUSED
        ])
    ],
    [
        SubscriptionStatusEnum.ACTIVE,
        new Set([
            SubscriptionStatusEnum.PAST_DUE,
            SubscriptionStatusEnum.PAUSED,
            SubscriptionStatusEnum.CANCELLED,
            SubscriptionStatusEnum.EXPIRED
        ])
    ],
    [
        SubscriptionStatusEnum.PAST_DUE,
        new Set([SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.CANCELLED])
    ],
    [
        SubscriptionStatusEnum.PAUSED,
        new Set([SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.CANCELLED])
    ],
    [SubscriptionStatusEnum.CANCELLED, new Set([SubscriptionStatusEnum.ACTIVE])],
    [SubscriptionStatusEnum.EXPIRED, new Set<SubscriptionStatusEnum>()],
    [SubscriptionStatusEnum.ABANDONED, new Set<SubscriptionStatusEnum>()]
]);

/** All status values for exhaustive matrix loops. */
const ALL_STATUSES = Object.values(SubscriptionStatusEnum);

// ─── checkSubscriptionStatusTransition ───────────────────────────────────────

describe('checkSubscriptionStatusTransition — legal edges', () => {
    for (const [from, targets] of LEGAL_TRANSITIONS) {
        for (const to of targets) {
            it(`${from} → ${to} returns { valid: true }`, () => {
                // Arrange — inputs from fixture
                // Act
                const result = checkSubscriptionStatusTransition({ from, to });
                // Assert
                expect(result.valid).toBe(true);
            });
        }
    }
});

describe('checkSubscriptionStatusTransition — illegal edges (full matrix)', () => {
    for (const from of ALL_STATUSES) {
        for (const to of ALL_STATUSES) {
            const allowedForFrom = LEGAL_TRANSITIONS.get(from) ?? new Set();
            if (allowedForFrom.has(to)) {
                continue; // skip legal edges — those are tested above
            }

            it(`${from} → ${to} returns { valid: false }`, () => {
                // Arrange — from/to pair is known illegal per fixture
                // Act
                const result = checkSubscriptionStatusTransition({ from, to });
                // Assert
                expect(result.valid).toBe(false);
                if (!result.valid) {
                    expect(typeof result.reason).toBe('string');
                    expect(result.reason.length).toBeGreaterThan(0);
                }
            });
        }
    }
});

describe('checkSubscriptionStatusTransition — terminal states have no outgoing transitions', () => {
    const terminalStates: SubscriptionStatusEnum[] = [
        SubscriptionStatusEnum.EXPIRED,
        SubscriptionStatusEnum.ABANDONED
    ];

    for (const terminal of terminalStates) {
        for (const to of ALL_STATUSES) {
            it(`${terminal} → ${to} is always rejected (terminal)`, () => {
                // Arrange
                // Act
                const result = checkSubscriptionStatusTransition({ from: terminal, to });
                // Assert
                expect(result.valid).toBe(false);
            });
        }
    }
});

describe('checkSubscriptionStatusTransition — unknown source status', () => {
    it('returns { valid: false } and a reason for an unrecognised from-status', () => {
        // Arrange
        const from = 'totally_unknown_status' as SubscriptionStatusEnum;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act
        const result = checkSubscriptionStatusTransition({ from, to });
        // Assert
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toContain('Unknown source status');
            expect(result.reason).toContain(from);
        }
    });

    it('includes subscriptionId in reason when provided', () => {
        // Arrange
        const from = 'ghost_status' as SubscriptionStatusEnum;
        // Act
        const result = checkSubscriptionStatusTransition({
            from,
            to: SubscriptionStatusEnum.ACTIVE,
            subscriptionId: 'sub-xyz-999'
        });
        // Assert
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toContain('sub-xyz-999');
        }
    });
});

describe('checkSubscriptionStatusTransition — same-status self-transitions', () => {
    for (const status of ALL_STATUSES) {
        it(`${status} → ${status} (self-loop) is rejected`, () => {
            // Arrange
            // Act
            const result = checkSubscriptionStatusTransition({ from: status, to: status });
            // Assert
            expect(result.valid).toBe(false);
        });
    }
});

describe('checkSubscriptionStatusTransition — subscriptionId in reason for illegal edges', () => {
    it('includes subscriptionId in the reason message when provided', () => {
        // Arrange
        const from = SubscriptionStatusEnum.ABANDONED;
        const to = SubscriptionStatusEnum.ACTIVE;
        const subscriptionId = 'sub-dead-001';
        // Act
        const result = checkSubscriptionStatusTransition({ from, to, subscriptionId });
        // Assert
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).toContain(subscriptionId);
        }
    });

    it('does not include subscriptionId in the reason message when omitted', () => {
        // Arrange
        const from = SubscriptionStatusEnum.EXPIRED;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act
        const result = checkSubscriptionStatusTransition({ from, to });
        // Assert
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason).not.toContain('subscription:');
        }
    });
});

// ─── validateSubscriptionStatusTransition ─────────────────────────────────────

describe('validateSubscriptionStatusTransition — valid edges do not throw', () => {
    for (const [from, targets] of LEGAL_TRANSITIONS) {
        for (const to of targets) {
            it(`${from} → ${to} does not throw`, () => {
                // Arrange
                // Act & Assert — should not throw
                expect(() => validateSubscriptionStatusTransition({ from, to })).not.toThrow();
            });
        }
    }
});

describe('validateSubscriptionStatusTransition — invalid edges throw InvalidSubscriptionTransitionError', () => {
    it('throws InvalidSubscriptionTransitionError for abandoned → active', () => {
        // Arrange
        const from = SubscriptionStatusEnum.ABANDONED;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act & Assert
        expect(() => validateSubscriptionStatusTransition({ from, to })).toThrow(
            InvalidSubscriptionTransitionError
        );
    });

    it('throws InvalidSubscriptionTransitionError for expired → active', () => {
        // Arrange
        const from = SubscriptionStatusEnum.EXPIRED;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act & Assert
        expect(() => validateSubscriptionStatusTransition({ from, to })).toThrow(
            InvalidSubscriptionTransitionError
        );
    });

    it('throws InvalidSubscriptionTransitionError for active → pending_provider', () => {
        // Arrange
        const from = SubscriptionStatusEnum.ACTIVE;
        const to = SubscriptionStatusEnum.PENDING_PROVIDER;
        // Act & Assert
        expect(() => validateSubscriptionStatusTransition({ from, to })).toThrow(
            InvalidSubscriptionTransitionError
        );
    });
});

describe('validateSubscriptionStatusTransition — error carries from/to/subscriptionId', () => {
    it('error.from matches the supplied from-status', () => {
        // Arrange
        const from = SubscriptionStatusEnum.ABANDONED;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act
        let caught: InvalidSubscriptionTransitionError | undefined;
        try {
            validateSubscriptionStatusTransition({ from, to, subscriptionId: 'sub-001' });
        } catch (err) {
            if (err instanceof InvalidSubscriptionTransitionError) {
                caught = err;
            }
        }
        // Assert
        expect(caught).toBeDefined();
        expect(caught?.from).toBe(from);
        expect(caught?.to).toBe(to);
        expect(caught?.subscriptionId).toBe('sub-001');
    });

    it('error.subscriptionId is undefined when not supplied', () => {
        // Arrange
        const from = SubscriptionStatusEnum.EXPIRED;
        const to = SubscriptionStatusEnum.ACTIVE;
        // Act
        let caught: InvalidSubscriptionTransitionError | undefined;
        try {
            validateSubscriptionStatusTransition({ from, to });
        } catch (err) {
            if (err instanceof InvalidSubscriptionTransitionError) {
                caught = err;
            }
        }
        // Assert
        expect(caught).toBeDefined();
        expect(caught?.subscriptionId).toBeUndefined();
    });

    it('error.name is InvalidSubscriptionTransitionError', () => {
        // Arrange & Act
        let caught: Error | undefined;
        try {
            validateSubscriptionStatusTransition({
                from: SubscriptionStatusEnum.ABANDONED,
                to: SubscriptionStatusEnum.TRIALING
            });
        } catch (err) {
            if (err instanceof Error) {
                caught = err;
            }
        }
        // Assert
        expect(caught?.name).toBe('InvalidSubscriptionTransitionError');
    });

    it('error.message contains both from and to statuses', () => {
        // Arrange
        const from = SubscriptionStatusEnum.EXPIRED;
        const to = SubscriptionStatusEnum.PAUSED;
        // Act
        let caught: Error | undefined;
        try {
            validateSubscriptionStatusTransition({ from, to });
        } catch (err) {
            if (err instanceof Error) {
                caught = err;
            }
        }
        // Assert
        expect(caught?.message).toContain(from);
        expect(caught?.message).toContain(to);
    });

    it('error.message contains subscriptionId when provided', () => {
        // Arrange
        const subscriptionId = 'sub-dead-beef-0001';
        // Act
        let caught: Error | undefined;
        try {
            validateSubscriptionStatusTransition({
                from: SubscriptionStatusEnum.ABANDONED,
                to: SubscriptionStatusEnum.ACTIVE,
                subscriptionId
            });
        } catch (err) {
            if (err instanceof Error) {
                caught = err;
            }
        }
        // Assert
        expect(caught?.message).toContain(subscriptionId);
    });
});

// ─── getAllowedTransitions ────────────────────────────────────────────────────

describe('getAllowedTransitions — utility', () => {
    it('returns the correct set for pending_provider', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.PENDING_PROVIDER);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.ACTIVE)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.ABANDONED)).toBe(true);
        expect(result?.size).toBe(2);
    });

    it('returns the correct set for trialing', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.TRIALING);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.ACTIVE)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.CANCELLED)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.EXPIRED)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.PAUSED)).toBe(true);
        expect(result?.size).toBe(4);
    });

    it('returns the correct set for active', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.ACTIVE);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.PAST_DUE)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.PAUSED)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.CANCELLED)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.EXPIRED)).toBe(true);
        expect(result?.size).toBe(4);
    });

    it('returns the correct set for past_due', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.PAST_DUE);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.ACTIVE)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.CANCELLED)).toBe(true);
        expect(result?.size).toBe(2);
    });

    it('returns the correct set for paused', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.PAUSED);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.ACTIVE)).toBe(true);
        expect(result?.has(SubscriptionStatusEnum.CANCELLED)).toBe(true);
        expect(result?.size).toBe(2);
    });

    it('returns the correct set for cancelled (reactivation path)', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.CANCELLED);
        // Assert
        expect(result).toBeDefined();
        expect(result?.has(SubscriptionStatusEnum.ACTIVE)).toBe(true);
        expect(result?.size).toBe(1);
    });

    it('returns an empty set for expired (terminal)', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.EXPIRED);
        // Assert
        expect(result).toBeDefined();
        expect(result?.size).toBe(0);
    });

    it('returns an empty set for abandoned (terminal)', () => {
        // Arrange & Act
        const result = getAllowedTransitions(SubscriptionStatusEnum.ABANDONED);
        // Assert
        expect(result).toBeDefined();
        expect(result?.size).toBe(0);
    });

    it('returns undefined for an unknown status', () => {
        // Arrange & Act
        const result = getAllowedTransitions('not_a_real_status' as SubscriptionStatusEnum);
        // Assert
        expect(result).toBeUndefined();
    });
});

// ─── Full matrix exhaustion ───────────────────────────────────────────────────

describe('Full matrix — every (from, to) pair is either legal or illegal, never uncategorised', () => {
    it('every status value in the enum appears as a key in the transition table', () => {
        // Arrange
        for (const status of ALL_STATUSES) {
            // Act
            const allowed = getAllowedTransitions(status);
            // Assert
            expect(allowed).toBeDefined();
        }
    });

    it('LEGAL_TRANSITIONS fixture and getAllowedTransitions agree on every edge', () => {
        // Arrange — verify our fixture matches the live module
        for (const [from, expectedTargets] of LEGAL_TRANSITIONS) {
            const actualTargets = getAllowedTransitions(from);
            // Assert
            expect(actualTargets).toBeDefined();
            expect(actualTargets?.size).toBe(expectedTargets.size);
            for (const to of expectedTargets) {
                expect(actualTargets?.has(to)).toBe(true);
            }
        }
    });

    it('total number of legal transitions matches the fixture count', () => {
        // Arrange
        let fixtureCount = 0;
        for (const targets of LEGAL_TRANSITIONS.values()) {
            fixtureCount += targets.size;
        }

        let moduleCount = 0;
        for (const status of ALL_STATUSES) {
            moduleCount += getAllowedTransitions(status)?.size ?? 0;
        }

        // Act & Assert
        expect(moduleCount).toBe(fixtureCount);
        // Sanity: we have a non-trivial number of legal transitions
        expect(fixtureCount).toBeGreaterThan(0);
    });
});

// ─── InvalidSubscriptionTransitionError class ─────────────────────────────────

describe('InvalidSubscriptionTransitionError — constructor', () => {
    it('can be constructed directly and instanceof check passes', () => {
        // Arrange & Act
        const err = new InvalidSubscriptionTransitionError({
            from: 'expired',
            to: 'active'
        });
        // Assert
        expect(err).toBeInstanceOf(InvalidSubscriptionTransitionError);
        expect(err).toBeInstanceOf(Error);
    });

    it('message includes arrow notation', () => {
        // Arrange & Act
        const err = new InvalidSubscriptionTransitionError({
            from: 'abandoned',
            to: 'trialing'
        });
        // Assert
        expect(err.message).toContain('abandoned');
        expect(err.message).toContain('trialing');
        expect(err.message).toContain('→');
    });

    it('subscriptionId defaults to undefined when omitted', () => {
        // Arrange & Act
        const err = new InvalidSubscriptionTransitionError({ from: 'expired', to: 'active' });
        // Assert
        expect(err.subscriptionId).toBeUndefined();
    });

    it('subscriptionId is set when provided', () => {
        // Arrange & Act
        const err = new InvalidSubscriptionTransitionError({
            from: 'expired',
            to: 'active',
            subscriptionId: 'sub-test-999'
        });
        // Assert
        expect(err.subscriptionId).toBe('sub-test-999');
        expect(err.message).toContain('sub-test-999');
    });
});
