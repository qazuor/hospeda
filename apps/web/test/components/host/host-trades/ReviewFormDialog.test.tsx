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

const { mockCreateReview, mockGetMyReview, mockUpdateReview } = vi.hoisted(() => ({
    mockCreateReview: vi.fn(),
    mockGetMyReview: vi.fn(),
    mockUpdateReview: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        createReview: (...args: unknown[]) => mockCreateReview(...args),
        getMyReview: (...args: unknown[]) => mockGetMyReview(...args),
        updateReview: (...args: unknown[]) => mockUpdateReview(...args)
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

/**
 * Waits for the read-back to finish and the form to render.
 *
 * The dialog asks `my-review` before it can know whether it is publishing or
 * editing, so nothing is on screen synchronously.
 */
async function formReady() {
    return screen.findByRole('group', { name: /puntuación general/i });
}

/** Fills the two mandatory answers: 4 stars and "respected the benefit". */
async function fillMandatory(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: /4 estrellas/i }));
    await user.click(screen.getByRole('radio', { name: /^sí$/i }));
}

/** An existing review, as `my-review` hands it back. */
const EXISTING_REVIEW = {
    id: 'review-1',
    hostTradeId: PROVIDER_ID,
    hostUserId: '11111111-1111-4111-8111-111111111111',
    overallRating: 3,
    rating: { punctuality: 2 },
    averageRating: 2,
    respectedBenefit: false,
    content: 'Tardó bastante en venir la primera vez.',
    moderationState: 'APPROVED',
    editedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z'
};

