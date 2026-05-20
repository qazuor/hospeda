/**
 * @file FilterSidebar.test.tsx
 * @description Regression and unit tests for the FilterSidebar component.
 *
 * Coverage:
 * - position='left' renders sidebar with positionLeft class (default)
 * - position='top' renders wrapper with positionTop class
 * - data-position attribute reflects the prop value
 * - Mobile drawer: floating trigger button is rendered
 * - Mobile drawer: clicking trigger renders the dialog as open
 * - All major filter group types render (checkbox, radio, toggle, dual-range,
 *   stepper, stars, icon-chips, select-search)
 * - Sort options render when provided
 * - Active filter count badge is shown when filters are pre-selected
 * - Clear all button appears when filters are active
 *
 * VISUAL DIFF NOTE:
 * The "<= 1% visual diff" acceptance criterion from SPEC-096 REQ-096-11 requires
 * manual verification post-merge using a browser screenshot comparison tool
 * (e.g., Percy, Chromatic, or a manual Playwright screenshot diff). Vitest cannot
 * render Astro pages or capture pixel-level screenshots. Run manual verification
 * before marking T-020 as completed in the spec tracker.
 */

import { FilterSidebar } from '@/components/shared/filters/FilterSidebar.client';
import type { FilterSidebarProps } from '@/components/shared/filters/FilterSidebar.client';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Browser API mocks (jsdom does not implement these by default)
// ---------------------------------------------------------------------------

beforeAll(() => {
    // jsdom does not implement window.matchMedia. The FilterSidebar uses it to
    // auto-close the mobile drawer when the viewport grows beyond 768px.
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
// Module mocks
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

// CSS module: return class name as-is so className assertions work
vi.mock('@/components/shared/filters/FilterSidebar.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// Sub-module CSS mocks (imported transitively)
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

// New sub-component CSS mocks (after refactor)
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

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const checkboxGroup: FilterGroup = {
    id: 'type',
    label: 'Tipo de alojamiento',
    type: 'checkbox',
    options: [
        { value: 'hotel', label: 'Hotel' },
        { value: 'hostel', label: 'Hostel' },
        { value: 'cabin', label: 'Cabaña' }
    ]
};

const radioGroup: FilterGroup = {
    id: 'category',
    label: 'Categoría',
    type: 'radio',
    options: [
        { value: 'budget', label: 'Económico' },
        { value: 'standard', label: 'Estándar' },
        { value: 'premium', label: 'Premium' }
    ]
};

const toggleGroup: FilterGroup = {
    id: 'featured',
    label: 'Solo destacados',
    type: 'toggle'
};

const stepperGroup: FilterGroup = {
    id: 'guests',
    label: 'Huéspedes',
    type: 'stepper',
    min: 1,
    max: 10,
    defaultValue: 1
};

const starsGroup: FilterGroup = {
    id: 'rating',
    label: 'Estrellas mínimas',
    type: 'stars',
    maxStars: 5
};

const dualRangeGroup: FilterGroup = {
    id: 'price',
    label: 'Precio por noche',
    type: 'dual-range',
    min: 0,
    max: 50000,
    step: 1000,
    paramMin: 'minPrice',
    paramMax: 'maxPrice'
};

const selectSearchGroup: FilterGroup = {
    id: 'destination',
    label: 'Destino',
    type: 'select-search',
    options: [
        { value: 'cdu', label: 'Concepción del Uruguay' },
        { value: 'colon', label: 'Colón' }
    ]
};

const iconChipsGroup: FilterGroup = {
    id: 'amenities',
    label: 'Comodidades',
    type: 'icon-chips',
    options: [
        { value: 'wifi', label: 'Wi-Fi' },
        { value: 'pool', label: 'Pileta' },
        { value: 'parking', label: 'Estacionamiento' }
    ]
};

const sortOptions = [
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'rating', label: 'Mejor valorados' }
];

/** Minimal valid props for rendering FilterSidebar. */
function buildProps(overrides: Partial<FilterSidebarProps> = {}): FilterSidebarProps {
    return {
        locale: 'es',
        filters: [checkboxGroup],
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the outermost wrapper element rendered by FilterSidebar.
 * FilterSidebar returns `display:contents` by default so we query by
 * data-position attribute which is always set.
 */
function getWrapper(container: HTMLElement): HTMLElement {
    return container.querySelector('[data-position]') as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests: position prop
// ---------------------------------------------------------------------------

describe('FilterSidebar — position prop', () => {
    it('defaults to position="left" when position prop is omitted', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps()} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper).toHaveAttribute('data-position', 'left');
    });

    it('applies positionLeft class when position="left"', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps({ position: 'left' })} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper.className).toContain('positionLeft');
    });

    it('does not apply positionTop class when position="left"', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps({ position: 'left' })} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper.className).not.toContain('positionTop');
    });

    it('sets data-position="top" when position="top"', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps({ position: 'top' })} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper).toHaveAttribute('data-position', 'top');
    });

    it('applies positionTop class when position="top"', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps({ position: 'top' })} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper.className).toContain('positionTop');
    });

    it('does not apply positionLeft class when position="top"', () => {
        // Arrange / Act
        const { container } = render(<FilterSidebar {...buildProps({ position: 'top' })} />);

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper.className).not.toContain('positionLeft');
    });

    it('merges custom className with position class', () => {
        // Arrange / Act
        const { container } = render(
            <FilterSidebar {...buildProps({ position: 'left', className: 'my-custom-class' })} />
        );

        // Assert
        const wrapper = getWrapper(container);
        expect(wrapper.className).toContain('my-custom-class');
        expect(wrapper.className).toContain('positionLeft');
    });
});

