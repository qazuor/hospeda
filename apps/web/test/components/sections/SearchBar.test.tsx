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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSearchUrl, SearchBar } from '../../../src/components/sections/SearchBar.client';
// The very selector list the component's trap runs on. Deriving the test's
// notion of "the focus ring" from anything narrower (the old
// `button:not([disabled])`) means the trap tests cover a ring the trap does not
// actually use — the destination/type sheets also hold a text input.
import { FOCUSABLE_SELECTORS } from '../../../src/lib/focus-trap';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Mock i18n to avoid the full `@repo/i18n` catalog in JSDOM: `tFromCatalog`
 * reads only the `es` namespace a key names. It resolves against the real
 * catalog, so the visible text still matches the Spanish a user sees — the
 * previous stub matched it only because the copy was duplicated inline, which
 * HOS-616 removed.
 */
vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    const t = tFromCatalog;
    const tPlural = (key: string, count: number, params?: Record<string, unknown>) => {
        if (key === 'home.searchBar.guestsAdultsCount')
            return `${count} adulto${count === 1 ? '' : 's'}`;
        if (key === 'home.searchBar.guestsChildrenCount')
            return `${count} niño${count === 1 ? '' : 's'}`;
        return t(key, undefined, { ...params, count });
    };
    return {
        createTranslations: (_locale: string) => ({ t, tPlural })
    };
});

/**
 * Capture analytics calls so the submit flow can assert the payload shape.
 * A hoisted spy lets the regression test below verify that
 * `accommodation_types` is serialized as a plain array (not a JS Set, which
 * PostHog would drop as `{}`).
 */
const { trackEventSpy } = vi.hoisted(() => ({ trackEventSpy: vi.fn() }));
vi.mock('../../../src/lib/analytics/posthog-client', () => ({
    trackEvent: trackEventSpy
}));

const BASE = '/es/alojamientos/';

const DEFAULTS = {
    baseUrl: BASE,
    destinationId: null,
    types: new Set<never>(),
    adults: 2,
    children: 0,
    guestsTouched: false
} as const;

