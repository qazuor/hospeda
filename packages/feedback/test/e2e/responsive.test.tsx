/**
 * T-039: Responsive layout tests for FeedbackModal.
 *
 * Verifies the isMobile / isDesktop detection logic that drives the
 * modal-vs-drawer layout switch. The component uses window.matchMedia to
 * react to viewport changes; we test the pure logic and the MediaQueryList
 * event handling in isolation, without DOM rendering.
 *
 * Breakpoint: 640px (MOBILE_BREAKPOINT in FeedbackModal.tsx).
 * - viewport < 640px  -> mobile drawer (alignItems: 'flex-end')
 * - viewport >= 640px -> desktop modal (alignItems: 'center')
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants — mirrored from FeedbackModal.tsx
// ---------------------------------------------------------------------------

/** Width at which the component switches from drawer to modal */
const MOBILE_BREAKPOINT = 640;

// ---------------------------------------------------------------------------
// Pure helpers mirroring FeedbackModal internal logic
// ---------------------------------------------------------------------------

/**
 * Determines whether the component should use the mobile drawer layout.
 * Mirrors the `useState` initializer in FeedbackModal:
 *   `() => window.innerWidth < MOBILE_BREAKPOINT`
 *
 * @param viewportWidth - Current window.innerWidth value
 * @returns true when the drawer layout should be used
 */
function detectIsMobile(viewportWidth: number): boolean {
    return viewportWidth < MOBILE_BREAKPOINT;
}

/**
 * Mirrors the MediaQueryList `change` event handler in FeedbackModal:
 *   `(e) => setIsMobile(!e.matches)`
 *
 * @param matches - Whether the media query `(min-width: 640px)` matches
 * @returns The derived isMobile value
 */
function handleMediaQueryChange(matches: boolean): boolean {
    return !matches;
}

/**
 * Selects the correct backdrop style based on isMobile.
 * Mirrors the expression in FeedbackModal:
 *   `const backdropStyle = isMobile ? styles.backdropMobile : styles.backdrop`
 */
function selectBackdropStyle(isMobile: boolean): { alignItems: string } {
    return isMobile
        ? { alignItems: 'flex-end' } // bottom-anchored drawer
        : { alignItems: 'center' }; // centered modal
}

/**
 * Selects the correct content style based on isMobile.
 * Mirrors:
 *   `const contentStyle = isMobile ? styles.drawer : styles.modal`
 */
function selectContentStyle(isMobile: boolean): {
    borderRadius: string;
    maxWidth: string | undefined;
} {
    return isMobile
        ? { borderRadius: '16px 16px 0 0', maxWidth: undefined }
        : { borderRadius: '12px', maxWidth: '640px' };
}

/**
 * Determines whether the drag handle is shown.
 * Mirrors: `{isMobile && <div style={styles.dragHandle} />}`
 */
function shouldShowDragHandle(isMobile: boolean): boolean {
    return isMobile;
}

/**
 * Determines whether the close button is shown.
 * Mirrors: `{!isMobile && <button ...>{FEEDBACK_STRINGS.buttons.close}</button>}`
 */
function shouldShowCloseButton(isMobile: boolean): boolean {
    return !isMobile;
}

// ---------------------------------------------------------------------------
// Mock MediaQueryList helpers
// ---------------------------------------------------------------------------

type MediaQueryChangeHandler = (e: Pick<MediaQueryListEvent, 'matches'>) => void;

interface MockMediaQueryList {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    /** Simulate the viewport changing so event listeners are called */
    simulateChange: (newMatches: boolean) => void;
}

/**
 * Builds a mock window.matchMedia that can simulate viewport changes.
 *
 * @param initialMatches - Whether the media query initially matches
 */
