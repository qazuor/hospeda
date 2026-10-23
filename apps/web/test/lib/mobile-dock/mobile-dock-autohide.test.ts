/** @module test/lib/mobile-dock/mobile-dock-autohide */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    MOBILE_DOCK_HIDDEN_ATTR,
    resolveDockHidden
} from '../../../src/lib/mobile-dock/mobile-dock-autohide';

let initDockAutoHide: (options: {
    readonly dock: HTMLElement;
    readonly win: Window;
    readonly matchMedia: (query: string) => MediaQueryList;
}) => { readonly cleanup: () => void };

beforeAll(async () => {
    const module = (await import('../../../src/lib/mobile-dock/mobile-dock-autohide')) as {
        readonly initDockAutoHide: typeof initDockAutoHide;
    };
    initDockAutoHide = module.initDockAutoHide;
});

const input = (overrides: Partial<Parameters<typeof resolveDockHidden>[0]> = {}) => ({
    isHidden: false,
    previousY: 200,
    currentY: 220,
    viewportHeight: 700,
    documentHeight: 2000,
    hasFocusWithin: false,
    isPinned: false,
    ...overrides
});

describe('TEST:1768:18 resolveDockHidden', () => {
    it('keeps the dock visible when focus is inside, even while scrolling down', () => {
        expect(resolveDockHidden(input({ hasFocusWithin: true }))).toEqual({ hidden: false });
    });

    it('keeps the dock visible when the comparison bar is pinned', () => {
        expect(resolveDockHidden(input({ isPinned: true }))).toEqual({ hidden: false });
    });

    it('keeps the dock visible at the top threshold and hides just below it while descending', () => {
        expect(resolveDockHidden(input({ previousY: 119, currentY: 120 }))).toEqual({
            hidden: false
        });
        expect(resolveDockHidden(input({ previousY: 112, currentY: 121 }))).toEqual({
            hidden: true
        });
    });

    it('keeps the dock visible at the page bottom, even while scrolling down', () => {
        expect(resolveDockHidden(input({ currentY: 1300, viewportHeight: 700 }))).toEqual({
            hidden: false
        });
    });

    it('preserves either state for movement smaller than the scroll delta', () => {
        expect(resolveDockHidden(input({ isHidden: true, previousY: 200, currentY: 207 }))).toEqual(
            { hidden: true }
        );
        expect(resolveDockHidden(input({ previousY: 200, currentY: 207 }))).toEqual({
            hidden: false
        });
    });

    it('hides while descending and reveals while ascending', () => {
        expect(resolveDockHidden(input())).toEqual({ hidden: true });
        expect(resolveDockHidden(input({ isHidden: true, previousY: 400, currentY: 300 }))).toEqual(
            { hidden: false }
        );
    });
});

describe('TEST:1768:19 initDockAutoHide', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function setup(matches = true) {
        const dock = document.createElement('div');
        dock.innerHTML = '<div data-mobile-dock-slot="above"></div>';
        document.body.append(dock);
        let mediaMatches = matches;
        let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
        const media = {
            get matches() {
                return mediaMatches;
            },
            addEventListener: vi.fn(
                (_type: string, listener: (event: MediaQueryListEvent) => void) => {
                    changeListener = listener;
                }
            ),
            removeEventListener: vi.fn()
        } as unknown as MediaQueryList;
        const rafCallbacks = new Map<number, FrameRequestCallback>();
        let nextId = 1;
        const win = {
            scrollY: 200,
            innerHeight: 700,
            document: { documentElement: { scrollHeight: 2000 } },
            addEventListener: window.addEventListener.bind(window),
            removeEventListener: window.removeEventListener.bind(window),
            dispatchEvent: window.dispatchEvent.bind(window),
            requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
                const id = nextId++;
                rafCallbacks.set(id, callback);
                return id;
            }),
            cancelAnimationFrame: vi.fn((id: number) => rafCallbacks.delete(id))
        } as unknown as Window;
        const flush = () => {
            const callbacks = [...rafCallbacks.values()];
            rafCallbacks.clear();
            callbacks.forEach((callback) => {
                callback(0);
            });
        };
        const setY = (y: number) => {
            Object.defineProperty(win, 'scrollY', { configurable: true, value: y });
            win.dispatchEvent(new Event('scroll'));
            flush();
        };
        const setMatches = (value: boolean) => {
            mediaMatches = value;
            changeListener?.({ matches: value } as MediaQueryListEvent);
        };
        const result = initDockAutoHide({ dock, win, matchMedia: () => media });
        return { dock, win, flush, setY, setMatches, rafCallbacks, result };
    }

    it('hides on downward scroll and reveals on upward scroll', () => {
        const { dock, setY } = setup();
        setY(400);
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(true);
        setY(300);
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
    });

    it('reveals immediately when focus enters the dock', () => {
        const { dock, setY } = setup();
        setY(400);
        dock.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
    });

    it('keeps the dock visible when an above-slot dock item is visible', () => {
        const { dock, setY } = setup();
        const item = document.createElement('button');
        item.setAttribute('data-dock-item', '');
        vi.spyOn(item, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
        dock.querySelector('[data-mobile-dock-slot="above"]')?.append(item);
        setY(400);
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
    });

    it('does not hide when the mobile media query does not match', () => {
        const { dock, setY } = setup(false);
        setY(400);
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
    });

    it('reveals when the media query stops matching', () => {
        const { dock, setY, setMatches } = setup();
        setY(400);
        setMatches(false);
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
    });

    it('removes listeners, cancels pending work, and reveals on cleanup', () => {
        const { dock, win, setY, result, rafCallbacks } = setup();
        setY(400);
        dock.setAttribute(MOBILE_DOCK_HIDDEN_ATTR, '');
        win.dispatchEvent(new Event('scroll'));
        expect(rafCallbacks.size).toBe(1);
        result.cleanup();
        expect(dock.hasAttribute(MOBILE_DOCK_HIDDEN_ATTR)).toBe(false);
        expect(rafCallbacks.size).toBe(0);
        win.dispatchEvent(new Event('scroll'));
        expect(rafCallbacks.size).toBe(0);
    });
});