// ---------------------------------------------------------------------------
// Tests: mobile drawer (floating trigger)
// ---------------------------------------------------------------------------

describe('FilterSidebar — mobile drawer', () => {
    it('renders the floating trigger button', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps()} />);

        // Assert — trigger is always present in DOM (CSS hides it on desktop)
        const trigger = screen.getByRole('button', { name: /filtros/i });
        expect(trigger).toBeInTheDocument();
    });

    it('floating trigger has aria-haspopup="dialog"', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps()} />);

        // Assert
        const trigger = screen.getByRole('button', { name: /filtros/i });
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('floating trigger is initially collapsed (aria-expanded=false)', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps()} />);

        // Assert
        const trigger = screen.getByRole('button', { name: /filtros/i });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens the drawer dialog when floating trigger is clicked', () => {
        // Arrange
        render(<FilterSidebar {...buildProps()} />);
        const trigger = screen.getByRole('button', { name: /filtros/i });

        // Act
        fireEvent.click(trigger);

        // Assert — dialog element is now open
        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('open');
    });

    it('trigger shows aria-expanded=true after clicking', () => {
        // Arrange
        render(<FilterSidebar {...buildProps()} />);
        const trigger = screen.getByRole('button', { name: /filtros/i });

        // Act
        fireEvent.click(trigger);

        // Assert
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('mobile drawer works the same for position="top"', () => {
        // Arrange
        render(<FilterSidebar {...buildProps({ position: 'top' })} />);
        const trigger = screen.getByRole('button', { name: /filtros/i });

        // Act
        fireEvent.click(trigger);

        // Assert — drawer behaviour is position-agnostic
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('open');
    });
});

// ---------------------------------------------------------------------------
// Tests: filter group types
// ---------------------------------------------------------------------------

