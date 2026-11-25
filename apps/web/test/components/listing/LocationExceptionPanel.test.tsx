/**
 * @file LocationExceptionPanel.test.tsx
 * @description Status block of the Ubicacion section (HOS-2192): pending,
 * approved, rejected and none.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const postProtectedMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: postProtectedMock } }));

import { LocationExceptionPanel } from '@/components/listing/LocationExceptionPanel.client';

beforeEach(() => vi.clearAllMocks());

const request = (
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    decisionReason: string | null = null,
    targetsNewAddress = false
) => ({
    id: '11111111-1111-4111-8111-111111111111',
    status,
    reason: 'Motivo del dueño',
    decisionReason,
    requestedAt: '2026-11-15T10:00:00.000Z',
    decidedAt: null,
    targetsNewAddress,
    targetLocation: targetsNewAddress ? { street: 'Mitre', number: '100' } : null
});

const renderPanel = (props: Partial<Parameters<typeof LocationExceptionPanel>[0]> = {}) =>
    render(
        <LocationExceptionPanel
            locale="es"
            vertical="accommodation"
            listingId="listing-1"
            locationDuplicate
            {...props}
        />
    );

describe('LocationExceptionPanel', () => {
    it('none + duplicate: offers "Pedir una excepción"', () => {
        renderPanel({ locationException: { hasException: false, request: null } });
        expect(screen.getByRole('button', { name: 'Pedir una excepción' })).toBeInTheDocument();
    });

    it('none without a duplicate: renders nothing', () => {
        const { container } = renderPanel({ locationDuplicate: false });
        expect(container).toBeEmptyDOMElement();
    });

    it('pending: says "en revisión" and offers no request button', () => {
        renderPanel({ locationException: { hasException: false, request: request('PENDING') } });
        expect(screen.getByTestId('location-exception-pending')).toHaveTextContent(/en revisión/i);
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'info');
    });

    it('approved: says it can publish and offers no request button', () => {
        renderPanel({ locationException: { hasException: true, request: request('APPROVED') } });
        expect(screen.getByTestId('location-exception-approved')).toHaveTextContent(
            /ya podés publicar/i
        );
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('status')).toHaveAttribute('data-tone', 'success');
    });

    it('approved move request: says it can save that address and offers no button', () => {
        renderPanel({
            locationDuplicate: false,
            locationException: { hasException: false, request: request('APPROVED', null, true) }
        });
        expect(screen.getByTestId('location-exception-approved-move')).toHaveTextContent(
            /ya podés guardar esa dirección/i
        );
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('rejected move request: shows the reason and no ask-again button', () => {
        renderPanel({
            locationException: {
                hasException: false,
                request: request('REJECTED', 'No corresponde', true)
            }
        });
        expect(screen.getByTestId('location-exception-rejected')).toHaveTextContent(
            'No corresponde'
        );
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('rejected: shows the admin reason and a button to ask again', () => {
        renderPanel({
            locationException: {
                hasException: false,
                request: request('REJECTED', 'Falta documentación')
            }
        });
        expect(screen.getByTestId('location-exception-rejected')).toHaveTextContent(
            'Falta documentación'
        );
        expect(screen.getByRole('button', { name: 'Volver a pedir' })).toBeInTheDocument();
    });

    it('flips to pending without a reload after a successful request', async () => {
        postProtectedMock.mockResolvedValue({ ok: true, data: { id: 'r1', status: 'PENDING' } });
        const user = userEvent.setup();
        renderPanel({
            vertical: 'venue',
            locationException: { hasException: false, request: null }
        });
        await user.click(screen.getByRole('button', { name: 'Pedir una excepción' }));
        await user.type(screen.getByTestId('location-exception-reason'), 'a'.repeat(15));
        await user.click(screen.getByRole('button', { name: 'Enviar pedido' }));
        expect(await screen.findByTestId('location-exception-pending')).toBeInTheDocument();
        expect(screen.queryByTestId('location-exception-form')).toBeNull();
        expect(postProtectedMock).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/protected/venues/listing-1/location-exception-request'
            })
        );
    });
});
