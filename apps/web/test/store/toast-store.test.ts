import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addToast,
    clearToasts,
    getToasts,
    removeToast,
    subscribe
} from '../../src/store/toast-store';

describe('toast-store.ts', () => {
    beforeEach(() => {
        // Clear store before each test
        clearToasts();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('addToast', () => {
        it('should add a toast with generated ID', () => {
            const id = addToast({
                type: 'success',
                message: 'Operation successful'
            });

            expect(id).toBeDefined();
            expect(typeof id).toBe('string');

            const toasts = getToasts();
            expect(toasts).toHaveLength(1);
            expect(toasts[0]).toEqual({
                id,
                type: 'success',
                message: 'Operation successful',
                duration: 5000
            });
        });

        it('should add multiple toasts', () => {
            addToast({ type: 'success', message: 'First toast' });
            addToast({ type: 'error', message: 'Second toast' });
            addToast({ type: 'warning', message: 'Third toast' });

            const toasts = getToasts();
            expect(toasts).toHaveLength(3);
            expect(toasts[0]?.message).toBe('First toast');
            expect(toasts[1]?.message).toBe('Second toast');
            expect(toasts[2]?.message).toBe('Third toast');
        });

        it('should accept custom duration', () => {
            const _id = addToast({
                type: 'info',
                message: 'Custom duration',
                duration: 10000
            });

            const toasts = getToasts();
            expect(toasts[0]?.duration).toBe(10000);
        });

        it('should use default duration of 5000ms', () => {
            addToast({ type: 'info', message: 'Default duration' });

            const toasts = getToasts();
            expect(toasts[0]?.duration).toBe(5000);
        });

        it('should notify subscribers when toast is added', () => {
            const listener = vi.fn();
            subscribe(listener);

            addToast({ type: 'success', message: 'Test' });

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should support all toast types', () => {
            addToast({ type: 'success', message: 'Success' });
            addToast({ type: 'error', message: 'Error' });
            addToast({ type: 'warning', message: 'Warning' });
            addToast({ type: 'info', message: 'Info' });

            const toasts = getToasts();
            expect(toasts[0]?.type).toBe('success');
            expect(toasts[1]?.type).toBe('error');
            expect(toasts[2]?.type).toBe('warning');
            expect(toasts[3]?.type).toBe('info');
        });
    });

    describe('removeToast', () => {
        it('should remove toast by ID', () => {
            const id = addToast({ type: 'success', message: 'Test toast' });
            expect(getToasts()).toHaveLength(1);

            removeToast(id);
            expect(getToasts()).toHaveLength(0);
        });

        it('should remove only specified toast', () => {
            const id1 = addToast({ type: 'success', message: 'First' });
            const id2 = addToast({ type: 'error', message: 'Second' });
            const id3 = addToast({ type: 'info', message: 'Third' });

            removeToast(id2);

            const toasts = getToasts();
            expect(toasts).toHaveLength(2);
            expect(toasts[0]?.id).toBe(id1);
            expect(toasts[1]?.id).toBe(id3);
        });

        it('should notify subscribers when toast is removed', () => {
            const listener = vi.fn();
            const id = addToast({ type: 'success', message: 'Test' });

            subscribe(listener);
            listener.mockClear();

            removeToast(id);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should handle removing non-existent toast', () => {
            addToast({ type: 'success', message: 'Test' });
            expect(getToasts()).toHaveLength(1);

            removeToast('non-existent-id');
            expect(getToasts()).toHaveLength(1);
        });

        it('should clear auto-dismiss timeout when toast is removed', () => {
            const id = addToast({
                type: 'success',
                message: 'Test',
                duration: 5000
            });

            removeToast(id);
            expect(getToasts()).toHaveLength(0);

            // Advance time - toast should not reappear or cause errors
            vi.advanceTimersByTime(6000);
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('clearToasts', () => {
        it('should remove all toasts', () => {
            addToast({ type: 'success', message: 'First' });
            addToast({ type: 'error', message: 'Second' });
            addToast({ type: 'warning', message: 'Third' });

            expect(getToasts()).toHaveLength(3);

            clearToasts();
            expect(getToasts()).toHaveLength(0);
        });

        it('should notify subscribers when toasts are cleared', () => {
            const listener = vi.fn();
            addToast({ type: 'success', message: 'Test' });

            subscribe(listener);
            listener.mockClear();

            clearToasts();
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should clear all auto-dismiss timeouts', () => {
            addToast({ type: 'success', message: 'First', duration: 5000 });
            addToast({ type: 'error', message: 'Second', duration: 10000 });

            clearToasts();
            expect(getToasts()).toHaveLength(0);

            // Advance time - no toasts should reappear
            vi.advanceTimersByTime(15000);
            expect(getToasts()).toHaveLength(0);
        });

        it('should handle clearing empty store', () => {
            expect(getToasts()).toHaveLength(0);
            clearToasts();
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('getToasts', () => {
        it('should return empty array initially', () => {
            const toasts = getToasts();
            expect(toasts).toEqual([]);
            expect(Array.isArray(toasts)).toBe(true);
        });

        it('should return all toasts', () => {
            addToast({ type: 'success', message: 'First' });
            addToast({ type: 'error', message: 'Second' });

            const toasts = getToasts();
            expect(toasts).toHaveLength(2);
        });

        it('should return readonly array', () => {
            addToast({ type: 'success', message: 'Test' });
            const toasts = getToasts();

            // TypeScript should enforce readonly, but runtime check
            expect(Array.isArray(toasts)).toBe(true);
        });
    });

    describe('subscribe', () => {
        it('should notify subscriber on state change', () => {
            const listener = vi.fn();
            subscribe(listener);

            addToast({ type: 'success', message: 'Test' });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should notify multiple subscribers', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            const listener3 = vi.fn();

            subscribe(listener1);
            subscribe(listener2);
            subscribe(listener3);

            addToast({ type: 'success', message: 'Test' });

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
            expect(listener3).toHaveBeenCalledTimes(1);
        });

        it('should return unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            expect(typeof unsubscribe).toBe('function');

            addToast({ type: 'success', message: 'Test 1' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            addToast({ type: 'error', message: 'Test 2' });
            expect(listener).toHaveBeenCalledTimes(1); // Not called again
        });

        it('should handle multiple subscriptions and unsubscriptions', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            const unsub1 = subscribe(listener1);
            const _unsub2 = subscribe(listener2);

            addToast({ type: 'success', message: 'Test 1' });
            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);

            unsub1();

            addToast({ type: 'error', message: 'Test 2' });
            expect(listener1).toHaveBeenCalledTimes(1); // Not called again
            expect(listener2).toHaveBeenCalledTimes(2); // Still subscribed
        });
    });

    describe('Auto-dismiss', () => {
        it('should auto-dismiss toast after duration', () => {
            addToast({
                type: 'success',
                message: 'Auto dismiss',
                duration: 5000
            });

            expect(getToasts()).toHaveLength(1);

            // Advance time by duration
            vi.advanceTimersByTime(5000);

            expect(getToasts()).toHaveLength(0);
        });

        it('should auto-dismiss multiple toasts independently', () => {
            addToast({ type: 'success', message: 'First', duration: 3000 });
            addToast({ type: 'error', message: 'Second', duration: 5000 });
            addToast({ type: 'warning', message: 'Third', duration: 7000 });

            expect(getToasts()).toHaveLength(3);

            // After 3 seconds, first toast dismissed
            vi.advanceTimersByTime(3000);
            expect(getToasts()).toHaveLength(2);
            expect(getToasts()[0]?.message).toBe('Second');

            // After 5 seconds total, second toast dismissed
            vi.advanceTimersByTime(2000);
            expect(getToasts()).toHaveLength(1);
            expect(getToasts()[0]?.message).toBe('Third');

            // After 7 seconds total, all dismissed
            vi.advanceTimersByTime(2000);
            expect(getToasts()).toHaveLength(0);
        });

        it('should not auto-dismiss if duration is 0', () => {
            addToast({
                type: 'success',
                message: 'No auto dismiss',
                duration: 0
            });

            expect(getToasts()).toHaveLength(1);

            vi.advanceTimersByTime(10000);

            expect(getToasts()).toHaveLength(1);
        });

        it('should notify subscribers when toast is auto-dismissed', () => {
            const listener = vi.fn();
            subscribe(listener);

            addToast({ type: 'success', message: 'Test', duration: 5000 });
            listener.mockClear();

            vi.advanceTimersByTime(5000);

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
