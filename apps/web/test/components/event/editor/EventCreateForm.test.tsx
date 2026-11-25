/** Event create contract, organizer recovery and kit semantics. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventCreateForm } from '@/components/event/editor/EventCreateForm.client';
import { eventEditApi, eventOrganizerApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/endpoints-protected', () => ({
    eventEditApi: { create: vi.fn() },
    eventOrganizerApi: { create: vi.fn() }
}));
const create = vi.mocked(eventEditApi.create);
const createOrganizer = vi.mocked(eventOrganizerApi.create);
const organizerId = '11111111-1111-4111-8111-111111111111';
const newOrganizerId = '22222222-2222-4222-8222-222222222222';
const organizers = [{ id: organizerId, name: 'Municipalidad' }];
const description =
    'Un evento con una descripción suficientemente larga para cumplir el contrato HTTP.';
const field = (label: string) =>
    screen.getByLabelText(new RegExp(`^${label}(?:\\*?\\s*obligatorio)?$`));
const change = (label: string, value: string) =>
    fireEvent.change(field(label), { target: { value } });
function fill() {
    change('Nombre', 'Festival de prueba');
    change('Categoría', 'CULTURE');
    change('Descripción', description);
    change('Comienza', '2027-01-10T18:00');
    change('Termina', '2027-01-10T22:00');
}

beforeEach(() => {
    create.mockReset();
    createOrganizer.mockReset();
    create.mockResolvedValue({ ok: true, data: { id: 'event-1' } });
    Object.defineProperty(window, 'location', { value: { href: '' }, configurable: true });
});

describe('EventCreateForm', () => {
    it('renders a non-duplicate Section title, hints, counters, placeholders and required controls', () => {
        const { container } = render(
            <EventCreateForm
                locale="es"
                organizers={organizers}
            />
        );
        expect(screen.getByRole('region', { name: 'Datos del evento' })).toHaveAttribute(
            'data-kit-section'
        );
        expect(container.querySelector('form')).toHaveAttribute('data-hydrated', 'true');
        for (const label of [
            'Nombre',
            'Categoría',
            'Descripción',
            'Comienza',
            'Termina',
            'Organiza'
        ]) {
            expect(field(label)).toHaveAttribute('aria-required', 'true');
        }
        expect(field('Nombre')).toHaveAttribute('minlength', '5');
        expect(field('Nombre')).toHaveAttribute('maxlength', '200');
        expect(field('Descripción')).toHaveAttribute(
            'aria-describedby',
            'ec-description-hint ec-description-counter'
        );
        expect(screen.getByRole('option', { name: 'Elegí una categoría' })).toHaveValue('');
        expect(screen.getByRole('option', { name: 'Elegí un organizador' })).toHaveValue('');
        expect(screen.getByTestId('event-create-submit')).toHaveClass('primary');
    });

    it('blocks empty values, short descriptions and reversed dates', () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={organizers}
            />
        );
        fireEvent.click(screen.getByTestId('event-create-submit'));
        expect(field('Nombre')).toHaveAttribute('aria-invalid', 'true');
        fill();
        change('Organiza', organizerId);
        change('Descripción', 'Corta');
        fireEvent.click(screen.getByTestId('event-create-submit'));
        expect(field('Descripción')).toHaveAttribute('aria-invalid', 'true');
        change('Descripción', description);
        change('Termina', '2027-01-09T18:00');
        fireEvent.click(screen.getByTestId('event-create-submit'));
        expect(field('Termina')).toHaveAttribute('aria-invalid', 'true');
        expect(
            screen.getByText('La fecha de fin no puede ser anterior a la fecha de inicio.')
        ).toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();
    });

    it('creates only the required payload and redirects to the editor', async () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={organizers}
            />
        );
        fill();
        change('Organiza', organizerId);
        fireEvent.click(screen.getByTestId('event-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0].data).toEqual({
            name: 'Festival de prueba',
            description,
            category: 'CULTURE',
            startDate: new Date('2027-01-10T18:00'),
            endDate: new Date('2027-01-10T22:00'),
            organizerId
        });
        expect(window.location.href).toBe('/es/mi-cuenta/eventos/event-1/editar/');
    });

    it.each([
        true,
        false
    ])('allows inline creation when the catalog is unusable (failed=%s)', async (failed) => {
        createOrganizer.mockResolvedValue({
            ok: true,
            data: { id: newOrganizerId, name: 'Club nuevo' }
        });
        render(
            <EventCreateForm
                locale="es"
                organizers={[]}
                organizersLoadFailed={failed}
            />
        );
        expect(
            screen.getByTestId(
                failed ? 'event-organizer-load-error' : 'event-organizer-empty-notice'
            )
        ).toBeInTheDocument();
        fill();
        change('Nombre del organizador', 'Club nuevo');
        fireEvent.click(screen.getByTestId('event-organizer-create-submit'));
        await waitFor(() => expect(field('Organiza')).toHaveValue(newOrganizerId));
        expect(field('Nombre')).toHaveValue('Festival de prueba');
        expect(field('Descripción')).toHaveValue(description);
        expect(createOrganizer).toHaveBeenCalledWith({ data: { name: 'Club nuevo' } });
        fireEvent.click(screen.getByTestId('event-create-submit'));
        await waitFor(() => expect(create).toHaveBeenCalledOnce());
        expect(create.mock.calls[0]?.[0].data.organizerId).toBe(newOrganizerId);
    });

    it('validates an inline organizer, preserves event state after API failure, and can cancel', async () => {
        createOrganizer.mockResolvedValue({
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });
        render(
            <EventCreateForm
                locale="es"
                organizers={organizers}
            />
        );
        fill();
        change('Organiza', organizerId);
        fireEvent.click(screen.getByTestId('event-organizer-create-toggle'));
        fireEvent.click(screen.getByTestId('event-organizer-create-submit'));
        expect(screen.getByTestId('event-organizer-create-error')).toHaveTextContent(
            'entre 3 y 100'
        );
        expect(createOrganizer).not.toHaveBeenCalled();
        change('Nombre del organizador', 'Club nuevo');
        fireEvent.click(screen.getByTestId('event-organizer-create-submit'));
        await waitFor(() =>
            expect(screen.getByTestId('event-organizer-create-error')).toHaveTextContent(
                'No pudimos crear'
            )
        );
        expect(field('Descripción')).toHaveValue(description);
        fireEvent.click(screen.getByTestId('event-organizer-create-cancel'));
        expect(field('Organiza')).toHaveValue(organizerId);
        expect(screen.queryByTestId('event-organizer-create-block')).not.toBeInTheDocument();
    });

    it('retires the previous API banner before a validation-failed retry', async () => {
        create.mockResolvedValue({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } });
        render(
            <EventCreateForm
                locale="es"
                organizers={organizers}
            />
        );
        fill();
        change('Organiza', organizerId);
        fireEvent.click(screen.getByTestId('event-create-submit'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
        expect(window.location.href).toBe('');
        change('Nombre', '');
        fireEvent.click(screen.getByTestId('event-create-submit'));
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(create).toHaveBeenCalledOnce();
    });
});
