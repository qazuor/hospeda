/**
 * @file CatalogPicker.test.tsx
 * @description The shared amenity/feature picker of the three owner editors
 * (HOS-2061). Absorbs the coverage of the two `AmenitiesSection` suites it
 * replaced (BETA-133, HOS-258, HOS-371, HOS-2058) and adds featured-first,
 * search and grouping.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogPicker } from '@/components/shared/catalog-picker/CatalogPicker.client';
import type { AmenityData } from '@/lib/api/types';

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/lib/catalog-names', () => ({
    translateAmenityName: ({ name }: { readonly name: string }) =>
        ({ heating: 'Calefacción' })[name] ?? name
}));

vi.mock('@/components/shared/catalog-picker/CatalogPicker.module.css', () => ({
    default: new Proxy({}, { get: (_target, prop) => String(prop) })
}));

const AMENITIES: readonly AmenityData[] = [
    { id: 'am-wifi', slug: 'wifi', category: 'CONNECTIVITY' },
    { id: 'am-pool', slug: 'pool', category: 'OUTDOORS' },
    { id: 'am-safe', slug: 'safe', category: 'SAFETY' },
    { id: 'am-heating', slug: 'heating', category: 'CLIMATE_CONTROL' },
    { id: 'am-unknown', slug: 'mystery', category: 'NOT_A_REAL_CATEGORY' },
    { id: 'am-null', slug: 'orphan', category: null }
];

const FEATURES: readonly AmenityData[] = [
    { id: 'ft-river', slug: 'river_front', category: null },
    { id: 'ft-quiet', slug: 'quiet_area', category: 'LOCATION' }
];

type Props = ComponentProps<typeof CatalogPicker>;

function renderPicker(overrides: Partial<Props> = {}) {
    const props: Props = {
        locale: 'es',
        amenitiesTitle: 'Comodidades',
        featuresTitle: 'Características',
        amenities: AMENITIES,
        features: FEATURES,
        selectedAmenityIds: new Set<string>(),
        selectedFeatureIds: new Set<string>(),
        onToggleAmenity: vi.fn(),
        onToggleFeature: vi.fn(),
        onChangeAmenityAttribute: vi.fn(),
        ...overrides
    };
    return { ...render(<CatalogPicker {...props} />), props };
}

function groupOf(label: string, container: HTMLElement): HTMLDetailsElement {
    const found = Array.from(container.querySelectorAll('details')).find(
        (details) => details.querySelector('summary')?.textContent?.includes(label) ?? false
    );
    if (!found) throw new Error(`no category group "${label}"`);
    return found as HTMLDetailsElement;
}

describe('CatalogPicker — grouping', () => {
    it('renders nothing when both catalogs are empty', () => {
        const { container } = renderPicker({ amenities: [], features: [] });

        expect(container).toBeEmptyDOMElement();
    });

    it('renders both catalog headings', () => {
        renderPicker();

        expect(screen.getByText('Comodidades')).toBeInTheDocument();
        expect(screen.getByText('Características')).toBeInTheDocument();
    });

    it('omits the feature block when only amenities exist', () => {
        renderPicker({ features: [] });

        expect(screen.queryByText('Características')).toBeNull();
        expect(screen.getByText('Comodidades')).toBeInTheDocument();
    });

    it('groups amenities under their category accordions', () => {
        const { container } = renderPicker();

        expect(within(groupOf('Conectividad', container)).getByText('wifi')).toBeInTheDocument();
        expect(within(groupOf('Exteriores', container)).getByText('pool')).toBeInTheDocument();
        expect(within(groupOf('Seguridad', container)).getByText('safe')).toBeInTheDocument();
    });

    it('puts null/unrecognized amenity categories under "Otros"', () => {
        const { container } = renderPicker();

        const other = groupOf('Otros', container);
        expect(within(other).getByText('mystery')).toBeInTheDocument();
        expect(within(other).getByText('orphan')).toBeInTheDocument();
    });

    it('groups features by category, uncategorized ones under "Otras"', () => {
        renderPicker();

        const located = screen.getByRole('checkbox', { name: 'quiet_area' });
        const uncategorized = screen.getByRole('checkbox', { name: 'river_front' });
        expect(located.closest('details')?.textContent).toContain('Ubicación');
        expect(uncategorized.closest('details')?.textContent).toContain('Otras');
    });

    it('opens a category holding a selection and badges its count', () => {
        const { container } = renderPicker({ selectedAmenityIds: new Set(['am-safe']) });

        const safety = groupOf('Seguridad', container);
        expect(safety.open).toBe(true);
        expect(within(safety).getByText('1')).toBeInTheDocument();
    });

    it('toggles a category open/closed from its summary', () => {
        const { container } = renderPicker({ selectedAmenityIds: new Set(['am-unknown']) });
        const other = groupOf('Otros', container);
        const summary = other.querySelector('summary') as HTMLElement;

        expect(other.open).toBe(true);
        fireEvent.click(summary);
        expect(other.open).toBe(false);
        fireEvent.click(summary);
        expect(other.open).toBe(true);
    });
});

describe('CatalogPicker — featured first', () => {
    const featuredAmenities: readonly AmenityData[] = [
        ...AMENITIES.filter((item) => item.id !== 'am-pool' && item.id !== 'am-wifi'),
        {
            id: 'am-wifi',
            slug: 'wifi',
            category: 'CONNECTIVITY',
            isFeatured: true,
            displayWeight: 40
        },
        { id: 'am-pool', slug: 'pool', category: 'OUTDOORS', isFeatured: true, displayWeight: 90 }
    ];

    it('lists featured items above the categories, by displayWeight, and not twice', () => {
        // Arrange / Act
        renderPicker({ amenities: featuredAmenities });

        // Assert
        const featuredBlock = screen.getByText('Destacados').parentElement as HTMLElement;
        const labels = within(featuredBlock)
            .getAllByRole('checkbox')
            .map((box) => box.closest('label')?.textContent);
        expect(labels).toEqual(['pool', 'wifi']);
        expect(screen.getAllByRole('checkbox', { name: 'pool' })).toHaveLength(1);
        expect(screen.getByText('Ver todos')).toBeInTheDocument();
    });

    it('shows no featured block when nothing is featured', () => {
        renderPicker();

        expect(screen.queryByText('Destacados')).toBeNull();
    });
});

describe('CatalogPicker — search', () => {
    it('filters both catalogs by localized label, ignoring accents and case', () => {
        // Arrange
        renderPicker();

        // Act
        fireEvent.change(screen.getByLabelText('Buscar servicios y características'), {
            target: { value: 'CALEFACCION' }
        });

        // Assert
        expect(screen.getByRole('checkbox', { name: 'Calefacción' })).toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: 'wifi' })).toBeNull();
        expect(screen.queryByRole('checkbox', { name: 'quiet_area' })).toBeNull();
    });

    it('opens the category of every match and includes featured items', () => {
        const { container } = renderPicker({
            amenities: [
                { id: 'am-pool', slug: 'pool', category: 'OUTDOORS', isFeatured: true },
                ...AMENITIES.filter((item) => item.id !== 'am-pool')
            ]
        });

        fireEvent.change(screen.getByLabelText('Buscar servicios y características'), {
            target: { value: 'pool' }
        });

        expect(screen.queryByText('Destacados')).toBeNull();
        expect(groupOf('Exteriores', container).open).toBe(true);
        expect(screen.getByRole('checkbox', { name: 'pool' })).toBeInTheDocument();
    });

    it('announces when nothing matches', () => {
        renderPicker();

        fireEvent.change(screen.getByLabelText('Buscar servicios y características'), {
            target: { value: 'sauna' }
        });

        expect(screen.getByRole('status')).toHaveTextContent('No encontramos nada con "sauna".');
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('restores the full catalog when the query is cleared', () => {
        renderPicker();
        const search = screen.getByLabelText('Buscar servicios y características');

        fireEvent.change(search, { target: { value: 'wifi' } });
        fireEvent.change(search, { target: { value: '' } });

        expect(screen.getAllByRole('checkbox')).toHaveLength(AMENITIES.length + FEATURES.length);
    });
});

describe('CatalogPicker — toggles and attributes', () => {
    it('reports amenity and feature toggles', () => {
        const { props } = renderPicker();

        fireEvent.click(screen.getByRole('checkbox', { name: 'wifi' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'river_front' }));

        expect(props.onToggleAmenity).toHaveBeenCalledWith('am-wifi');
        expect(props.onToggleFeature).toHaveBeenCalledWith('ft-river');
    });

    it('reflects the selection as checked', () => {
        renderPicker({ selectedAmenityIds: new Set(['am-wifi']) });

        expect(screen.getByRole('checkbox', { name: 'wifi' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'pool' })).not.toBeChecked();
    });

    it('offers no attribute controls for an unchecked amenity', () => {
        renderPicker();

        expect(screen.queryByText('Detalles')).toBeNull();
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('offers collapsed scope/availability controls for a checked amenity', () => {
        renderPicker({ selectedAmenityIds: new Set(['am-pool']) });

        const disclosure = screen.getByText('Detalles').closest('details') as HTMLDetailsElement;
        expect(disclosure.open).toBe(false);
        const radios = within(disclosure).getAllByRole('radio') as HTMLInputElement[];
        expect(radios).toHaveLength(6);
        expect(radios.filter((radio) => radio.checked)).toHaveLength(2);
        expect(screen.getAllByRole('radio', { name: 'Sin indicar' })).toHaveLength(2);
    });

    it('reflects declared attributes and reports changes', () => {
        const onChangeAmenityAttribute = vi.fn();
        renderPicker({
            selectedAmenityIds: new Set(['am-pool']),
            amenityAttributes: { 'am-pool': { scope: 'shared', availability: null } },
            onChangeAmenityAttribute
        });

        expect(screen.getByRole('radio', { name: 'Compartido' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Privado' })).not.toBeChecked();

        fireEvent.click(screen.getByRole('radio', { name: 'De temporada' }));
        expect(onChangeAmenityAttribute).toHaveBeenCalledWith(
            'am-pool',
            'availability',
            'seasonal'
        );

        fireEvent.click(screen.getAllByRole('radio', { name: 'Sin indicar' })[0] as HTMLElement);
        expect(onChangeAmenityAttribute).toHaveBeenCalledWith('am-pool', 'scope', null);
    });

    it('hides the attribute controls when the caller does not handle them', () => {
        renderPicker({
            selectedAmenityIds: new Set(['am-pool']),
            onChangeAmenityAttribute: undefined
        });

        expect(screen.queryByText('Detalles')).toBeNull();
    });
});
