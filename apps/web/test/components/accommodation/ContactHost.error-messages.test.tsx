/**
 * @file ContactHost.error-messages.test.tsx
 * @description Regression suite for HOS-190 — the ContactHost initiate flow used
 * to show "conversación no encontrada" for ANY non-ok response and never read the
 * real API error. `resolveInitiateFailureMessage` now surfaces the real error
 * (reason → code → status → message priority via `translateApiError`).
 *
 * Renders with the REAL translations (no `@/lib/i18n` mock) so `translateApiError`
 * actually falls through to the API `message`, proving the real error is read.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactHost } from '../../../src/components/accommodation/ContactHost.client';

vi.mock('../../../src/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

const ACTIVE_ACCOMMODATION = {
    id: 'acc-001',
    lifecycleState: 'ACTIVE' as const,
    deletedAt: null,
    type: 'CABIN',
    destinationId: 'dest-colon',
    destinationName: 'Colón',
    price: 12000,
    currency: 'ARS',
    ownerId: 'owner-9'
};

const CURRENT_USER = { id: 'user-1', name: 'Ana', email: 'ana@example.com' };

describe('ContactHost — accurate API error message (HOS-190)', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    it('surfaces the real API error message instead of "conversation not found"', async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            status: 400,
            headers: { get: () => null },
            json: async () => ({
                error: { code: 'SOME_UNKNOWN_CODE', message: 'El mensaje es demasiado corto' }
            })
        } as unknown as Response);

        render(
            <ContactHost
                accommodation={ACTIVE_ACCOMMODATION}
                currentUser={CURRENT_USER}
                locale="es"
            />
        );

        const textarea = document.getElementById('contact-message') as HTMLTextAreaElement;
        fireEvent.change(textarea, {
            target: { value: 'Hola, quería consultar por disponibilidad para el finde.' }
        });
        fireEvent.click(document.querySelector('button[type="submit"]') as HTMLButtonElement);

        await waitFor(() => {
            expect(screen.getByText('El mensaje es demasiado corto')).toBeInTheDocument();
        });

        // The misleading catch-all must NOT appear.
        expect(document.body.textContent ?? '').not.toMatch(/no encontr/i);
    });
});
