/**
 * @file FaqSection.save-error.test.tsx
 * @description Regression test (HOS-2428): a refused FAQ save used to show the
 * same generic "No se pudo guardar la pregunta." whatever the server answered,
 * hiding that the real cause was a plan / permission refusal. Uses the REAL
 * translation loader so the mapped copy is what the owner would read.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FaqSection } from '@/components/host/editor/FaqSection.client';

const { mockAdd, mockUpdate } = vi.hoisted(() => ({ mockAdd: vi.fn(), mockUpdate: vi.fn() }));

vi.mock('@/hooks/use-faq-ai-draft', () => ({
    useFaqAiDraft: () => ({ isLoading: false, feedback: null, suggest: vi.fn() })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.client', () => ({
    PlanEntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('@/lib/logger', () => ({
    webLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() }
}));
vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationFaqApi: { add: mockAdd, update: mockUpdate, remove: vi.fn(), reorder: vi.fn() }
}));

function fillAndSave(): void {
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
    fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: '¿Hay wifi gratis?' } });
    fireEvent.change(screen.getByLabelText('Respuesta'), {
        target: { value: 'Sí, gratuito en todo el hospedaje.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

describe('FaqSection save errors (HOS-2428)', () => {
    beforeEach(() => {
        mockAdd.mockReset();
    });

    it('shows the plan reason, not the generic line, for ENTITLEMENT_REQUIRED', async () => {
        mockAdd.mockResolvedValueOnce({
            ok: false,
            error: { code: 'ENTITLEMENT_REQUIRED', message: 'Entitlement required', status: 403 }
        });
        render(
            <FaqSection
                locale="es"
                accommodationId="acc-1"
                initialFaqs={[]}
            />
        );

        fillAndSave();

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        const text = screen.getByRole('alert').textContent ?? '';
        expect(text).toContain('Tu plan no incluye');
        expect(text).not.toContain('No se pudo guardar la pregunta');
        expect(text).not.toContain('Entitlement required');
    });

    it('keeps the generic line for an unmapped server failure', async () => {
        mockAdd.mockResolvedValueOnce({
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'boom', status: 500 }
        });
        render(
            <FaqSection
                locale="es"
                accommodationId="acc-1"
                initialFaqs={[]}
            />
        );

        fillAndSave();

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        expect(screen.getByRole('alert').textContent).not.toContain('boom');
    });
});
