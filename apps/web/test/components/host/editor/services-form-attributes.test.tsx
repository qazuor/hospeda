/**
 * @file services-form-attributes.test.tsx
 * @description Round trip of the HOS-2058 per-amenity scope/availability
 * declarations through the services page: what the host picks in the details
 * dialog (HOS-2123; an inline "Detalles" disclosure before it) must reach the
 * PATCH body as the write-only `amenityAttributes` list the API applies to the
 * final linked set, and nothing must be sent when the declarations did not
 * change — including when the host cancels the dialog.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn();
const mockAddToast = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: (...args: unknown[]) => mockUpdate(...args) }
}));

vi.mock('@/store/toast-store', () => ({ addToast: (...args: unknown[]) => mockAddToast(...args) }));

const { ServicesForm } = await import('@/components/host/editor/forms/ServicesForm.client');

const POOL = '11111111-1111-4111-8111-111111111111';
const GRILL = '22222222-2222-4222-8222-222222222222';

const INITIAL = {
    id: 'acc-123',
    name: 'Hotel Test',
    amenityIds: [POOL],
    amenityAttributes: { [POOL]: { scope: 'shared', availability: null } },
    featureIds: [],
    policies: {},
    videos: []
} as any;

const AMENITIES = [
    { id: POOL, slug: 'pool', category: 'OUTDOORS' },
    { id: GRILL, slug: 'grill', category: 'OUTDOORS' }
] as any;

function renderForm() {
    return render(
        <ServicesForm
            locale="es"
            accommodationId="acc-123"
            initialData={INITIAL}
            amenities={AMENITIES}
            features={[]}
        />
    );
}

function submit() {
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

/** Opens the details dialog of the pool, the one amenity that already has details. */
async function openPoolDetails(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /^Detalles de / }));
    return screen.getByRole('dialog');
}

beforeEach(() => {
    mockUpdate.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('ServicesForm amenityAttributes (HOS-2058, dialog since HOS-2123)', () => {
    it('summarizes the declared values next to the selected tile', () => {
        renderForm();

        expect(screen.getByText('Compartido')).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('loads the declared values into the dialog radios', async () => {
        const user = userEvent.setup();
        renderForm();

        const dialog = await openPoolDetails(user);

        expect(within(dialog).getByRole('radio', { name: 'Compartido' })).toBeChecked();
    });

    it('sends only amenityAttributes when the host declares availability and applies', async () => {
        const user = userEvent.setup();
        renderForm();

        const dialog = await openPoolDetails(user);
        await user.click(within(dialog).getByRole('radio', { name: 'De temporada' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0].data).toEqual({
            amenityAttributes: [{ amenityId: POOL, scope: 'shared', availability: 'seasonal' }]
        });
    });

    it('sends amenityIds plus the attributes of a newly selected amenity', async () => {
        const user = userEvent.setup();
        renderForm();

        const [grillTile] = screen.getAllByRole('button', { pressed: false });
        await user.click(grillTile as HTMLButtonElement);
        await user.click(screen.getByRole('button', { name: /^Agregar detalles a / }));
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('radio', { name: 'Privado' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        const body = mockUpdate.mock.calls[0][0].data as Record<string, unknown>;
        expect(body.amenityIds).toEqual([POOL, GRILL]);
        expect(body.amenityAttributes).toEqual([
            { amenityId: POOL, scope: 'shared', availability: null },
            { amenityId: GRILL, scope: 'private', availability: null }
        ]);
    });

    it('sends extraCharge true when the host checks "Con cargo extra" (HOS-2084)', async () => {
        const user = userEvent.setup();
        renderForm();

        const dialog = await openPoolDetails(user);
        await user.click(within(dialog).getByRole('checkbox', { name: 'Con cargo extra' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0].data).toEqual({
            amenityAttributes: [
                { amenityId: POOL, scope: 'shared', availability: null, extraCharge: true }
            ]
        });
    });

    it('discards the draft when the host cancels the dialog', async () => {
        const user = userEvent.setup();
        renderForm();

        const dialog = await openPoolDetails(user);
        await user.click(within(dialog).getByRole('radio', { name: 'Privado' }));
        await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
        submit();

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(screen.getByText('Compartido')).toBeInTheDocument();
    });

    it('treats a change put back to its saved value as no change', async () => {
        const user = userEvent.setup();
        renderForm();

        const dialog = await openPoolDetails(user);
        await user.click(within(dialog).getByRole('radio', { name: 'Privado' }));
        await user.click(within(dialog).getByRole('radio', { name: 'Compartido' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
        submit();

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(mockUpdate).not.toHaveBeenCalled();
    });
    it('drops the attributes of an amenity the host deselects (regression)', async () => {
        const user = userEvent.setup();
        renderForm();

        // Declare something new on the pool so its entry would differ...
        const dialog = await openPoolDetails(user);
        await user.click(within(dialog).getByRole('radio', { name: 'De temporada' }));
        await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
        // ...then untoggle its tile.
        const [poolTile] = screen.getAllByRole('button', { pressed: true });
        await user.click(poolTile as HTMLButtonElement);
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        const body = mockUpdate.mock.calls[0][0].data as Record<string, unknown>;
        expect(body.amenityIds).toEqual([]);
        const entries = (body.amenityAttributes ?? []) as ReadonlyArray<{ amenityId: string }>;
        expect(entries.some((entry) => entry.amenityId === POOL)).toBe(false);
    });

    it('never sends policies from the services page (HOS-2123)', async () => {
        const user = userEvent.setup();
        render(
            <ServicesForm
                locale="es"
                accommodationId="acc-123"
                initialData={{ ...INITIAL, policies: { smokingAllowed: 'no', checkIn: '14:00' } }}
                amenities={AMENITIES}
                features={[]}
            />
        );

        const [grillTile] = screen.getAllByRole('button', { pressed: false });
        await user.click(grillTile as HTMLButtonElement);
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty('policies');
    });
});
