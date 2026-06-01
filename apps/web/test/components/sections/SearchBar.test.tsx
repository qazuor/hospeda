/**
 * @file SearchBar.test.tsx
 * @description Unit tests for the hero SearchBar. Covers two layers:
 *
 * 1. The pure `buildSearchUrl` helper: it must include only the params that
 *    have a meaningful value, and skip the ones at default state.
 * 2. The `<SearchBar />` React island: keyboard interaction to open panels
 *    and the submit flow that builds the destination URL via
 *    `window.location.assign`. The lazy-loaded `SearchBarCalendar` chunk is
 *    intentionally not exercised here (its Suspense fallback is null).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchBar, buildSearchUrl } from '../../../src/components/sections/SearchBar.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Mock i18n to avoid locale file loading in JSDOM. Returns the provided
 * fallback (which is what the component always passes) so the visible text
 * matches the literal Spanish strings in the source.
 */
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, vars?: Record<string, unknown>) => {
            const base = fallback ?? _key;
            if (!vars) return base;
            return base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
        }
    })
}));

const BASE = '/es/alojamientos/';

const DEFAULTS = {
    baseUrl: BASE,
    destinationId: null,
    types: new Set<never>(),
    adults: 2,
    children: 0
} as const;

describe('buildSearchUrl', () => {
    it('emits only adults at default state (others suppressed)', () => {
        // Adults is always emitted to keep the sidebar in sync with the hero.
        // Everything else stays out when at default.
        const url = buildSearchUrl({ ...DEFAULTS });
        expect(url).toBe(`${BASE}?adults=2`);
    });

    it('emits destinationIds when a destination is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            destinationId: '11111111-2222-3333-4444-555555555555'
        });
        expect(url).toContain('destinationIds=11111111-2222-3333-4444-555555555555');
    });

    it('emits types as comma-separated when a strict subset is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(['HOTEL', 'CABIN']) as ReadonlySet<'HOTEL' | 'CABIN'>
        });
        expect(url).toContain('types=HOTEL%2CCABIN');
    });

    it('omits types when ALL accommodation types are selected (no filter intent)', () => {
        // Picking every type is equivalent to no filter — keep the URL clean.
        const ALL = [
            'HOTEL',
            'APARTMENT',
            'HOUSE',
            'COUNTRY_HOUSE',
            'CABIN',
            'HOSTEL',
            'CAMPING',
            'ROOM',
            'MOTEL',
            'RESORT'
        ] as const;
        const url = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(ALL) as ReadonlySet<(typeof ALL)[number]>
        });
        // adults still emitted (always) but no `types`
        expect(url).not.toContain('types=');
    });

    it('emits checkIn/checkOut as local YYYY-MM-DD (no timezone shift)', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            checkIn: new Date(2026, 5, 1), // June 1 local time
            checkOut: new Date(2026, 5, 7)
        });
        expect(url).toContain('checkIn=2026-06-01');
        expect(url).toContain('checkOut=2026-06-07');
    });

    it('always emits adults so the listing sidebar shows the same number the user saw in the hero', () => {
        // Even at the default (2), `adults` is emitted because the sidebar's
        // stepper minimum is 1 — without this, the sidebar would default-render
        // 1 adult and silently disagree with the hero.
        const url = buildSearchUrl({ ...DEFAULTS, adults: 2, children: 0 });
        expect(url).toContain('adults=2');
        // Children stays out when 0 (its natural absence; sidebar default is 0 too).
        expect(url).not.toContain('children=');
    });

    it('emits children only when greater than 0', () => {
        const url = buildSearchUrl({ ...DEFAULTS, adults: 4, children: 2 });
        expect(url).toContain('adults=4');
        expect(url).toContain('children=2');
    });

    it('still suppresses children when the user did not touch it', () => {
        const url = buildSearchUrl({ ...DEFAULTS, adults: 5, children: 0 });
        expect(url).toContain('adults=5');
        expect(url).not.toContain('children=');
    });

    it('combines every param when all are set', () => {
        const url = buildSearchUrl({
            baseUrl: BASE,
            destinationId: 'dest-1',
            types: new Set(['HOTEL']) as ReadonlySet<'HOTEL'>,
            checkIn: new Date(2026, 0, 15),
            checkOut: new Date(2026, 0, 20),
            adults: 3,
            children: 1
        });
        expect(url).toContain('destinationIds=dest-1');
        expect(url).toContain('types=HOTEL');
        expect(url).toContain('checkIn=2026-01-15');
        expect(url).toContain('checkOut=2026-01-20');
        expect(url).toContain('adults=3');
        expect(url).toContain('children=1');
    });
});

// ---------------------------------------------------------------------------
// <SearchBar /> island integration tests
// ---------------------------------------------------------------------------

const MOCK_DESTINATIONS = [
    { id: 'dest-colon', slug: 'colon', name: 'Colón' },
    { id: 'dest-cdu', slug: 'concepcion-del-uruguay', name: 'Concepción del Uruguay' }
] as const;