describe('buildSearchUrl', () => {
    it('omits adults at default state when the guests stepper was not touched (BETA-161)', () => {
        // An untouched hero search must not silently narrow the listing via
        // `minGuests` — adults is suppressed entirely when guestsTouched=false.
        const url = buildSearchUrl({ ...DEFAULTS });
        expect(url).toBe(BASE);
    });

    it('emits adults when the guests stepper was touched, even at the default value', () => {
        const url = buildSearchUrl({ ...DEFAULTS, guestsTouched: true });
        expect(url).toBe(`${BASE}?adults=2`);
    });

    it('emits destinationIds when a destination is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            destinationId: '11111111-2222-3333-4444-555555555555'
        });
        expect(url).toContain('destinationIds=11111111-2222-3333-4444-555555555555');
    });

    it('emits types as comma-separated, in canonical order, when a strict subset is selected', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(['HOTEL', 'CABIN']) as ReadonlySet<'HOTEL' | 'CABIN'>
        });
        // HOS-524: sorted, not checkbox order — the hero search bar is one of
        // four writers of `?types=` and they must all mint the SAME URL for
        // the same selection.
        expect(url).toContain('types=CABIN%2CHOTEL');
    });

    it('emits the SAME url regardless of the order the types were checked (HOS-524)', () => {
        const a = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(['HOTEL', 'CABIN']) as ReadonlySet<'HOTEL' | 'CABIN'>
        });
        const b = buildSearchUrl({
            ...DEFAULTS,
            types: new Set(['CABIN', 'HOTEL']) as ReadonlySet<'HOTEL' | 'CABIN'>
        });
        expect(a).toBe(b);
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

    it('emits adults only when guestsTouched is true, regardless of the listing sidebar value (BETA-161)', () => {
        // Untouched: adults is fully suppressed, no matter its numeric value.
        const untouched = buildSearchUrl({ ...DEFAULTS, adults: 2, children: 0 });
        expect(untouched).not.toContain('adults=');
        // Touched: adults is emitted so the listing sidebar shows the same
        // number the user deliberately set in the hero.
        const touched = buildSearchUrl({
            ...DEFAULTS,
            adults: 2,
            children: 0,
            guestsTouched: true
        });
        expect(touched).toContain('adults=2');
        // Children stays out when 0 (its natural absence; sidebar default is 0 too).
        expect(touched).not.toContain('children=');
    });

    it('emits children only when greater than 0', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            adults: 4,
            children: 2,
            guestsTouched: true
        });
        expect(url).toContain('adults=4');
        expect(url).toContain('children=2');
    });

    it('still suppresses children when the user did not touch it', () => {
        const url = buildSearchUrl({
            ...DEFAULTS,
            adults: 5,
            children: 0,
            guestsTouched: true
        });
        expect(url).toContain('adults=5');
        expect(url).not.toContain('children=');
    });

    it('omits adults when only children was touched (adults untouched)', () => {
        // Regression for BETA-161 round 2: the hero used a single combined
        // `guestsTouched` flag shared by both steppers, so touching only
        // children leaked the untouched `adults` default (2) into the URL as
        // an unasserted filter. `guestsTouched` gates solely on the adults
        // stepper's own touched state (`adultsTouched`), independent of
        // `childrenTouched`.
        const url = buildSearchUrl({ ...DEFAULTS, children: 1, guestsTouched: false });
        expect(url).not.toContain('adults=');
        expect(url).toContain('children=1');
    });

    it('combines every param when all are set', () => {
        const url = buildSearchUrl({
            baseUrl: BASE,
            destinationId: 'dest-1',
            types: new Set(['HOTEL']) as ReadonlySet<'HOTEL'>,
            checkIn: new Date(2026, 0, 15),
            checkOut: new Date(2026, 0, 20),
            adults: 3,
            children: 1,
            guestsTouched: true
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

// ---------------------------------------------------------------------------
// Controllable viewport mock
// ---------------------------------------------------------------------------

/**
 * Handle returned by {@link installViewportMock} so a test can drive the
 * breakpoint at runtime.
 */
interface ViewportController {
    /**
     * Flips `matches` on the bottom-sheet media query and fires every
     * registered `change` listener, wrapped in `act()` so React state settles.
     */
    setMatches(next: boolean): void;
    /** How many `change` listeners are currently registered (leak detection). */
    readonly listenerCount: number;
}

/**
 * Installs a `matchMedia` stub for `(max-width: 900px)` that can actually EMIT
 * `change` events.
 *
 * The previous stub hard-coded `addEventListener`/`removeEventListener` as
 * no-ops, which made the whole resize path structurally untestable: the
 * listener registered by `useIsMobileSheet`, its cleanup, and every breakpoint
 * transition were invisible to the suite — exactly where the scroll-lock
 * split-brain and the Fragment↔Portal remount live.
 */
function installViewportMock(initialIsSheet: boolean): ViewportController {
    let isSheet = initialIsSheet;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
        // Only the bottom-sheet query is driven by this controller; anything
        // else (e.g. prefers-reduced-motion) keeps reporting "no match".
        const tracksSheetQuery = query.includes('900px');
        return {
            get matches() {
                return tracksSheetQuery ? isSheet : false;
            },
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: (
                _type: string,
                listener: (event: MediaQueryListEvent) => void
            ): void => {
                if (tracksSheetQuery) listeners.add(listener);
            },
            removeEventListener: (
                _type: string,
                listener: (event: MediaQueryListEvent) => void
            ): void => {
                listeners.delete(listener);
            },
            dispatchEvent: () => false
        } as unknown as MediaQueryList;
    });

    return {
        setMatches(next: boolean): void {
            isSheet = next;
            act(() => {
                for (const listener of [...listeners]) {
                    listener({
                        matches: next,
                        media: '(max-width: 900px)'
                    } as MediaQueryListEvent);
                }
            });
        },
        get listenerCount(): number {
            return listeners.size;
        }
    };
}

/** Force `matchMedia('(max-width: 900px)')` to report a bottom-sheet viewport. */
function mockMobileViewport(): ViewportController {
    return installViewportMock(true);
}

/** Force `matchMedia('(max-width: 900px)')` to report a desktop viewport. */
function mockDesktopViewport(): ViewportController {
    return installViewportMock(false);
}

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
        // The guests stepper was never touched, so guestsTouched is false and
        // adults is suppressed (BETA-161).
        const expected = buildSearchUrl({
            baseUrl: SEARCH_BASE,
            destinationId: 'dest-colon',
            types: new Set(),
            adults: 2,
            children: 0,
            guestsTouched: false
        });
        expect(navigatedTo).toBe(expected);
        expect(navigatedTo).toContain('destinationIds=dest-colon');
        // No dates, no adults (untouched), no children, types omitted.
        expect(navigatedTo).not.toContain('checkIn=');
        expect(navigatedTo).not.toContain('checkOut=');
        expect(navigatedTo).not.toContain('adults=');
        expect(navigatedTo).not.toContain('children=');
        expect(navigatedTo).not.toContain('types=');
    });

    it('sends a plain serializable analytics payload on submit (no Set values)', async () => {
        const user = userEvent.setup();
        trackEventSpy.mockClear();

        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /^buscar$/i }));

        expect(trackEventSpy).toHaveBeenCalledTimes(1);
        const [, payload] = trackEventSpy.mock.calls[0] as [string, Record<string, unknown>];
        expect(Object.values(payload).some((value) => value instanceof Set)).toBe(false);
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
        await user.click(screen.getByRole('button', { name: /más adultos/i }));
        await user.click(screen.getByRole('button', { name: /menos adultos/i }));

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
        // Force mobile: the (max-width: 900px) media query matches. Shares the
        // single controllable helper — the old byte-identical inline copy was
        // pure duplication.
        mockMobileViewport();

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

