/**
 * Google Calendar OAuth State Store Tests (HOS-157 Phase 2 — Layer 4)
 *
 * Unit tests for the one-time, TTL-bound CSRF state store backing the
 * per-accommodation connect flow.
 *
 * @module test/services/google-calendar/calendar-oauth-state
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    generateCalendarOAuthState,
    validateAndConsumeCalendarOAuthState
} from '../../../src/services/google-calendar/calendar-oauth-state.js';

describe('calendar-oauth-state', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('validates and returns the bound accommodationId + userId for a fresh state', () => {
        // Arrange
        const state = generateCalendarOAuthState({ accommodationId: 'acc-1', userId: 'user-1' });

        // Act
        const consumed = validateAndConsumeCalendarOAuthState(state);

        // Assert
        expect(consumed).toEqual({ accommodationId: 'acc-1', userId: 'user-1' });
    });

    it('is one-time use — a second validation of the same token returns null', () => {
        // Arrange
        const state = generateCalendarOAuthState({ accommodationId: 'acc-1', userId: 'user-1' });

        // Act
        const first = validateAndConsumeCalendarOAuthState(state);
        const second = validateAndConsumeCalendarOAuthState(state);

        // Assert
        expect(first).not.toBeNull();
        expect(second).toBeNull();
    });

    it('returns null for an unknown token', () => {
        expect(validateAndConsumeCalendarOAuthState('never-issued')).toBeNull();
    });

    it('round-trips an optional returnTo path', () => {
        // Arrange
        const state = generateCalendarOAuthState({
            accommodationId: 'acc-1',
            userId: 'user-1',
            returnTo: '/es/mi-cuenta/propiedades/acc-1/editar/'
        });

        // Act
        const consumed = validateAndConsumeCalendarOAuthState(state);

        // Assert
        expect(consumed).toEqual({
            accommodationId: 'acc-1',
            userId: 'user-1',
            returnTo: '/es/mi-cuenta/propiedades/acc-1/editar/'
        });
    });

    it('expires a state after the 5-minute TTL', () => {
        // Arrange
        const state = generateCalendarOAuthState({ accommodationId: 'acc-1', userId: 'user-1' });

        // Act — advance just past the 5-minute TTL.
        vi.advanceTimersByTime(5 * 60 * 1000 + 1);
        const consumed = validateAndConsumeCalendarOAuthState(state);

        // Assert
        expect(consumed).toBeNull();
    });

    it('keeps a state valid just inside the TTL window', () => {
        // Arrange
        const state = generateCalendarOAuthState({ accommodationId: 'acc-1', userId: 'user-1' });

        // Act — advance to just before the TTL boundary.
        vi.advanceTimersByTime(5 * 60 * 1000 - 1000);
        const consumed = validateAndConsumeCalendarOAuthState(state);

        // Assert
        expect(consumed).toEqual({ accommodationId: 'acc-1', userId: 'user-1' });
    });

    it('issues distinct tokens that resolve to their own bindings', () => {
        // Arrange
        const stateA = generateCalendarOAuthState({ accommodationId: 'acc-A', userId: 'user-A' });
        const stateB = generateCalendarOAuthState({ accommodationId: 'acc-B', userId: 'user-B' });

        // Assert
        expect(stateA).not.toBe(stateB);
        expect(validateAndConsumeCalendarOAuthState(stateA)).toEqual({
            accommodationId: 'acc-A',
            userId: 'user-A'
        });
        expect(validateAndConsumeCalendarOAuthState(stateB)).toEqual({
            accommodationId: 'acc-B',
            userId: 'user-B'
        });
    });
});
