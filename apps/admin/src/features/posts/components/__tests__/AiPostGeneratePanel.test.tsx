// @vitest-environment jsdom
/**
 * @file AiPostGeneratePanel.test.tsx
 * @description Component tests for AiPostGeneratePanel (SPEC-223 T-013).
 *
 * Covers 4 cases:
 *
 *   1. Render shows panel title + topic field.
 *   2. Filling topic + one point + submit calls fetch with a body that matches
 *      the AiPostGenerateRequestSchema.
 *   3. A successful mocked JSON response triggers onDraftReady with the
 *      returned draft and populates the draft-ready UI.
 *   4. A 422 MODERATION_FAILED response shows the moderation error and does
 *      NOT populate any draft fields.
 *
 * ## Mocking strategy
 *
 * - `fetch` is mocked globally via `vi.stubGlobal`.
 * - The success mock returns the REAL API envelope:
 *   `{ success: true, data: VALID_DRAFT }` so that the test will break if the
 *   panel ever stops reading `json.data`.
 * - The error mock returns the REAL API envelope:
 *   `{ success: false, error: { code: 'MODERATION_FAILED' } }` so that the
 *   test will break if the panel ever stops reading `json.error.code`.
 * - `@/hooks/use-translations` is already mocked globally in test/setup.tsx
 *   (returns key as value) — no local re-mock needed.
 * - `@repo/icons` is mocked globally in test/setup.tsx — SparkleIcon renders
 *   as a span stub.
 * - `EntityFormContext` is mocked with a real React context so that
 *   `useContext(EntityFormContext)` inside the panel returns the mock value.
 *   Tests that exercise `setFieldValue` render inside the mock provider.
 */

import type { AiPostGenerateDraft } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * We create a real React context here so that `useContext(EntityFormContext)`
 * inside the panel component receives the correct mock value when the test
 * wraps the tree with `MockFormProvider`.
 *
 * vi.mock is hoisted to the top of the file by Vitest, so the factory below
 * runs before any imports. The exported `EntityFormContext` is this real
 * context, and `useEntityFormContext` throws when called outside a provider
 * (matching production behaviour, though the panel no longer calls it).
 */
const mockSetFieldValue = vi.fn();

// We need a stable context reference across the mock boundary.
// Because vi.mock factories run synchronously before module evaluation,
// we declare the context inside the factory using React.createContext.
vi.mock('@/components/entity-form/context/EntityFormContext', async () => {
    const reactMod = await import('react');
    const MockEntityFormContext = reactMod.createContext<{
        setFieldValue: typeof mockSetFieldValue;
    } | null>(null);

    return {
        EntityFormContext: MockEntityFormContext,
        useEntityFormContext: () => {
            const ctx = reactMod.useContext(MockEntityFormContext);
            if (!ctx) {
                throw new Error('useEntityFormContext must be used within an EntityFormProvider');
            }
            return ctx;
        }
    };
});

