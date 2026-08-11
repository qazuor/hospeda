/**
 * @file ReviewReplyForm.test.tsx
 * @description Tests for the provider's right of reply (HOS-376 T-051, §6.4).
 *
 * Three decisions are pinned here, and each answers something the provider
 * would otherwise misread:
 *
 *  - THE MODERATION NOTICE IS ALWAYS ON SCREEN, before sending. A reply is born
 *    PENDING, so a provider who is not warned will send one, see it absent from
 *    the directory, and conclude it was lost — the exact reaction §6.4 says to
 *    design against.
 *  - EDITING SAYS SOMETHING DIFFERENT FROM ANSWERING. Editing an APPROVED reply
 *    returns it to moderation (AC-23), which pulls a published answer OUT of the
 *    directory. That is a consequence, not a detail, and it has to be readable
 *    before the provider commits to it.
 *  - THE FLOOR IS CHECKED HERE, not only by the API. The reply's `content` is
 *    REQUIRED with a minimum of 10 — a two-word answer would come back a 400
 *    the provider cannot act on.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReplyToReview, mockUpdateReply } = vi.hoisted(() => ({
    mockReplyToReview: vi.fn(),
    mockUpdateReply: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        replyToReview: (...args: unknown[]) => mockReplyToReview(...args),
        updateReply: (...args: unknown[]) => mockUpdateReply(...args)
    }
}));

import { ReviewReplyForm } from '../../../../src/components/host/host-trades/ReviewReplyForm';

const REVIEW_ID = '33333333-3333-4333-8333-333333333333';
const REPLY_ID = '44444444-4444-4444-8444-444444444444';

/** A reply as both write endpoints hand it back. */
const SAVED_REPLY = {
    id: REPLY_ID,
    reviewId: REVIEW_ID,
    content: 'Perdón por la demora, se nos complicó el día. Ya lo hablamos con el equipo.',
    moderationState: 'PENDING' as const,
    reviewEditedAfterReply: false,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z'
};

function renderForm(
    overrides: {
        existingReply?: { readonly id: string; readonly content: string } | null;
        onSaved?: (reply: unknown) => void;
        onCancel?: () => void;
    } = {}
) {
    return render(
        <ReviewReplyForm
            existingReply={overrides.existingReply ?? null}
            locale="es"
            onCancel={overrides.onCancel ?? (() => undefined)}
            onSaved={overrides.onSaved ?? (() => undefined)}
            reviewId={REVIEW_ID}
        />
    );
}

/** The reply textarea. */
function textarea(): HTMLTextAreaElement {
    return screen.getByRole('textbox', { name: /tu respuesta/i });
}

beforeEach(() => {
    mockReplyToReview.mockReset();
    mockUpdateReply.mockReset();
    mockReplyToReview.mockResolvedValue({ ok: true, data: { reply: SAVED_REPLY } });
    mockUpdateReply.mockResolvedValue({ ok: true, data: { reply: SAVED_REPLY } });
});

describe('ReviewReplyForm — answering', () => {
    it('should POST the trimmed reply against the review it answers', async () => {
        // Arrange
        const user = userEvent.setup();
        renderForm();

        // Act
        await user.type(textarea(), '  Gracias por avisarnos, lo corregimos enseguida.  ');
        await user.click(screen.getByRole('button', { name: /enviar respuesta/i }));

        // Assert
        await waitFor(() => expect(mockReplyToReview).toHaveBeenCalledTimes(1));
        expect(mockReplyToReview).toHaveBeenCalledWith({
            reviewId: REVIEW_ID,
            body: { content: 'Gracias por avisarnos, lo corregimos enseguida.' }
        });
        expect(mockUpdateReply).not.toHaveBeenCalled();
    });

    it('should warn that the reply is moderated BEFORE it is sent', () => {
        // Arrange + Act
        renderForm();

        // Assert
        expect(screen.getByText(/la revisamos antes de publicarla/i)).toBeInTheDocument();
    });

    it('should hand the saved reply back to the panel', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSaved = vi.fn();
        renderForm({ onSaved });

        // Act
        await user.type(textarea(), 'Ya está resuelto, gracias por la paciencia.');
        await user.click(screen.getByRole('button', { name: /enviar respuesta/i }));

        // Assert
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(onSaved).toHaveBeenCalledWith(SAVED_REPLY);
    });
});

describe('ReviewReplyForm — editing', () => {
    it('should PATCH the reply by its own id, never the review', async () => {
        // Arrange
        const user = userEvent.setup();
        renderForm({
            existingReply: { id: REPLY_ID, content: 'Respuesta vieja que ya no aplica.' }
        });

        // Act
        await user.clear(textarea());
        await user.type(textarea(), 'Respuesta nueva, ya lo solucionamos.');
        await user.click(screen.getByRole('button', { name: /guardar respuesta/i }));

        // Assert
        await waitFor(() => expect(mockUpdateReply).toHaveBeenCalledTimes(1));
        expect(mockUpdateReply).toHaveBeenCalledWith({
            replyId: REPLY_ID,
            body: { content: 'Respuesta nueva, ya lo solucionamos.' }
        });
        expect(mockReplyToReview).not.toHaveBeenCalled();
    });

    it('should preload the existing text so an edit is not a rewrite from zero', () => {
        // Arrange + Act
        renderForm({
            existingReply: { id: REPLY_ID, content: 'Respuesta vieja que ya no aplica.' }
        });

        // Assert
        expect(textarea()).toHaveValue('Respuesta vieja que ya no aplica.');
    });

    it('should say that editing returns the reply to moderation (AC-23)', () => {
        // Arrange + Act
        renderForm({
            existingReply: { id: REPLY_ID, content: 'Respuesta vieja que ya no aplica.' }
        });

        // Assert — the answering copy alone would hide that a PUBLISHED reply
        // leaves the directory the moment it is edited.
        expect(screen.getByText(/vuelve a revisión/i)).toBeInTheDocument();
    });
});

describe('ReviewReplyForm — refusals', () => {
    it('should refuse a reply under the 10-character floor without calling the API', async () => {
        // Arrange
        const user = userEvent.setup();
        renderForm();

        // Act
        await user.type(textarea(), 'gracias');
        await user.click(screen.getByRole('button', { name: /enviar respuesta/i }));

        // Assert
        expect(await screen.findByRole('alert')).toHaveTextContent(/al menos 10 caracteres/i);
        expect(mockReplyToReview).not.toHaveBeenCalled();
    });

    it('should surface a rejected reply as an error and keep the text on screen', async () => {
        // Arrange
        const user = userEvent.setup();
        const onSaved = vi.fn();
        mockReplyToReview.mockResolvedValue({
            ok: false,
            error: { code: 'REVIEW_ALREADY_EXISTS', message: 'already answered' }
        });
        renderForm({ onSaved });

        // Act
        await user.type(textarea(), 'Intento responder de nuevo esta valoración.');
        await user.click(screen.getByRole('button', { name: /enviar respuesta/i }));

        // Assert — losing the text on a failure would make the provider rewrite
        // an answer he already wrote.
        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(textarea()).toHaveValue('Intento responder de nuevo esta valoración.');
        expect(onSaved).not.toHaveBeenCalled();
    });
});
