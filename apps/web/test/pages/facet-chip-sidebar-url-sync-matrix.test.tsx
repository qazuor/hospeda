/**
 * @file facet-chip-sidebar-url-sync-matrix.test.tsx
 * @description HOS-96 T-024 — US-5 consolidated proof, across all three
 * OR-facets (accommodation `types`, event `categories`, blog `categories`),
 * that the chip row and the `FilterSidebar` island ALWAYS agree, derived
 * SOLELY from the URL query param — there is no in-memory shared store.
 *
 * Proof strategy per facet:
 * 1. Chip side: `readFacetActiveValues` is the exact function every listing
 *    page calls to compute each chip's `active`/`aria-current` state (see
 *    `alojamientos|eventos|publicaciones/index.astro` — the chip anchor
 *    itself carries `aria-current`, NOT `aria-pressed`, which is only valid
 *    ARIA on `role="button"`, not an `<a href>`; a HOS-96 T-009 `ariaPressed`
 *    prop was removed after the CI a11y sweep flagged the violation). Calling
 *    `readFacetActiveValues` directly with a crafted `URLSearchParams` IS the
 *    chip-active computation. The sidebar's own `aria-pressed` assertions
 *    below (on `FilterGroupContent`'s real `<button>` checkboxes) are
 *    unrelated and correct as-is — `aria-pressed` IS valid ARIA on a button.
 * 2. Sidebar side: mounting a REAL `FilterSidebar` (via
 *    `@testing-library/react`, the same render pattern used for HOS-96
 *    T-014/T-015) with `initialParams` built the same way the page builds
 *    them (from a FRESH parse of the crafted URL, not a shared reference)
 *    proves the sidebar checkboxes independently reflect the identical URL.
 * 3. Because both computations are re-derived from the SAME crafted
 *    `URLSearchParams` object independently (no shared JS singleton, no
 *    module-level mutable state), a "navigate directly to a crafted 3-value
 *    URL with no prior interaction" scenario is exactly what each test below
 *    already does — there is nothing else that could seed either surface.
 * 4. Accommodations already had `types` as the sidebar's array paramKey (the
 *    T-001 blueprint) — no HOS-96 rename needed there, unlike events/blog
 *    (T-014/T-015). All three now use identical `paramKey`s end-to-end.
 */

import { AccommodationTypeEnum, EventCategoryEnum, PostCategoryEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import { FilterSidebar } from '@/components/shared/filters/FilterSidebar.client';
import { buildParamsFromState, filterReducer } from '@/components/shared/filters/filter-reducer';
import { buildAccommodationsFilterGroups } from '@/lib/filters/accommodations-filter-groups';
import { buildEventsFilterGroups } from '@/lib/filters/events-filter-groups';
import { readFacetActiveValues } from '@/lib/filters/read-facet-active-values';

// ---------------------------------------------------------------------------
// Browser API mocks (jsdom does not implement matchMedia)
// ---------------------------------------------------------------------------

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })
    });
});

// ---------------------------------------------------------------------------
// Module mocks (mirrors test/components/FilterSidebar.test.tsx)
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/cn', () => ({
    cn: (...classes: (string | undefined | false | null)[]) => classes.filter(Boolean).join(' ')
}));

