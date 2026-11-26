/** Shared prefill/AI regression cases run against every vertical's actual policy. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FaqSection } from '@/components/account/editor/FaqSection.client';
import type { FaqConfig } from '@/components/account/editor/faq-model';
import type { FaqPersistence } from '@/lib/api/faq-persistence';
import { addToast } from '@/store/toast-store';

const { mockSuggest, mockDismiss, gate, draftState } = vi.hoisted(() => ({
    mockSuggest: vi.fn(),
    mockDismiss: vi.fn(),
    gate: vi.fn(),
    draftState: { feedback: null as 'noData' | 'notEligible' | 'error' | null, isLoading: false }
}));
vi.mock('@/hooks/use-faq-ai-draft', () => ({
    useFaqAiDraft: () => ({ ...draftState, suggest: mockSuggest })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.client', () => ({
    PlanEntitlementGate: (props: { children: React.ReactNode }) => {
        gate(props);
        return <>{props.children}</>;
    }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/lib/api/client', () => ({
    apiClient: { postProtected: mockDismiss }
}));

const MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const POLICIES: readonly (FaqConfig & { vertical: 'accommodation' | 'venue' | 'experience' })[] = [
    {
        vertical: 'accommodation',
        namespace: 'host.properties.editor.faq',
        showCategory: false,
        errorSurface: 'toast',
        validationMode: 'schema'
    },
    {
        vertical: 'venue',
        namespace: 'listing.owner.editor.faqManager',
        showCategory: true,
        errorSurface: 'inline',
        validationMode: 'required'
    },
    {
        vertical: 'experience',
        namespace: 'listing.owner.editor.faqManager',
        showCategory: true,
        errorSurface: 'inline',
        validationMode: 'required'
    }
];

describe.each(POLICIES)('FaqSection $vertical prefill and AI', (policy) => {
    const persistence: FaqPersistence = {
        add: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        reorder: vi.fn()
    };
    const mount = () =>
        render(
            <FaqSection
                {...policy}
                locale="es"
                listingId="listing-1"
                initialFaqs={[]}
                persistence={persistence}
            />
        );

    beforeEach(() => {
        vi.clearAllMocks();
        draftState.feedback = null;
        draftState.isLoading = false;
        mockDismiss.mockResolvedValue({ ok: true, data: {} });
    });
    afterEach(() => window.history.replaceState(null, '', '/'));

    it('opens the add form with ?pregunta= filled in and clears the parameter', async () => {
        window.history.replaceState(
            null,
            '',
            '/es/editar/preguntas/?pregunta=%C2%BFHay%20cochera%3F'
        );
        mount();

        const question = await screen.findByLabelText('Pregunta');
        expect(question).toHaveValue('¿Hay cochera?');
        expect(window.location.search).toBe('');
    });

    it('fills the response with a suggested draft and keeps the gated review notice visible', async () => {
        window.history.replaceState(
            null,
            '',
            `/es/editar/preguntas/?pregunta=%C2%BFHay%20cochera%3F&mensaje=${MESSAGE_ID}`
        );
        mockSuggest.mockImplementationOnce(
            async ({ onDraft }: { onDraft: (draft: string) => void }) => onDraft('Hay cochera.')
        );
        mount();
        fireEvent.click(await screen.findByText('Sugerir respuesta con IA'));

        expect(await screen.findByLabelText('Respuesta')).toHaveValue('Hay cochera.');
        expect(screen.getByText(/borrador editable/i)).toBeInTheDocument();
        expect(gate).toHaveBeenCalledWith(
            expect.objectContaining({
                vertical: policy.vertical,
                entitlementKey: 'ai_faq_draft',
                fallback: null
            })
        );
        expect(persistence.add).not.toHaveBeenCalled();
    });

    it('dismisses the source question only after a successful save through the injected port', async () => {
        window.history.replaceState(
            null,
            '',
            `/es/editar/preguntas/?pregunta=%C2%BFHay%20cochera%3F&mensaje=${MESSAGE_ID}`
        );
        vi.mocked(persistence.add).mockResolvedValueOnce({
            ok: false,
            error: { status: 500, message: 'boom' }
        });
        mount();
        fireEvent.change(await screen.findByLabelText('Respuesta'), {
            target: { value: 'Sí, hay cochera cubierta.' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await screen.findByRole('alert');
        expect(mockDismiss).not.toHaveBeenCalled();
        expect(addToast).toHaveBeenCalledTimes(policy.errorSurface === 'toast' ? 1 : 0);

        vi.mocked(persistence.add).mockResolvedValueOnce({
            ok: true,
            data: {
                faq: {
                    id: 'faq-new',
                    question: '¿Hay cochera?',
                    answer: 'Sí, hay cochera cubierta.',
                    category: null,
                    displayOrder: 0,
                    isVisibleOnListing: true,
                    isUsableByAi: true
                }
            }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() =>
            expect(mockDismiss).toHaveBeenCalledWith({
                path: `/api/v1/protected/ai/listing-questions/${MESSAGE_ID}/dismiss`
            })
        );
        expect(screen.queryByLabelText('Respuesta')).not.toBeInTheDocument();
        expect(persistence.add).toHaveBeenLastCalledWith({
            question: '¿Hay cochera?',
            answer: 'Sí, hay cochera cubierta.',
            ...(policy.showCategory ? { category: undefined } : {}),
            isVisibleOnListing: true,
            isUsableByAi: true
        });
    });

    it('keeps answer help outside the gate when AI has no confirmed data', async () => {
        draftState.feedback = 'noData';
        window.history.replaceState(
            null,
            '',
            `/es/editar/preguntas/?pregunta=Question&mensaje=${MESSAGE_ID}`
        );
        mount();
        await screen.findByLabelText('Pregunta');
        expect(screen.getByText(/No hay una respuesta confirmada/)).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
