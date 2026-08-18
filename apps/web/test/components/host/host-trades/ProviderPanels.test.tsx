/**
 * @file ProviderPanels.test.tsx
 * @description Tests for the provider's three account panels (HOS-376 T-050).
 *
 * What is pinned here is what each panel exists to get right:
 *
 *  - EXACTLY ONE host identifier leaves the declaration form. The API refuses a
 *    body carrying both, so a form that sent an empty second field would fail
 *    every declaration for a reason the provider cannot see.
 *  - A suspended listing shows the REASON and no form. Taking away someone's
 *    ability to record work without saying why is the one thing this must not do.
 *  - A PENDING reply reads as "in review", never as absent. The directory
 *    listing hides it; showing that to its own author says "it was lost".
 *  - The QR is rendered as an image with a data URL, not injected as markup.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockConfirmUsage,
    mockDeclare,
    mockListOwnUsages,
    mockRejectUsage,
    mockReplyToReview,
    mockUndoUsageRejection,
    mockUpdateReply
} = vi.hoisted(() => ({
    mockConfirmUsage: vi.fn(),
    mockDeclare: vi.fn(),
    mockListOwnUsages: vi.fn(),
    mockRejectUsage: vi.fn(),
    mockReplyToReview: vi.fn(),
    mockUndoUsageRejection: vi.fn(),
    mockUpdateReply: vi.fn()
}));

vi.mock('@/lib/api/endpoints-protected', () => ({
    hostTradesApi: {
        confirmUsage: (...args: unknown[]) => mockConfirmUsage(...args),
        declareUsageAsProvider: (...args: unknown[]) => mockDeclare(...args),
        listOwnUsages: (...args: unknown[]) => mockListOwnUsages(...args),
        rejectUsage: (...args: unknown[]) => mockRejectUsage(...args),
        replyToReview: (...args: unknown[]) => mockReplyToReview(...args),
        undoUsageRejection: (...args: unknown[]) => mockUndoUsageRejection(...args),
        updateReply: (...args: unknown[]) => mockUpdateReply(...args)
    }
}));

import { ProviderQrPanel } from '../../../../src/components/host/host-trades/ProviderQrPanel.client';
import { ProviderReviewsPanel } from '../../../../src/components/host/host-trades/ProviderReviewsPanel.client';
import { ProviderUsagesPanel } from '../../../../src/components/host/host-trades/ProviderUsagesPanel.client';

const TODAY = '2026-08-10';
const HOST_ID = '11111111-1111-4111-8111-111111111111';

const LINKED_HOSTS = [{ id: HOST_ID, displayName: 'Ana Anfitriona' }];

function makeUsage(overrides: Record<string, unknown> = {}) {
    return {
        id: 'usage-1',
        hostTradeId: '22222222-2222-4222-8222-222222222222',
        hostUserId: HOST_ID,
        declaredBy: 'PROVIDER',
        declaredById: '33333333-3333-4333-8333-333333333333',
        creationChannel: 'LINKED_SELECTOR',
        status: 'PENDING',
        servicedAt: '2026-08-01',
        note: null,
        expiresAt: '2026-09-01T00:00:00.000Z',
        confirmedAt: null,
        rejectedAt: null,
        rejectionNote: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        hostTrade: null,
        ...overrides
    } as never;
}

function renderUsages(overrides: Record<string, unknown> = {}) {
    return render(
        <ProviderUsagesPanel
            initialLinkedHosts={LINKED_HOSTS}
            initialTotal={0}
            initialUsages={[]}
            locale="es"
            today={TODAY}
            {...overrides}
        />
    );
}

beforeEach(() => {
    mockConfirmUsage.mockReset();
    mockDeclare.mockReset();
    mockListOwnUsages.mockReset();
    mockRejectUsage.mockReset();
    mockReplyToReview.mockReset();
    mockUndoUsageRejection.mockReset();
    mockUpdateReply.mockReset();
    mockDeclare.mockResolvedValue({ ok: true, data: { usage: makeUsage() } });
    mockListOwnUsages.mockResolvedValue({
        ok: true,
        data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
    });
    mockConfirmUsage.mockResolvedValue({ ok: true, data: { usage: makeUsage() } });
    mockRejectUsage.mockResolvedValue({ ok: true, data: { usage: makeUsage() } });
    mockUndoUsageRejection.mockResolvedValue({ ok: true, data: { usage: makeUsage() } });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Usos
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The provider's inbox (H-06 / H-65 / H-159)
// ---------------------------------------------------------------------------

/**
 * These tests exist because this half of "A declara, B confirma" was missing.
 *
 * A host declared a usage by scanning the QR — the flagship channel, the sticker
 * on the van — the row was created PENDING, and the provider's screen listed it
 * with a "Pendiente" badge and NO button. The email even asked him to confirm and
 * linked him to that exact screen. Every such row expired after 30 days without
 * counting, so the QR channel produced none of the effects it exists for.
 *
 * Every assertion here is therefore about a BUTTON EXISTING and a REQUEST
 * LEAVING. The list rendered perfectly while the bug was live; rendering is not
 * the property under test.
 */