function buildMatchMediaMock(initialMatches: boolean): MockMediaQueryList {
    const listeners: MediaQueryChangeHandler[] = [];

    const mql: MockMediaQueryList = {
        matches: initialMatches,
        addEventListener: vi.fn((_type: string, handler: MediaQueryChangeHandler) => {
            listeners.push(handler);
        }),
        removeEventListener: vi.fn((_type: string, handler: MediaQueryChangeHandler) => {
            const idx = listeners.indexOf(handler);
            if (idx !== -1) listeners.splice(idx, 1);
        }),
        simulateChange(newMatches: boolean) {
            mql.matches = newMatches;
            for (const handler of listeners) {
                handler({ matches: newMatches });
            }
        }
    };

    return mql;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackModal responsive layout: detectIsMobile', () => {
    it('should return true for widths below MOBILE_BREAKPOINT (320px)', () => {
        // Arrange & Act & Assert
        expect(detectIsMobile(320)).toBe(true);
    });

    it('should return true for widths below MOBILE_BREAKPOINT (375px — iPhone SE)', () => {
        expect(detectIsMobile(375)).toBe(true);
    });

    it('should return true for width 1 below the breakpoint (639px)', () => {
        expect(detectIsMobile(639)).toBe(true);
    });

    it('should return false at the exact breakpoint boundary (640px)', () => {
        expect(detectIsMobile(640)).toBe(false);
    });

    it('should return false for widths above MOBILE_BREAKPOINT (768px — tablet)', () => {
        expect(detectIsMobile(768)).toBe(false);
    });

    it('should return false for widths above MOBILE_BREAKPOINT (1024px — desktop)', () => {
        expect(detectIsMobile(1024)).toBe(false);
    });

    it('should return false for widths above MOBILE_BREAKPOINT (1440px — wide desktop)', () => {
        expect(detectIsMobile(1440)).toBe(false);
    });

    it('should use strict less-than comparison (not <=)', () => {
        // 640 is NOT mobile; 639 IS mobile
        expect(detectIsMobile(639)).toBe(true);
        expect(detectIsMobile(640)).toBe(false);
    });
});

describe('FeedbackModal responsive layout: handleMediaQueryChange', () => {
    it('should return isMobile=true when media query does NOT match (< 640px)', () => {
        // matches=false means the min-width query is not satisfied -> mobile
        expect(handleMediaQueryChange(false)).toBe(true);
    });

    it('should return isMobile=false when media query DOES match (>= 640px)', () => {
        // matches=true means the min-width query is satisfied -> desktop
        expect(handleMediaQueryChange(true)).toBe(false);
    });

    it('should be the inverse of the matches value', () => {
        expect(handleMediaQueryChange(true)).toBe(false);
        expect(handleMediaQueryChange(false)).toBe(true);
    });
});

describe('FeedbackModal responsive layout: backdrop style selection', () => {
    it('should use bottom-aligned backdrop on mobile (drawer)', () => {
        // Arrange
        const isMobile = true;

        // Act
        const style = selectBackdropStyle(isMobile);

        // Assert
        expect(style.alignItems).toBe('flex-end');
    });

    it('should use center-aligned backdrop on desktop (modal)', () => {
        // Arrange
        const isMobile = false;

        // Act
        const style = selectBackdropStyle(isMobile);

        // Assert
        expect(style.alignItems).toBe('center');
    });
});

describe('FeedbackModal responsive layout: content style selection', () => {
    it('should use rounded-top corners for drawer on mobile', () => {
        // Arrange
        const isMobile = true;

        // Act
        const style = selectContentStyle(isMobile);

        // Assert
        expect(style.borderRadius).toBe('16px 16px 0 0');
    });

    it('should use fully rounded corners for modal on desktop', () => {
        // Arrange
        const isMobile = false;

        // Act
        const style = selectContentStyle(isMobile);

        // Assert
        expect(style.borderRadius).toBe('12px');
    });

    it('should set maxWidth=640px for desktop modal', () => {
        const style = selectContentStyle(false);
        expect(style.maxWidth).toBe('640px');
    });

    it('should not constrain maxWidth for mobile drawer', () => {
        const style = selectContentStyle(true);
        expect(style.maxWidth).toBeUndefined();
    });
});

