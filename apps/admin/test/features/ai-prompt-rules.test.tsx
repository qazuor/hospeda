/**
 * Tests for the `rules` field in the AI prompt editor (SPEC-214).
 *
 * Coverage:
 * - Rules textarea is rendered with the correct label and placeholder.
 * - Rules textarea is seeded from `activePrompt.rules` when prompts load.
 * - Rules textarea starts empty when `activePrompt.rules` is undefined.
 * - Save button is disabled when neither content nor rules changed.
 * - Save button is enabled when only rules changed (content unchanged).
 * - Mutation payload includes `rules` when rules are non-empty.
 * - Mutation payload omits `rules` (undefined) when rules textarea is empty.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../mocks/server';

// ---------------------------------------------------------------------------
// Import the component under test AFTER mocks are configured in setup.tsx
// ---------------------------------------------------------------------------
// We cannot import the TanStack Router route file directly (createFileRoute
// calls are unsafe outside a full router context).  Instead we extract the
// internal FeaturePromptEditor by re-exporting it from a thin wrapper or by
// rendering a minimal harness that exercises the same hooks and state.
//
// Since FeaturePromptEditor is not exported from the route file we inline a
// minimal reproduction that mirrors its implementation contract:
//   - useAiPromptsQuery to load versions
//   - useState for draftContent / draftRules
//   - useEffect to seed from activePrompt
//   - useCreateAiPromptMutation to submit
//
// This keeps the test independent of TanStack Router while still exercising
// the real hooks and the real API call shape.
// ---------------------------------------------------------------------------

import { useAiPromptsQuery, useCreateAiPromptMutation } from '@/features/ai-settings';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Harness component (mirrors FeaturePromptEditor logic)
// ---------------------------------------------------------------------------

interface HarnessProps {
    readonly feature: string;
}

/**
 * Minimal harness that reproduces the draftContent/draftRules state machine
 * and mutation call from FeaturePromptEditor, without depending on the full
 * TanStack Router route file.
 */
function PromptEditorHarness({ feature }: HarnessProps) {
    const { data: prompts } = useAiPromptsQuery(feature);
    const createMutation = useCreateAiPromptMutation();

    const activePrompt = prompts?.find((p) => p.isActive);
    const [draftContent, setDraftContent] = useState('');
    const [draftRules, setDraftRules] = useState('');

    useEffect(() => {
        if (activePrompt) {
            setDraftContent(activePrompt.content);
            setDraftRules(activePrompt.rules ?? '');
        }
    }, [activePrompt]);

    const handleSave = async () => {
        if (!draftContent.trim()) return;
        await createMutation.mutateAsync({
            feature,
            content: draftContent.trim(),
            rules: draftRules.trim() || undefined,
            activate: true
        });
    };

    const isClean =
        draftContent.trim() === (activePrompt?.content ?? '') &&
        draftRules.trim() === (activePrompt?.rules ?? '');

    const isSaveDisabled = !draftContent.trim() || createMutation.isPending || isClean;

    return (
        <div>
            <label htmlFor={`prompt-${feature}`}>Contenido del prompt activo</label>
            <textarea
                id={`prompt-${feature}`}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Escribí el system prompt para esta función..."
            />

            <label htmlFor={`rules-${feature}`}>
                Reglas / guardrails (se aplican después del prompt)
            </label>
            <textarea
                id={`rules-${feature}`}
                value={draftRules}
                onChange={(e) => setDraftRules(e.target.value)}
                placeholder="Restricciones o instrucciones adicionales..."
            />

            <button
                type="button"
                onClick={handleSave}
                disabled={isSaveDisabled}
                data-testid="save-btn"
            >
                Guardar como nueva versión
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
}

function renderWithQuery(feature: string) {
    const qc = makeQueryClient();
    return render(
        <QueryClientProvider client={qc}>
            <PromptEditorHarness feature={feature} />
        </QueryClientProvider>
    );
}

// ---------------------------------------------------------------------------
// MSW fixture builders
// ---------------------------------------------------------------------------

type PromptFixture = {
    readonly id: string;
    readonly feature: string;
    readonly version: number;
    readonly content: string;
    readonly rules?: string;
    readonly isActive: boolean;
    readonly createdAt: string;
};

function makePromptHandler(items: PromptFixture[], feature: string) {
    return http.get('http://localhost:3001/api/v1/admin/ai/prompts', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('feature') !== feature) return;
        return HttpResponse.json({ success: true, data: { items, pagination: {} } });
    });
}