describe('ProviderUsagesPanel — answering what the host declared', () => {
    const hostDeclared = makeUsage({ id: 'host-declared-1', declaredBy: 'HOST' });

    it('offers confirm and reject on a usage the host declared', () => {
        renderUsages({ initialPending: [hostDeclared] });

        expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    });

    it('confirms it through the API', async () => {
        const user = userEvent.setup();
        renderUsages({ initialPending: [hostDeclared] });

        await user.click(screen.getByRole('button', { name: /confirmar/i }));

        await waitFor(() => expect(mockConfirmUsage).toHaveBeenCalledTimes(1));
        expect(mockConfirmUsage).toHaveBeenCalledWith({ id: 'host-declared-1' });
    });

    it('rejects it through the API, note and all', async () => {
        const user = userEvent.setup();
        renderUsages({ initialPending: [hostDeclared] });

        await user.click(screen.getByRole('button', { name: /rechazar/i }));
        await user.type(screen.getByLabelText(/por qué/i), 'Ese día no atendí.');
        await user.click(screen.getByRole('button', { name: /sí, rechazar/i }));

        await waitFor(() => expect(mockRejectUsage).toHaveBeenCalledTimes(1));
        expect(mockRejectUsage).toHaveBeenCalledWith({
            id: 'host-declared-1',
            note: 'Ese día no atendí.'
        });
    });

    it('rejects without a note, because the note is optional on purpose', async () => {
        // Rejecting cheaply is the only control keeping the public counters
        // honest. Demanding a written explanation to say "that never happened"
        // taxes the one action the system most needs people to take.
        const user = userEvent.setup();
        renderUsages({ initialPending: [hostDeclared] });

        await user.click(screen.getByRole('button', { name: /rechazar/i }));
        await user.click(screen.getByRole('button', { name: /sí, rechazar/i }));

        await waitFor(() => expect(mockRejectUsage).toHaveBeenCalledTimes(1));
        // `undefined`, not an empty string: `rejectUsage` omits the key from the
        // request body on a falsy note, and an empty string would be stored as a
        // written reason that says nothing.
        expect((mockRejectUsage.mock.calls[0]?.[0] as { note?: string }).note).toBeUndefined();
    });

    it('does NOT offer to answer a usage the provider declared himself', () => {
        // That one waits on the HOST. A button here would 404 — the endpoint
        // refuses the declarant answering their own declaration, and answers
        // 404 rather than 403 so it cannot be used to probe which ids exist.
        renderUsages({
            initialPending: [],
            initialUsages: [makeUsage({ declaredBy: 'PROVIDER' })]
        });

        expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^rechazar/i })).not.toBeInTheDocument();
    });

    it('offers undo on a rejection the provider made, and not on one he received', () => {
        renderUsages({
            initialUsages: [
                makeUsage({ id: 'mine', status: 'REJECTED', declaredBy: 'HOST' }),
                makeUsage({ id: 'theirs', status: 'REJECTED', declaredBy: 'PROVIDER' })
            ]
        });

        // Exactly one: the host-declared row is the one this provider refused.
        expect(screen.getAllByRole('button', { name: /deshacer el rechazo/i })).toHaveLength(1);
    });

    it('asks the API for PENDING rows the HOST declared when it re-reads the inbox', async () => {
        const user = userEvent.setup();
        renderUsages({ initialPending: [hostDeclared] });

        await user.click(screen.getByRole('button', { name: /confirmar/i }));

        await waitFor(() => expect(mockListOwnUsages).toHaveBeenCalled());
        // The narrowing has to reach the API. Splitting a PENDING page here
        // would report an empty inbox whenever the first page happens to hold
        // the provider's own declarations — a wrong all-clear.
        const inboxCall = mockListOwnUsages.mock.calls
            .map((call) => call[0] as Record<string, unknown>)
            .find((params) => params?.declaredBy !== undefined);
        expect(inboxCall).toMatchObject({ status: 'PENDING', declaredBy: 'HOST' });
    });
});

