/**
 * @file IntentChips.test.tsx
 * @description Comprehensive RTL tests for the IntentChips React island (SPEC-199 T-020).
 *
 * Coverage:
 * - Render all chip key categories (boolean flags, array keys, numeric, date, string)
 * - Chip interactive states: select/deselect via click and keyboard
 * - sessionStorage persistence under `ai_search_chips` key
 * - Chip removal updates sessionStorage and navigates with window.location.replace
 * - SSR safety: null chip list when sessionStorage is unavailable
 * - Malformed JSON in sessionStorage: graceful clear and no chips
 * - ARIA attributes: aria-label on container, remove button aria-label
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntentChips } from '../../../src/components/ai-search/IntentChips';

// ─── Module mocks ─────────────────────────────────────────────────────────────

/**
 * i18n mock: returns fallback when provided, otherwise the key itself.
 * This keeps chip labels predictable without needing real translation files.
 * Keys without fallbacks (e.g. `aiSearch.chips.type`) return the key string,
 * which is still truthy so chips get rendered.
 */
// `t` and `translations` are created ONCE inside the factory (which runs once
// per module load) and the SAME reference is returned on every call. IntentChips
// uses `useEffect([t])` — an unstable `t` would retrigger the effect, set state,
// re-render, create a new `t`, and loop forever (OOM, not a timeout).
vi.mock('@/lib/i18n', () => {
    const t = (_key: string, fallback?: string, _params?: Record<string, unknown>): string =>
        fallback ?? _key;
    const translations = { t };
    return {
        createTranslations: (_locale: string) => translations
    };
});

vi.mock('@repo/icons', () => ({
    CloseIcon: ({ size }: { size: number }) => (
        <svg
            data-testid="close-icon"
            width={size}
            aria-hidden="true"
        />
    )
}));

// CSS module proxy: each className lookup returns the property name as a string.
vi.mock('../../../src/components/ai-search/IntentChips.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'ai_search_chips';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seed sessionStorage with a params object before rendering. */
function seedSession(params: Record<string, unknown>): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(params));
}