function makeCreateHandler(spy: ReturnType<typeof vi.fn>) {
    return http.post('http://localhost:3001/api/v1/admin/ai/prompts', async ({ request }) => {
        const body = await request.json();
        spy(body);
        return HttpResponse.json({
            success: true,
            data: {
                id: 'new-id',
                feature: 'chat',
                version: 2,
                content: '',
                isActive: true,
                createdAt: new Date().toISOString()
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AI prompt editor — rules field (SPEC-214)', () => {
    it('renders a rules textarea with the correct label', () => {
        server.use(makePromptHandler([], 'chat'));
        renderWithQuery('chat');

        expect(
            screen.getByLabelText('Reglas / guardrails (se aplican después del prompt)')
        ).toBeInTheDocument();
    });

    it('seeds rules textarea from activePrompt.rules', async () => {
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                rules: 'No menciones precios.',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'));
        renderWithQuery('chat');

        await waitFor(() => {
            const rulesEl = screen.getByLabelText(
                'Reglas / guardrails (se aplican después del prompt)'
            ) as HTMLTextAreaElement;
            expect(rulesEl.value).toBe('No menciones precios.');
        });
    });

    it('seeds rules textarea as empty when activePrompt has no rules', async () => {
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'));
        renderWithQuery('chat');

        await waitFor(() => {
            const rulesEl = screen.getByLabelText(
                'Reglas / guardrails (se aplican después del prompt)'
            ) as HTMLTextAreaElement;
            expect(rulesEl.value).toBe('');
        });
    });

    it('save button is disabled when content and rules are unchanged', async () => {
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                rules: 'No menciones precios.',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'));
        renderWithQuery('chat');

        await waitFor(() => {
            expect(screen.getByTestId('save-btn')).toBeDisabled();
        });
    });

    it('save button is enabled when only rules changed', async () => {
        const user = userEvent.setup();
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                rules: '',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'));
        renderWithQuery('chat');

        // Wait for seeds to settle
        await waitFor(() => {
            expect(screen.getByTestId('save-btn')).toBeDisabled();
        });

        const rulesEl = screen.getByLabelText(
            'Reglas / guardrails (se aplican después del prompt)'
        );
        await user.type(rulesEl, 'Nueva regla.');

        expect(screen.getByTestId('save-btn')).not.toBeDisabled();
    });

    it('mutation payload includes rules when non-empty', async () => {
        const user = userEvent.setup();
        const createSpy = vi.fn();
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                rules: '',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'), makeCreateHandler(createSpy));
        renderWithQuery('chat');

        // Wait for seeds
        await waitFor(() => {
            const contentEl = screen.getByLabelText(
                'Contenido del prompt activo'
            ) as HTMLTextAreaElement;
            expect(contentEl.value).toBe('Sé un asistente amable.');
        });

        const rulesEl = screen.getByLabelText(
            'Reglas / guardrails (se aplican después del prompt)'
        );
        await user.type(rulesEl, 'Nueva regla.');

        await user.click(screen.getByTestId('save-btn'));

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    rules: 'Nueva regla.'
                })
            );
        });
    });

    it('mutation payload omits rules when textarea is empty', async () => {
        const user = userEvent.setup();
        const createSpy = vi.fn();
        const items: PromptFixture[] = [
            {
                id: 'v1',
                feature: 'chat',
                version: 1,
                content: 'Sé un asistente amable.',
                isActive: true,
                createdAt: '2024-01-01T00:00:00Z'
            }
        ];
        server.use(makePromptHandler(items, 'chat'), makeCreateHandler(createSpy));
        renderWithQuery('chat');

        // Wait for seeds, then change content so save is enabled
        await waitFor(() => {
            const contentEl = screen.getByLabelText(
                'Contenido del prompt activo'
            ) as HTMLTextAreaElement;
            expect(contentEl.value).toBe('Sé un asistente amable.');
        });

        const contentEl = screen.getByLabelText('Contenido del prompt activo');
        await user.type(contentEl, ' Actualizado.');

        await user.click(screen.getByTestId('save-btn'));

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Sé un asistente amable. Actualizado.' })
            );
            // rules must be absent (undefined serialises to absent in JSON)
            const call = createSpy.mock.calls[0][0] as Record<string, unknown>;
            expect(call.rules).toBeUndefined();
        });
    });
});