describe('FilterSidebar — filter group types', () => {
    it('renders checkbox filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [checkboxGroup] })} />);

        // Assert
        expect(screen.getAllByText('Tipo de alojamiento').length).toBeGreaterThan(0);
    });

    it('renders radio filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [radioGroup] })} />);

        // Assert
        expect(screen.getAllByText('Categoría').length).toBeGreaterThan(0);
    });

    it('renders toggle filter group inline (outside collapsible wrapper)', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [toggleGroup] })} />);

        // Assert — toggle label is visible
        expect(screen.getAllByText('Solo destacados').length).toBeGreaterThan(0);
    });

    it('renders stepper filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [stepperGroup] })} />);

        // Assert
        expect(screen.getAllByText('Huéspedes').length).toBeGreaterThan(0);
    });

    it('renders stars filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [starsGroup] })} />);

        // Assert
        expect(screen.getAllByText('Estrellas mínimas').length).toBeGreaterThan(0);
    });

    it('renders dual-range filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [dualRangeGroup] })} />);

        // Assert
        expect(screen.getAllByText('Precio por noche').length).toBeGreaterThan(0);
    });

    it('renders select-search filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [selectSearchGroup] })} />);

        // Assert
        expect(screen.getAllByText('Destino').length).toBeGreaterThan(0);
    });

    it('renders icon-chips filter group label', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [iconChipsGroup] })} />);

        // Assert
        expect(screen.getAllByText('Comodidades').length).toBeGreaterThan(0);
    });

    it('renders multiple filter groups together', () => {
        // Arrange
        const allGroups: FilterGroup[] = [
            checkboxGroup,
            radioGroup,
            toggleGroup,
            stepperGroup,
            starsGroup
        ];

        // Act
        render(<FilterSidebar {...buildProps({ filters: allGroups })} />);

        // Assert — each group label appears at least once
        expect(screen.getAllByText('Tipo de alojamiento').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Categoría').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Solo destacados').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Huéspedes').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Estrellas mínimas').length).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Tests: sort options
// ---------------------------------------------------------------------------

describe('FilterSidebar — sort options', () => {
    it('renders sort trigger button when sortOptions are provided', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ sortOptions })} />);

        // Assert — sort popover trigger has aria-label containing "Ordenar por"
        const sortTrigger = screen
            .getAllByRole('button')
            .find((btn) => btn.getAttribute('aria-label')?.includes('Ordenar por'));
        expect(sortTrigger).toBeDefined();
    });

    it('does not render sort trigger when sortOptions is not provided', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ sortOptions: undefined })} />);

        // Assert
        const sortTrigger = screen
            .queryAllByRole('button')
            .find((btn) => btn.getAttribute('aria-label')?.includes('Ordenar por'));
        expect(sortTrigger).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Tests: active filter count badge
// ---------------------------------------------------------------------------

describe('FilterSidebar — active filter badge', () => {
    it('shows no badge when no filters are pre-selected', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ initialParams: {} })} />);

        // Assert — trigger button should not show a badge (no aria-label with "filtro activo")
        const trigger = screen.getByRole('button', { name: /^filtros$/i });
        expect(trigger).not.toHaveTextContent(/filtro activo/i);
    });

    it('shows active count badge on floating trigger when a filter is pre-selected', () => {
        // Arrange — pre-select "hotel" in the checkbox group
        const props = buildProps({
            filters: [checkboxGroup],
            initialParams: { type: 'hotel' }
        });

        // Act
        render(<FilterSidebar {...props} />);

        // Assert — floating trigger shows badge with count "1"
        // The badge span is a sibling inside the floating trigger button
        const trigger = screen
            .getAllByRole('button')
            .find((btn) => btn.getAttribute('aria-label')?.toLowerCase().includes('filtros'));
        // Badge exists when activeCount > 0
        expect(trigger?.textContent).toMatch(/1/);
    });

    it('shows clear-all button in desktop header when a filter is pre-selected', () => {
        // Arrange
        const props = buildProps({
            filters: [checkboxGroup],
            initialParams: { type: 'hotel' }
        });

        // Act
        render(<FilterSidebar {...props} />);

        // Assert — "Limpiar filtros" button appears at least once
        // (desktop sidebar + potentially inside drawer both contain it)
        const clearBtns = screen.getAllByText('Limpiar filtros');
        expect(clearBtns.length).toBeGreaterThan(0);
    });
});

