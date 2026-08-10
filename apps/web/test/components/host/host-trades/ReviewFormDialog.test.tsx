/**
 * @file ReviewFormDialog.test.tsx
 * @description Tests for the review form (HOS-376 T-048, §8).
 *
 * Four decisions are pinned here, and each one is a decision the spec argued
 * for rather than a detail:
 *
 *  - The stars are REAL radios with textual labels, not clickable glyphs. The
 *    directory's audience skews older and largely mobile; a star widget that
 *    only works with a pointer and announces nothing is unusable for part of it.
 *  - The benefit question has NO preselected answer. It is the one field the
 *    whole feature exists to capture ("excellent work, ignored the discount"),
 *    and a default would collect the default rather than the answer.
 *  - The breakdown is collapsed. A host who only wants to leave stars must not
 *    be walked through three more decisions to do it.
 *  - An absent breakdown travels as ABSENT, not as an object of undefineds:
 *    the body schema is `.strict()` and `rating: null` vs `{}` mean different
 *    things to the aggregate that reads it.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateReview } = vi.hoisted(() => ({ mockCreateReview: vi.fn() }));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        createReview: (...args: unknown[]) => mockCreateReview(...args)
    }
}));

import { ReviewFormDialog } from '../../../../src/components/host/host-trades/ReviewFormDialog.client';

const PROVIDER_ID = '22222222-2222-4222-8222-222222222222';
const PROVIDER_NAME = 'Plomero Centro';

function renderDialog(overrides: { onClose?: () => void; onSaved?: () => void } = {}) {
    return render(
        <ReviewFormDialog
            hostTradeId={PROVIDER_ID}
            locale="es"
            onClose={overrides.onClose ?? (() => undefined)}
            onSaved={overrides.onSaved ?? (() => undefined)}
            providerName={PROVIDER_NAME}
        />
    );
}

/** The submitted body, from the only call. */
function submittedBody(): Record<string, unknown> {
    return mockCreateReview.mock.calls[0][0].body as Record<string, unknown>;
}

/** Fills the two mandatory answers: 4 stars and "respected the benefit". */
async function fillMandatory(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: /4 estrellas/i }));
    await user.click(screen.getByRole('radio', { name: /^sí$/i }));
}

