/**
 * @file services-form-attributes.test.tsx
 * @description Round trip of the HOS-2058 per-amenity scope/availability
 * declarations through the services page: what the host picks in the
 * "Detalles" disclosure must reach the PATCH body as the write-only
 * `amenityAttributes` list the API applies to the final linked set, and
 * nothing must be sent when the declarations did not change.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // HOS-2060: the services page also carries the Policies panel.
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

beforeEach(() => {
    mockUpdate.mockResolvedValue({ ok: true, data: {} });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('ServicesForm amenityAttributes (HOS-2058)', () => {
    it('loads the declared values into the radios', () => {
        renderForm();

        const shared = document.querySelector<HTMLInputElement>(
            `input[name$="-amenity-${POOL}-scope"]:checked`
        );
        expect(shared?.parentElement?.textContent).toBe('Compartido');
    });

    it('sends only amenityAttributes when the host declares availability', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(screen.getByRole('radio', { name: 'De temporada' }));
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0].data).toEqual({
            amenityAttributes: [{ amenityId: POOL, scope: 'shared', availability: 'seasonal' }]
        });
    });

    it('sends amenityIds plus the attributes of a newly checked amenity', async () => {
        const user = userEvent.setup();
        renderForm();

        const grill = document.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]:not([name$="-extra-charge"])'
        )[1];
        await user.click(grill as HTMLInputElement);
        const grillPrivate = document.querySelector(
            `input[name$="-amenity-${GRILL}-scope"]`
        ) as HTMLInputElement;
        await user.click(grillPrivate);
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

        await user.click(screen.getByRole('checkbox', { name: 'Con cargo extra' }));
        submit();

        await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
        expect(mockUpdate.mock.calls[0][0].data).toEqual({
            amenityAttributes: [
                { amenityId: POOL, scope: 'shared', availability: null, extraCharge: true }
            ]
        });
    });

    it('treats a change put back to its saved value as no change', async () => {
        const user = userEvent.setup();
        renderForm();

        await user.click(screen.getByRole('radio', { name: 'Privado' }));
        await user.click(screen.getByRole('radio', { name: 'Compartido' }));
        submit();

        await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