beforeEach(() => {
    mockCreateReview.mockReset();
    mockGetMyReview.mockReset();
    mockUpdateReview.mockReset();
    mockCreateReview.mockResolvedValue({
        ok: true,
        data: { review: { id: 'review-1', moderationState: 'APPROVED' } }
    });
    // Nothing written yet — the create path, which most tests exercise.
    mockGetMyReview.mockResolvedValue({ ok: true, data: { review: null } });
    mockUpdateReview.mockResolvedValue({
        ok: true,
        data: { review: { ...EXISTING_REVIEW, moderationState: 'APPROVED' } }
    });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Accessibility of the star control
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — the stars', () => {
    it('exposes five radios with a textual label each, not bare icons', async () => {
        renderDialog();

        const stars = await formReady();
        expect(within(stars).getAllByRole('radio')).toHaveLength(5);
        expect(within(stars).getByRole('radio', { name: /1 estrella/i })).toBeInTheDocument();
        expect(within(stars).getByRole('radio', { name: /5 estrellas/i })).toBeInTheDocument();
    });

    it('starts with no star chosen, so nothing is submitted by omission', async () => {
        renderDialog();

        const stars = await formReady();
        for (const radio of within(stars).getAllByRole('radio')) {
            expect(radio).not.toBeChecked();
        }
    });

    it('fills every star up to the chosen one, not only the chosen one', async () => {
        // A rating control communicates its value by how many stars are lit.
        // Lighting ONLY the fifth reads as one star, which is the opposite of
        // what the host just answered — and it disagrees with the provider's
        // Valoraciones tab, which renders the same score as five filled stars.
        const user = userEvent.setup();
        renderDialog();
        const stars = await formReady();

        await user.click(within(stars).getByRole('radio', { name: /4 estrellas/i }));

        const glyphs = [...stars.querySelectorAll('.starGlyph')];
        expect(glyphs).toHaveLength(5);
        expect(glyphs.map((g) => g.className.includes('starGlyphFilled'))).toEqual([
            true,
            true,
            true,
            true,
            false
        ]);
    });

    it('lights nothing before a star is chosen', async () => {
        renderDialog();
        const stars = await formReady();

        const glyphs = [...stars.querySelectorAll('.starGlyph')];
        expect(glyphs.some((g) => g.className.includes('starGlyphFilled'))).toBe(false);
    });

    it('is operable from the keyboard', async () => {
        const user = userEvent.setup();
        renderDialog();
        await formReady();

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
    it('offers an explicit yes/no with neither preselected', async () => {
        renderDialog();
        await formReady();

        const group = screen.getByRole('group', { name: /beneficio/i });
        expect(within(group).getByRole('radio', { name: /^sí$/i })).not.toBeChecked();
        expect(within(group).getByRole('radio', { name: /^no$/i })).not.toBeChecked();
    });

    it('refuses to submit until it is answered, without spending a request', async () => {
        const user = userEvent.setup();
        renderDialog();
        await formReady();

        await user.click(screen.getByRole('radio', { name: /4 estrellas/i }));
        await user.click(screen.getByRole('button', { name: /publicar/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/beneficio/i);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    it('submits false when the host says the benefit was not honoured', async () => {
        const user = userEvent.setup();
        renderDialog();
        await formReady();

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
        await formReady();

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
        await formReady();

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
    it('starts collapsed', async () => {
        renderDialog();
        await formReady();

        // Queried through the summary rather than by role+name: jsdom does not
        // derive a `<details>` accessible name from its `<summary>`, so a
        // role query would pass vacuously by finding nothing.
        const summary = screen.getByText(/detalle por aspecto/i);
        expect(summary.closest('details')).not.toHaveAttribute('open');
    });

    it('omits `rating` entirely when the host left the breakdown alone', async () => {
        const user = userEvent.setup();
        renderDialog();
        await formReady();

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
        await formReady();

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
        await formReady();

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
        await formReady();

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
        await formReady();

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
        await formReady();

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
        await formReady();

        await user.click(screen.getByRole('button', { name: /cancelar/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(mockCreateReview).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Edit mode (T-049)
// ---------------------------------------------------------------------------

describe('ReviewFormDialog — editing an existing review', () => {
    /** Renders with a review already on file, and waits for it to load. */
    async function renderEditing(overrides: { onSaved?: () => void } = {}) {
        mockGetMyReview.mockResolvedValue({ ok: true, data: { review: EXISTING_REVIEW } });
        const result = renderDialog(overrides);
        await screen.findByRole('button', { name: /guardar/i });
        return result;
    }

    it('preloads every value the host had written', async () => {
        await renderEditing();

        expect(screen.getByRole('radio', { name: /3 estrellas/i })).toBeChecked();
        expect(screen.getByRole('radio', { name: /^no$/i })).toBeChecked();
        expect(screen.getByLabelText(/comentario/i)).toHaveValue(EXISTING_REVIEW.content);
        expect(screen.getByRole('radio', { name: /puntualidad: 2/i })).toBeChecked();
    });

    it('sends ONLY the field that changed', async () => {
        // The decisive one. Changing the TEXT re-runs moderation and can pull
        // the review out of the directory; resending an untouched `content`
        // would turn a star-only edit into a rewrite, and could hand back as
        // APPROVED a text a moderator had already rejected.
        const user = await renderEditing().then(() => userEvent.setup());

        await user.click(screen.getByRole('radio', { name: /5 estrellas/i }));
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => expect(mockUpdateReview).toHaveBeenCalledTimes(1));
        expect(mockUpdateReview.mock.calls[0][0]).toEqual({
            reviewId: EXISTING_REVIEW.id,
            body: { overallRating: 5 }
        });
    });

    it('sends the text when the text is what changed', async () => {
        // The complementary case: without it, "sends only what changed" would
        // also pass on a form that never sends anything at all.
        const user = await renderEditing().then(() => userEvent.setup());

        const textarea = screen.getByLabelText(/comentario/i);
        await user.clear(textarea);
        await user.type(textarea, 'Al final volvió y lo resolvió bien.');
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => expect(mockUpdateReview).toHaveBeenCalledTimes(1));
        expect(mockUpdateReview.mock.calls[0][0].body).toEqual({
            content: 'Al final volvió y lo resolvió bien.'
        });
    });

    it('creates nothing while editing', async () => {
        const user = await renderEditing().then(() => userEvent.setup());

        await user.click(screen.getByRole('radio', { name: /5 estrellas/i }));
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => expect(mockUpdateReview).toHaveBeenCalled());
        expect(mockCreateReview).not.toHaveBeenCalled();
    });

    it('says there is nothing to save when nothing was touched', async () => {
        const user = await renderEditing().then(() => userEvent.setup());

        await user.click(screen.getByRole('button', { name: /guardar/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/no cambiaste/i);
        expect(mockUpdateReview).not.toHaveBeenCalled();
    });

    it('warns that editing the text sends the review back to moderation', async () => {
        mockUpdateReview.mockResolvedValue({
            ok: true,
            data: { review: { ...EXISTING_REVIEW, moderationState: 'PENDING' } }
        });
        const user = await renderEditing().then(() => userEvent.setup());

        const textarea = screen.getByLabelText(/comentario/i);
        await user.clear(textarea);
        await user.type(textarea, 'Un texto nuevo y distinto del anterior.');
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        expect(await screen.findByRole('status')).toHaveTextContent(/revisión/i);
    });

    it('offers publishing, not saving, when there is no review yet', async () => {
        const user = userEvent.setup();
        renderDialog();

        await waitFor(() => expect(mockGetMyReview).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('button', { name: /publicar/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /guardar/i })).toBeNull();
        await user.click(screen.getByRole('button', { name: /cancelar/i }));
    });

    it('treats a failed read-back as "no review yet" rather than blocking', async () => {
        // Refusing to open on a read failure would leave the host unable to say
        // anything; the create path still answers 409 if one does exist, with
        // its own copy.
        mockGetMyReview.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        renderDialog();

        await waitFor(() => expect(mockGetMyReview).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: /publicar/i })).toBeInTheDocument();
    });
});
