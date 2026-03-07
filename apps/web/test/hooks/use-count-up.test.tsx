/**
 * @file use-count-up.test.tsx
 * @description Tests for useCountUp and useViewportTrigger hooks.
 * Uses fake timers and mocked IntersectionObserver / requestAnimationFrame
 * to verify animation behavior without needing a real browser.
 */
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountUp, useViewportTrigger } from '../../src/hooks/useCountUp';

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let intersectionCallback: IntersectionCallback | null = null;

const mockObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn()
};

const MockIntersectionObserver = vi.fn((callback: IntersectionCallback) => {
    intersectionCallback = callback;
    return mockObserver;
});

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        return setTimeout(() => cb(performance.now()), 0) as unknown as number;
    });
    MockIntersectionObserver.mockClear();
    mockObserver.observe.mockClear();
    mockObserver.disconnect.mockClear();
    intersectionCallback = null;
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// useViewportTrigger - test component that attaches a real DOM ref
// ---------------------------------------------------------------------------

/**
 * Wrapper component that renders the hook with a real element in the DOM.
 * Exposes isVisible via a data attribute for assertion.
 */
function ViewportTriggerTestComponent({ threshold }: { readonly threshold?: number }) {
    const [ref, isVisible] = useViewportTrigger<HTMLDivElement>(
        threshold !== undefined ? { threshold } : {}
    );
    return (
        <div
            ref={ref}
            data-testid="observed-element"
            data-visible={String(isVisible)}
        />
    );
}

// ---------------------------------------------------------------------------
// useViewportTrigger tests
// ---------------------------------------------------------------------------

describe('useViewportTrigger', () => {
    it('should return [ref, false] initially before any intersection', () => {
        const { result } = renderHook(() => useViewportTrigger());
        const [ref, isVisible] = result.current;
        expect(ref).toBeDefined();
        expect(isVisible).toBe(false);
    });

    it('should set isVisible to true when entry intersects', () => {
        const { getByTestId } = render(<ViewportTriggerTestComponent />);

        // Verify initial state
        expect(getByTestId('observed-element').dataset.visible).toBe('false');

        // Simulate intersection event
        act(() => {
            if (intersectionCallback) {
                intersectionCallback([
                    { isIntersecting: true } as unknown as IntersectionObserverEntry
                ]);
            }
        });

        expect(getByTestId('observed-element').dataset.visible).toBe('true');
    });

    it('should call observer.disconnect after element becomes visible', () => {
        render(<ViewportTriggerTestComponent />);

        act(() => {
            if (intersectionCallback) {
                intersectionCallback([
                    { isIntersecting: true } as unknown as IntersectionObserverEntry
                ]);
            }
        });

        expect(mockObserver.disconnect).toHaveBeenCalled();
    });

    it('should NOT set isVisible when entry is not intersecting', () => {
        const { getByTestId } = render(<ViewportTriggerTestComponent />);

        act(() => {
            if (intersectionCallback) {
                intersectionCallback([
                    { isIntersecting: false } as unknown as IntersectionObserverEntry
                ]);
            }
        });

        expect(getByTestId('observed-element').dataset.visible).toBe('false');
    });

    it('should construct an IntersectionObserver when rendered with real element', () => {
        render(<ViewportTriggerTestComponent />);
        expect(MockIntersectionObserver).toHaveBeenCalled();
    });

    it('should call observer.observe with the DOM element', () => {
        render(<ViewportTriggerTestComponent />);
        expect(mockObserver.observe).toHaveBeenCalled();
    });

    it('should accept a custom threshold option', () => {
        render(<ViewportTriggerTestComponent threshold={0.75} />);
        expect(MockIntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ threshold: 0.75 })
        );
    });

    it('should use default threshold of 0.3 when not specified', () => {
        render(<ViewportTriggerTestComponent />);
        expect(MockIntersectionObserver).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ threshold: 0.3 })
        );
    });
});

// ---------------------------------------------------------------------------
// useCountUp - initial state
// ---------------------------------------------------------------------------

