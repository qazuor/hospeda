/**
 * @file gallery-preload.test.ts
 * @description Progressive gallery preloading (owner smoke, HOS-2520): the pure window
 * computation, the lightbox neighbours, the data-saver read and the page-idle trigger.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    GALLERY_PRELOAD_AHEAD,
    readSaveData,
    resolveEagerThrough,
    resolveLightboxPreloadIndices,
    whenPageIdle
} from '@/components/gallery/gallery-preload';

afterEach(() => {
    vi.useRealTimers();
});

describe('resolveEagerThrough', () => {
    const base = { current: 0, count: 10, ready: true, saveData: false, previous: 0 };

    it('keeps only the first slide eager before the page is ready', () => {
        expect(resolveEagerThrough({ ...base, ready: false })).toEqual({ eagerThrough: 0 });
    });

    it('covers the current slide plus the look-ahead once ready', () => {
        expect(GALLERY_PRELOAD_AHEAD).toBe(2);
        expect(resolveEagerThrough(base)).toEqual({ eagerThrough: 2 });
        expect(resolveEagerThrough({ ...base, current: 4, previous: 2 })).toEqual({
            eagerThrough: 6
        });
    });

    it('never goes past the last slide', () => {
        expect(resolveEagerThrough({ ...base, current: 8, count: 10 })).toEqual({
            eagerThrough: 9
        });
        expect(resolveEagerThrough({ ...base, count: 2 })).toEqual({ eagerThrough: 1 });
    });

    it('never shrinks: swiping back keeps the slides already fetched', () => {
        expect(resolveEagerThrough({ ...base, current: 1, previous: 6 })).toEqual({
            eagerThrough: 6
        });
    });

    it('preloads nothing extra with data saver on or a single slide', () => {
        expect(resolveEagerThrough({ ...base, saveData: true })).toEqual({ eagerThrough: 0 });
        expect(resolveEagerThrough({ ...base, count: 1 })).toEqual({ eagerThrough: 0 });
    });
});

describe('resolveLightboxPreloadIndices', () => {
    it('warms the next two and the previous photo, nearest first', () => {
        expect(resolveLightboxPreloadIndices({ index: 3, count: 10, saveData: false })).toEqual({
            indices: [4, 5, 2]
        });
    });

    it('wraps around like the lightbox navigation', () => {
        expect(resolveLightboxPreloadIndices({ index: 9, count: 10, saveData: false })).toEqual({
            indices: [0, 1, 8]
        });
        expect(resolveLightboxPreloadIndices({ index: 0, count: 10, saveData: false })).toEqual({
            indices: [1, 2, 9]
        });
    });

    it('drops duplicates and the current photo on short galleries', () => {
        expect(resolveLightboxPreloadIndices({ index: 0, count: 2, saveData: false })).toEqual({
            indices: [1]
        });
        expect(resolveLightboxPreloadIndices({ index: 1, count: 3, saveData: false })).toEqual({
            indices: [2, 0]
        });
    });

    it('preloads nothing with data saver on or a single photo', () => {
        expect(resolveLightboxPreloadIndices({ index: 0, count: 10, saveData: true })).toEqual({
            indices: []
        });
        expect(resolveLightboxPreloadIndices({ index: 0, count: 1, saveData: false })).toEqual({
            indices: []
        });
    });
});

describe('readSaveData', () => {
    it('reads navigator.connection.saveData and defaults to false', () => {
        expect(readSaveData({})).toEqual({ saveData: false });
        expect(readSaveData({ nav: {} as Navigator })).toEqual({ saveData: false });
        expect(
            readSaveData({ nav: { connection: { saveData: true } } as unknown as Navigator })
        ).toEqual({ saveData: true });
    });
});

describe('whenPageIdle', () => {
    /** A minimal window double: readyState, load listeners and optional idle callback. */
    function fakeWindow({
        readyState,
        idle
    }: {
        readonly readyState: DocumentReadyState;
        readonly idle?: boolean;
    }) {
        const listeners = new Set<() => void>();
        const idleCallbacks: (() => void)[] = [];
        const win = {
            document: { readyState },
            addEventListener: (_: string, fn: () => void) => listeners.add(fn),
            removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
            ...(idle
                ? {
                      requestIdleCallback: (fn: () => void) => idleCallbacks.push(fn),
                      cancelIdleCallback: vi.fn()
                  }
                : {})
        };
        return {
            win: win as unknown as Window,
            fireLoad: () => {
                for (const fn of [...listeners]) fn();
            },
            fireIdle: () => {
                for (const fn of idleCallbacks.splice(0)) fn();
            }
        };
    }

    it('waits for load and then for idle', () => {
        const { win, fireLoad, fireIdle } = fakeWindow({ readyState: 'interactive', idle: true });
        const onReady = vi.fn();
        whenPageIdle({ win, onReady });

        fireIdle();
        expect(onReady).not.toHaveBeenCalled();
        fireLoad();
        expect(onReady).not.toHaveBeenCalled();
        fireIdle();
        expect(onReady).toHaveBeenCalledOnce();
    });

    it('goes straight to idle when the page already loaded, with a timeout fallback', () => {
        vi.useFakeTimers();
        const { win } = fakeWindow({ readyState: 'complete' });
        const onReady = vi.fn();
        whenPageIdle({ win, onReady });

        vi.advanceTimersByTime(199);
        expect(onReady).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onReady).toHaveBeenCalledOnce();
    });

    it('never fires after cleanup', () => {
        const { win, fireLoad, fireIdle } = fakeWindow({ readyState: 'loading', idle: true });
        const onReady = vi.fn();
        const { cleanup } = whenPageIdle({ win, onReady });

        cleanup();
        fireLoad();
        fireIdle();
        expect(onReady).not.toHaveBeenCalled();
    });
});
