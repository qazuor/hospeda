/**
 * @file LocationExceptionRequestForm.test.tsx
 * @description The owner's "Pedir una excepción" form (HOS-2192): 10-character
 * validation, counter, payload and endpoint per vertical, and the 409/400 mapping.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtectedMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: postProtectedMock } }));

import { LocationExceptionRequestForm } from '@/components/listing/LocationExceptionRequestForm.client';

beforeEach(() => vi.clearAllMocks());

async function fillAndSubmit({
    text,
    vertical = 'accommodation'
}: {
    readonly text: string;
    readonly vertical?: 'accommodation' | 'venue';
}) {
    const user = userEvent.setup();
    const onSent = vi.fn();
    render(
        <LocationExceptionRequestForm
            locale="es"
            vertical={vertical}
            listingId="listing-1"
            onSent={onSent}
        />
    );
    await user.type(screen.getByTestId('location-exception-reason'), text);
    await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
    return { onSent };
}

describe('LocationExceptionRequestForm', () => {
    it('does not submit a 9-character reason and shows the validation message', async () => {
        await fillAndSubmit({ text: 'a'.repeat(9) });
        expect(postProtectedMock).not.toHaveBeenCalled();
        expect(screen.getByTestId('location-exception-validation')).toHaveTextContent(
            /al menos 10/i
        );
    });

    it('shows the live counter', async () => {
        const user = userEvent.setup();
        render(
            <LocationExceptionRequestForm
                locale="es"
                vertical="venue"
                listingId="listing-1"
            />
        );
        await user.type(screen.getByTestId('location-exception-reason'), 'hola');
        expect(screen.getByTestId('location-exception-counter')).toHaveTextContent('4 de 500');
    });

    it.each([
        ['accommodation', 'accommodations'],
        ['venue', 'venues']
    ] as const)('submits a 10-character reason to the %s endpoint', async (vertical, plural) => {
        postProtectedMock.mockResolvedValue({ ok: true, data: { id: 'r1', status: 'PENDING' } });
        const { onSent } = await fillAndSubmit({ text: 'a'.repeat(10), vertical });
        expect(postProtectedMock).toHaveBeenCalledWith({
            path: `/api/v1/protected/${plural}/listing-1/location-exception-request`,
            body: { reason: 'a'.repeat(10) }
        });
        expect(onSent).toHaveBeenCalledTimes(1);
        expect(await screen.findByTestId('location-exception-sent')).toBeInTheDocument();
    });

    it.each([
        ['LOCATION_EXCEPTION_REQUEST_PENDING', /ya tenés un pedido de excepción en revisión/i],
        ['LOCATION_EXCEPTION_ALREADY_GRANTED', /ya tiene la excepción aprobada/i],
        ['LOCATION_EXCEPTION_NOT_NEEDED', /no comparte dirección/i],
        ['LOCATION_EXCEPTION_NEEDS_KEY', /completá la dirección/i]
    ])('maps the 409 %s to its own message, not the generic one', async (reason, message) => {
        postProtectedMock.mockResolvedValue({
            ok: false,
            error: { status: 409, code: 'ALREADY_EXISTS', reason, message: 'x' }
        });
        const { onSent } = await fillAndSubmit({ text: 'a'.repeat(12) });
        const error = await screen.findByTestId('location-exception-error');
        expect(error).toHaveTextContent(message);
        expect(error).not.toHaveTextContent(/probá de nuevo/i);
        expect(onSent).not.toHaveBeenCalled();
    });

    it('maps a 400 to the invalid-reason message', async () => {
        postProtectedMock.mockResolvedValue({
            ok: false,
            error: { status: 400, code: 'VALIDATION_ERROR', message: 'x' }
        });
        await fillAndSubmit({ text: 'a'.repeat(12) });
        expect(await screen.findByTestId('location-exception-error')).toHaveTextContent(
            /entre 10 y 500/i
        );
    });
});
