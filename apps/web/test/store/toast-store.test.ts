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
        vi.useFakeTimers();
        clearToasts();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('addToast', () => {
        it('should add a toast and return its id', () => {
            const id = addToast({ type: 'success', message: 'Done!' });

            expect(id).toBeDefined();
            expect(typeof id).toBe('string');

            const toasts = getToasts();
            expect(toasts).toHaveLength(1);
            expect(toasts[0].type).toBe('success');
            expect(toasts[0].message).toBe('Done!');
        });

        it('should add multiple toasts', () => {
            addToast({ type: 'info', message: 'First' });
            addToast({ type: 'warning', message: 'Second' });

            expect(getToasts()).toHaveLength(2);
        });

        it('should default duration to 5000ms', () => {
            addToast({ type: 'info', message: 'Default duration' });

            const toasts = getToasts();
            expect(toasts[0].duration).toBe(5000);
        });

        it('should accept custom duration', () => {
            addToast({ type: 'error', message: 'Long toast', duration: 10000 });

            const toasts = getToasts();
            expect(toasts[0].duration).toBe(10000);
        });
    });

    describe('removeToast', () => {
        it('should remove a toast by id', () => {
            const id = addToast({ type: 'success', message: 'Will be removed' });
            expect(getToasts()).toHaveLength(1);

            removeToast(id);
            expect(getToasts()).toHaveLength(0);
        });

        it('should be safe to remove non-existent id', () => {
            addToast({ type: 'info', message: 'Stay' });
            removeToast('non-existent');

            expect(getToasts()).toHaveLength(1);
        });
    });

    describe('clearToasts', () => {
        it('should remove all toasts', () => {
            addToast({ type: 'success', message: 'One' });
            addToast({ type: 'info', message: 'Two' });
            addToast({ type: 'warning', message: 'Three' });

            expect(getToasts()).toHaveLength(3);
            clearToasts();
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('auto-dismiss', () => {
        it('should auto-dismiss after duration', () => {
            addToast({ type: 'info', message: 'Auto dismiss', duration: 3000 });
            expect(getToasts()).toHaveLength(1);

            vi.advanceTimersByTime(3000);
            expect(getToasts()).toHaveLength(0);
        });

        it('should not auto-dismiss when duration is 0', () => {
            addToast({ type: 'error', message: 'Persistent', duration: 0 });
            expect(getToasts()).toHaveLength(1);

            vi.advanceTimersByTime(60000);
            expect(getToasts()).toHaveLength(1);
        });

        it('should clear timeout when manually removed', () => {
            const id = addToast({ type: 'info', message: 'Manual removal', duration: 5000 });
            removeToast(id);

            vi.advanceTimersByTime(5000);
            expect(getToasts()).toHaveLength(0);
        });
    });

    describe('subscribe', () => {
        it('should notify subscribers on addToast', () => {
            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            addToast({ type: 'success', message: 'Notify!' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
        });

        it('should notify subscribers on removeToast', () => {
            const id = addToast({ type: 'info', message: 'Will notify' });

            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            removeToast(id);
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
        });

        it('should notify subscribers on clearToasts', () => {
            addToast({ type: 'info', message: 'Toast' });

            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            clearToasts();
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
        });

        it('should stop notifying after unsubscribe', () => {
            const listener = vi.fn();
            const unsubscribe = subscribe(listener);

            addToast({ type: 'info', message: 'Before unsub' });
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();

            addToast({ type: 'info', message: 'After unsub' });
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