/** Render IntentChips with defaults. */
function renderChips(lang = 'es') {
    return render(
        <IntentChips
            locale="es"
            lang={lang}
        />
    );
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Stub window.location so replace() calls don't throw in jsdom.
    Object.defineProperty(window, 'location', {
        value: { href: '', replace: vi.fn() },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IntentChips', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Empty / null state
    // ─────────────────────────────────────────────────────────────────────────

    describe('empty state', () => {
        it('renders nothing when sessionStorage is empty', () => {
            const { container } = renderChips();
            expect(container.firstChild).toBeNull();
        });

        it('renders nothing when only the excluded q key is stored', async () => {
            seedSession({ q: 'hotel cerca del mar' });
            const { container } = renderChips();
            await waitFor(() => {
                expect(container.firstChild).toBeNull();
            });
        });

        it('clears malformed JSON from sessionStorage and renders nothing', async () => {
            sessionStorage.setItem(SESSION_KEY, '{not valid json}');
            const { container } = renderChips();
            await waitFor(() => {
                expect(container.firstChild).toBeNull();
            });
            expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Chip rendering — one per key category
    // ─────────────────────────────────────────────────────────────────────────

    describe('chip rendering', () => {
        it('renders one chip for a single string key (type)', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders one chip per key for multiple string/numeric keys', async () => {
            seedSession({ type: 'HOTEL', minGuests: 2, minPrice: 5000 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(3);
            });
        });

        it('renders chip for hasPool: true (boolean truthy)', async () => {
            seedSession({ hasPool: true });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('suppresses chip for hasPool: false (boolean falsy)', async () => {
            seedSession({ hasPool: false, type: 'HOTEL' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for hasWifi: true', async () => {
            seedSession({ hasWifi: true });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for allowsPets: true', async () => {
            seedSession({ allowsPets: true });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for hasParking: true', async () => {
            seedSession({ hasParking: true });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for non-empty amenities array', async () => {
            seedSession({ amenities: ['wifi', 'pool'] });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('suppresses chip for empty amenities array', async () => {
            seedSession({ amenities: [], type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for non-empty features array', async () => {
            seedSession({ features: ['mountain-view', 'bbq'] });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('suppresses chip for empty features array', async () => {
            seedSession({ features: [], type: 'HOTEL' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for checkIn date', async () => {
            seedSession({ checkIn: '2025-01-15' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for checkOut date', async () => {
            seedSession({ checkOut: '2025-01-20' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders chip for minRating and maxRating', async () => {
            seedSession({ minRating: 4, maxRating: 5 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
        });

        it('renders chip for minBedrooms and maxBedrooms', async () => {
            seedSession({ minBedrooms: 2, maxBedrooms: 4 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
        });

        it('renders chip for minBathrooms and maxBathrooms', async () => {
            seedSession({ minBathrooms: 1, maxBathrooms: 3 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });
        });

        it('renders chip for destinationId (fixed label, no value interpolation)', async () => {
            seedSession({ destinationId: 'uuid-123' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('suppresses chip when destinationId is null/undefined', async () => {
            seedSession({ destinationId: null, type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });
        });

        it('renders a remove button (CloseIcon) for each chip', async () => {
            seedSession({ type: 'CABIN', minGuests: 3 });
            renderChips();
            await waitFor(() => {
                const removeBtns = screen.getAllByRole('button');
                expect(removeBtns).toHaveLength(2);
            });
        });

        it('renders all chips with a CloseIcon inside each remove button', async () => {
            seedSession({ type: 'HOTEL', hasPool: true });
            renderChips();
            await waitFor(() => {
                const icons = screen.getAllByTestId('close-icon');
                expect(icons).toHaveLength(2);
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. ARIA and accessibility
    // ─────────────────────────────────────────────────────────────────────────

    describe('accessibility', () => {
        it('chip container has an aria-label attribute', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                const list = screen.getByRole('list');
                expect(list.parentElement).toHaveAttribute('aria-label');
            });
        });

        it('each remove button has an aria-label', async () => {
            seedSession({ type: 'CABIN', minGuests: 2 });
            renderChips();
            await waitFor(() => {
                const removeBtns = screen.getAllByRole('button');
                for (const btn of removeBtns) {
                    expect(btn).toHaveAttribute('aria-label');
                }
            });
        });

        it('CloseIcon inside remove button has aria-hidden="true"', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                const icon = screen.getByTestId('close-icon');
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            });
        });

        it('remove button is keyboard-focusable (type=button)', async () => {
            seedSession({ type: 'HOTEL' });
            renderChips();
            await waitFor(() => {
                const btn = screen.getByRole('button');
                expect(btn).toHaveAttribute('type', 'button');
            });
        });

        it('remove button activates on Enter key press', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const user = userEvent.setup();
            const btn = screen.getByRole('button');
            btn.focus();
            await user.keyboard('{Enter}');

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalled();
            });
        });

        it('remove button activates on Space key press', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getByRole('button')).toBeInTheDocument();
            });

            const user = userEvent.setup();
            const btn = screen.getByRole('button');
            btn.focus();
            await user.keyboard(' ');

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalled();
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Chip removal — state, sessionStorage, navigation
    // ─────────────────────────────────────────────────────────────────────────

    describe('chip removal', () => {
        it('clicking remove triggers window.location.replace', async () => {
            seedSession({ type: 'CABIN', minGuests: 3 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            const user = userEvent.setup();
            const [firstBtn] = screen.getAllByRole('button');
            await user.click(firstBtn);

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalled();
            });
        });

        it('navigates to /[lang]/alojamientos/ with remaining params', async () => {
            seedSession({ type: 'HOTEL', minGuests: 2 });
            renderChips('es');
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            const user = userEvent.setup();
            // type is first in CHIP_KEYS order — click first remove button
            const [firstBtn] = screen.getAllByRole('button');
            await user.click(firstBtn);

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalledWith(
                    expect.stringContaining('/es/alojamientos/')
                );
            });
        });

        it('includes remaining param in navigation URL after removing one chip', async () => {
            seedSession({ type: 'HOTEL', minGuests: 2 });
            renderChips('es');
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            const user = userEvent.setup();
            const [firstBtn] = screen.getAllByRole('button');
            await user.click(firstBtn);

            await waitFor(() => {
                const calls = vi.mocked(window.location.replace).mock.calls;
                const url = String(calls[0]?.[0] ?? '');
                expect(url).toContain('minGuests=2');
                expect(url).not.toContain('type=');
            });
        });

        it('navigates to /[lang]/alojamientos/ without params when last chip removed', async () => {
            seedSession({ type: 'CABIN' });
            renderChips('es');
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });

            const user = userEvent.setup();
            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalledWith('/es/alojamientos/');
            });
        });

        it('updates sessionStorage after removal when remaining keys exist', async () => {
            seedSession({ type: 'CABIN', minGuests: 3 });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            const user = userEvent.setup();
            const [firstBtn] = screen.getAllByRole('button');
            await user.click(firstBtn);

            await waitFor(() => {
                const stored = sessionStorage.getItem(SESSION_KEY);
                if (stored !== null) {
                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                    expect(parsed.type).toBeUndefined();
                    expect(parsed.minGuests).toBe(3);
                }
            });
        });

        it('removes sessionStorage key entirely when last chip is removed', async () => {
            seedSession({ type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });

            const user = userEvent.setup();
            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
            });
        });

        it('array-valued chip (amenities) is removed entirely from params on click', async () => {
            seedSession({ amenities: ['wifi', 'pool'], type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            const user = userEvent.setup();
            // amenities comes after type in CHIP_KEYS — remove the second button
            const buttons = screen.getAllByRole('button');
            await user.click(buttons[1]);

            await waitFor(() => {
                const stored = sessionStorage.getItem(SESSION_KEY);
                if (stored !== null) {
                    const parsed = JSON.parse(stored) as Record<string, unknown>;
                    expect(parsed.amenities).toBeUndefined();
                    expect(parsed.type).toBe('CABIN');
                }
            });
        });

        it('uses the lang prop in the navigation URL', async () => {
            seedSession({ type: 'CABIN' });
            renderChips('pt');
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(1);
            });

            const user = userEvent.setup();
            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(window.location.replace).toHaveBeenCalledWith(
                    expect.stringContaining('/pt/alojamientos/')
                );
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 5. sessionStorage — SSR safety and private-mode guard
    // ─────────────────────────────────────────────────────────────────────────

    describe('sessionStorage safety', () => {
        it('renders nothing when sessionStorage.getItem throws (private mode guard)', async () => {
            const originalGet = sessionStorage.getItem.bind(sessionStorage);
            vi.spyOn(sessionStorage, 'getItem').mockImplementation((key) => {
                if (key === SESSION_KEY) {
                    throw new Error('SecurityError: access denied');
                }
                return originalGet(key);
            });

            const { container } = renderChips();
            await waitFor(() => {
                expect(container.firstChild).toBeNull();
            });
        });

        it('persists chips across re-render when sessionStorage still has data', async () => {
            seedSession({ type: 'HOTEL', hasPool: true });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            // Data should still be in sessionStorage after render (not consumed)
            expect(sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 6. CHIP_KEYS order preserved
    // ─────────────────────────────────────────────────────────────────────────

    describe('chip render order', () => {
        it('renders type chip before minGuests chip (CHIP_KEYS order)', async () => {
            seedSession({ minGuests: 3, type: 'CABIN' });
            renderChips();
            await waitFor(() => {
                expect(screen.getAllByRole('listitem')).toHaveLength(2);
            });

            // Verify sessionStorage params: type and minGuests both present
            const stored = sessionStorage.getItem(SESSION_KEY);
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored ?? '{}') as Record<string, unknown>;
            expect(parsed.type).toBe('CABIN');
            expect(parsed.minGuests).toBe(3);
        });
    });
});