// ---------------------------------------------------------------------------
// Regression: HOS-323 — the guests stepper is unusable on mobile because the
// bottom-sheet panel is trapped inside the hero's stacking context.
//
// `.panel` is `position: fixed; z-index: 100` on mobile, yet later sections
// paint on top of it. The base hero layering is NOT the culprit:
// `.hero__container` is `position: relative; z-index: 15` at every width, which
// beats the `.section__container { z-index: 10 }` of the sections below.
//
// The enabler is `@media (max-width: 640px)`, which sets
// `.hero__container { position: static }` (so the rotating hero photo can
// anchor to `.hero`). That dissolves the protective z-15 stacking context and
// leaves a CHAIN of nested contexts below it: `.hero__bottom { position:
// relative; z-index: 2 }` (same media query) > `.hero__search-wrapper
// { position: relative; z-index: 20 }` (a base rule, never reset at any
// breakpoint, and therefore the innermost positioned ancestor) > `.searchBar` >
// `.panel { z-index: 100 }`. The panel's 100 resolves inside the wrapper's 20,
// which resolves inside `.hero__bottom`'s 2 — and it is that 2 which loses to
// the level-10 sections. Tapping `+` hits the section painted on top, which
// fires the click-outside handler and closes the panel without applying the
// change.
//
// The only fix that escapes an ancestor stacking context is moving the node out
// of it, so the sheet (and its backdrop) are portaled to `document.body` — at
// every bottom-sheet size (0–900px), not just the 640px burial window, so the
// JS gate stays bound to the CSS media query it mirrors. The desktop popover is
// positioned `absolute` relative to the bar and would fly off if reparented,
// so it is deliberately left in place.
// ---------------------------------------------------------------------------