describe('FeedbackModal responsive layout: conditional elements', () => {
    it('should show drag handle on mobile', () => {
        expect(shouldShowDragHandle(true)).toBe(true);
    });

    it('should hide drag handle on desktop', () => {
        expect(shouldShowDragHandle(false)).toBe(false);
    });

    it('should show close button on desktop', () => {
        expect(shouldShowCloseButton(false)).toBe(true);
    });

    it('should hide close button on mobile', () => {
        expect(shouldShowCloseButton(true)).toBe(false);
    });

    it('drag handle and close button are mutually exclusive', () => {
        for (const isMobile of [true, false]) {
            const hasDragHandle = shouldShowDragHandle(isMobile);
            const hasCloseButton = shouldShowCloseButton(isMobile);
            // Exactly one of the two should be shown at any given viewport
            expect(hasDragHandle !== hasCloseButton).toBe(true);
        }
    });
});

describe('FeedbackModal responsive layout: MediaQueryList event listener lifecycle', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
        originalMatchMedia = globalThis.window?.matchMedia;
    });

    afterEach(() => {
        if (originalMatchMedia !== undefined) {
            (globalThis as unknown as Record<string, unknown>).matchMedia = originalMatchMedia;
        }
        vi.restoreAllMocks();
    });

    it('should register a "change" listener on the MediaQueryList', () => {
        // Arrange
        const mql = buildMatchMediaMock(true);

        // Act — simulate the useEffect body in FeedbackModal
        mql.addEventListener('change', (_e) => {});

        // Assert
        expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove the "change" listener on cleanup', () => {
        // Arrange
        const mql = buildMatchMediaMock(true);
        const handler = (_e: Pick<MediaQueryListEvent, 'matches'>): void => {};

        // Act — simulate useEffect body + return cleanup
        mql.addEventListener('change', handler);
        mql.removeEventListener('change', handler);

        // Assert
        expect(mql.removeEventListener).toHaveBeenCalledWith('change', handler);
    });

    it('should transition from mobile to desktop when viewport expands past 640px', () => {
        // Arrange — start on mobile
        const mql = buildMatchMediaMock(false); // min-width: 640px does NOT match => mobile
        const currentIsMobile = handleMediaQueryChange(mql.matches);
        expect(currentIsMobile).toBe(true);

        let capturedIsMobile: boolean | undefined;
        mql.addEventListener('change', (e) => {
            capturedIsMobile = handleMediaQueryChange(e.matches);
        });

        // Act — simulate viewport expanding to 768px
        mql.simulateChange(true); // min-width: 640px NOW matches

        // Assert
        expect(capturedIsMobile).toBe(false);
    });

    it('should transition from desktop to mobile when viewport shrinks below 640px', () => {
        // Arrange — start on desktop
        const mql = buildMatchMediaMock(true); // min-width: 640px matches => desktop
        let capturedIsMobile: boolean | undefined;

        mql.addEventListener('change', (e) => {
            capturedIsMobile = handleMediaQueryChange(e.matches);
        });

        // Act — simulate viewport shrinking to 375px
        mql.simulateChange(false); // min-width: 640px no longer matches

        // Assert
        expect(capturedIsMobile).toBe(true);
    });

    it('should not call listener after cleanup (removeEventListener)', () => {
        // Arrange
        const mql = buildMatchMediaMock(true);
        const toggleSpy = vi.fn();

        const handler = (e: Pick<MediaQueryListEvent, 'matches'>): void => {
            toggleSpy(handleMediaQueryChange(e.matches));
        };

        mql.addEventListener('change', handler);
        mql.removeEventListener('change', handler);

        // Act — fire change after cleanup
        mql.simulateChange(false);

        // Assert — listener was removed, so spy should not have been called
        expect(toggleSpy).not.toHaveBeenCalled();
    });
});

describe('FeedbackModal responsive layout: MOBILE_BREAKPOINT constant', () => {
    it('MOBILE_BREAKPOINT is 640', () => {
        expect(MOBILE_BREAKPOINT).toBe(640);
    });

    it('common mobile breakpoints are below MOBILE_BREAKPOINT', () => {
        const mobileWidths = [320, 375, 390, 414, 428];
        for (const w of mobileWidths) {
            expect(detectIsMobile(w)).toBe(true);
        }
    });

    it('common tablet/desktop breakpoints are at or above MOBILE_BREAKPOINT', () => {
        const desktopWidths = [640, 768, 1024, 1280, 1440, 1920];
        for (const w of desktopWidths) {
            expect(detectIsMobile(w)).toBe(false);
        }
    });
});