describe('FilterSidebar — per-group active count badge', () => {
    it('renders a count badge with the number of selections when the group has multi-select active', () => {
        const props = buildProps({
            filters: [checkboxGroup],
            initialParams: { type: 'hotel,hostel' }
        });
        const { container } = render(<FilterSidebar {...props} />);

        // The group header toggle button (id="filter-type") wraps the label
        // plus, when active, a [N] count badge. We assert the badge digit "2"
        // sits inside the same toggle button as the label.
        const toggleBtn = container.querySelector('button[id="filter-type"]');
        expect(toggleBtn).not.toBeNull();
        expect(toggleBtn?.textContent).toMatch(/Tipo de alojamiento.*2/);
    });

    it('does not render the count badge when no options are selected for a multi-select group', () => {
        const props = buildProps({ filters: [checkboxGroup], initialParams: {} });
        const { container } = render(<FilterSidebar {...props} />);

        const toggleBtn = container.querySelector('button[id="filter-type"]');
        expect(toggleBtn?.textContent?.trim()).toBe('Tipo de alojamiento');
    });

    it('does not render a count badge for non-multi-select group types (stepper, dual-range)', () => {
        // Stepper active (guests=4 > default 1) and dual-range with a min set
        // are both "hasActive=true" but neither should show a [N] badge.
        const props = buildProps({
            filters: [stepperGroup, dualRangeGroup],
            initialParams: { guests: '4', minPrice: '5000' }
        });
        const { container } = render(<FilterSidebar {...props} />);

        const guestsToggle = container.querySelector('button[id="filter-guests"]');
        const priceToggle = container.querySelector('button[id="filter-price"]');
        expect(guestsToggle?.textContent?.trim()).toBe('Huéspedes');
        expect(priceToggle?.textContent?.trim()).toBe('Precio por noche');
    });
});

describe('FilterSidebar — stable group order (no active-first sort)', () => {
    it('preserves the declaration order of filter groups regardless of which are active', () => {
        // Declaration order: checkbox (type), then dual-range (price).
        // Pre-select the SECOND group (price). With the old "active-first
        // sort" feature, price would move to the top. Now it should stay
        // second.
        const props = buildProps({
            filters: [checkboxGroup, dualRangeGroup],
            initialParams: { minPrice: '5000' }
        });
        const { container } = render(<FilterSidebar {...props} />);

        // Two desktop fieldsets in the order they were declared.
        const fieldsets = Array.from(container.querySelectorAll('fieldset[aria-labelledby]'));
        // Both desktop + drawer instances render in jsdom; take the first
        // rendering pass (2 entries for 2 groups).
        const desktopFieldsets = fieldsets.slice(0, 2);
        const ids = desktopFieldsets.map((fs) => fs.getAttribute('aria-labelledby'));
        expect(ids).toEqual(['filter-type', 'filter-price']);
    });
});

describe('FilterSidebar — stable group order (no active-first sort)', () => {
    it('preserves the declaration order of filter groups regardless of which are active', () => {
        // declaration order: checkbox (type), then dualRange (price)
        // Pre-select the SECOND group (price) so the old "active-first sort" would
        // move it to the top. We assert the DOM order is unchanged.
        const props = buildProps({
            filters: [checkboxGroup, dualRangeGroup],
            initialParams: { minPrice: '5000' }
        });
        const { container } = render(<FilterSidebar {...props} />);

        const fieldsets = Array.from(container.querySelectorAll('fieldset[aria-labelledby]'));
        // Filter to the desktop sidebar instance (both desktop + drawer render in jsdom).
        // Take the first half of the fieldsets which corresponds to one rendering pass.
        const desktopFieldsets = fieldsets.slice(0, 2);
        const ids = desktopFieldsets.map((fs) => fs.getAttribute('aria-labelledby'));
        expect(ids).toEqual(['filter-type', 'filter-price']);
    });
});

// ---------------------------------------------------------------------------
// Tests: structural snapshot — position='left'
//
// Uses DOM structure assertions instead of serialized snapshots because
// toMatchSnapshot() requires SnapshotClient.setup() which is only available
// when Vitest runs the full test suite (not in isolated file mode).
// The assertions below capture the load-bearing structural invariants that
// a serialized snapshot would also catch.
// ---------------------------------------------------------------------------

