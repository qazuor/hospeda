/**
 * @file use-push-registration.test.ts
 * @description Unit tests for the `usePushRegistration` hook.
 *
 * ## Strategy
 *
 * The hook is a thin orchestrator that:
 * 1. Maintains a `useRef` guard (fires at most once per mount).
 * 2. Calls `registerPushToken()` in a `useEffect` when `enabled` is true.
 *
 * Because the Vitest environment is `node` (no DOM, no RN runtime), we mock
 * both `react` (to control `useEffect` / `useRef` execution) and the
 * `push-notifications` module (to avoid real device calls).
 *
 * The mock strategy for `useRef` / `useEffect`:
 * - `useRef` returns a mutable ref object `{ current: false }`.
 * - `useEffect` is synchronous — it calls the callback immediately so we can
 *   assert side-effects inline, without async ticks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables — must live in vi.hoisted() so they are available
// when vi.mock() factory functions are evaluated (vitest hoists vi.mock to
// the top of the file before regular variable declarations).
// ---------------------------------------------------------------------------

const { mockRegisterPushToken, mockUseEffect, mockUseRef, refContainer } = vi.hoisted(() => {
    const mockRegisterPushToken = vi.fn().mockResolvedValue({ registered: true });

    // Ref container — a simple mutable object simulating the ref returned by useRef.
    // Declared outside so tests can inspect and reset it.
    const refContainer = { current: false };

    // Synchronous useEffect: call the callback immediately (ignores cleanup).
    const mockUseEffect = vi.fn((callback: () => undefined | (() => void)) => {
        callback();
    });

    // useRef: always return the same refContainer so the guard persists across
    // calls within a single test (mirrors what React does per component instance).
    const mockUseRef = vi.fn(() => refContainer);

    return { mockRegisterPushToken, mockUseEffect, mockUseRef, refContainer };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react', () => ({
    useEffect: mockUseEffect,
    useRef: mockUseRef
}));

vi.mock('./push-notifications', () => ({
    registerPushToken: mockRegisterPushToken
}));

// ---------------------------------------------------------------------------
// Module under test (imported AFTER mocks are declared)
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/order
import { usePushRegistration } from './use-push-registration';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('usePushRegistration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the ref guard before each test so each test starts with a
        // "fresh" component instance (ref.current = false = unregistered).
        refContainer.current = false;
        // Restore default useEffect / useRef implementations
        mockUseEffect.mockImplementation((callback: () => undefined | (() => void)) => {
            callback();
        });
        mockUseRef.mockReturnValue(refContainer);
        mockRegisterPushToken.mockResolvedValue({ registered: true });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // enabled: false — no-op
    // -------------------------------------------------------------------------

    describe('when enabled is false', () => {
        it('does NOT call registerPushToken', () => {
            // Act
            usePushRegistration(false);

            // Assert
            expect(mockRegisterPushToken).not.toHaveBeenCalled();
        });

        it('does not flip the ref guard to true', () => {
            // Arrange
            expect(refContainer.current).toBe(false);

            // Act
            usePushRegistration(false);

            // Assert
            expect(refContainer.current).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // enabled: true — first call
    // -------------------------------------------------------------------------

    describe('when enabled is true (first trigger)', () => {
        it('calls registerPushToken once', () => {
            // Act
            usePushRegistration(true);

            // Assert
            expect(mockRegisterPushToken).toHaveBeenCalledOnce();
        });

        it('flips the ref guard to true after registration is triggered', () => {
            // Arrange
            expect(refContainer.current).toBe(false);

            // Act
            usePushRegistration(true);

            // Assert — guard is set so a subsequent render does NOT re-fire
            expect(refContainer.current).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // ref guard — prevents re-registration on subsequent renders
    // -------------------------------------------------------------------------

    describe('ref guard prevents duplicate registration', () => {
        it('does NOT call registerPushToken again when hook is called a second time with enabled: true', () => {
            // Arrange — first render fires registration
            usePushRegistration(true);
            expect(mockRegisterPushToken).toHaveBeenCalledOnce();
            // ref.current is now true (the hook flipped it)

            // Act — second render (same ref — still current:true from first call)
            usePushRegistration(true);

            // Assert — should NOT have been called again
            expect(mockRegisterPushToken).toHaveBeenCalledOnce();
        });

        it('does NOT call registerPushToken when ref.current is already true (pre-set)', () => {
            // Arrange — simulate already-registered state
            refContainer.current = true;

            // Act
            usePushRegistration(true);

            // Assert
            expect(mockRegisterPushToken).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // enabled transition: false → true
    // -------------------------------------------------------------------------

    describe('enabled flips from false to true', () => {
        it('calls registerPushToken only when enabled becomes true', () => {
            // First render: disabled
            usePushRegistration(false);
            expect(mockRegisterPushToken).not.toHaveBeenCalled();

            // Second render: enabled
            usePushRegistration(true);
            expect(mockRegisterPushToken).toHaveBeenCalledOnce();
        });
    });

    // -------------------------------------------------------------------------
    // Fire-and-forget: does not propagate errors
    // -------------------------------------------------------------------------

    describe('registerPushToken never propagates errors', () => {
        it('does not throw even if registerPushToken rejects', async () => {
            // Arrange — registerPushToken rejects (should never happen per contract,
            // but the hook wraps it with void and must not crash)
            mockRegisterPushToken.mockRejectedValue(new Error('Unexpected failure'));

            // Act + Assert (hook itself must not throw synchronously)
            expect(() => usePushRegistration(true)).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // useEffect dependency: [enabled]
    // -------------------------------------------------------------------------

    describe('useEffect is called with [enabled] dependency array', () => {
        it('passes [enabled] as the dependency array to useEffect', () => {
            // Act
            usePushRegistration(true);

            // Assert — second argument to useEffect is the dep array
            expect(mockUseEffect).toHaveBeenCalledOnce();
            const callArgs = mockUseEffect.mock.calls[0] as unknown as [unknown, unknown[]];
            const [, deps] = callArgs;
            expect(deps).toEqual([true]);
        });

        it('passes [false] when enabled is false', () => {
            // Act
            usePushRegistration(false);

            // Assert
            const callArgs = mockUseEffect.mock.calls[0] as unknown as [unknown, unknown[]];
            const [, deps] = callArgs;
            expect(deps).toEqual([false]);
        });
    });
});
