/**
 * @file toast-store.test.ts
 * @description Tests for the global toast store, including the action /
 * secondaryAction extension that the GuestPreferenceNudge relies on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addToast,
    clearToasts,
    getToastTimer,
    getToasts,
    pauseToast,
    promiseToast,
    removeToast,
    resumeToast,
    subscribe,
    updateToast
} from '../../src/store/toast-store';

describe('toast-store', () => {
    beforeEach(() => {
        clearToasts();
        vi.useFakeTimers();
    });

    afterEach(() => {
        clearToasts();
        vi.useRealTimers();
    });

    describe('addToast', () => {
        it('adds a toast and returns its id', () => {
            const id = addToast({ type: 'info', message: 'Hello' });
            expect(id).toBeTruthy();
            expect(getToasts()).toHaveLength(1);
            expect(getToasts()[0]?.message).toBe('Hello');
        });

        it('preserves the type variant', () => {
            addToast({ type: 'error', message: 'Boom' });
            expect(getToasts()[0]?.type).toBe('error');
        });

        it('auto-dismisses after the default duration', () => {
            addToast({ type: 'info', message: 'Bye' });
            vi.advanceTimersByTime(5000);
            expect(getToasts()).toHaveLength(0);
        });

        it('respects a custom duration', () => {
            addToast({ type: 'info', message: 'Quick', duration: 1000 });
            vi.advanceTimersByTime(900);
            expect(getToasts()).toHaveLength(1);
            vi.advanceTimersByTime(200);
            expect(getToasts()).toHaveLength(0);
        });

        it('keeps toasts with duration=0 until manually removed', () => {
            const id = addToast({ type: 'info', message: 'Sticky', duration: 0 });
            vi.advanceTimersByTime(60_000);
            expect(getToasts()).toHaveLength(1);
            removeToast(id);
            expect(getToasts()).toHaveLength(0);
        });

        it('stores a primary action when provided', () => {
            addToast({
                type: 'info',
                message: 'Sign up',
                action: { label: 'Iniciar sesión', href: '/auth/signin' }
            });
            const stored = getToasts()[0];
            expect(stored?.action?.label).toBe('Iniciar sesión');
            expect(stored?.action?.href).toBe('/auth/signin');
        });

        it('stores both primary and secondary actions', () => {
            addToast({
                type: 'info',
                message: 'Benefits',
                action: { label: 'Iniciar sesión', href: '/auth/signin' },
                secondaryAction: { label: 'Ver ventajas', href: '/beneficios' }
            });
            const stored = getToasts()[0];
            expect(stored?.action).toBeDefined();
            expect(stored?.secondaryAction?.href).toBe('/beneficios');
        });
    });

    describe('removeToast', () => {
        it('removes a toast by id', () => {
            const id = addToast({ type: 'info', message: 'A' });
            addToast({ type: 'info', message: 'B' });
            removeToast(id);
            const remaining = getToasts();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]?.message).toBe('B');
        });

        it('cancels the auto-dismiss timer for the removed toast', () => {
            const id = addToast({ type: 'info', message: 'A' });
            removeToast(id);
            vi.advanceTimersByTime(10_000);
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('subscribe', () => {
        it('notifies listeners when a toast is added', () => {
            const listener = vi.fn();
            const unsub = subscribe(listener);
            addToast({ type: 'info', message: 'A' });
            expect(listener).toHaveBeenCalledTimes(1);
            unsub();
        });

        it('stops notifying after unsubscribe', () => {
            const listener = vi.fn();
            const unsub = subscribe(listener);
            unsub();
            addToast({ type: 'info', message: 'A' });
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('clearToasts', () => {
        it('removes all toasts', () => {
            addToast({ type: 'info', message: 'A' });
            addToast({ type: 'info', message: 'B' });
            clearToasts();
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('stacking limit', () => {
        it('caps the visible stack at 3 toasts', () => {
            addToast({ type: 'info', message: 'A' });
            addToast({ type: 'info', message: 'B' });
            addToast({ type: 'info', message: 'C' });
            addToast({ type: 'info', message: 'D' });
            const list = getToasts();
            expect(list).toHaveLength(3);
            expect(list.map((t) => t.message)).toEqual(['B', 'C', 'D']);
        });

        it('evicts the oldest non-loading toast first', () => {
            addToast({ type: 'loading', message: 'Saving...' });
            addToast({ type: 'info', message: 'A' });
            addToast({ type: 'info', message: 'B' });
            addToast({ type: 'info', message: 'C' });
            const list = getToasts();
            expect(list.map((t) => t.message)).toEqual(['Saving...', 'B', 'C']);
        });

        it('cancels the timer of the evicted toast', () => {
            const evictedId = addToast({ type: 'info', message: 'A', duration: 5000 });
            addToast({ type: 'info', message: 'B' });
            addToast({ type: 'info', message: 'C' });
            addToast({ type: 'info', message: 'D' });
            // 'A' was evicted; advancing past its original timer should not
            // double-remove anything (no throw, no extra emissions).
            const listener = vi.fn();
            const unsub = subscribe(listener);
            vi.advanceTimersByTime(5000);
            unsub();
            // 3 toasts left B/C/D were added at t=0 with default 5000ms, so
            // all three should auto-dismiss together — listener fires per
            // removal (not from the evicted 'A').
            expect(getToasts()).toHaveLength(0);
            expect(getToastTimer(evictedId)).toBeNull();
        });
    });

    describe('pause / resume', () => {
        it('freezes the dismiss countdown while paused', () => {
            const id = addToast({ type: 'info', message: 'X', duration: 1000 });
            vi.advanceTimersByTime(400);
            pauseToast(id);
            vi.advanceTimersByTime(5000);
            expect(getToasts()).toHaveLength(1);
            resumeToast(id);
            vi.advanceTimersByTime(599);
            expect(getToasts()).toHaveLength(1);
            vi.advanceTimersByTime(2);
            expect(getToasts()).toHaveLength(0);
        });

        it('reports remaining time via getToastTimer', () => {
            const id = addToast({ type: 'info', message: 'X', duration: 2000 });
            vi.advanceTimersByTime(800);
            pauseToast(id);
            const snapshot = getToastTimer(id);
            expect(snapshot?.paused).toBe(true);
            expect(snapshot?.remaining).toBeGreaterThan(1100);
            expect(snapshot?.remaining).toBeLessThanOrEqual(1200);
            expect(snapshot?.totalDuration).toBe(2000);
        });

        it('pause is a no-op when the toast has no timer (loading)', () => {
            const id = addToast({ type: 'loading', message: 'Wait' });
            pauseToast(id);
            resumeToast(id);
            expect(getToasts()).toHaveLength(1);
        });
    });

    describe('updateToast', () => {
        it('swaps type and message in place and bumps version', () => {
            const id = addToast({ type: 'loading', message: 'Saving' });
            const before = getToasts()[0];
            const ok = updateToast(id, { type: 'success', message: 'Saved' });
            expect(ok).toBe(true);
            const after = getToasts()[0];
            expect(after?.type).toBe('success');
            expect(after?.message).toBe('Saved');
            expect(after?.version).toBe((before?.version ?? 0) + 1);
        });

        it('schedules a dismiss timer when transitioning out of loading', () => {
            const id = addToast({ type: 'loading', message: 'Saving' });
            updateToast(id, { type: 'success', message: 'Saved', duration: 1000 });
            vi.advanceTimersByTime(999);
            expect(getToasts()).toHaveLength(1);
            vi.advanceTimersByTime(2);
            expect(getToasts()).toHaveLength(0);
        });

        it('returns false for unknown ids', () => {
            expect(updateToast('does-not-exist', { message: 'noop' })).toBe(false);
        });
    });

    describe('promiseToast', () => {
        it('shows loading, then success on resolve', async () => {
            vi.useRealTimers();
            const result = promiseToast(Promise.resolve(42), {
                loading: 'Working...',
                success: (v) => `Got ${v}`,
                error: 'Failed'
            });
            expect(getToasts()[0]?.type).toBe('loading');
            await expect(result).resolves.toBe(42);
            // Microtask flush
            await Promise.resolve();
            expect(getToasts()[0]?.type).toBe('success');
            expect(getToasts()[0]?.message).toBe('Got 42');
        });

        it('shows loading, then error on reject', async () => {
            vi.useRealTimers();
            const failing = Promise.reject(new Error('boom'));
            promiseToast(failing, {
                loading: 'Working...',
                success: 'OK',
                error: (e) => `Bad: ${(e as Error).message}`
            });
            await failing.catch(() => undefined);
            await Promise.resolve();
            expect(getToasts()[0]?.type).toBe('error');
            expect(getToasts()[0]?.message).toBe('Bad: boom');
        });
    });
});