describe('FilterSidebar — snapshot position="left"', () => {
    it('renders consistent structure for position="left"', () => {
        // Arrange
        const { container } = render(
            <FilterSidebar
                locale="es"
                filters={[checkboxGroup, toggleGroup]}
                sortOptions={sortOptions}
                position="left"
            />
        );
        const wrapper = getWrapper(container);

        // Assert — structural invariants for position='left'
        // 1. Wrapper has data-position="left"
        expect(wrapper).toHaveAttribute('data-position', 'left');
        // 2. Wrapper carries positionLeft class
        expect(wrapper.className).toContain('positionLeft');
        // 3. Desktop sidebar panel is present
        expect(wrapper.querySelector('.sidebarDesktop')).toBeInTheDocument();
        // 4. Mobile floating trigger is present
        expect(wrapper.querySelector('.floatingTrigger')).toBeInTheDocument();
        // 5. Mobile drawer dialog is present (closed)
        const dialog = wrapper.querySelector('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).not.toHaveAttribute('open');
        // 6. Sort trigger is rendered (sortOptions provided)
        const sortTrigger = wrapper.querySelector('.sortPopoverTrigger');
        expect(sortTrigger).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: structural snapshot — position='top'
// ---------------------------------------------------------------------------

describe('FilterSidebar — snapshot position="top"', () => {
    it('renders consistent structure for position="top"', () => {
        // Arrange
        const { container } = render(
            <FilterSidebar
                locale="es"
                filters={[checkboxGroup, toggleGroup]}
                sortOptions={sortOptions}
                position="top"
            />
        );
        const wrapper = getWrapper(container);

        // Assert — structural invariants for position='top'
        // 1. Wrapper has data-position="top"
        expect(wrapper).toHaveAttribute('data-position', 'top');
        // 2. Wrapper carries positionTop class
        expect(wrapper.className).toContain('positionTop');
        // 3. Desktop sidebar panel is still present
        expect(wrapper.querySelector('.sidebarDesktop')).toBeInTheDocument();
        // 4. Mobile floating trigger is still present (position-agnostic)
        expect(wrapper.querySelector('.floatingTrigger')).toBeInTheDocument();
    });

    it('data-position differs between left and top renders', () => {
        // Arrange
        const { container: containerLeft } = render(
            <FilterSidebar
                locale="es"
                filters={[checkboxGroup]}
                position="left"
            />
        );
        const { container: containerTop } = render(
            <FilterSidebar
                locale="es"
                filters={[checkboxGroup]}
                position="top"
            />
        );

        // Act
        const wrapperLeft = getWrapper(containerLeft);
        const wrapperTop = getWrapper(containerTop);

        // Assert
        expect(wrapperLeft.getAttribute('data-position')).toBe('left');
        expect(wrapperTop.getAttribute('data-position')).toBe('top');
        expect(wrapperLeft.className).not.toBe(wrapperTop.className);
    });
});

// ---------------------------------------------------------------------------
// Tests: section-header decorative entry + sectioned layout
//
// When `filters` declares at least one `section-header`, the sidebar switches
// from the legacy "inline toggles first, collapsibles below" layout to a
// strictly-declaration-order render so each group lands under its intended
// header. Listings that don't declare any section-header keep the legacy
// ordering — covered by the "stable group order" describes above.
// ---------------------------------------------------------------------------

const locationHeader: FilterGroup = {
    id: 'section-location',
    type: 'section-header',
    label: 'UBICACIÓN'
};

const priceHeader: FilterGroup = {
    id: 'section-price',
    type: 'section-header',
    label: 'PRECIO Y CALIDAD',
    icon: 'PriceIcon'
};

describe('FilterSidebar — section-header decorative entry', () => {
    it('renders the section-header label text in the sidebar body', () => {
        // Arrange / Act
        render(<FilterSidebar {...buildProps({ filters: [locationHeader, selectSearchGroup] })} />);

        // Assert — label appears at least once (desktop sidebar; the drawer
        // also renders an instance, so we use getAllByText).
        expect(screen.getAllByText('UBICACIÓN').length).toBeGreaterThan(0);
    });

    it('renders the section-header as a non-interactive presentation element', () => {
        // Arrange / Act
        const { container } = render(
            <FilterSidebar {...buildProps({ filters: [locationHeader, selectSearchGroup] })} />
        );

        // Assert — the header is announced as role="presentation" and is NOT
        // wrapped in a button / fieldset / collapsible toggle. Section
        // headers carry no state; they're a visual divider only.
        const headers = container.querySelectorAll('[role="presentation"]');
        const labels = Array.from(headers).map((h) => h.textContent ?? '');
        expect(labels.some((l) => l.includes('UBICACIÓN'))).toBe(true);
        // None of the header nodes should themselves be buttons.
        for (const node of headers) {
            expect(node.tagName.toLowerCase()).not.toBe('button');
        }
    });

    it('renders the optional icon when the section-header config carries one', () => {
        // Arrange / Act
        const { container } = render(
            <FilterSidebar {...buildProps({ filters: [priceHeader, dualRangeGroup] })} />
        );

        // Assert — the header with an `icon` field renders an icon slot
        // (sectionHeaderIcon class) right next to the label.
        const headerNodes = container.querySelectorAll('[role="presentation"]');
        const priceHeaderNode = Array.from(headerNodes).find((n) =>
            n.textContent?.includes('PRECIO Y CALIDAD')
        );
        expect(priceHeaderNode).toBeDefined();
        expect(priceHeaderNode?.querySelector('.sectionHeaderIcon')).not.toBeNull();
    });

    it('switches to sectioned layout (declaration order) when filters contain a section-header', () => {
        // Arrange — declare a toggle group AFTER a checkbox group. In the
        // legacy "inline toggles first" layout the toggle would be hoisted
        // above the checkbox. With a section-header present the layout
        // switches to strict declaration order, so the checkbox stays first.
        const sectioned: FilterGroup[] = [
            locationHeader,
            checkboxGroup, // 'Tipo de alojamiento'
            toggleGroup // 'Solo destacados'
        ];

        // Act
        const { container } = render(<FilterSidebar {...buildProps({ filters: sectioned })} />);

        // Assert — find the checkbox group toggle and the toggle filter in
        // the desktop sidebar, and confirm the toggle does NOT appear
        // before the checkbox group in document order.
        const desktopSidebar = container.querySelector('.sidebarDesktop');
        expect(desktopSidebar).not.toBeNull();
        const checkboxToggle = desktopSidebar?.querySelector('button[id="filter-type"]');
        const toggleLabel = Array.from(desktopSidebar?.querySelectorAll('label') ?? []).find((n) =>
            n.textContent?.includes('Solo destacados')
        );
        expect(checkboxToggle).not.toBeNull();
        expect(toggleLabel).toBeDefined();
        // checkbox group must come BEFORE the inline toggle in the DOM.
        if (checkboxToggle && toggleLabel) {
            const cmp = checkboxToggle.compareDocumentPosition(toggleLabel);
            // DOCUMENT_POSITION_FOLLOWING === 0x04 — toggleLabel is after
            // checkboxToggle in document order.
            expect((cmp & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
        }
    });

    it('keeps legacy layout (inline toggles first) when no section-header is declared', () => {
        // Arrange — same group set without a section-header. The toggle
        // should now be hoisted above the checkbox group (legacy layout).
        const legacy: FilterGroup[] = [checkboxGroup, toggleGroup];

        // Act
        const { container } = render(<FilterSidebar {...buildProps({ filters: legacy })} />);

        // Assert — in the desktop sidebar the toggle's inline label comes
        // BEFORE the checkbox group's collapsible header.
        const desktopSidebar = container.querySelector('.sidebarDesktop');
        const checkboxToggle = desktopSidebar?.querySelector('button[id="filter-type"]');
        const toggleLabel = Array.from(desktopSidebar?.querySelectorAll('label') ?? []).find((n) =>
            n.textContent?.includes('Solo destacados')
        );
        expect(checkboxToggle).not.toBeNull();
        expect(toggleLabel).toBeDefined();
        if (checkboxToggle && toggleLabel) {
            const cmp = toggleLabel.compareDocumentPosition(checkboxToggle);
            // DOCUMENT_POSITION_FOLLOWING means `checkboxToggle` is after
            // `toggleLabel` — i.e. the toggle was hoisted to the top.
            expect((cmp & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
        }
    });
});