describe('<SearchBar /> mobile panel portal (HOS-323 regression)', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the guests sheet outside the search bar subtree on mobile', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        const bar = screen.getByRole('search');
        // Anything still inside the bar inherits every ancestor stacking
        // context the hero establishes, which is exactly what buries the sheet.
        expect(bar.contains(panel)).toBe(false);
        // `document.body.contains(panel)` would be vacuous here: RTL appends
        // its own container to <body>, so it holds for ANY rendered element
        // even with the portal deleted. The real contract is that the panel is
        // a DIRECT child of <body>, which only createPortal can produce.
        expect(panel.parentElement).toBe(document.body);
    });

    it('renders the mobile backdrop outside the search bar subtree too', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        // Two controls carry the "close panel" label: the sheet's own X button
        // and the backdrop. The backdrop is the one outside the dialog.
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        const backdrop = screen
            .getAllByRole('button', { name: /cerrar panel/i })
            .find((el) => !panel.contains(el));
        const bar = screen.getByRole('search');
        expect(backdrop).toBeDefined();
        // The backdrop is a sibling dim layer at z-index 95. Left behind in the
        // hero context it would paint *under* the sections it is meant to dim,
        // so it has to travel with the sheet.
        expect(bar.contains(backdrop as HTMLElement)).toBe(false);
    });

    it('keeps the sheet open when the stepper inside the portal is used', async () => {
        // Guard for the defect this fix could introduce: `handleClickOutside`
        // tests containment against the bar's ref, and a portaled panel is no
        // longer a descendant of it. Without an explicit panel check, the very
        // first tap on `+` would read as "outside" and close the sheet — the
        // exact symptom HOS-323 reports, reproduced by the fix itself.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        await user.click(trigger);
        await user.click(screen.getByRole('button', { name: /más adultos/i }));

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('dialog', { name: 'Huéspedes' })).toBeInTheDocument();
        expect(trigger).toHaveTextContent('3 adultos, 0 niños');
    });

    it.each([
        { panel: 'destination', trigger: /destino/i },
        { panel: 'type', trigger: /tipo/i },
        { panel: 'dates', trigger: /fechas/i },
        { panel: 'guests', trigger: /huéspedes/i }
    ])('portals the $panel sheet and keeps it open on a tap inside', async ({ trigger }) => {
        // All four panels become bottom-sheets on mobile, so all four are
        // buried by the hero stacking context and all four must carry the
        // marker the click-outside handler looks for. Asserting only on guests
        // would leave three panels relying on an attribute nothing checks.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const triggerEl = screen.getByRole('button', { name: trigger });
        await user.click(triggerEl);

        const panel = document.querySelector('[data-search-panel]');
        expect(panel).not.toBeNull();
        expect(screen.getByRole('search').contains(panel)).toBe(false);

        fireEvent.mouseDown(panel as Element);
        expect(triggerEl).toHaveAttribute('aria-expanded', 'true');
    });

    it('still closes the sheet when the click lands outside it', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        await user.click(trigger);
        expect(screen.getByRole('dialog', { name: 'Huéspedes' })).toBeInTheDocument();

        // A tap on unrelated page content must still dismiss the sheet — the
        // panel check must not degrade into "never close".
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        await user.click(outside);

        expect(screen.queryByRole('dialog', { name: 'Huéspedes' })).toBeNull();
        outside.remove();
    });

    it('keeps the desktop popover anchored inside the bar', async () => {
        // Default matchMedia mock reports matches:false -> desktop popover,
        // which is `position: absolute` against `.searchBar`. Reparenting it
        // would detach it from its containing block and drop it at the top of
        // the document.
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        expect(screen.getByRole('search').contains(panel)).toBe(true);
        expect(panel.parentElement).not.toBe(document.body);
    });
});

// ---------------------------------------------------------------------------
// Breakpoint transitions — the resize path the no-op matchMedia stub hid.
//
// The scroll lock and the autofocus guard used to call `window.matchMedia`
// imperatively inside effects keyed only on `[activePanel]`, while the portal
// gate read a reactive hook. Split brain: rotating a tablet from portrait to
// landscape while a panel was open turned the sheet into a popover but never
// re-ran the lock effect, leaving <html> stuck at `overflow: hidden` behind a
// small dropdown (and the mirror case opened a sheet with no lock at all).
// ---------------------------------------------------------------------------

