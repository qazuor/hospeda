/**
 * @file AmenityCatalogBrowser.test.tsx
 * @description The accommodation catalog browser (HOS-2123, mockup variant B):
 * category switching, search across categories, tile toggling (mouse and
 * keyboard), and the per-amenity details dialog (open, apply, cancel, Escape).
 *
 * Uses the REAL `es` dictionary so every new key is proven to resolve; only
 * the amenity-name resolver is stubbed, to keep tile labels deterministic.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AmenityCatalogBrowser } from '@/components/host/editor/amenity-catalog/AmenityCatalogBrowser.client';
import type { AmenityData } from '@/lib/api/types';

vi.mock('@/lib/catalog-names', () => ({
    translateAmenityName: ({ name }: { readonly name: string }) =>
        ({ wifi: 'Wifi', pool: 'Pileta', grill: 'Parrilla' })[name] ?? name
}));

const AMENITIES: readonly AmenityData[] = [
    { id: 'am-wifi', slug: 'wifi', category: 'CONNECTIVITY' },
    { id: 'am-pool', slug: 'pool', category: 'OUTDOORS' },
    { id: 'am-grill', slug: 'grill', category: 'OUTDOORS' }
];

const FEATURES: readonly AmenityData[] = [
    { id: 'ft-river', slug: 'zz-riverside', category: 'LOCATION' }
];

type Props = ComponentProps<typeof AmenityCatalogBrowser>;

function renderBrowser(overrides: Partial<Props> = {}) {
    const props: Props = {
        locale: 'es',
        amenities: AMENITIES,
        features: FEATURES,
        selectedAmenityIds: new Set<string>(),
        selectedFeatureIds: new Set<string>(),
        onToggleAmenity: vi.fn(),
        onToggleFeature: vi.fn(),
        amenityAttributes: {},
        onChangeAmenityAttributes: vi.fn(),
        ...overrides
    };
    return { ...render(<AmenityCatalogBrowser {...props} />), props };
}

function nav(): HTMLElement {
    return screen.getByRole('navigation', { name: 'Categorías' });
}

function categoryButtons(): HTMLElement[] {
    return within(nav()).getAllByRole('button');
}

function tileNames(): string[] {
    return Array.from(document.querySelectorAll('button[aria-pressed]')).map(
        (button) => button.textContent ?? ''
    );
}

describe('AmenityCatalogBrowser — categories', () => {
    it('renders nothing when both catalogs are empty', () => {
        const { container } = renderBrowser({ amenities: [], features: [] });

        expect(container).toBeEmptyDOMElement();
    });

    it('lists amenity categories, then feature categories, and opens the first one', () => {
        renderBrowser();

        const buttons = categoryButtons();
        expect(buttons).toHaveLength(3);
        expect(buttons[0]).toHaveAttribute('aria-current', 'true');
        expect(within(nav()).getByText('Comodidades')).toBeInTheDocument();
        expect(within(nav()).getByText('Características')).toBeInTheDocument();
        // The feature category comes last.
        expect(buttons[2]?.textContent).not.toBe(buttons[0]?.textContent);
    });

    it('shows only the active category tiles and switches on click', async () => {
        const user = userEvent.setup();
        renderBrowser();

        const first = tileNames();
        await user.click(categoryButtons()[1] as HTMLElement);

        expect(categoryButtons()[1]).toHaveAttribute('aria-current', 'true');
        expect(categoryButtons()[0]).not.toHaveAttribute('aria-current');
        expect(tileNames()).not.toEqual(first);
        // Unselected items stay browsable: both outdoor items are listed.
        const outdoors = [...tileNames()].sort();
        expect(outdoors).toEqual(['Parrilla', 'Pileta']);
    });

    it('shows the per-category selected count and the total', () => {
        renderBrowser({ selectedAmenityIds: new Set(['am-pool', 'am-grill']) });

        const outdoorsButton = categoryButtons().find((button) =>
            button.textContent?.includes('2 elegidas')
        );
        expect(outdoorsButton).toBeDefined();
        expect(screen.getAllByText('2 elegidas').length).toBeGreaterThanOrEqual(2);
    });

    it('shows "N de M" progress for the active category', async () => {
        const user = userEvent.setup();
        renderBrowser({ selectedAmenityIds: new Set(['am-pool']) });

        await user.click(categoryButtons()[1] as HTMLElement);

        expect(screen.getByText('1 de 2')).toBeInTheDocument();
    });
});

describe('AmenityCatalogBrowser — search', () => {
    it('filters across every category, amenities and features alike', async () => {
        const user = userEvent.setup();
        renderBrowser();

        await user.type(screen.getByLabelText('Buscar en todo el catálogo'), 'pil');

        expect(tileNames()).toEqual(['Pileta']);
        expect(screen.getByRole('heading', { name: '1 resultado' })).toBeInTheDocument();

        await user.clear(screen.getByLabelText('Buscar en todo el catálogo'));
        await user.type(screen.getByLabelText('Buscar en todo el catálogo'), 'riverside');

        expect(tileNames()).toEqual(['zz-riverside']);
    });

    it('says so when nothing matches', async () => {
        const user = userEvent.setup();
        renderBrowser();

        await user.type(screen.getByLabelText('Buscar en todo el catálogo'), 'qwerty');

        expect(screen.getByText(/qwerty/)).toBeInTheDocument();
        expect(tileNames()).toEqual([]);
    });

    it('announces the result count through ONE polite live region only', async () => {
        const user = userEvent.setup();
        const { container } = renderBrowser();

        expect(screen.getByRole('status')).toHaveTextContent('');

        await user.type(screen.getByLabelText('Buscar en todo el catálogo'), 'qwerty');

        // Exactly one search live region (the selection total is the only other one).
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByRole('status')).toHaveTextContent('0 resultados');
        expect(screen.getByRole('status')).not.toHaveTextContent('qwerty');
        expect(container.querySelector('h3[aria-live]')).toBeNull();
    });

    it('never submits the surrounding form when Enter is pressed in the search box', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
        render(
            <form onSubmit={onSubmit}>
                <AmenityCatalogBrowser
                    locale="es"
                    amenities={AMENITIES}
                    features={FEATURES}
                    selectedAmenityIds={new Set<string>()}
                    selectedFeatureIds={new Set<string>()}
                    onToggleAmenity={vi.fn()}
                    onToggleFeature={vi.fn()}
                    onChangeAmenityAttributes={vi.fn()}
                />
                <button type="submit">Guardar</button>
            </form>
        );

        const search = screen.getByLabelText('Buscar en todo el catálogo') as HTMLInputElement;
        await user.type(search, 'pil{Enter}');

        expect(onSubmit).not.toHaveBeenCalled();
        expect(search.value).toBe('pil');
        expect(tileNames()).toEqual(['Pileta']);
    });

    it('leaves search when the owner picks a category', async () => {
        const user = userEvent.setup();
        renderBrowser();

        const search = screen.getByLabelText('Buscar en todo el catálogo') as HTMLInputElement;
        await user.type(search, 'pil');
        await user.click(categoryButtons()[0] as HTMLElement);

        expect(search.value).toBe('');
        expect(tileNames()).toEqual(['Wifi']);
    });
});

describe('AmenityCatalogBrowser — toggling', () => {
    it('reflects selection with aria-pressed', () => {
        renderBrowser({ selectedAmenityIds: new Set(['am-wifi']) });

        expect(screen.getByRole('button', { name: 'Wifi', pressed: true })).toBeInTheDocument();
    });

    it('toggles an amenity on click and a feature through its own callback', async () => {
        const user = userEvent.setup();
        const { props } = renderBrowser();

        await user.click(screen.getByRole('button', { name: 'Wifi', pressed: false }));
        expect(props.onToggleAmenity).toHaveBeenCalledWith('am-wifi');

        await user.click(categoryButtons()[2] as HTMLElement);
        await user.click(screen.getByRole('button', { name: 'zz-riverside' }));
        expect(props.onToggleFeature).toHaveBeenCalledWith('ft-river');
    });

    it('toggles from the keyboard (Enter and Space)', async () => {
        const user = userEvent.setup();
        const { props } = renderBrowser();

        screen.getByRole('button', { name: 'Wifi' }).focus();
        await user.keyboard('{Enter}');
        await user.keyboard(' ');

        expect(props.onToggleAmenity).toHaveBeenCalledTimes(2);
    });
});

describe('AmenityCatalogBrowser — details dialog', () => {
    it('offers "Agregar detalles" only on selected amenities, never on features', async () => {
        const user = userEvent.setup();
        renderBrowser({
            selectedAmenityIds: new Set(['am-wifi']),
            selectedFeatureIds: new Set(['ft-river'])
        });

        expect(screen.getByRole('button', { name: 'Agregar detalles a Wifi' })).toBeInTheDocument();

        await user.click(categoryButtons()[2] as HTMLElement);
        expect(screen.queryByRole('button', { name: /detalles/i })).toBeNull();
    });

    it('shows "Detalles" and a summary once something is declared', () => {
        renderBrowser({
            selectedAmenityIds: new Set(['am-wifi']),
            amenityAttributes: {
                'am-wifi': { scope: 'private', availability: 'seasonal', extraCharge: true }
            }
        });

        expect(screen.getByRole('button', { name: 'Detalles de Wifi' })).toBeInTheDocument();
        expect(screen.getByText('Privado · De temporada · Con cargo extra')).toBeInTheDocument();
    });

    it('opens the dialog and applies the edited details', async () => {
        const user = userEvent.setup();
        const { props } = renderBrowser({ selectedAmenityIds: new Set(['am-wifi']) });

        await user.click(screen.getByRole('button', { name: 'Agregar detalles a Wifi' }));
        const dialog = screen.getByRole('dialog', { name: 'Detalles de Wifi' });
        await user.click(within(dialog).getByRole('radio', { name: 'Compartido' }));
        await user.click(within(dialog).getByRole('radio', { name: 'Todo el año' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));

        expect(props.onChangeAmenityAttributes).toHaveBeenCalledWith({
            amenityId: 'am-wifi',
            value: { scope: 'shared', availability: 'year_round' }
        });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('closes on Escape without applying anything', async () => {
        const user = userEvent.setup();
        const { props } = renderBrowser({ selectedAmenityIds: new Set(['am-wifi']) });

        await user.click(screen.getByRole('button', { name: 'Agregar detalles a Wifi' }));
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('radio', { name: 'Privado' }));
        await user.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(props.onChangeAmenityAttributes).not.toHaveBeenCalled();
    });

    it('starts every opening from the declared value, not a cancelled draft', async () => {
        const user = userEvent.setup();
        renderBrowser({
            selectedAmenityIds: new Set(['am-wifi']),
            amenityAttributes: { 'am-wifi': { scope: 'shared', availability: null } }
        });

        await user.click(screen.getByRole('button', { name: 'Detalles de Wifi' }));
        await user.click(
            within(screen.getByRole('dialog')).getByRole('radio', { name: 'Privado' })
        );
        await user.click(
            within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' })
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        await user.click(screen.getByRole('button', { name: 'Detalles de Wifi' }));
        expect(
            within(screen.getByRole('dialog')).getByRole('radio', { name: 'Compartido' })
        ).toBeChecked();
    });
});
