import { describe, expect, it } from 'vitest';
import {
    type PayingPredecessorFacts,
    type PayingSuccessorFacts,
    payingSuccessorShape,
    successorDeclaredFromPayingBase
} from '../../../../src/services/billing/subscription/paying-predecessor-successor';

const WINDOW_ENDS_AT = new Date('2026-10-04T03:00:00.000Z');
const DAY_MS = 86_400_000;

const at = (ms: number) => new Date(WINDOW_ENDS_AT.getTime() + ms);

const successor = (overrides: Partial<PayingSuccessorFacts> = {}): PayingSuccessorFacts => ({
    class: 'PRINCIPAL',
    paymentMethod: 'CARD',
    firstChargeAt: at(DAY_MS),
    authorizationWindowEndsAt: WINDOW_ENDS_AT,
    ...overrides
});

const cardPredecessor: PayingPredecessorFacts = { class: 'PRINCIPAL', paymentMethod: 'CARD' };

describe('AC:B7:4 — the successor of a paying predecessor (pure part)', () => {
    it('a first charge after the authorization window is a successor declared from ACTIVE', () => {
        // Arrange
        const facts = successor();

        // Act
        const shape = payingSuccessorShape({ successor: facts, predecessor: cardPredecessor });

        // Assert
        expect(successorDeclaredFromPayingBase({ successor: facts })).toBe(true);
        expect(shape).toBe(true);
    });

    it('a first charge at or before the window is the successor of a SUSPENDED: no', () => {
        // Arrange
        const atWindow = successor({ firstChargeAt: WINDOW_ENDS_AT });
        const beforeWindow = successor({ firstChargeAt: at(-3 * DAY_MS) });

        // Act
        const results = [atWindow, beforeWindow].map((facts) =>
            payingSuccessorShape({ successor: facts, predecessor: cardPredecessor })
        );

        // Assert
        expect(results).toEqual([false, false]);
    });

    it('a missing first charge fails towards S16', () => {
        // Arrange
        const facts = successor({ firstChargeAt: null });

        // Act
        const shape = payingSuccessorShape({ successor: facts, predecessor: cardPredecessor });

        // Assert
        expect(shape).toBe(false);
    });

    it('a missing authorization window fails towards S16', () => {
        // Arrange
        const facts = successor({ authorizationWindowEndsAt: null });

        // Act
        const shape = payingSuccessorShape({ successor: facts, predecessor: cardPredecessor });

        // Assert
        expect(shape).toBe(false);
    });

    it('a manual predecessor is never a paying predecessor of this branch', () => {
        // Arrange
        const manual: PayingPredecessorFacts = { class: 'PRINCIPAL', paymentMethod: 'MANUAL' };
        const complement: PayingPredecessorFacts = { class: 'COMPLEMENTO', paymentMethod: 'CARD' };

        // Act
        const results = [manual, complement].map((predecessor) =>
            payingSuccessorShape({ successor: successor(), predecessor })
        );

        // Assert
        expect(results).toEqual([false, false]);
    });

    it('a manual or non-principal successor is never in this branch', () => {
        // Arrange
        const manual = successor({ paymentMethod: 'MANUAL' });
        const complement = successor({ class: 'COMPLEMENTO' });

        // Act
        const results = [manual, complement].map((facts) =>
            payingSuccessorShape({ successor: facts, predecessor: cardPredecessor })
        );

        // Assert
        expect(results).toEqual([false, false]);
        expect(successorDeclaredFromPayingBase({ successor: manual })).toBe(false);
    });

    it('a row without a predecessor is not a successor', () => {
        // Arrange
        const facts = successor();

        // Act
        const shape = payingSuccessorShape({ successor: facts, predecessor: null });

        // Assert
        expect(shape).toBe(false);
    });
});