describe('ProviderUsagesPanel — declaring', () => {
    it('sends the selected host id and NOT an email', async () => {
        const user = userEvent.setup();
        renderUsages();

        await user.selectOptions(screen.getByLabelText(/anfitrión/i), HOST_ID);
        await user.click(screen.getByRole('button', { name: /registrar el uso/i }));

        await waitFor(() => expect(mockDeclare).toHaveBeenCalledTimes(1));
        const body = mockDeclare.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(body.hostUserId).toBe(HOST_ID);
        // The API refuses a body carrying both identifiers.
        expect(body).not.toHaveProperty('hostEmail');
    });

    it('sends the email and NOT a host id on the fallback channel', async () => {
        const user = userEvent.setup();
        renderUsages();

        await user.click(screen.getByRole('radio', { name: /alguien nuevo/i }));
        await user.type(screen.getByLabelText(/email del anfitrión/i), 'ana@example.com');
        await user.click(screen.getByRole('button', { name: /registrar el uso/i }));

        await waitFor(() => expect(mockDeclare).toHaveBeenCalledTimes(1));
        const body = mockDeclare.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(body.hostEmail).toBe('ana@example.com');
        expect(body).not.toHaveProperty('hostUserId');
    });

    it('defaults to the email channel when nobody is linked yet', () => {
        // A selector with no options is a dead end on the very first job, which
        // is exactly when the fallback is the only channel that works.
        renderUsages({ initialLinkedHosts: [] });

        expect(screen.getByRole('radio', { name: /alguien nuevo/i })).toBeChecked();
        expect(screen.getByRole('radio', { name: /ya me confirmó/i })).toBeDisabled();
    });

    it('refuses a future service date without spending a request', async () => {
        const user = userEvent.setup();
        renderUsages();

        await user.selectOptions(screen.getByLabelText(/anfitrión/i), HOST_ID);
        const date = screen.getByLabelText(/qué día fue el servicio/i);
        await user.clear(date);
        await user.type(date, '2026-12-31');
        await user.click(screen.getByRole('button', { name: /registrar el uso/i }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/no puede ser en el futuro/i);
        expect(mockDeclare).not.toHaveBeenCalled();
    });

    it('surfaces the explicit refusal for an email that is nobody', async () => {
        mockDeclare.mockResolvedValue({
            ok: false,
            error: { status: 404, code: 'HOST_NOT_FOUND', message: 'no such host' }
        });
        const user = userEvent.setup();
        renderUsages();

        await user.click(screen.getByRole('radio', { name: /alguien nuevo/i }));
        await user.type(screen.getByLabelText(/email del anfitrión/i), 'typo@example.com');
        await user.click(screen.getByRole('button', { name: /registrar el uso/i }));

        expect(await screen.findByRole('alert')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});

describe('ProviderUsagesPanel — a suspended listing', () => {
    it('replaces the form with the reason', async () => {
        renderUsages({ suspendedReason: 'Tres anfitriones rechazaron tus registros.' });

        expect(screen.getByRole('alert')).toHaveTextContent(/tres anfitriones/i);
        expect(screen.queryByRole('button', { name: /registrar el uso/i })).toBeNull();
    });

    it('still shows the record, because confirmed usages keep counting', () => {
        renderUsages({
            suspendedReason: 'Motivo cualquiera.',
            initialUsages: [makeUsage({ status: 'CONFIRMED' })],
            initialTotal: 1
        });

        expect(screen.getByText('Confirmado')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Valoraciones
// ---------------------------------------------------------------------------

function reviewRow(reply: Record<string, unknown> | null) {
    return {
        review: {
            id: 'review-1',
            hostTradeId: '22222222-2222-4222-8222-222222222222',
            hostUserId: HOST_ID,
            overallRating: 4,
            rating: null,
            averageRating: null,
            respectedBenefit: true,
            content: 'Vino el mismo día.',
            moderationState: 'APPROVED',
            editedAt: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z'
        },
        author: { id: HOST_ID, displayName: 'Ana Anfitriona', image: null },
        reply
    } as never;
}

describe('ProviderReviewsPanel', () => {
    it('shows a PENDING reply as in review, never as missing', () => {
        // The directory listing hides an unapproved answer. Doing that here
        // would tell its own author that what he wrote does not exist.
        render(
            <ProviderReviewsPanel
                initialReviews={[
                    reviewRow({
                        id: 'reply-1',
                        content: 'Gracias por la devolución.',
                        moderationState: 'PENDING',
                        moderationReason: null,
                        reviewEditedAfterReply: false,
                        createdAt: '2026-08-02T00:00:00.000Z',
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    })
                ]}
                initialTotal={1}
                locale="es"
            />
        );

        expect(screen.getByText('En revisión')).toBeInTheDocument();
        expect(screen.getByText(/gracias por la devolución/i)).toBeInTheDocument();
        expect(screen.getByText(/todavía no se ve en el directorio/i)).toBeInTheDocument();
    });

    it('shows why a reply was turned down', () => {
        render(
            <ProviderReviewsPanel
                initialReviews={[
                    reviewRow({
                        id: 'reply-1',
                        content: 'Respuesta',
                        moderationState: 'REJECTED',
                        moderationReason: 'Incluía la dirección del anfitrión.',
                        reviewEditedAfterReply: false,
                        createdAt: '2026-08-02T00:00:00.000Z',
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    })
                ]}
                initialTotal={1}
                locale="es"
            />
        );

        expect(screen.getByText('Rechazada')).toBeInTheDocument();
        expect(screen.getByText(/dirección del anfitrión/i)).toBeInTheDocument();
    });

    it('says so when a review has no answer yet', () => {
        render(
            <ProviderReviewsPanel
                initialReviews={[reviewRow(null)]}
                initialTotal={1}
                locale="es"
            />
        );

        expect(screen.getByText(/todavía no respondiste/i)).toBeInTheDocument();
    });

    it('reports the benefit answer, which is what the feature exists to expose', () => {
        const row = reviewRow(null) as unknown as { review: { respectedBenefit: boolean } };
        row.review.respectedBenefit = false;

        render(
            <ProviderReviewsPanel
                initialReviews={[row as never]}
                initialTotal={1}
                locale="es"
            />
        );

        expect(screen.getByText(/NO respetaste el beneficio/i)).toBeInTheDocument();
    });

    it('renders an empty state rather than a bare heading', () => {
        render(
            <ProviderReviewsPanel
                initialReviews={[]}
                initialTotal={0}
                locale="es"
            />
        );

        expect(screen.getByText(/todavía no hay valoraciones/i)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Valoraciones — answering (T-051)
// ---------------------------------------------------------------------------

describe('ProviderReviewsPanel — answering', () => {
    /** A reply as the write endpoints hand it back: always PENDING. */
    const SAVED_REPLY = {
        id: 'reply-1',
        reviewId: 'review-1',
        content: 'Perdón por la demora, ya lo hablamos con el equipo.',
        moderationState: 'PENDING',
        reviewEditedAfterReply: false,
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z'
    };

    it('restates the row as in review once the answer is sent (T-051)', async () => {
        // Arrange — an unanswered review.
        const user = userEvent.setup();
        mockReplyToReview.mockResolvedValue({ ok: true, data: { reply: SAVED_REPLY } });
        render(
            <ProviderReviewsPanel
                initialReviews={[reviewRow(null)]}
                initialTotal={1}
                locale="es"
            />
        );

        // Act
        await user.click(screen.getByRole('button', { name: /^responder$/i }));
        await user.type(
            screen.getByRole('textbox', { name: /tu respuesta/i }),
            'Perdón por la demora, ya lo hablamos con el equipo.'
        );
        await user.click(screen.getByRole('button', { name: /enviar respuesta/i }));

        // Assert — the state has to appear WITHOUT a reload. A provider who
        // sends an answer and is left looking at "todavía no respondiste"
        // concludes it failed and sends it again.
        expect(await screen.findByText('En revisión')).toBeInTheDocument();
        expect(screen.getByText(/ya lo hablamos con el equipo/i)).toBeInTheDocument();
        expect(screen.queryByText(/todavía no respondiste/i)).not.toBeInTheDocument();
    });

    // The DROPPED REASON itself is asserted in `merge-saved-reply.test.ts`, not
    // here: a stale reason is invisible in this render (the row only prints one
    // while REJECTED, and a rewrite is always PENDING), so an assertion at this
    // layer would pass whether or not the reason was cleared — it was tried, and
    // the mutation survived. What IS observable here is the rejection LEAVING.
    it('takes a rewritten reply out of the rejected state (AC-23)', async () => {
        // Arrange — a REJECTED reply carrying the moderator's reason.
        const user = userEvent.setup();
        mockUpdateReply.mockResolvedValue({ ok: true, data: { reply: SAVED_REPLY } });
        render(
            <ProviderReviewsPanel
                initialReviews={[
                    reviewRow({
                        id: 'reply-1',
                        content: 'Respuesta vieja',
                        moderationState: 'REJECTED',
                        moderationReason: 'Incluía la dirección del anfitrión.',
                        reviewEditedAfterReply: false,
                        createdAt: '2026-08-02T00:00:00.000Z',
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    })
                ]}
                initialTotal={1}
                locale="es"
            />
        );

        // Act
        await user.click(screen.getByRole('button', { name: /editar tu respuesta/i }));
        await user.clear(screen.getByRole('textbox', { name: /tu respuesta/i }));
        await user.type(
            screen.getByRole('textbox', { name: /tu respuesta/i }),
            'Perdón por la demora, ya lo hablamos con el equipo.'
        );
        await user.click(screen.getByRole('button', { name: /guardar respuesta/i }));

        // Assert — the row must stop announcing a rejection the edit undid.
        expect(await screen.findByText('En revisión')).toBeInTheDocument();
        expect(screen.queryByText('Rechazada')).not.toBeInTheDocument();
        expect(screen.getByText(/ya lo hablamos con el equipo/i)).toBeInTheDocument();
    });

    it('offers editing rather than answering when a reply already exists', () => {
        // Arrange + Act
        render(
            <ProviderReviewsPanel
                initialReviews={[
                    reviewRow({
                        id: 'reply-1',
                        content: 'Gracias por la devolución.',
                        moderationState: 'APPROVED',
                        moderationReason: null,
                        reviewEditedAfterReply: false,
                        createdAt: '2026-08-02T00:00:00.000Z',
                        updatedAt: '2026-08-02T00:00:00.000Z'
                    })
                ]}
                initialTotal={1}
                locale="es"
            />
        );

        // Assert — a second POST answers 409; the label must not invite it.
        expect(screen.getByRole('button', { name: /editar tu respuesta/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^responder$/i })).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Mi QR
// ---------------------------------------------------------------------------

describe('ProviderQrPanel', () => {
    const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    const URL_TARGET =
        'https://hospeda.com.ar/es/mi-cuenta/directorio-proveedores/plomero/registrar-uso';

    it('renders the code as an image, not as injected markup', () => {
        // An <img> with a data URL cannot execute script inside the SVG, which
        // injecting the same markup into the DOM could.
        const { container } = render(
            <ProviderQrPanel
                locale="es"
                slug="plomero"
                svg={SVG}
                targetUrl={URL_TARGET}
            />
        );

        const image = screen.getByRole('img');
        expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
        expect(container.querySelector('svg')).toBeNull();
    });

    it('shows the encoded URL as text, for a provider who cannot scan it', () => {
        render(
            <ProviderQrPanel
                locale="es"
                slug="plomero"
                svg={SVG}
                targetUrl={URL_TARGET}
            />
        );

        expect(
            screen.getByText(new RegExp(URL_TARGET.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')))
        ).toBeInTheDocument();
    });

    it('names the downloaded file after the listing', async () => {
        // The anchor is created for the click and discarded, so it is captured
        // here rather than queried out of the DOM.
        const created: HTMLAnchorElement[] = [];
        const realCreateElement = document.createElement.bind(document);
        const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
            const element = realCreateElement(tag);
            if (tag === 'a') created.push(element as HTMLAnchorElement);
            return element;
        }) as typeof document.createElement);

        const user = userEvent.setup();
        render(
            <ProviderQrPanel
                locale="es"
                slug="plomero"
                svg={SVG}
                targetUrl={URL_TARGET}
            />
        );

        await user.click(screen.getByRole('button', { name: /descargar/i }));

        expect(created.at(-1)?.download).toBe('qr-plomero.svg');
        expect(created.at(-1)?.href).toMatch(/^data:image\/svg\+xml/);
        spy.mockRestore();
    });
});
