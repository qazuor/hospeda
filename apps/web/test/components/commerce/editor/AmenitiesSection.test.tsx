/**
 * @file AmenitiesSection.test.tsx
 * @description Unit coverage for the commerce editor's amenity + feature
 * section (HOS-258).
 *
 * @module test/components/commerce/editor/AmenitiesSection
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmenitiesSection } from '../../../../src/components/commerce/editor/AmenitiesSection.client';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        // A key with no translation resolves to `[MISSING:<key>]`, NOT the bare
        // key. `catalog-names` keys off that sentinel to humanize the slug, so a
        // plain `fallback ?? key` mock would change how labels render.
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

const AMENITY_A = '11111111-1111-4111-8111-111111111111';
const AMENITY_B = '22222222-2222-4222-8222-222222222222';
const FEATURE_A = '33333333-3333-4333-8333-333333333333';

const amenities = [
    { id: AMENITY_A, slug: 'wifi', category: null },
    { id: AMENITY_B, slug: 'terraza', category: null }
];
const features = [{ id: FEATURE_A, slug: 'pet_friendly', category: null }];

function renderSection(overrides: Partial<React.ComponentProps<typeof AmenitiesSection>> = {}): {
    onToggleAmenity: ReturnType<typeof vi.fn>;
    onToggleFeature: ReturnType<typeof vi.fn>;
} {
    const onToggleAmenity = vi.fn();
    const onToggleFeature = vi.fn();
    render(
        <AmenitiesSection
            locale="es"
            amenities={amenities}
            features={features}
            selectedAmenityIds={new Set<string>()}
            selectedFeatureIds={new Set<string>()}
            onToggleAmenity={onToggleAmenity}
            onToggleFeature={onToggleFeature}
            {...overrides}
        />
    );
    return { onToggleAmenity, onToggleFeature };
}

describe('AmenitiesSection', () => {
    it('renders nothing when both catalogs are empty', () => {
        const { container } = render(
            <AmenitiesSection
                locale="es"
                amenities={[]}
                features={[]}
                selectedAmenityIds={new Set<string>()}
                selectedFeatureIds={new Set<string>()}
                onToggleAmenity={vi.fn()}
                onToggleFeature={vi.fn()}
            />
        );

        // The orchestrator used to carry this guard inline; the section owns it
        // now, so an empty catalog must not leave an empty titled block behind.
        expect(container).toBeEmptyDOMElement();
    });

    it('renders both groups when both catalogs have rows', () => {
        renderSection();

        expect(screen.getByText('Servicios')).toBeInTheDocument();
        expect(screen.getByText('Características')).toBeInTheDocument();
    });

    it('omits the feature group when only amenities exist', () => {
        renderSection({ features: [] });

        expect(screen.getByText('Servicios')).toBeInTheDocument();
        expect(screen.queryByText('Características')).toBeNull();
    });

    it('omits the amenity group when only features exist', () => {
        renderSection({ amenities: [] });

        expect(screen.queryByText('Servicios')).toBeNull();
        expect(screen.getByText('Características')).toBeInTheDocument();
    });

    it('humanizes an amenity slug that has no i18n key (SPEC-266)', () => {
        renderSection();

        // The `name` column is gone; the label comes from the slug through
        // `translateAmenityName`, which humanizes when the key is missing.
        expect(screen.getByLabelText('Wifi')).toBeInTheDocument();
        expect(screen.getByLabelText('Terraza')).toBeInTheDocument();
    });

    it('falls back to the raw slug for a feature with no i18n key', () => {
        renderSection();

        expect(screen.getByLabelText('pet_friendly')).toBeInTheDocument();
    });

    it('reflects the selected sets as checked state', () => {
        renderSection({
            selectedAmenityIds: new Set([AMENITY_A]),
            selectedFeatureIds: new Set([FEATURE_A])
        });

        expect(screen.getByLabelText('Wifi')).toBeChecked();
        expect(screen.getByLabelText('Terraza')).not.toBeChecked();
        expect(screen.getByLabelText('pet_friendly')).toBeChecked();
    });

    it('reports an amenity toggle by id', () => {
        const { onToggleAmenity, onToggleFeature } = renderSection();

        fireEvent.click(screen.getByLabelText('Terraza'));

        expect(onToggleAmenity).toHaveBeenCalledWith(AMENITY_B);
        expect(onToggleFeature).not.toHaveBeenCalled();
    });

    it('reports a feature toggle on the feature callback, not the amenity one', () => {
        const { onToggleAmenity, onToggleFeature } = renderSection();

        fireEvent.click(screen.getByLabelText('pet_friendly'));

        // `amenityIds` and `featureIds` are separate entries in the PATCH diff;
        // crossing the callbacks would write the id into the wrong column.
        expect(onToggleFeature).toHaveBeenCalledWith(FEATURE_A);
        expect(onToggleAmenity).not.toHaveBeenCalled();
    });

    it('renders the scrollspy anchor the section nav will target', () => {
        renderSection();

        expect(document.getElementById('editor-amenities')).not.toBeNull();
    });

    describe('category accordions (HOS-371)', () => {
        const WIFI = '11111111-1111-4111-8111-111111111111';
        const TV = '22222222-2222-4222-8222-222222222222';
        const TERRAZA = '33333333-3333-4333-8333-333333333333';
        const UNCATEGORIZED = '44444444-4444-4444-8444-444444444444';

        /** Renders the section with amenities spanning three category buckets. */
        function renderCategorized(selected: readonly string[] = []) {
            return render(
                <AmenitiesSection
                    locale="es"
                    amenities={[
                        { id: TV, slug: 'tv', category: 'ENTERTAINMENT' },
                        { id: WIFI, slug: 'wifi', category: 'CONNECTIVITY' },
                        { id: TERRAZA, slug: 'terraza', category: 'OUTDOORS' },
                        { id: UNCATEGORIZED, slug: 'algo', category: null }
                    ]}
                    features={[]}
                    selectedAmenityIds={new Set(selected)}
                    selectedFeatureIds={new Set<string>()}
                    onToggleAmenity={vi.fn()}
                    onToggleFeature={vi.fn()}
                />
            );
        }

        it('groups amenities into one collapsible <details> per category', () => {
            const { container } = renderCategorized();

            const summaries = Array.from(container.querySelectorAll('details > summary')).map(
                (el) => el.textContent
            );

            // One accordion per non-empty bucket, plus the "Otros" catch-all for
            // the null-category amenity — four buckets, not one flat list.
            expect(summaries).toHaveLength(4);
            expect(summaries.some((s) => s?.includes('Conectividad'))).toBe(true);
            expect(summaries.some((s) => s?.includes('Entretenimiento'))).toBe(true);
            expect(summaries.some((s) => s?.includes('Exteriores'))).toBe(true);
            expect(summaries.some((s) => s?.includes('Otros'))).toBe(true);
        });

        it('renders categories in the canonical order, not catalog order', () => {
            const { container } = renderCategorized();

            const summaries = Array.from(container.querySelectorAll('details > summary')).map(
                (el) => el.textContent ?? ''
            );

            // The catalog above deliberately lists ENTERTAINMENT before
            // CONNECTIVITY; AMENITY_CATEGORY_ORDER puts CONNECTIVITY first and
            // the "Otros" bucket always last.
            const positions = ['Conectividad', 'Entretenimiento', 'Exteriores', 'Otros'].map(
                (label) => summaries.findIndex((s) => s.includes(label))
            );
            expect(positions).toEqual([...positions].sort((a, b) => a - b));
            expect(positions.at(-1)).toBe(summaries.length - 1);
        });

        it('opens the first group and any group holding a selection, and badges the count', () => {
            const { container } = renderCategorized([TERRAZA]);

            const groups = Array.from(container.querySelectorAll('details'));
            const byLabel = (label: string) =>
                groups.find((el) => el.querySelector('summary')?.textContent?.includes(label));

            // First group is open so the section never reads as empty...
            expect(byLabel('Conectividad')?.open).toBe(true);
            // ...and a selected amenity is never hidden behind a closed summary.
            expect(byLabel('Exteriores')?.open).toBe(true);
            expect(byLabel('Exteriores')?.querySelector('summary')?.textContent).toContain('1');
            // A group with neither property stays collapsed.
            expect(byLabel('Entretenimiento')?.open).toBe(false);
        });

        it('still toggles an amenity from inside a collapsed accordion', () => {
            const onToggleAmenity = vi.fn();
            render(
                <AmenitiesSection
                    locale="es"
                    amenities={[
                        { id: WIFI, slug: 'wifi', category: 'CONNECTIVITY' },
                        { id: TERRAZA, slug: 'terraza', category: 'OUTDOORS' }
                    ]}
                    features={[]}
                    selectedAmenityIds={new Set<string>()}
                    selectedFeatureIds={new Set<string>()}
                    onToggleAmenity={onToggleAmenity}
                    onToggleFeature={vi.fn()}
                />
            );

            // "Terraza" lives in a collapsed group; <details> keeps its contents
            // in the DOM, so the checkbox is reachable either way.
            fireEvent.click(screen.getByLabelText('Terraza'));

            expect(onToggleAmenity).toHaveBeenCalledWith(TERRAZA);
        });

        it('keeps features as a flat grid — the catalog carries no category for them', () => {
            const { container } = render(
                <AmenitiesSection
                    locale="es"
                    amenities={[]}
                    features={[{ id: FEATURE_A, slug: 'pet_friendly', category: null }]}
                    selectedAmenityIds={new Set<string>()}
                    selectedFeatureIds={new Set<string>()}
                    onToggleAmenity={vi.fn()}
                    onToggleFeature={vi.fn()}
                />
            );

            expect(container.querySelectorAll('details')).toHaveLength(0);
            expect(screen.getByLabelText('pet_friendly')).toBeInTheDocument();
        });
    });
});