vi.mock('@/components/shared/filters/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/FilterGroupContent.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/ToggleFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/StepperFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/StarsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/DualRangeFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/SelectSearchFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/filter-types/IconChipsFilter.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/FilterGroup.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/MobileDrawer.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/SortPopover.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));
vi.mock('@/components/shared/filters/components/SectionHeader.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

const stubT = (_key: string, fallback?: string) => fallback ?? _key;

/** Blog's `categories` checkbox group — inline in publicaciones/index.astro, no exported builder (T-015). */
const blogCategoriesGroup: FilterGroup = {
    id: 'categories',
    label: 'Categoría',
    type: 'checkbox',
    options: [
        { value: 'CULTURE', label: 'Cultura' },
        { value: 'GASTRONOMY', label: 'Gastronomía' },
        { value: 'NATURE', label: 'Naturaleza' }
    ]
};

interface FacetMatrixCase {
    readonly name: string;
    readonly paramKey: string;
    readonly getGroups: () => readonly FilterGroup[];
    readonly labels: Readonly<Record<string, string>>;
}

const ACCOMMODATION_TYPES_GROUP = buildAccommodationsFilterGroups({
    t: stubT,
    destinations: [],
    amenities: [],
    features: []
}).find((g) => g.id === 'types');

const EVENT_CATEGORIES_GROUP = buildEventsFilterGroups({ t: stubT, destinations: [] }).find(
    (g) => g.id === 'categories'
);

if (!ACCOMMODATION_TYPES_GROUP) throw new Error('accommodationsFilterGroups: types group missing');
if (!EVENT_CATEGORIES_GROUP) throw new Error('eventsFilterGroups: categories group missing');

const FACETS: readonly FacetMatrixCase[] = [
    {
        // `getAccommodationTypeLabel` falls back to the raw enum value itself
        // when no real i18n dictionary is mocked (see `colors.ts`:
        // `t(\`common.enums.accommodationType.\${normalizedType}\`, type)`) —
        // the stub `t` used here returns that fallback verbatim, so the
        // rendered accessible name IS the enum value (e.g. "HOTEL"), unlike
        // events/blog whose fallback strings are already-localized literals
        // baked into their config (e.g. `t('events.categories.music', 'Música')`).
        name: 'accommodations (types)',
        paramKey: 'types',
        getGroups: () => [ACCOMMODATION_TYPES_GROUP as FilterGroup],
        labels: { HOTEL: 'HOTEL', CABIN: 'CABIN', APARTMENT: 'APARTMENT' }
    },
    {
        name: 'events (categories)',
        paramKey: 'categories',
        getGroups: () => [EVENT_CATEGORIES_GROUP as FilterGroup],
        labels: { MUSIC: 'Música', CULTURE: 'Cultura', SPORTS: 'Deportes' }
    },
    {
        name: 'blog (categories)',
        paramKey: 'categories',
        getGroups: () => [blogCategoriesGroup],
        labels: { CULTURE: 'Cultura', GASTRONOMY: 'Gastronomía', NATURE: 'Naturaleza' }
    }
];

describe.each(FACETS)('chip/sidebar/URL sync — $name (HOS-96 T-024, US-5)', ({
    paramKey,
    getGroups,
    labels
}) => {
    const [valueA, valueB, valueC] = Object.keys(labels) as [string, string, string];

    it('given a crafted 2-value URL, the chip-active computation AND the freshly-mounted sidebar checkboxes both read the SAME two values as active/checked, and the third as inactive — no prior interaction required', () => {
        // Arrange — a fresh URL, as if the user navigated here directly.
        const searchParams = new URLSearchParams(`${paramKey}=${valueA},${valueB}`);

        // Act (chip side) — the exact call every listing page makes.
        const activeValues = readFacetActiveValues({ searchParams, paramKey });

        // Act (sidebar side) — fresh initialParams built straight from this
        // SAME URL (mirrors how each page derives sidebarInitialParams),
        // mounted as a brand-new FilterSidebar instance.
        render(
            <FilterSidebar
                locale="es"
                filters={getGroups()}
                initialParams={{ [paramKey]: searchParams.get(paramKey) ?? '' }}
            />
        );

        // Assert — chip logic
        expect(activeValues.includes(valueA)).toBe(true);
        expect(activeValues.includes(valueB)).toBe(true);
        expect(activeValues.includes(valueC)).toBe(false);

        // Assert — sidebar checkboxes (rendered as buttons with aria-pressed
        // for the `checkbox` FilterGroup type — see FilterGroupContent.tsx)
        const btnA = screen.getAllByRole('button', { name: labels[valueA] })[0];
        const btnB = screen.getAllByRole('button', { name: labels[valueB] })[0];
        const btnC = screen.getAllByRole('button', { name: labels[valueC] })[0];
        expect(btnA).toHaveAttribute('aria-pressed', 'true');
        expect(btnB).toHaveAttribute('aria-pressed', 'true');
        expect(btnC).toHaveAttribute('aria-pressed', 'false');
    });

    it('given zero active values, neither the chip logic nor the sidebar reads anything as active', () => {
        const searchParams = new URLSearchParams('');
        const activeValues = readFacetActiveValues({ searchParams, paramKey });

        render(
            <FilterSidebar
                locale="es"
                filters={getGroups()}
                initialParams={{}}
            />
        );

        expect(activeValues).toEqual([]);
        const btnA = screen.getAllByRole('button', { name: labels[valueA] })[0];
        expect(btnA).toHaveAttribute('aria-pressed', 'false');
    });

    it('navigating directly to a crafted 3-value URL alone reproduces the full selection in both the chip logic and a brand-new sidebar mount (URL is the single source of truth — no in-memory store)', () => {
        const searchParams = new URLSearchParams(`${paramKey}=${valueA},${valueB},${valueC}`);
        const activeValues = readFacetActiveValues({ searchParams, paramKey });

        render(
            <FilterSidebar
                locale="es"
                filters={getGroups()}
                initialParams={{ [paramKey]: searchParams.get(paramKey) ?? '' }}
            />
        );

        for (const value of [valueA, valueB, valueC]) {
            expect(activeValues.includes(value)).toBe(true);
            const btn = screen.getAllByRole('button', { name: labels[value] })[0];
            expect(btn).toHaveAttribute('aria-pressed', 'true');
        }
    });
});

describe('events/blog sidebar writes multiple selections under "categories", never "category" (HOS-96 T-024 point 2)', () => {
    it('events: checking two category boxes and reading the resulting params never produces the old singular key', () => {
        const withOne = filterReducer(
            {
                selections: {},
                ranges: {},
                steppers: {},
                toggles: {},
                dates: {},
                geo: {},
                search: '',
                sort: ''
            },
            { type: 'TOGGLE_CHECKBOX', groupId: 'categories', value: 'MUSIC' }
        );
        const withTwo = filterReducer(withOne, {
            type: 'TOGGLE_CHECKBOX',
            groupId: 'categories',
            value: 'CULTURE'
        });
        const params = buildParamsFromState({
            state: withTwo,
            filters: [EVENT_CATEGORIES_GROUP as FilterGroup]
        });
        expect(params.get('categories')).toBe('MUSIC,CULTURE');
        expect(params.has('category')).toBe(false);
    });

    it('blog: checking two category boxes and reading the resulting params never produces the old singular key', () => {
        const withOne = filterReducer(
            {
                selections: {},
                ranges: {},
                steppers: {},
                toggles: {},
                dates: {},
                geo: {},
                search: '',
                sort: ''
            },
            { type: 'TOGGLE_CHECKBOX', groupId: 'categories', value: 'CULTURE' }
        );
        const withTwo = filterReducer(withOne, {
            type: 'TOGGLE_CHECKBOX',
            groupId: 'categories',
            value: 'GASTRONOMY'
        });
        const params = buildParamsFromState({ state: withTwo, filters: [blogCategoriesGroup] });
        expect(params.get('categories')).toBe('CULTURE,GASTRONOMY');
        expect(params.has('category')).toBe(false);
    });
});

describe('sanity: the three facets really do use the canonical enums (no test-fixture drift)', () => {
    it('accommodation types fixture values are real AccommodationTypeEnum members', () => {
        expect(Object.values(AccommodationTypeEnum)).toEqual(
            expect.arrayContaining(['HOTEL', 'CABIN', 'APARTMENT'])
        );
    });

    it('event categories fixture values are real EventCategoryEnum members', () => {
        expect(Object.values(EventCategoryEnum)).toEqual(
            expect.arrayContaining(['MUSIC', 'CULTURE', 'SPORTS'])
        );
    });

    it('blog categories fixture values are real PostCategoryEnum members', () => {
        expect(Object.values(PostCategoryEnum)).toEqual(
            expect.arrayContaining(['CULTURE', 'GASTRONOMY', 'NATURE'])
        );
    });
});