const SEARCH_BASE = '/es/alojamientos/';

describe('<SearchBar /> destinations panel keyboard interaction', () => {
    let assignSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        // Replace `window.location` with a stub whose `assign` is a vi.fn().
        // JSDOM's default location is non-configurable, so we redefine the
        // property rather than spying on it.
        assignSpy = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                assign: assignSpy,
                href: 'http://localhost/',
                pathname: '/',
                search: ''
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('opens the destinations listbox when Enter is pressed on the destination column (T-014 keyboard a11y)', async () => {
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /destino/i });
        // Initially collapsed.
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('listbox')).toBeNull();

        // Focus + Enter — keyDown handler short-circuits on Enter/Space.
        trigger.focus();
        fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        // Both destination options are rendered.
        expect(screen.getByRole('option', { name: 'Colón' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Concepción del Uruguay' })).toBeInTheDocument();
    });

    it('also opens the destinations listbox when Space is pressed (Space parity with Enter)', () => {
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /destino/i });
        trigger.focus();
        fireEvent.keyDown(trigger, { key: ' ', code: 'Space' });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
});

describe('<SearchBar /> submit flow', () => {
    let assignSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        assignSpy = vi.fn();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                assign: assignSpy,
                href: 'http://localhost/',
                pathname: '/',
                search: ''
            }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds the expected URL when submitting after selecting a destination', async () => {
        const user = userEvent.setup();

        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        // Open destinations panel via click and pick "Colón".
        const destTrigger = screen.getByRole('button', { name: /destino/i });
        await user.click(destTrigger);

        const colonOption = screen.getByRole('option', { name: 'Colón' });
        await user.click(colonOption);

        // After selection the panel auto-closes.
        expect(destTrigger).toHaveAttribute('aria-expanded', 'false');

        // Click the submit button.
        const submit = screen.getByRole('button', { name: /^buscar$/i });
        await user.click(submit);

        // The submit handler navigates via window.location.assign.
        expect(assignSpy).toHaveBeenCalledTimes(1);
        const navigatedTo = assignSpy.mock.calls[0]?.[0] as string;

        // Compare against buildSearchUrl directly to make the contract explicit.
        const expected = buildSearchUrl({
            baseUrl: SEARCH_BASE,
            destinationId: 'dest-colon',
            types: new Set(),
            adults: 2,
            children: 0
        });
        expect(navigatedTo).toBe(expected);
        expect(navigatedTo).toContain('destinationIds=dest-colon');
        expect(navigatedTo).toContain('adults=2');
        // No dates, no children, types omitted.
        expect(navigatedTo).not.toContain('checkIn=');
        expect(navigatedTo).not.toContain('checkOut=');
        expect(navigatedTo).not.toContain('children=');
        expect(navigatedTo).not.toContain('types=');
    });
});

// ---------------------------------------------------------------------------
// Regression: BETA-26 — guests selector appears to "not save" the value 2
// ---------------------------------------------------------------------------

describe('<SearchBar /> guests selector (BETA-26 regression)', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows the value (even at the default 2) once the stepper is touched, not the placeholder', async () => {
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const guestsTrigger = screen.getByRole('button', { name: /huéspedes/i });
        // Untouched: the placeholder hint is shown (2 adults / 0 children is the default).
        expect(guestsTrigger).toHaveTextContent('¿Cuántas personas son?');

        await user.click(guestsTrigger);

        // Bump adults 2 -> 3, then back 3 -> 2: the user deliberately lands on 2.
        await user.click(screen.getByRole('button', { name: /more adults/i }));
        await user.click(screen.getByRole('button', { name: /fewer adults/i }));

        // The chosen value must remain visible; it must NOT collapse back to the
        // placeholder just because it equals the default (the original bug).
        expect(guestsTrigger).toHaveTextContent('2 adultos, 0 niños');
        expect(guestsTrigger).not.toHaveTextContent('¿Cuántas personas son?');
    });
});

// ---------------------------------------------------------------------------
// Regression: BETA-24 — type panel pops the mobile keyboard, overlapping the
// option list. Autofocus must only run on desktop popover sizes (>900px).
// ---------------------------------------------------------------------------

describe('<SearchBar /> type panel autofocus (BETA-24 regression)', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('autofocuses the type search input on desktop popover sizes', async () => {
        // Default matchMedia mock reports matches:false -> desktop popover.
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /tipo/i }));

        const input = screen.getByRole('textbox', { name: /buscar entre los tipos/i });
        await waitFor(() => expect(input).toHaveFocus());
    });

    it('does NOT autofocus the type search input on mobile bottom-sheet sizes', async () => {
        // Force mobile: the (max-width: 900px) media query matches.
        vi.spyOn(window, 'matchMedia').mockImplementation(
            (query: string) =>
                ({
                    matches: query.includes('900px'),
                    media: query,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => false
                }) as MediaQueryList
        );

        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /tipo/i }));

        const input = screen.getByRole('textbox', { name: /buscar entre los tipos/i });
        expect(input).not.toHaveFocus();
    });
});