describe('useCountUp - initial state', () => {
    it('should return value=0 and isComplete=false when not visible', () => {
        const { result } = renderHook(() => useCountUp({ target: 1000, isVisible: false }));
        expect(result.current.value).toBe(0);
        expect(result.current.isComplete).toBe(false);
    });

    it('should return value=0 when target is 0 and not visible', () => {
        const { result } = renderHook(() => useCountUp({ target: 0, isVisible: false }));
        expect(result.current.value).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// useCountUp - prefers-reduced-motion
// ---------------------------------------------------------------------------

describe('useCountUp - prefers-reduced-motion', () => {
    it('should jump to target immediately when reduced motion is preferred', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));

        const { result } = renderHook(() => useCountUp({ target: 500, isVisible: true }));

        expect(result.current.value).toBe(500);
        expect(result.current.isComplete).toBe(true);
    });

    it('should set isComplete=true immediately when reduced motion is preferred', () => {
        vi.stubGlobal('matchMedia', (_query: string) => ({
            matches: true,
            media: _query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));

        const { result } = renderHook(() => useCountUp({ target: 100, isVisible: true }));

        expect(result.current.isComplete).toBe(true);
    });

    it('should handle target=0 with reduced motion (value=0, isComplete=true)', () => {
        vi.stubGlobal('matchMedia', (_query: string) => ({
            matches: true,
            media: _query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));

        const { result } = renderHook(() => useCountUp({ target: 0, isVisible: true }));

        expect(result.current.value).toBe(0);
        expect(result.current.isComplete).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// useCountUp - animation behavior
// ---------------------------------------------------------------------------

describe('useCountUp - animation', () => {
    beforeEach(() => {
        vi.stubGlobal('matchMedia', (_query: string) => ({
            matches: false,
            media: _query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));

        vi.useFakeTimers();
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
            return setTimeout(() => cb(performance.now()), 16) as unknown as number;
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return value >= 0 at start of animation', () => {
        const { result } = renderHook(() =>
            useCountUp({ target: 100, isVisible: true, duration: 500 })
        );

        expect(result.current.value).toBeGreaterThanOrEqual(0);
    });

    it('should reach target value and set isComplete=true after duration', () => {
        const { result } = renderHook(() =>
            useCountUp({ target: 100, isVisible: true, duration: 100 })
        );

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.value).toBe(100);
        expect(result.current.isComplete).toBe(true);
    });

    it('should only animate once regardless of re-renders (hasAnimated guard)', () => {
        let isVisible = false;
        const { result, rerender } = renderHook(() =>
            useCountUp({ target: 50, isVisible, duration: 100 })
        );

        // First trigger
        isVisible = true;
        rerender();
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(result.current.isComplete).toBe(true);
        const finalValue = result.current.value;

        // Toggle off and on again - should NOT restart
        isVisible = false;
        rerender();
        isVisible = true;
        rerender();
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(result.current.value).toBe(finalValue);
    });
});

// ---------------------------------------------------------------------------
// useCountUp - edge cases
// ---------------------------------------------------------------------------

describe('useCountUp - edge cases', () => {
    beforeEach(() => {
        // Use reduced motion for instant animation in edge case tests
        vi.stubGlobal('matchMedia', (_query: string) => ({
            matches: true,
            media: _query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn()
        }));
    });

    it('should handle large targets correctly', () => {
        const { result } = renderHook(() => useCountUp({ target: 1_000_000, isVisible: true }));
        expect(result.current.value).toBe(1_000_000);
        expect(result.current.isComplete).toBe(true);
    });

    it('should return 0 for value when isVisible=false (per hook contract)', () => {
        const { result } = renderHook(() => useCountUp({ target: 999, isVisible: false }));
        // Hook implementation: return { value: isVisible ? value : 0, isComplete }
        expect(result.current.value).toBe(0);
    });

    it('should accept quart easing preset without throwing', () => {
        expect(() =>
            renderHook(() => useCountUp({ target: 100, isVisible: true, easing: 'quart' }))
        ).not.toThrow();
    });

    it('should accept cubic easing preset without throwing', () => {
        expect(() =>
            renderHook(() => useCountUp({ target: 100, isVisible: true, easing: 'cubic' }))
        ).not.toThrow();
    });

    it('should work with default duration (1500ms) when not specified', () => {
        expect(() => renderHook(() => useCountUp({ target: 50, isVisible: true }))).not.toThrow();
    });

    it('should work with non-visible state without errors', () => {
        expect(() => renderHook(() => useCountUp({ target: 500, isVisible: false }))).not.toThrow();
    });
});
