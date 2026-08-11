/**
 * @file WhatsAppContact.render.test.tsx
 * @description Behaviour tests for the WhatsAppContact island (HOS-369 WB0-7).
 *
 * The invariant under test is the reason this component stopped being a static
 * Astro component: the host's WhatsApp number is gated by the VIEWER's plan, and
 * the page it lives on is edge-cacheable. If the number can appear for anyone
 * who has not personally passed the protected endpoint's gate, one visitor's
 * entitled number is served to every subsequent visitor for the whole cache TTL.
 *
 * So the assertions are deliberately one-sided: an unresolved or absent session
 * must produce the upsell and must not produce a request, and the number may
 * only ever come from the protected endpoint's own response.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAuthSnapshot } from '../../helpers/auth-session';

const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    // Anything not answered by the cache falls through to this fetch, left
    // pending on purpose: the component must render its anonymous variant while
    // unresolved, which is exactly what a guest must see.
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

const mockGetWhatsApp = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedAccommodationsApi: {
        getWhatsApp: (params: { readonly id: string }) => mockGetWhatsApp(params)
    }
}));

import { WhatsAppContact } from '@/components/accommodation/WhatsAppContact.client';

const PROPS = {
    accommodationId: 'acc-1',
    accommodationName: 'Casa del Río',
    plansHref: '/es/suscriptores/turistas/',
    locale: 'es' as const
};

const NUMBER = '+5493442123456';

describe('WhatsAppContact island', () => {
    beforeEach(() => {
        mockReadCachedAuthMe.mockReset();
        mockGetWhatsApp.mockReset();
    });

    it('renders the upsell and calls nothing for a visitor with no session', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: false }));

        render(<WhatsAppContact {...PROPS} />);

        expect(await screen.findByText('Ver planes')).toBeInTheDocument();
        expect(screen.queryByText(NUMBER)).not.toBeInTheDocument();
        expect(mockGetWhatsApp).not.toHaveBeenCalled();
    });

    it('renders the upsell while the session is still unresolved', () => {
        // No cached snapshot → the hook falls through to the pending fetch, so
        // this is the state the server renders and the edge caches.
        mockReadCachedAuthMe.mockReturnValue(null);

        render(<WhatsAppContact {...PROPS} />);

        expect(screen.getByText('Ver planes')).toBeInTheDocument();
        expect(screen.queryByText(NUMBER)).not.toBeInTheDocument();
        expect(mockGetWhatsApp).not.toHaveBeenCalled();
    });

    it('shows the number as text for an entitled, non-direct viewer', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockGetWhatsApp.mockResolvedValue({
            ok: true,
            data: { number: NUMBER, direct: false, entitled: true }
        });

        render(<WhatsAppContact {...PROPS} />);

        expect(await screen.findByText(NUMBER)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /WhatsApp/i })).not.toBeInTheDocument();
        expect(mockGetWhatsApp).toHaveBeenCalledWith({ id: 'acc-1' });
    });

    it('renders a wa.me deep link for a direct-entitled viewer', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockGetWhatsApp.mockResolvedValue({
            ok: true,
            data: { number: NUMBER, direct: true, entitled: true }
        });

        render(<WhatsAppContact {...PROPS} />);

        const link = await screen.findByRole('link', { name: 'Consultar por WhatsApp' });
        expect(link.getAttribute('href')).toContain('wa.me/');
        // The shared builder strips the leading '+', without which wa.me does
        // not resolve the recipient (HOS-289).
        expect(link.getAttribute('href')).not.toContain('+');
    });

    it('falls back to the upsell when the viewer is signed in but unentitled', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockGetWhatsApp.mockResolvedValue({
            ok: true,
            data: { number: null, direct: false, entitled: false }
        });

        render(<WhatsAppContact {...PROPS} />);

        expect(await screen.findByText('Ver planes')).toBeInTheDocument();
    });

    it('falls back to the upsell rather than a blank block when the call fails', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockGetWhatsApp.mockResolvedValue({ ok: false, error: { status: 500 } });

        render(<WhatsAppContact {...PROPS} />);

        await waitFor(() => expect(mockGetWhatsApp).toHaveBeenCalled());
        expect(await screen.findByText('Ver planes')).toBeInTheDocument();
    });

    it('renders nothing when the viewer is entitled but no number exists', async () => {
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
        mockGetWhatsApp.mockResolvedValue({
            ok: true,
            data: { number: null, direct: false, entitled: true }
        });

        const { container } = render(<WhatsAppContact {...PROPS} />);

        await waitFor(() => expect(mockGetWhatsApp).toHaveBeenCalled());
        await waitFor(() => expect(container.querySelector('section')).toBeNull());
    });
});
