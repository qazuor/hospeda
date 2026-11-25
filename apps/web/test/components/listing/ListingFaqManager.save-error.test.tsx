/**
 * @file ListingFaqManager.save-error.test.tsx
 * @description Regression test (HOS-2428), venue/experience side: a refused
 * FAQ save shows the server's mapped reason, not one generic line. Uses the
 * REAL translation loader.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingFaqManager } from '../../../src/components/listing/ListingFaqManager.client';

vi.mock('@/hooks/use-faq-ai-draft', () => ({
    useFaqAiDraft: () => ({ isLoading: false, feedback: null, suggest: vi.fn() })
}));
vi.mock('@/components/host/editor/PlanEntitlementGate.client', () => ({
    PlanEntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        post: vi.fn(),
        postProtected: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn()
    }
}));

import { apiClient } from '../../../src/lib/api/client';

const mockPostProtected = vi.mocked(apiClient.postProtected);

describe('ListingFaqManager save errors (HOS-2428)', () => {
    beforeEach(() => {
        mockPostProtected.mockReset();
    });

    it('shows the plan reason, not the generic line, for ENTITLEMENT_REQUIRED', async () => {
        mockPostProtected.mockResolvedValueOnce({
            ok: false,
            error: { code: 'ENTITLEMENT_REQUIRED', message: 'Entitlement required', status: 403 }
        } as never);
        render(
            <ListingFaqManager
                vertical="venue"
                listingId="listing-1"
                locale="es"
                initialFaqs={[]}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Agregar pregunta' }));
        fireEvent.change(screen.getByLabelText('Pregunta'), {
            target: { value: '¿Tienen estacionamiento?' }
        });
        fireEvent.change(screen.getByLabelText('Respuesta'), {
            target: { value: 'Sí, hay lugar para diez autos.' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
        const text = screen.getByRole('alert').textContent ?? '';
        expect(text).toContain('Tu plan no incluye');
        expect(text).not.toContain('No se pudo guardar la pregunta');
    });
});
