/**
 * @file ReceivedReviewsPanel.test.tsx
 * @description The host's received reviews and reply controls (HOS-2199).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
    listReceived: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
}));

vi.mock('../../../src/lib/api/endpoints-protected-review-replies', () => ({
    reviewRepliesApi: api
}));

import { ReceivedReviewsPanel } from '../../../src/components/account/ReceivedReviewsPanel.client';

const REVIEW = {
    id: '22222222-2222-4222-8222-222222222222',
    accommodationId: '11111111-1111-4111-8111-111111111111',
    accommodationName: 'Casa del Litoral',
    accommodationSlug: 'casa-del-litoral',
    title: 'Excelente estadía',
    content: 'Muy buen lugar.',
    averageRating: 4.5,
    createdAt: '2026-11-01T10:00:00Z',
    reviewerName: 'Ana P.',
    reply: null
};

const REPLY = {
    id: '33333333-3333-4333-8333-333333333333',
    reviewId: REVIEW.id,
    content: 'Gracias por tu visita',
    moderationState: 'APPROVED',
    createdAt: '2026-11-02T10:00:00Z',
    editedAt: null
};

function page(items: unknown[], canRespond = true) {
    return { ok: true, data: { items, total: items.length, canRespond } };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ReceivedReviewsPanel', () => {
    it('lists a received review with its reviewer, listing and text', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW]));

        render(<ReceivedReviewsPanel locale="es" />);

        expect(await screen.findByText('Muy buen lugar.')).toBeInTheDocument();
        expect(screen.getByText('Ana P.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Casa del Litoral' })).toHaveAttribute(
            'href',
            expect.stringContaining('alojamientos/casa-del-litoral')
        );
    });

    it('asks only for unanswered reviews when the filter is chosen', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW]));
        render(<ReceivedReviewsPanel locale="es" />);
        await screen.findByText('Muy buen lugar.');

        fireEvent.click(screen.getByRole('button', { name: 'Sin responder' }));

        await waitFor(() =>
            expect(api.listReceived).toHaveBeenLastCalledWith(
                expect.objectContaining({ unanswered: true, page: 1 })
            )
        );
    });

    it('publishes a reply and shows it in place of the form', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW]));
        api.create.mockResolvedValue({ ok: true, data: REPLY });
        render(<ReceivedReviewsPanel locale="es" />);
        await screen.findByText('Muy buen lugar.');

        fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
        fireEvent.change(screen.getByLabelText('Tu respuesta'), {
            target: { value: '  Gracias por tu visita  ' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));

        await waitFor(() =>
            expect(api.create).toHaveBeenCalledWith({
                accommodationId: REVIEW.accommodationId,
                reviewId: REVIEW.id,
                content: 'Gracias por tu visita'
            })
        );
        expect(await screen.findByText('Gracias por tu visita')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Editar respuesta' })).toBeInTheDocument();
    });

    it('does not send an empty reply', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW]));
        render(<ReceivedReviewsPanel locale="es" />);
        await screen.findByText('Muy buen lugar.');

        fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
        fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));

        expect(await screen.findByText('Escribí una respuesta.')).toBeInTheDocument();
        expect(api.create).not.toHaveBeenCalled();
    });

    it('edits an existing reply through the update endpoint and marks it as edited', async () => {
        api.listReceived.mockResolvedValue(page([{ ...REVIEW, reply: REPLY }]));
        api.update.mockResolvedValue({
            ok: true,
            data: { ...REPLY, content: 'Texto nuevo', editedAt: '2026-11-03T10:00:00Z' }
        });
        render(<ReceivedReviewsPanel locale="es" />);
        await screen.findByText('Gracias por tu visita');

        fireEvent.click(screen.getByRole('button', { name: 'Editar respuesta' }));
        fireEvent.change(screen.getByLabelText('Tu respuesta'), {
            target: { value: 'Texto nuevo' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        await waitFor(() =>
            expect(api.update).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Texto nuevo' })
            )
        );
        expect(await screen.findByText('Texto nuevo')).toBeInTheDocument();
        expect(screen.getByText(/editada/)).toBeInTheDocument();
        expect(api.create).not.toHaveBeenCalled();
    });

    it('tells the host a held reply is not public yet', async () => {
        api.listReceived.mockResolvedValue(
            page([{ ...REVIEW, reply: { ...REPLY, moderationState: 'PENDING' } }])
        );

        render(<ReceivedReviewsPanel locale="es" />);

        expect(
            await screen.findByText(/está en revisión y todavía no se muestra/)
        ).toBeInTheDocument();
    });

    it('offers no edit on a reply an admin hid, only deletion', async () => {
        api.listReceived.mockResolvedValue(
            page([{ ...REVIEW, reply: { ...REPLY, moderationState: 'REJECTED' } }])
        );

        render(<ReceivedReviewsPanel locale="es" />);

        expect(await screen.findByText(/ocultó esta respuesta/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar respuesta' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Eliminar respuesta' })).toBeInTheDocument();
    });

    it('replaces the reply controls with an upsell when the plan lacks the entitlement', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW], false));

        render(<ReceivedReviewsPanel locale="es" />);

        expect(await screen.findByText('Responder reseñas no está en tu plan')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Responder' })).toBeNull();
    });

    it('still lets a host without the entitlement delete an existing reply', async () => {
        api.listReceived.mockResolvedValue(page([{ ...REVIEW, reply: REPLY }], false));

        render(<ReceivedReviewsPanel locale="es" />);

        expect(
            await screen.findByRole('button', { name: 'Eliminar respuesta' })
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar respuesta' })).toBeNull();
    });

    it('shows the entitlement message when the API refuses the write', async () => {
        api.listReceived.mockResolvedValue(page([REVIEW]));
        api.create.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' }
        });
        render(<ReceivedReviewsPanel locale="es" />);
        await screen.findByText('Muy buen lugar.');

        fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
        fireEvent.change(screen.getByLabelText('Tu respuesta'), { target: { value: 'Hola' } });
        fireEvent.click(screen.getByRole('button', { name: 'Publicar respuesta' }));

        expect(
            await screen.findByText('Tu plan actual no incluye responder reseñas.')
        ).toBeInTheDocument();
    });

    it('shows the empty state of the unanswered filter', async () => {
        api.listReceived.mockResolvedValue(page([]));

        render(<ReceivedReviewsPanel locale="es" />);

        expect(await screen.findByText('Todavía no recibiste reseñas')).toBeInTheDocument();
    });
});
