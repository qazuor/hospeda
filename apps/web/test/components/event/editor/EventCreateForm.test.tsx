/**
 * @file EventCreateForm.test.tsx
 * @description RTL tests for the editor self-service event create form island
 * (HOS-374 §5.2.2).
 *
 * Covers: all required fields render, submitting an invalid payload
 * (description under the 50-char minimum) surfaces validation and never
 * calls the create endpoint, a valid submit calls `eventEditApi.create` with
 * the right payload and redirects to the editor URL, an API error surfaces
 * via `handleApiError` without redirecting, the three organizer-catalog
 * states (loaded / load-failed / genuinely-empty), inline organizer creation
 * selecting the new organizer without losing typed event fields, and an
 * `endDate` before `startDate` being refused.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventCreateForm } from '../../../../src/components/event/editor/EventCreateForm.client';

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../../src/components/event/editor/EventCreateForm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../../src/lib/urls', () => ({
    buildUrl: ({ locale, path = '' }: { locale: string; path?: string }) => `/${locale}/${path}/`
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    eventEditApi: { create: vi.fn() },
    eventOrganizerApi: { create: vi.fn() }
}));

import { eventEditApi, eventOrganizerApi } from '../../../../src/lib/api/endpoints-protected';

const mockCreateEvent = vi.mocked(eventEditApi.create);
const mockCreateOrganizer = vi.mocked(eventOrganizerApi.create);

const VALID_DESCRIPTION =
    'Un texto lo suficientemente largo como para superar el mínimo de cincuenta caracteres que exige el esquema de creación de eventos.';

// `organizerId` is validated as a real UUID by `EventCreateHttpSchema`
// (`.pick()`ed, unchanged, into this form's schema) — fixture ids must be
// valid UUIDs or every submit test fails validation before reaching the API.
const ORGANIZER_1_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZER_2_ID = '22222222-2222-4222-8222-222222222222';
const NEW_ORGANIZER_ID = '33333333-3333-4333-8333-333333333333';

const ORGANIZERS = [
    { id: ORGANIZER_1_ID, name: 'Municipalidad' },
    { id: ORGANIZER_2_ID, name: 'Club de Pesca' }
];

function fillValidEventFields(): void {
    fireEvent.change(screen.getByLabelText('Nombre'), {
        target: { value: 'Un evento de prueba' }
    });
    fireEvent.change(screen.getByLabelText('Categoría'), {
        target: { value: 'CULTURE' }
    });
    fireEvent.change(screen.getByLabelText('Descripción'), {
        target: { value: VALID_DESCRIPTION }
    });
    fireEvent.change(screen.getByLabelText('Comienza'), {
        target: { value: '2027-01-10T18:00' }
    });
    fireEvent.change(screen.getByLabelText('Termina'), {
        target: { value: '2027-01-10T22:00' }
    });
}

beforeEach(() => {
    mockCreateEvent.mockReset();
    mockCreateOrganizer.mockReset();
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

describe('EventCreateForm', () => {
    it('renders all required fields when organizers are loaded', () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );

        expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
        expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
        expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
        expect(screen.getByLabelText('Comienza')).toBeInTheDocument();
        expect(screen.getByLabelText('Termina')).toBeInTheDocument();
        expect(screen.getByLabelText('Organiza')).toBeInTheDocument();
        expect(screen.getByTestId('event-create-submit')).toBeInTheDocument();
    });

    it('does not submit and shows validation when description is under the 50-char minimum', async () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );

        fireEvent.change(screen.getByLabelText('Nombre'), {
            target: { value: 'Un evento de prueba' }
        });
        fireEvent.change(screen.getByLabelText('Categoría'), {
            target: { value: 'CULTURE' }
        });
        fireEvent.change(screen.getByLabelText('Descripción'), {
            target: { value: 'Demasiado corto.' }
        });
        fireEvent.change(screen.getByLabelText('Comienza'), {
            target: { value: '2027-01-10T18:00' }
        });
        fireEvent.change(screen.getByLabelText('Termina'), {
            target: { value: '2027-01-10T22:00' }
        });
        fireEvent.change(screen.getByLabelText('Organiza'), {
            target: { value: ORGANIZER_1_ID }
        });

        fireEvent.click(screen.getByTestId('event-create-submit'));

        await waitFor(() => {
            expect(screen.getByText(/50 y 2000 caracteres/i)).toBeInTheDocument();
        });
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('does not submit when required fields are empty', async () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );

        fireEvent.click(screen.getByTestId('event-create-submit'));

        await waitFor(() => {
            expect(mockCreateEvent).not.toHaveBeenCalled();
        });
    });

    it('refuses an endDate before startDate without calling the API', async () => {
        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );

        fireEvent.change(screen.getByLabelText('Nombre'), {
            target: { value: 'Un evento de prueba' }
        });
        fireEvent.change(screen.getByLabelText('Categoría'), {
            target: { value: 'CULTURE' }
        });
        fireEvent.change(screen.getByLabelText('Descripción'), {
            target: { value: VALID_DESCRIPTION }
        });
        fireEvent.change(screen.getByLabelText('Comienza'), {
            target: { value: '2027-01-10T18:00' }
        });
        fireEvent.change(screen.getByLabelText('Termina'), {
            target: { value: '2027-01-10T10:00' } // before startDate
        });
        fireEvent.change(screen.getByLabelText('Organiza'), {
            target: { value: ORGANIZER_1_ID }
        });

        fireEvent.click(screen.getByTestId('event-create-submit'));

        // The mocked `t()` (see the top-of-file mock) resolves every key to
        // itself when no explicit fallback reaches it, which is exactly what
        // happens for a `.refine()` message routed through
        // `zodIssuesToFieldErrors` → `resolveValidationMessage` (it always
        // calls `t(key, undefined, params)`, dropping the schema-authored
        // fallback). So under this mock the endDate field surfaces the raw
        // i18n KEY, not the translated Spanish copy — asserting on
        // `aria-invalid` plus the key text is what is actually observable
        // here, and is enough to prove the check fired and blocked submit.
        await waitFor(() => {
            expect(screen.getByLabelText('Termina')).toHaveAttribute('aria-invalid', 'true');
        });
        expect(
            screen.getByText('account.myContent.events.create.dateOrderError')
        ).toBeInTheDocument();
        expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it('submits the picked create payload and redirects to the editor on success', async () => {
        mockCreateEvent.mockResolvedValue({ ok: true, data: { id: 'event-1' } });

        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );
        fillValidEventFields();
        fireEvent.change(screen.getByLabelText('Organiza'), {
            target: { value: ORGANIZER_1_ID }
        });

        fireEvent.click(screen.getByTestId('event-create-submit'));

        await waitFor(() => {
            expect(mockCreateEvent).toHaveBeenCalledTimes(1);
        });

        const call = mockCreateEvent.mock.calls[0]?.[0];
        expect(call?.data).toMatchObject({
            name: 'Un evento de prueba',
            category: 'CULTURE',
            description: VALID_DESCRIPTION,
            organizerId: ORGANIZER_1_ID
        });
        // Never sent from the create form (HOS-374 D-2 / mirrors PostCreateForm).
        expect(call?.data).not.toHaveProperty('authorId');
        expect(call?.data).not.toHaveProperty('slug');
        expect(call?.data).not.toHaveProperty('locationId');

        await waitFor(() => {
            expect(window.location.href).toContain('/mi-cuenta/eventos/event-1/editar');
        });
    });

    it('surfaces an API error via handleApiError and does not redirect', async () => {
        mockCreateEvent.mockResolvedValue({
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        });

        render(
            <EventCreateForm
                locale="es"
                organizers={ORGANIZERS}
            />
        );
        fillValidEventFields();
        fireEvent.change(screen.getByLabelText('Organiza'), {
            target: { value: ORGANIZER_1_ID }
        });

        fireEvent.click(screen.getByTestId('event-create-submit'));

        await waitFor(() => {
            expect(mockCreateEvent).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
        expect(window.location.href).toBe('');
    });

    describe('organizer catalog states', () => {
        it('shows an explicit error (not a silently empty select) when the catalog fetch failed', () => {
            render(
                <EventCreateForm
                    locale="es"
                    organizers={[]}
                    organizersLoadFailed
                />
            );

            expect(screen.getByTestId('event-organizer-load-error')).toBeInTheDocument();
            // No select rendered on a failed fetch — the inline create block is shown instead.
            expect(screen.queryByLabelText('Organiza')).not.toBeInTheDocument();
            expect(screen.getByTestId('event-organizer-create-block')).toBeInTheDocument();
        });

        it('offers only the inline create path when the catalog is genuinely empty', () => {
            render(
                <EventCreateForm
                    locale="es"
                    organizers={[]}
                />
            );

            expect(screen.queryByTestId('event-organizer-load-error')).not.toBeInTheDocument();
            expect(screen.getByTestId('event-organizer-empty-notice')).toBeInTheDocument();
            expect(screen.getByTestId('event-organizer-create-block')).toBeInTheDocument();
        });

        it('shows the select plus a toggle when organizers are loaded', () => {
            render(
                <EventCreateForm
                    locale="es"
                    organizers={ORGANIZERS}
                />
            );

            expect(screen.getByLabelText('Organiza')).toBeInTheDocument();
            expect(screen.getByTestId('event-organizer-create-toggle')).toBeInTheDocument();
            expect(screen.queryByTestId('event-organizer-create-block')).not.toBeInTheDocument();
        });
    });

    describe('inline organizer creation', () => {
        it('selects the newly created organizer without losing already-typed event fields', async () => {
            mockCreateOrganizer.mockResolvedValue({
                ok: true,
                data: { id: NEW_ORGANIZER_ID, name: 'Nuevo Club' }
            });

            render(
                <EventCreateForm
                    locale="es"
                    organizers={ORGANIZERS}
                />
            );

            // Type event fields BEFORE touching the organizer sub-form.
            fillValidEventFields();

            fireEvent.click(screen.getByTestId('event-organizer-create-toggle'));
            fireEvent.change(screen.getByPlaceholderText('Nombre del organizador'), {
                target: { value: 'Nuevo Club' }
            });
            fireEvent.click(screen.getByTestId('event-organizer-create-submit'));

            await waitFor(() => {
                expect(mockCreateOrganizer).toHaveBeenCalledTimes(1);
            });
            expect(mockCreateOrganizer.mock.calls[0]?.[0].data).toEqual({ name: 'Nuevo Club' });

            // Back to select mode, with the new organizer selected.
            await waitFor(() => {
                expect(screen.getByLabelText('Organiza')).toHaveValue(NEW_ORGANIZER_ID);
            });

            // Event fields typed earlier survived the organizer round-trip.
            expect(screen.getByLabelText('Nombre')).toHaveValue('Un evento de prueba');
            expect(screen.getByLabelText('Descripción')).toHaveValue(VALID_DESCRIPTION);

            // The event can now be submitted successfully.
            mockCreateEvent.mockResolvedValue({ ok: true, data: { id: 'event-2' } });
            fireEvent.click(screen.getByTestId('event-create-submit'));
            await waitFor(() => {
                expect(mockCreateEvent).toHaveBeenCalledTimes(1);
            });
            expect(mockCreateEvent.mock.calls[0]?.[0].data).toMatchObject({
                organizerId: NEW_ORGANIZER_ID
            });
        });

        it('surfaces an organizer creation failure without wiping typed event fields', async () => {
            mockCreateOrganizer.mockResolvedValue({
                ok: false,
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });

            render(
                <EventCreateForm
                    locale="es"
                    organizers={[]}
                />
            );

            fillValidEventFields();

            fireEvent.change(screen.getByPlaceholderText('Nombre del organizador'), {
                target: { value: 'Nuevo Club' }
            });
            fireEvent.click(screen.getByTestId('event-organizer-create-submit'));

            await waitFor(() => {
                expect(screen.getByTestId('event-organizer-create-error')).toBeInTheDocument();
            });

            // The organizer creation failure never touched the event fields.
            expect(screen.getByLabelText('Nombre')).toHaveValue('Un evento de prueba');
            expect(screen.getByLabelText('Descripción')).toHaveValue(VALID_DESCRIPTION);
            expect(screen.getByLabelText('Comienza')).toHaveValue('2027-01-10T18:00');
            expect(mockCreateEvent).not.toHaveBeenCalled();
        });
    });
});