beforeEach(() => {
    mockCreateReview.mockReset();
    mockCreateReview.mockResolvedValue({
        ok: true,
        data: { review: { id: 'review-1', moderationState: 'APPROVED' } }
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Accessibility of the star control
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — the stars', () => {
    it('exposes five radios with a textual label each, not bare icons', () => {
        renderDialog();

        const stars = screen.getByRole('group', { name: /puntuación general/i });
        expect(within(stars).getAllByRole('radio')).toHaveLength(5);
        expect(within(stars).getByRole('radio', { name: /1 estrella/i })).toBeInTheDocument();
        expect(within(stars).getByRole('radio', { name: /5 estrellas/i })).toBeInTheDocument();
    });

    it('starts with no star chosen, so nothing is submitted by omission', () => {
        renderDialog();

        const stars = screen.getByRole('group', { name: /puntuación general/i });
        for (const radio of within(stars).getAllByRole('radio')) {
            expect(radio).not.toBeChecked();
        }
    });

    it('is operable from the keyboard', async () => {
        const user = userEvent.setup();
        renderDialog();

        const first = screen.getByRole('radio', { name: /1 estrella/i });
        first.focus();
        await user.keyboard('{ArrowRight}');

        expect(screen.getByRole('radio', { name: /2 estrellas/i })).toBeChecked();
    });
});

// ---------------------------------------------------------------------------
// The benefit question
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — the benefit question', () => {
    it('offers an explicit yes/no with neither preselected', () => {
        renderDialog();

        const group = screen.getByRole('group', { name: /beneficio/i });
        expect(within(group).getByRole('radio', { name: /^sí$/i })).not.toBeChecked();
        expect(within(group).getByRole('radio', { name: /^no$/i })).not.toBeChecked();
    });

    it('refuses to submit until it is answered, without spending a request', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.click(screen.getByRole('radio', { name: /4 estrellas/i }));
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/beneficio/i);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    it('submits false when the host says the benefit was not honoured', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.click(screen.getByRole('radio', { name: /4 estrellas/i }));
        await user.click(screen.getByRole('radio', { name: /^no$/i }));
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
        expect(submittedBody().respectedBenefit).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — what it refuses to send', () => {
    it('refuses to submit without a star rating', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.click(screen.getByRole('radio', { name: /^sí$/i }));
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    it('refuses a comment shorter than the schema allows', async () => {
        // The schema's floor is 10 characters. Letting it through would spend a
        // request to be told the same thing in a language the host did not pick.
        const user = userEvent.setup();
        renderDialog();

        await fillMandatory(user);
        await user.type(screen.getByLabelText(/comentario/i), 'corto');
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(mockCreateReview).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// The breakdown
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — the optional breakdown', () => {
    it('starts collapsed', () => {
        renderDialog();

        // Queried through the summary rather than by role+name: jsdom does not
        // derive a `<details>` accessible name from its `<summary>`, so a
        // role query would pass vacuously by finding nothing.
        const summary = screen.getByText(/detalle por aspecto/i);
        expect(summary.closest('details')).not.toHaveAttribute('open');
    });

    it('omits `rating` entirely when the host left the breakdown alone', async () => {
        const user = userEvent.setup();
        renderDialog();

        await fillMandatory(user);
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
        // Absent, not `{}` and not an object of undefineds: the body is strict
        // and the aggregate reads a null breakdown differently from an empty one.
        expect(submittedBody()).not.toHaveProperty('rating');
    });

    it('sends only the dimensions the host actually scored', async () => {
        const user = userEvent.setup();
        renderDialog();

        await fillMandatory(user);
        await user.click(screen.getByText(/detalle/i));
        await user.click(screen.getByRole('radio', { name: /puntualidad: 5/i }));
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        await waitFor(() => expect(mockCreateReview).toHaveBeenCalledTimes(1));
        expect(submittedBody().rating).toEqual({ punctuality: 5 });
    });
});

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — outcomes', () => {
    it('sends the review to the right provider and reports success', async () => {
        const onSaved = vi.fn();
        const user = userEvent.setup();
        renderDialog({ onSaved });

        await fillMandatory(user);
        await user.type(screen.getByLabelText(/comentario/i), 'Vino el mismo día y resolvió todo.');
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
        expect(mockCreateReview.mock.calls[0][0].hostTradeId).toBe(PROVIDER_ID);
        expect(submittedBody()).toMatchObject({
            overallRating: 4,
            respectedBenefit: true,
            content: 'Vino el mismo día y resolvió todo.'
        });
    });

    it('warns that a moderated review is not published yet', async () => {
        // `moderateText()` can push a review to PENDING despite the APPROVED
        // default. Saying nothing would read as "it saved and is live".
        mockCreateReview.mockResolvedValue({
            ok: true,
            data: { review: { id: 'review-1', moderationState: 'PENDING' } }
        });
        const onSaved = vi.fn();
        const user = userEvent.setup();
        renderDialog({ onSaved });

        await fillMandatory(user);
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('status')).toHaveTextContent(/revisión/i);
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it('surfaces the domain refusal when there is no confirmed usage', async () => {
        mockCreateReview.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'NO_CONFIRMED_USAGE', message: 'nope' }
        });
        const user = userEvent.setup();
        renderDialog();

        await fillMandatory(user);
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/uso del beneficio confirmado/i);
    });

    it('keeps what the host wrote after a refusal', async () => {
        mockCreateReview.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const user = userEvent.setup();
        renderDialog();

        await fillMandatory(user);
        await user.type(screen.getByLabelText(/comentario/i), 'Un texto que no quiero reescribir.');
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        await screen.findByRole('alert');
        expect(screen.getByLabelText(/comentario/i)).toHaveValue(
            'Un texto que no quiero reescribir.'
        );
    });

    it('closes without writing anything when dismissed', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        renderDialog({ onClose });

        await user.click(screen.getByRole('button', { name: /cancelar/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });
});
