/**
 * @file LocationExceptionRequestTrigger.test.tsx
 * @description The request shown under a refused location save (HOS-2192, D-23)
 * carries the submitted address and no key.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtectedMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: postProtectedMock } }));

import { LocationExceptionRequestTrigger } from '@/components/listing/LocationExceptionRequestTrigger.client';

beforeEach(() => vi.clearAllMocks());

describe('LocationExceptionRequestTrigger', () => {
    it('posts the reason with the submitted address to the vertical endpoint', async () => {
        postProtectedMock.mockResolvedValue({ ok: true, data: { id: 'r1', status: 'PENDING' } });
        const user = userEvent.setup();
        render(
            <LocationExceptionRequestTrigger
                locale="es"
                vertical="venue"
                listingId="listing-1"
                location={{ street: 'Av. San Martin', number: '10' }}
            />
        );
        await user.click(screen.getByRole('button', { name: 'Pedir una excepción' }));
        await user.type(screen.getByTestId('location-exception-reason'), 'a'.repeat(12));
        await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
        expect(postProtectedMock).toHaveBeenCalledWith({
            path: '/api/v1/protected/venues/listing-1/location-exception-request',
            body: { reason: 'a'.repeat(12), location: { street: 'Av. San Martin', number: '10' } }
        });
        expect(await screen.findByTestId('location-exception-sent')).toBeInTheDocument();
    });
});