// Import SUT AFTER mocks are declared (vi.mock is hoisted)
import { EntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { AiPostGeneratePanel } from '../AiPostGeneratePanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Valid draft returned by the API (unwrapped inner payload). */
const VALID_DRAFT: AiPostGenerateDraft = {
    title: 'Carnaval 2024: récord de asistencia en Concepción del Uruguay',
    summary:
        'El carnaval de este año superó todas las expectativas con un récord histórico de visitantes.',
    content:
        '<p>El carnaval de Concepción del Uruguay 2024 fue declarado el más concurrido de la historia.</p>'
};

/** Wraps the panel inside a mock EntityFormContext provider so setFieldValue is available. */
function WithFormContext({ children }: { children: ReactNode }) {
    return (
        <EntityFormContext.Provider value={{ setFieldValue: mockSetFieldValue } as never}>
            {children}
        </EntityFormContext.Provider>
    );
}

/** Renders the panel standalone (no context). */
function renderPanel(onDraftReady?: (draft: AiPostGenerateDraft) => void) {
    return render(<AiPostGeneratePanel onDraftReady={onDraftReady} />);
}

/** Renders the panel inside a mock EntityFormContext provider. */
function renderPanelWithContext(onDraftReady?: (draft: AiPostGenerateDraft) => void) {
    return render(
        <WithFormContext>
            <AiPostGeneratePanel onDraftReady={onDraftReady} />
        </WithFormContext>
    );
}

/** Fills the topic field and the first point input. */
function fillForm(topic: string, point: string) {
    const topicInput = screen.getByTestId('ai-post-topic');
    fireEvent.change(topicInput, { target: { value: topic } });

    const pointInput = screen.getByTestId('ai-post-point-0');
    fireEvent.change(pointInput, { target: { value: point } });
}

/** Clicks the generate button. */
function clickGenerate() {
    const btn = screen.getByTestId('ai-post-generate-btn');
    fireEvent.click(btn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiPostGeneratePanel', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        mockSetFieldValue.mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // 1. Render shows panel title + topic field
    it('renders panel title and topic field', () => {
        renderPanel();

        // Panel container is present
        expect(screen.getByTestId('ai-post-generate-panel')).toBeInTheDocument();

        // The panel title key is rendered (t() returns the key in test setup)
        expect(screen.getByText('admin-pages.posts.aiGenerate.panelTitle')).toBeInTheDocument();

        // Topic input is present
        expect(screen.getByTestId('ai-post-topic')).toBeInTheDocument();
    });

    // 2. Submit calls fetch with body matching AiPostGenerateRequestSchema
    it('calls fetch with a valid request body when topic and one point are filled', async () => {
        // Success envelope — REAL API shape: { success: true, data: ... }
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: VALID_DRAFT })
        });

        renderPanel();
        fillForm('Carnaval 2024', 'Récord de asistencia');
        clickGenerate();

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        // The panel MUST target the API origin (VITE_API_URL), not a bare
        // relative path — a relative path resolves against the admin origin
        // and 404s (SPEC-223 smoke regression). Assert the absolute URL.
        expect(url).toMatch(/^https?:\/\/.+\/api\/v1\/admin\/ai\/post-generate$/);
        expect(init.method).toBe('POST');
        expect(init.credentials).toBe('include');

        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        expect(body.topic).toBe('Carnaval 2024');
        expect(Array.isArray(body.points)).toBe(true);
        expect((body.points as string[])[0]).toBe('Récord de asistencia');
    });

    // 3. Successful response triggers onDraftReady with the draft
    it('calls onDraftReady with the draft on a successful response', async () => {
        // Success envelope — REAL API shape: { success: true, data: ... }
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: VALID_DRAFT })
        });

        const onDraftReady = vi.fn();
        renderPanel(onDraftReady);
        fillForm('Carnaval 2024', 'Récord de asistencia');
        clickGenerate();

        // Draft preview should appear with the actual draft fields populated
        await waitFor(() => {
            expect(screen.getByTestId('ai-post-draft-preview')).toBeInTheDocument();
        });

        // Verify draft fields are visible in the preview (guards that json.data is read)
        expect(screen.getByText(VALID_DRAFT.title)).toBeInTheDocument();
        expect(screen.getByText(VALID_DRAFT.summary)).toBeInTheDocument();

        // Click apply
        fireEvent.click(screen.getByTestId('ai-post-apply'));

        expect(onDraftReady).toHaveBeenCalledTimes(1);
        expect(onDraftReady).toHaveBeenCalledWith(VALID_DRAFT);
    });

    // 3b. When no onDraftReady, apply uses setFieldValue from context
    it('calls setFieldValue on context when onDraftReady is not provided', async () => {
        // Success envelope — REAL API shape: { success: true, data: ... }
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: VALID_DRAFT })
        });

        // Render inside context provider so formContext is non-null
        renderPanelWithContext();
        fillForm('Carnaval 2024', 'Récord de asistencia');
        clickGenerate();

        await waitFor(() => {
            expect(screen.getByTestId('ai-post-draft-preview')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('ai-post-apply'));

        expect(mockSetFieldValue).toHaveBeenCalledWith('title', VALID_DRAFT.title);
        expect(mockSetFieldValue).toHaveBeenCalledWith('summary', VALID_DRAFT.summary);
        expect(mockSetFieldValue).toHaveBeenCalledWith('content', VALID_DRAFT.content);
    });

    // 4. 422 MODERATION_FAILED shows error, does NOT populate form fields
    it('shows moderation error on 422 MODERATION_FAILED and does not populate fields', async () => {
        // Error envelope — REAL API shape: { success: false, error: { code } }
        fetchMock.mockResolvedValue({
            ok: false,
            status: 422,
            json: async () => ({
                success: false,
                error: { code: 'MODERATION_FAILED', message: 'Content blocked' }
            })
        });

        const onDraftReady = vi.fn();
        renderPanel(onDraftReady);
        fillForm('Carnaval 2024', 'Récord de asistencia');
        clickGenerate();

        // Error banner should appear
        await waitFor(() => {
            expect(screen.getByTestId('ai-post-error')).toBeInTheDocument();
        });

        // i18n key for moderation error
        expect(screen.getByTestId('ai-post-error')).toHaveTextContent(
            'posts.aiGenerate.errorModeration'
        );

        // Draft preview must NOT be shown
        expect(screen.queryByTestId('ai-post-draft-preview')).not.toBeInTheDocument();

        // onDraftReady must NOT have been called
        expect(onDraftReady).not.toHaveBeenCalled();

        // setFieldValue must NOT have been called
        expect(mockSetFieldValue).not.toHaveBeenCalled();
    });

    // 5. 502 ENGINE_EXHAUSTED shows the "service unavailable" error (not generic).
    // Regression: the API maps all-providers-failed to HTTP 502 + code
    // ENGINE_EXHAUSTED, but mapErrorKey only checked status 503 / code
    // 'exhausted', so the panel showed the generic error (SPEC-223 smoke).
    it('shows the exhausted error on 502 ENGINE_EXHAUSTED, not the generic one', async () => {
        fetchMock.mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({
                success: false,
                error: { code: 'ENGINE_EXHAUSTED', message: 'ENGINE_EXHAUSTED' }
            })
        });

        renderPanel();
        fillForm('Carnaval 2024', 'Récord de asistencia');
        clickGenerate();

        await waitFor(() => {
            expect(screen.getByTestId('ai-post-error')).toBeInTheDocument();
        });

        // Must resolve to the specific "service unavailable" key, NOT errorGeneric.
        expect(screen.getByTestId('ai-post-error')).toHaveTextContent(
            'posts.aiGenerate.errorExhausted'
        );
        expect(screen.getByTestId('ai-post-error')).not.toHaveTextContent(
            'posts.aiGenerate.errorGeneric'
        );

        // No draft populated.
        expect(screen.queryByTestId('ai-post-draft-preview')).not.toBeInTheDocument();
    });
});
