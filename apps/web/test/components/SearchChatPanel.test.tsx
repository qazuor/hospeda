/**
 * @file SearchChatPanel.test.tsx
 * @description Component tests for the SearchChatPanel React island (SPEC-212 T-010).
 *
 * Strategy: mock `useSearchChat` at the module level to inject controlled state
 * and assert rendering / interaction. This keeps tests fast and deterministic
 * — no real SSE streams or fetch calls.
 *
 * Coverage:
 * - Initial empty state renders placeholder text
 * - Renders completed message history (user + assistant bubbles)
 * - Renders streamed tokens when `currentReply` is non-empty and `isStreaming`
 * - Shows thinking indicator when `isStreaming` and `currentReply` is empty
 * - Shows results grid when `results` is non-empty
 * - Shows skeleton when `resultsLoading` is true
 * - `resultsLoading` + `isStreaming` simultaneously (D-9) — both states visible
 * - Shows error banner when `error` is set
 * - Typing into the textarea updates local draft
 * - Submitting the form calls `send` with the draft text
 * - Enter (without Shift) submits the form
 * - Send button is disabled when `isStreaming` is true
 * - Reset button calls `reset`
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SearchChatPanel,
    type SearchChatPanelProps
} from '../../src/components/ai-search/SearchChatPanel.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// Mock i18n — return fallback key verbatim so assertions can use readable English.
vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

// Mock CSS module — return class name strings so className assertions work.
vi.mock('../../src/components/ai-search/SearchChatPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// Mock buildUrl — return a predictable href for test assertions.
vi.mock('@/lib/urls', () => ({
    buildUrl: ({ path }: { locale: string; path: string }) => `/es${path}`
}));

// Centralised mock state — replaced per-test via `mockUseSearchChat`.
const defaultHookReturn = {
    messages: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
    currentFilters: null,
    results: [] as Array<{
        id: string;
        slug: string;
        name: string;
        type: string;
        media: null;
        price: null;
        averageRating: 0;
        reviewsCount: 0;
        cityDestination: null;
    }>,
    resultsLoading: false,
    currentReply: '',
    isStreaming: false,
    conversationId: null,
    confidence: null,
    lastTurnHadEntities: false,
    error: null,
    errorStatus: null,
    send: vi.fn(),
    removeFilter: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn()
};

const mockSend = vi.fn();
const mockReset = vi.fn();
const mockAbort = vi.fn();

vi.mock('../../src/components/ai-search/useSearchChat', () => ({
    useSearchChat: vi.fn(() => ({
        ...defaultHookReturn,
        send: mockSend,
        abort: mockAbort,
        reset: mockReset
    }))
}));

// Import after mocks are set up.
import { useSearchChat } from '../../src/components/ai-search/useSearchChat';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPanel(props: Partial<SearchChatPanelProps> = {}) {
    return render(
        <SearchChatPanel
            locale="es"
            apiUrl="http://localhost:3001"
            isAuthenticated={true}
            currentUrl="http://localhost:4321/es/alojamientos"
            {...props}
        />
    );
}

function mockHook(overrides: Partial<typeof defaultHookReturn>) {
    vi.mocked(useSearchChat).mockReturnValue({
        ...defaultHookReturn,
        send: mockSend,
        abort: mockAbort,
        reset: mockReset,
        ...overrides
    } as ReturnType<typeof useSearchChat>);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchChatPanel', () => {
    beforeEach(() => {
        mockSend.mockClear();
        mockReset.mockClear();
        mockAbort.mockClear();
        // Reset hook to default state before each test.
        vi.mocked(useSearchChat).mockReturnValue({
            ...defaultHookReturn,
            send: mockSend,
            abort: mockAbort,
            reset: mockReset
        } as ReturnType<typeof useSearchChat>);
    });

    // ── Initial empty state ─────────────────────────────────────────────────

    describe('Initial empty state', () => {
        it('renders the panel title', () => {
            renderPanel();
            expect(screen.getByText('Búsqueda conversacional')).toBeInTheDocument();
        });

        it('renders empty-state message before first turn', () => {
            renderPanel();
            expect(
                screen.getByText(
                    'Hacé tu primera pregunta y te ayudo a encontrar el alojamiento ideal.'
                )
            ).toBeInTheDocument();
        });

        it('renders the message textarea', () => {
            renderPanel();
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('renders the send button', () => {
            renderPanel();
            expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument();
        });

        it('does NOT render the reset button when there are no messages', () => {
            renderPanel();
            expect(
                screen.queryByRole('button', { name: /nueva conversación/i })
            ).not.toBeInTheDocument();
        });
    });

    // ── Message history ─────────────────────────────────────────────────────

    describe('Message history', () => {
        it('renders user and assistant bubbles from messages array', () => {
            mockHook({
                messages: [
                    { role: 'user', content: 'Cabaña con pileta' },
                    { role: 'assistant', content: 'Encontré varias opciones.' }
                ]
            });
            renderPanel();
            expect(screen.getByText('Cabaña con pileta')).toBeInTheDocument();
            expect(screen.getByText('Encontré varias opciones.')).toBeInTheDocument();
        });

        it('shows reset button when there are messages', () => {
            mockHook({
                messages: [{ role: 'user', content: 'hola' }]
            });
            renderPanel();
            expect(screen.getByRole('button', { name: /nueva conversación/i })).toBeInTheDocument();
        });

        it('does NOT show empty-state when messages exist', () => {
            mockHook({
                messages: [{ role: 'user', content: 'busco algo' }]
            });
            renderPanel();
            expect(
                screen.queryByText(
                    'Hacé tu primera pregunta y te ayudo a encontrar el alojamiento ideal.'
                )
            ).not.toBeInTheDocument();
        });
    });

    // ── Streaming reply ─────────────────────────────────────────────────────

    describe('Streaming reply', () => {
        it('renders streamed tokens when currentReply is non-empty and isStreaming', () => {
            mockHook({
                isStreaming: true,
                currentReply: 'Aquí van las opciones que encontr'
            });
            renderPanel();
            expect(screen.getByText('Aquí van las opciones que encontr')).toBeInTheDocument();
        });

        it('does NOT render an assistant bubble when currentReply is empty', () => {
            mockHook({
                isStreaming: true,
                currentReply: ''
            });
            renderPanel();
            // When currentReply is empty the streaming bubble must not be shown.
            // The thinking indicator (role=status) is shown instead, but no bubble.
            const bubbles = document.querySelectorAll('.assistantBubble');
            expect(bubbles.length).toBe(0);
        });

        it('thinking indicator is visible when isStreaming and currentReply is empty', () => {
            mockHook({
                isStreaming: true,
                currentReply: ''
            });
            renderPanel();
            expect(screen.getByRole('status', { name: /pensando/i })).toBeInTheDocument();
        });

        it('thinking indicator is NOT shown when currentReply has content', () => {
            mockHook({
                isStreaming: true,
                currentReply: 'algo'
            });
            renderPanel();
            expect(screen.queryByRole('status', { name: /pensando/i })).not.toBeInTheDocument();
        });

        it('thinking indicator is NOT shown when not streaming', () => {
            mockHook({ isStreaming: false, currentReply: '' });
            renderPanel();
            expect(screen.queryByRole('status', { name: /pensando/i })).not.toBeInTheDocument();
        });
    });

    // ── Results grid ────────────────────────────────────────────────────────

    describe('Results grid', () => {
        const mockResults = [
            {
                id: 'acc-1',
                slug: 'cabana-rio',
                name: 'Cabaña Río Verde',
                type: 'CABIN',
                media: null,
                price: { price: 500000, currency: 'ARS' },
                averageRating: 4.5,
                reviewsCount: 12,
                cityDestination: { id: 'd1', name: 'Concepción del Uruguay' }
            },
            {
                id: 'acc-2',
                slug: 'hotel-centro',
                name: 'Hotel Centro',
                type: 'HOTEL',
                media: null,
                price: null,
                averageRating: 0,
                reviewsCount: 0,
                cityDestination: null
            }
        ];

        it('renders result cards when results is non-empty', () => {
            mockHook({ results: mockResults as ReturnType<typeof useSearchChat>['results'] });
            renderPanel();
            expect(screen.getByText('Cabaña Río Verde')).toBeInTheDocument();
            expect(screen.getByText('Hotel Centro')).toBeInTheDocument();
        });

        it('renders result card links pointing to detail pages', () => {
            mockHook({ results: mockResults as ReturnType<typeof useSearchChat>['results'] });
            renderPanel();
            const link = screen.getByRole('link', { name: 'Cabaña Río Verde' });
            expect(link).toHaveAttribute('href', '/es/alojamientos/cabana-rio/');
        });

        it('renders price for accommodations that have one', () => {
            mockHook({ results: [mockResults[0]] as ReturnType<typeof useSearchChat>['results'] });
            renderPanel();
            // Price is formatted; just check "Desde" label appears
            expect(screen.getByText(/desde/i)).toBeInTheDocument();
        });

        it('renders consult-price label for accommodations without price', () => {
            mockHook({ results: [mockResults[1]] as ReturnType<typeof useSearchChat>['results'] });
            renderPanel();
            expect(screen.getByText('Consultar precio')).toBeInTheDocument();
        });

        it('does NOT render results section when results is empty and not loading', () => {
            mockHook({ results: [], resultsLoading: false });
            renderPanel();
            expect(screen.queryByText('Resultados')).not.toBeInTheDocument();
        });
    });

    // ── Results loading skeleton ────────────────────────────────────────────

    describe('Results loading skeleton', () => {
        it('renders skeleton when resultsLoading is true', () => {
            mockHook({ resultsLoading: true });
            renderPanel();
            expect(
                screen.getByRole('status', { name: /buscando alojamientos/i })
            ).toBeInTheDocument();
        });

        it('renders skeleton AND streaming state simultaneously (D-9)', () => {
            mockHook({
                isStreaming: true,
                currentReply: 'Buscando',
                resultsLoading: true
            });
            renderPanel();
            // Streamed reply visible
            expect(screen.getByText('Buscando')).toBeInTheDocument();
            // Skeleton visible
            expect(
                screen.getByRole('status', { name: /buscando alojamientos/i })
            ).toBeInTheDocument();
        });

        it('does NOT render skeleton when resultsLoading is false', () => {
            mockHook({ resultsLoading: false, results: [] });
            renderPanel();
            expect(
                screen.queryByRole('status', { name: /buscando alojamientos/i })
            ).not.toBeInTheDocument();
        });
    });

    // ── Error banner ────────────────────────────────────────────────────────

    describe('Error banner', () => {
        it('renders the error banner when error is set', () => {
            mockHook({ error: 'El servicio no está disponible.' });
            renderPanel();
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('El servicio no está disponible.')).toBeInTheDocument();
        });

        it('does NOT render the error banner when error is null', () => {
            mockHook({ error: null });
            renderPanel();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    // ── Composer interaction ─────────────────────────────────────────────────

    describe('Composer interaction', () => {
        it('typing into the textarea updates the draft', () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'cabaña para 4' } });
            expect(input).toHaveValue('cabaña para 4');
        });

        it('submitting the form calls send with the input text', async () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'cabaña para 4' } });
            fireEvent.submit(input.closest('form')!);
            await waitFor(() => {
                expect(mockSend).toHaveBeenCalledWith('cabaña para 4');
            });
        });

        it('pressing Enter (without Shift) submits the form', async () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'pileta y wifi' } });
            fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
            await waitFor(() => {
                expect(mockSend).toHaveBeenCalledWith('pileta y wifi');
            });
        });

        it('pressing Shift+Enter does NOT submit', () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'multi\nline' } });
            fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('clears the input after submission', async () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'algo' } });
            fireEvent.submit(input.closest('form')!);
            await waitFor(() => {
                expect(input).toHaveValue('');
            });
        });

        it('does NOT call send when the draft is whitespace only', () => {
            renderPanel();
            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: '   ' } });
            fireEvent.submit(input.closest('form')!);
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('replaces the send button with a Stop button while streaming (SPEC-265 C1)', () => {
            mockHook({ isStreaming: true });
            renderPanel();
            // The send button is gone during streaming...
            expect(
                screen.queryByRole('button', { name: /enviar mensaje/i })
            ).not.toBeInTheDocument();
            // ...replaced by a Stop button that aborts the stream.
            expect(screen.getByRole('button', { name: /detener/i })).toBeInTheDocument();
        });

        it('textarea is disabled while isStreaming', () => {
            mockHook({ isStreaming: true });
            renderPanel();
            expect(screen.getByRole('textbox')).toBeDisabled();
        });
    });

    // ── Reset button ────────────────────────────────────────────────────────

    describe('Reset button', () => {
        it('clicking reset calls the hook reset function', () => {
            mockHook({
                messages: [{ role: 'user', content: 'hola' }]
            });
            renderPanel();
            fireEvent.click(screen.getByRole('button', { name: /nueva conversación/i }));
            expect(mockReset).toHaveBeenCalledOnce();
        });
    });

    // ── Accessibility ────────────────────────────────────────────────────────

    describe('Accessibility', () => {
        it('the message region has aria-live="polite"', () => {
            renderPanel();
            const liveRegion = document.querySelector('[aria-live="polite"]');
            expect(liveRegion).not.toBeNull();
        });

        it('the textarea has an accessible label', () => {
            renderPanel();
            // The label text is exactly "Mensaje" (fallback key for 'aiSearch.chat.inputLabel').
            // Use exact:true to avoid matching the send button aria-label "Enviar mensaje".
            expect(screen.getByLabelText('Mensaje', { exact: true })).toBeInTheDocument();
        });

        it('the panel root has an accessible aria-label', () => {
            renderPanel();
            expect(
                screen.getByRole('region', { name: /panel de búsqueda conversacional/i })
            ).toBeInTheDocument();
        });
    });

    describe('auth gate (anonymous)', () => {
        it('hides the chat input and shows login/register links when not authenticated', () => {
            renderPanel({ isAuthenticated: false });

            // The chat composer must not render for anonymous users.
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: /enviar mensaje/i })
            ).not.toBeInTheDocument();

            // The login CTA renders login + register links instead.
            expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(1);
        });

        it('renders the chat composer when authenticated', () => {
            renderPanel({ isAuthenticated: true });
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });
    });

    // ── Send button spinner (SPEC-228 T-021) ─────────────────────────────────

    describe('Send button spinner replaces ⏳ (SPEC-228 T-021)', () => {
        it('does NOT show ⏳ on the send button when idle', () => {
            renderPanel();
            expect(document.body.textContent).not.toContain('⏳');
        });

        it('does NOT show ⏳ on the send button when streaming', () => {
            mockHook({ isStreaming: true });
            renderPanel();
            expect(document.body.textContent).not.toContain('⏳');
        });

        it('shows the Stop button (with no ⏳ emoji) while streaming', () => {
            // SPEC-265 C1 replaced the streaming "Enviando" spinner button with a
            // Stop button. The SPEC-228 intent (never use the ⏳ emoji) still holds.
            mockHook({ isStreaming: true });
            renderPanel();
            const stopBtn = screen.getByRole('button', { name: /detener/i });
            expect(stopBtn).toBeInTheDocument();
            expect(stopBtn.textContent).not.toContain('⏳');
        });

        it('shows the up-arrow (↑) on the send button when not streaming', () => {
            renderPanel();
            const sendBtn = screen.getByRole('button', { name: /enviar mensaje/i });
            expect(sendBtn.textContent).toContain('↑');
        });
    });

    // ── SPEC-265: controls, transparency & onboarding ────────────────────────

    describe('Char counter (SPEC-265 C2)', () => {
        it('renders the char counter referencing the 500 cap', () => {
            renderPanel();
            const counter = screen.getByTestId('ai-search-char-count');
            expect(counter).toBeInTheDocument();
            expect(counter.textContent).toContain('/500');
        });
    });

    describe('Stop streaming (SPEC-265 C1)', () => {
        it('clicking Stop calls the hook abort function', () => {
            mockHook({ isStreaming: true });
            renderPanel();
            fireEvent.click(screen.getByRole('button', { name: /detener/i }));
            expect(mockAbort).toHaveBeenCalledOnce();
        });
    });

    describe('Low-confidence notice (SPEC-265 A2)', () => {
        it('shows the notice when confidence is below threshold', () => {
            mockHook({ confidence: 0.2, lastTurnHadEntities: true });
            renderPanel();
            expect(screen.getByTestId('ai-search-low-confidence')).toBeInTheDocument();
        });

        it('shows the notice when entities are empty even with high confidence', () => {
            mockHook({ confidence: 0.95, lastTurnHadEntities: false });
            renderPanel();
            expect(screen.getByTestId('ai-search-low-confidence')).toBeInTheDocument();
        });

        it('hides the notice when confidence is high and entities were extracted', () => {
            mockHook({ confidence: 0.95, lastTurnHadEntities: true });
            renderPanel();
            expect(screen.queryByTestId('ai-search-low-confidence')).not.toBeInTheDocument();
        });

        it('does not trip the notice when chips are cleared on a good turn', () => {
            // Regression: lastTurnHadEntities is a snapshot of the turn, so an
            // empty currentFilters (all chips removed) must NOT show the notice.
            mockHook({ confidence: 0.9, lastTurnHadEntities: true, currentFilters: null });
            renderPanel();
            expect(screen.queryByTestId('ai-search-low-confidence')).not.toBeInTheDocument();
        });

        it('hides the notice while streaming', () => {
            mockHook({ confidence: 0.1, isStreaming: true });
            renderPanel();
            expect(screen.queryByTestId('ai-search-low-confidence')).not.toBeInTheDocument();
        });
    });

    describe('Classified error copy (SPEC-265 C3)', () => {
        it('maps a 429 status to the rate-limit copy', () => {
            mockHook({ error: 'HTTP 429', errorStatus: 429 });
            renderPanel();
            const banner = screen.getByTestId('ai-search-error');
            expect(banner.textContent).toContain('Demasiadas búsquedas');
            expect(banner.textContent).not.toContain('HTTP 429');
        });

        it('maps a 5xx status to the service-error copy', () => {
            mockHook({ error: 'HTTP 503', errorStatus: 503 });
            renderPanel();
            const banner = screen.getByTestId('ai-search-error');
            expect(banner.textContent).toContain('El servicio no está disponible');
        });

        it('falls back to the raw error message for unclassified statuses', () => {
            mockHook({ error: 'boom', errorStatus: 400 });
            renderPanel();
            expect(screen.getByTestId('ai-search-error').textContent).toContain('boom');
        });
    });

    describe('Onboarding example chips (SPEC-265 B1)', () => {
        it('renders clickable example chips in the empty state', () => {
            renderPanel();
            const examples = screen.getByTestId('ai-search-examples');
            expect(within(examples).getAllByRole('button').length).toBeGreaterThan(0);
        });

        it('clicking an example chip sends that query', () => {
            renderPanel();
            const examples = screen.getByTestId('ai-search-examples');
            fireEvent.click(within(examples).getAllByRole('button')[0]);
            expect(mockSend).toHaveBeenCalledOnce();
        });

        it('prepends a type-specific example when pageType is set', () => {
            renderPanel({ pageType: 'CABIN' });
            const examples = screen.getByTestId('ai-search-examples');
            // The type-specific example key is prepended to the generic pool.
            expect(within(examples).getAllByRole('button')[0].textContent).toContain('typeCabin');
        });
    });
});