describe('<SearchBar /> breakpoint transitions', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('releases the <html> scroll lock when the viewport grows past the sheet breakpoint', async () => {
        const viewport = mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        expect(document.documentElement.style.overflow).toBe('hidden');

        // Rotate to landscape / resize past 900px with the panel still open.
        viewport.setMatches(false);

        expect(document.documentElement.style.overflow).not.toBe('hidden');
    });

    it('applies the <html> scroll lock when the viewport shrinks into sheet mode', async () => {
        const viewport = mockDesktopViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        expect(document.documentElement.style.overflow).not.toBe('hidden');

        viewport.setMatches(true);

        expect(document.documentElement.style.overflow).toBe('hidden');
    });

    it('starts autofocusing the panel search input once the viewport leaves sheet mode', async () => {
        // The BETA-24 guard (no autofocus on a sheet, or the virtual keyboard
        // covers the option list) must follow the LIVE breakpoint too. Read
        // imperatively inside an effect keyed on [activePanel], it froze
        // whatever the viewport was when the panel opened.
        const viewport = mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /destino/i }));
        expect(
            screen.getByRole('textbox', { name: /buscar entre los destinos/i })
        ).not.toHaveFocus();

        viewport.setMatches(false);

        // The panel is now a desktop popover, so the input takes focus.
        await waitFor(() =>
            expect(
                screen.getByRole('textbox', { name: /buscar entre los destinos/i })
            ).toHaveFocus()
        );
    });

    it('removes the media-query change listener on unmount (no leak)', () => {
        const viewport = mockDesktopViewport();
        const { unmount } = render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        expect(viewport.listenerCount).toBeGreaterThan(0);

        unmount();

        expect(viewport.listenerCount).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Sheet dismissal + the <html> flag, while the panel lives in the portal.
// ---------------------------------------------------------------------------

describe('<SearchBar /> portaled sheet dismissal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('closes the portaled sheet on Escape', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        expect(screen.getByRole('dialog', { name: 'Huéspedes' })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        expect(screen.queryByRole('dialog', { name: 'Huéspedes' })).toBeNull();
    });

    it('closes the portaled sheet when the backdrop is clicked', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        // Two controls carry the "close panel" label: the sheet's X button and
        // the backdrop. The backdrop is the one outside the dialog.
        const backdrop = screen
            .getAllByRole('button', { name: /cerrar panel/i })
            .find((el) => !panel.contains(el)) as HTMLElement;
        expect(backdrop).toBeDefined();

        // `fireEvent.click` (not `user.click`) on purpose: a full user click
        // also dispatches mousedown, which the document-level click-outside
        // handler would catch — so the sheet would close even with the
        // backdrop's own onClick deleted. Firing only `click` isolates the
        // backdrop handler as the sole thing under test.
        fireEvent.click(backdrop);

        expect(screen.queryByRole('dialog', { name: 'Huéspedes' })).toBeNull();
    });

    it('flags <html data-search-panel-open> while a sheet is open and clears it on close', async () => {
        // Real contract, not decoration: `feedback-overrides.css` hides the
        // feedback FAB off this attribute so it cannot overlap the sheet.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        expect(document.documentElement.hasAttribute('data-search-panel-open')).toBe(false);

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        expect(document.documentElement.hasAttribute('data-search-panel-open')).toBe(true);

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
        expect(document.documentElement.hasAttribute('data-search-panel-open')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Focus management — bottom-sheet ONLY.
//
// The portal moves the panel to the end of <body>, so without focus management
// a keyboard user tabs through the whole page (visually covered by the
// backdrop) before reaching the sheet's controls, and a screen reader gets an
// orphan role="dialog" outside the role="search" landmark (WCAG 2.4.3 / 1.3.2).
// Desktop must NOT get any of this: there the panel is a popover with no
// backdrop and the rest of the page stays usable, so trapping focus would be a
// new bug.
// ---------------------------------------------------------------------------

/** Collects the panel's focus ring in DOM order, exactly as `trapFocus` does. */
function focusablesOf(panel: HTMLElement): readonly HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

/**
 * Dispatches a REAL cancelable Tab keydown on `document` and returns it so the
 * caller can read `defaultPrevented`.
 *
 * `fireEvent.keyDown` + "did `document.activeElement` change" is not a valid
 * trap assertion: jsdom never moves focus on Tab, so a trap that silently lets
 * the key through looks identical to one that blocked it. `defaultPrevented`
 * is true only if the handler really called `preventDefault()`, which is the
 * single thing standing between the user and the page behind the backdrop.
 */
function dispatchTab(options: { readonly shiftKey?: boolean } = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        shiftKey: options.shiftKey ?? false,
        bubbles: true,
        cancelable: true
    });
    document.dispatchEvent(event);
    return event;
}

/**
 * Applies the HTML spec's "unfocusing steps" that a browser runs when the
 * currently focused element becomes `disabled`, leaving
 * `document.activeElement` on `<body>`.
 *
 * jsdom implements neither half of that: it does not blur on disable, AND its
 * `blur()` short-circuits on an element that is no longer a focusable area —
 * so the disabled node stays parked as `activeElement` forever, a state no
 * browser produces. Clearing the flag for the duration of the `blur()` call is
 * the narrowest way to get jsdom to the end state a browser reaches on its
 * own; the DOM is byte-identical afterwards.
 */
function runUnfocusingSteps(element: HTMLElement): void {
    const button = element as HTMLButtonElement;
    const wasDisabled = button.disabled;
    button.disabled = false;
    button.blur();
    button.disabled = wasDisabled;
}

describe('<SearchBar /> sheet focus management', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { assign: vi.fn(), href: 'http://localhost/', pathname: '/', search: '' }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('moves focus onto the sheet close button when a sheet opens', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        const [closeButton] = focusablesOf(panel);
        await waitFor(() => expect(closeButton).toHaveFocus());
    });

    it('does NOT steal focus into the destination panel search input on a sheet (BETA-24)', async () => {
        // The focus target must stay the close button: focusing a text input
        // inside a bottom-sheet pops the virtual keyboard over the option list.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /destino/i }));

        const input = screen.getByRole('textbox', { name: /buscar entre los destinos/i });
        expect(input).not.toHaveFocus();
    });

    it('traps Tab and Shift+Tab inside the open sheet', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        const focusables = focusablesOf(panel);
        expect(focusables.length).toBeGreaterThan(1);
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        // Tab off the last focusable wraps back to the first.
        last.focus();
        const forward = dispatchTab();
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(first);

        // Shift+Tab off the first wraps to the last.
        first.focus();
        const backward = dispatchTab({ shiftKey: true });
        expect(backward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(last);
    });

    it('counts the destination sheet’s search input as part of the trapped ring', async () => {
        // The helper above used to enumerate only `button:not([disabled])`,
        // narrower than the `FOCUSABLE_SELECTORS` the trap actually runs on —
        // so every trap assertion in this file was made against a ring the
        // component does not use. The destination/type sheets hold a text
        // input, which is exactly the element that divergence hid.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /destino/i }));

        const panel = document.querySelector('[data-search-panel]') as HTMLElement;
        const input = screen.getByRole('textbox', { name: /buscar entre los destinos/i });
        const ring = focusablesOf(panel);
        expect(ring).toContain(input);

        // And the trap really wraps around that full ring.
        const last = ring[ring.length - 1] as HTMLElement;
        last.focus();
        const event = dispatchTab();
        expect(event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(ring[0]);
    });

    it('prevents Tab and pulls focus back in when focus has escaped to <body>', async () => {
        // The trap only ever cycled on `first`/`last`. From anywhere else —
        // above all `<body>` — Tab was NOT prevented and the browser advanced
        // to the first focusable in the DOCUMENT: page content sitting behind
        // an opaque backdrop (WCAG 2.4.3). `<body>` is not an exotic state; see
        // the two tests below for the routes users take to reach it.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

        (document.activeElement as HTMLElement).blur();
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(panel.contains(document.activeElement)).toBe(true);
        expect(document.activeElement).toBe(focusablesOf(panel)[0]);
    });

    it('prevents Tab after the focused stepper button disables itself at its bound', async () => {
        // Route 1 to `<body>`: click children `+` until it hits the maximum and
        // React re-renders it `disabled`. Per the HTML spec the browser then
        // runs the unfocusing steps on it and `document.activeElement` becomes
        // `<body>` — a state the old trap left completely unguarded.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });

        const moreChildren = screen.getByRole('button', { name: /más niños/i });
        for (let index = 0; index < 6; index += 1) {
            await user.click(moreChildren);
        }
        // The precondition is real and unsimulated: the button the user was
        // pressing is now disabled and out of the focus ring.
        expect(moreChildren).toBeDisabled();
        expect(focusablesOf(panel)).not.toContain(moreChildren);

        // jsdom leaves `activeElement` parked on the now-disabled node, so the
        // browser's half of the sequence is applied explicitly. Without it this
        // test would assert a DOM state no real browser ever produces.
        expect(document.activeElement).toBe(moreChildren);
        runUnfocusingSteps(moreChildren);
        expect(document.activeElement).toBe(document.body);

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(panel.contains(document.activeElement)).toBe(true);
    });

    it('prevents Tab after a tap on the sheet’s own non-focusable background', async () => {
        // Route 2 to `<body>`, fully real this time: the panel root has no
        // `tabindex`, so clicking it moves focus to `<body>` rather than to any
        // focusable ancestor.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });

        await user.click(panel);
        expect(document.activeElement).toBe(document.body);
        // The sheet must still be open — the tap landed inside it.
        expect(screen.getByRole('dialog', { name: 'Huéspedes' })).toBeInTheDocument();

        const event = dispatchTab();

        expect(event.defaultPrevented).toBe(true);
        expect(panel.contains(document.activeElement)).toBe(true);
    });

    it('restores focus to the trigger column that opened the sheet', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        await user.click(trigger);
        expect(trigger).not.toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('restores focus to the trigger when the DESKTOP popover that stole it closes', async () => {
        // The restore used to be gated on `isMobileSheet`, justified by "the
        // desktop popover never stole focus in the first place". That premise
        // was false: the BETA-24 autofocus effect puts the caret in the
        // destination search input precisely when NOT in sheet mode. So Tab to
        // Destino → Enter → Escape unmounted the focused input, left
        // `activeElement` on `<body>`, and the next Tab restarted from the top
        // of the document — the same WCAG 2.4.3 class as the sheet bug, just
        // left standing on desktop.
        mockDesktopViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /destino/i });
        await user.click(trigger);

        const input = screen.getByRole('textbox', { name: /buscar entre los destinos/i });
        await waitFor(() => expect(input).toHaveFocus());

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => expect(trigger).toHaveFocus());
        expect(document.activeElement).not.toBe(document.body);
    });

    it('does NOT yank focus back to the trigger when the user already moved it elsewhere', async () => {
        // The other half of replacing the `isMobileSheet` gate with "did the
        // closing panel actually hold focus": a sheet that closes while the
        // user is typing somewhere else on the page must not steal the caret.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        await user.click(trigger);
        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

        // The user deliberately focuses unrelated page content.
        const elsewhere = document.createElement('button');
        elsewhere.type = 'button';
        elsewhere.textContent = 'unrelated page control';
        document.body.appendChild(elsewhere);
        elsewhere.focus();
        expect(elsewhere).toHaveFocus();

        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Huéspedes' })).toBeNull());
        expect(elsewhere).toHaveFocus();
        expect(trigger).not.toHaveFocus();
        elsewhere.remove();
    });

    it('marks the sheet aria-modal and wires aria-controls to the rendered panel id', async () => {
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        await user.click(trigger);

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        expect(panel).toHaveAttribute('aria-modal', 'true');
        const controls = trigger.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(panel.id).toBe(controls);
    });

    it('omits aria-controls while the panel is closed, so it never dangles', async () => {
        // `aria-controls` must reference an element that is actually in the
        // document. Panels are conditionally rendered, so pointing at their id
        // while collapsed leaves a dangling reference. `aria-haspopup` already
        // announces that the column opens something.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        const trigger = screen.getByRole('button', { name: /huéspedes/i });
        expect(trigger).not.toHaveAttribute('aria-controls');

        await user.click(trigger);
        const controls = trigger.getAttribute('aria-controls');
        expect(controls).toBeTruthy();
        expect(document.getElementById(controls as string)).not.toBeNull();

        await user.keyboard('{Escape}');
        expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it.each([
        { panel: 'destination', trigger: /destino/i, label: 'Destino' },
        { panel: 'type', trigger: /tipo/i, label: 'Tipo' }
    ])('wraps the $panel sheet in an aria-modal dialog while keeping the listbox valid', async ({
        trigger,
        label
    }) => {
        // This assertion used to be the opposite ("the sheet is a listbox
        // with no aria-modal") and that was the defect, not the contract.
        // `aria-modal` really is invalid on a listbox — but leaving these
        // two sheets with NO modality substitute meant a screen-reader
        // virtual cursor could swipe straight out of the option list into
        // content the opaque backdrop hides. The focus trap does not help:
        // it governs Tab, not the virtual cursor, and `aria-controls` is
        // not a substitute (NVDA/VoiceOver largely ignore it for
        // navigation). So the panel root becomes a real dialog and the
        // listbox role moves onto the element wrapping the options.
        mockMobileViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: trigger }));

        const sheet = document.querySelector('[data-search-panel]') as HTMLElement;
        expect(sheet).not.toBeNull();
        expect(sheet).toHaveAttribute('role', 'dialog');
        expect(sheet).toHaveAttribute('aria-modal', 'true');
        expect(sheet).toHaveAttribute('aria-label', label);

        // Still valid ARIA: `aria-modal` is NOT on the listbox itself.
        const listbox = screen.getByRole('listbox');
        expect(listbox).not.toHaveAttribute('aria-modal');
        // And the listbox still wraps the options, so the widget contract
        // (and every existing query against it) holds.
        expect(sheet.contains(listbox)).toBe(true);
        expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);

        // The modal BEHAVIOUR must still be there.
        expect(document.documentElement.style.overflow).toBe('hidden');
    });

    it.each([
        { panel: 'destination', trigger: /destino/i },
        { panel: 'type', trigger: /tipo/i }
    ])('leaves the $panel desktop popover a plain, non-modal listbox', async ({ trigger }) => {
        // The desktop popover is not modal: no backdrop, the rest of the page
        // stays usable. Announcing it as a modal dialog would be a lie, so the
        // wrapper is sheet-mode only.
        mockDesktopViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: trigger }));

        const popover = document.querySelector('[data-search-panel]') as HTMLElement;
        expect(popover).not.toBeNull();
        expect(popover).toHaveAttribute('role', 'listbox');
        expect(popover).not.toHaveAttribute('aria-modal');
        expect(screen.queryByRole('dialog')).toBeNull();

        // Exactly one listbox, and it still wraps the options.
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBe(popover);
        expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);
    });

    it('does NOT move or trap focus in desktop popover mode', async () => {
        mockDesktopViewport();
        const user = userEvent.setup();
        render(
            <SearchBar
                locale="es"
                destinations={MOCK_DESTINATIONS}
                searchBaseUrl={SEARCH_BASE}
            />
        );

        await user.click(screen.getByRole('button', { name: /huéspedes/i }));

        const panel = screen.getByRole('dialog', { name: 'Huéspedes' });
        const focusables = focusablesOf(panel);
        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        // No focus stealing: the popover leaves the page usable.
        expect(first).not.toHaveFocus();
        expect(panel).not.toHaveAttribute('aria-modal');

        // No trap: Tab off the last focusable must fall through to the rest of
        // the page instead of cycling back into the popover.
        last.focus();
        fireEvent.keyDown(last, { key: 'Tab', code: 'Tab' });
        expect(document.activeElement).toBe(last);
    });
});
