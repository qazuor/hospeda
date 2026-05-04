/**
 * @file toast-store.test.ts
 * @description Tests for the global toast store, including the action /
 * secondaryAction extension that the GuestPreferenceNudge relies on.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addToast,
    clearToasts,
    getToasts,
    removeToast,
    subscribe
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
});
