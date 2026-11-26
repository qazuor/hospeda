/** Minimal draft creation: four fields, kit semantics, validation and redirects. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingCreateForm } from '@/components/listing/ListingCreateForm.client';
import { createOwnerListing, type ListingDetail } from '@/lib/listing/owner-listings';

vi.mock('@/lib/listing/owner-listings', () => ({ createOwnerListing: vi.fn() }));
const create = vi.mocked(createOwnerListing);
const destinations = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Colón' }];
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
const change = (label: string, value: string) =>
    fireEvent.change(field(label), { target: { value } });

function fill(vertical: 'venue' | 'experience' = 'venue') {
    change('Nombre', 'Una ficha de prueba');
    change('Categoría', vertical === 'venue' ? 'BAR' : 'EXCURSION');
    change('Resumen', 'Un resumen de nuestra propuesta');
    change('Ciudad / Destino', destinations[0].id);
}

beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ ok: true, data: { id: 'listing-1' } as ListingDetail });
    Object.defineProperty(window, 'location', { value: { href: '' }, configurable: true });
});

describe('ListingCreateForm', () => {
    it('renders a named kit Section, required controls, hints, counters and a hydration marker', () => {
        const { container } = render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={destinations}
            />
        );
        expect(screen.getByRole('region', { name: 'Datos para empezar' })).toHaveAttribute(
            'data-kit-section'
        );
        expect(container.querySelector('form')).toHaveAttribute('data-hydrated', 'true');
        expect(field('Nombre')).toHaveAttribute('aria-required', 'true');
        expect(field('Nombre')).toHaveAttribute('aria-describedby', 'cc-name-hint cc-name-counter');
        expect(field('Nombre')).toHaveValue('');
        expect(field('Ciudad / Destino')).toHaveValue('');
        expect(screen.getByRole('option', { name: 'Elegí una categoría' })).toHaveValue('');
        expect(screen.getByTestId('listing-create-submit')).toHaveClass('accent');
        change('Resumen', 'Un resumen');
        expect(container.querySelector('#cc-summary-counter')).toHaveTextContent(
            '10 de 300 caracteres'
        );
    });

    it.each([
        'BAR',
        'BOLICHE',
        'HELADERIA'
    ])('leaves business lines and age to the server/editor for %s', async (type) => {
        render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={destinations}
            />
        );
        fill();
        change('Categoría', type);
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Edad mínima/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0]).toEqual({
            vertical: 'venue',
            data: {
                name: 'Una ficha de prueba',
                type,
                summary: 'Un resumen de nuestra propuesta',
                destinationId: destinations[0].id
            }
        });
        expect(window.location.href).toBe('/es/mi-cuenta/comercio/venue/listing-1/editar/');
    });

    it('includes the selected destination and updates the type hint', async () => {
        render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={destinations}
            />
        );
        fill();
        const previousHint = document.getElementById('cc-type-hint')?.textContent;
        change('Categoría', 'BOLICHE');
        expect(document.getElementById('cc-type-hint')?.textContent).not.toBe(previousHint);
        change('Ciudad / Destino', destinations[0].id);
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0].data.destinationId).toBe(destinations[0].id);
    });

    it('blocks an empty form and associates validation errors with the fields', () => {
        render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={destinations}
            />
        );
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        expect(create).not.toHaveBeenCalled();
        expect(field('Nombre')).toHaveAttribute('aria-invalid', 'true');
        expect(field('Nombre')).toHaveAttribute(
            'aria-describedby',
            expect.stringContaining('cc-name-error')
        );
    });

    it.each([true, false])('surfaces an unavailable destination catalog (failed=%s)', (failed) => {
        render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={[]}
                destinationsLoadFailed={failed}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent(
            failed ? /No pudimos cargar/ : /Todavía no hay/
        );
    });

    it('creates an experience with only the four initial fields', async () => {
        render(
            <ListingCreateForm
                locale="es"
                vertical="experience"
                destinations={destinations}
            />
        );
        fill('experience');
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0].data).toEqual({
            name: 'Una ficha de prueba',
            type: 'EXCURSION',
            summary: 'Un resumen de nuestra propuesta',
            destinationId: destinations[0].id
        });
        expect(window.location.href).toBe('/es/mi-cuenta/comercio/experience/listing-1/editar/');
    });

    it.each([
        'venue',
        'experience'
    ] as const)('leaves description and pricing to the %s editor and requires destination', (vertical) => {
        render(
            <ListingCreateForm
                locale="es"
                vertical={vertical}
                destinations={destinations}
            />
        );
        expect(screen.queryByLabelText(/^Descripción/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Precio/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^Unidad de precio/)).not.toBeInTheDocument();
        fill(vertical);
        change('Ciudad / Destino', '');
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        expect(create).not.toHaveBeenCalled();
        expect(field('Ciudad / Destino')).toHaveAttribute('aria-invalid', 'true');
    });

    it('shows API errors and retires the old banner before a retry', async () => {
        create.mockResolvedValueOnce({
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });
        render(
            <ListingCreateForm
                locale="es"
                vertical="venue"
                destinations={destinations}
            />
        );
        fill();
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
        expect(window.location.href).toBe('');
        change('Nombre', '');
        fireEvent.click(screen.getByTestId('listing-create-submit'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(create).toHaveBeenCalledOnce();
    });
});
