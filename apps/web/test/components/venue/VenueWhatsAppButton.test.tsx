/**
 * @file VenueWhatsAppButton.test.tsx
 * @description Tests for the venue WhatsApp island (HOS-2256, AC-17, AC-18).
 *
 * The property that matters: in `LOGGED_IN_ONLY` mode the server-rendered markup
 * never contains the number, and only the resolved link carries the interaction
 * attribute that makes the tap count as `WHATSAPP_CLICK`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { userState, getWhatsApp } = vi.hoisted(() => ({
    userState: { user: null as { id: string } | null },
    getWhatsApp: vi.fn()
}));

vi.mock('@/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: userState.user, permissions: null, roles: [] })
}));
vi.mock('@/lib/api/endpoints-protected', () => ({
    protectedVenuesApi: { getWhatsApp: (...args: unknown[]) => getWhatsApp(...args) }
}));
vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

import { VenueWhatsAppButton } from '@/components/venue/VenueWhatsAppButton.client';
import { findBareInkDeclarations } from '../../static-guards/ink-literals';

const NUMBER = '+54 9 343 7654321';
const SIGN_IN = '/es/auth/signin/?returnUrl=%2Fes%2Fcomer-y-salir%2Fbar%2F';
const base = { venueId: 'v-1', venueName: 'El Bar', signInHref: SIGN_IN, locale: 'es' as const };

describe('VenueWhatsAppButton', () => {
    beforeEach(() => {
        userState.user = null;
        getWhatsApp.mockReset();
    });

    it('AC-17 renders the wa.me link, tracked as WHATSAPP_CLICK, in PUBLIC mode', () => {
        render(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'PUBLIC', number: NUMBER }}
            />
        );

        const link = screen.getByRole('link', { name: /Escribir por WhatsApp/ });
        expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/549343'));
        expect(link).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
        expect(link).toHaveClass('btn-gradient', 'btn-gradient--md');
        expect(getWhatsApp).not.toHaveBeenCalled();
    });

    it.each([
        'PUBLIC',
        'LOGGED_IN_ONLY'
    ] as const)('uses the phone button treatment for the inline %s channel', (mode) => {
        render(
            <VenueWhatsAppButton
                {...base}
                inlineChannel
                whatsapp={mode === 'PUBLIC' ? { mode, number: NUMBER } : { mode }}
            />
        );

        const link = screen.getByRole('link');
        expect(link).toHaveClass(
            'btn-gradient--sm',
            'btn-gradient--outline-primary',
            'listing-contact__channel'
        );
        expect(link.querySelector('svg')).toHaveAttribute('width', '16');
        if (mode === 'PUBLIC')
            expect(link).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
        else expect(link).not.toHaveAttribute('data-interaction-kind');
    });

    it('AC-18 server markup of LOGGED_IN_ONLY has no number and sends anonymous visitors to sign in', () => {
        const html = renderToStaticMarkup(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'LOGGED_IN_ONLY' }}
            />
        );

        expect(html).toContain(SIGN_IN.replace(/&/g, '&amp;'));
        expect(html).not.toMatch(/wa\.me|7654321/);
        // The sign-in link is not a contact attempt: it must not be counted.
        expect(html).not.toContain('data-interaction-kind');
    });

    it('does not ask the protected endpoint for an anonymous visitor', () => {
        render(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'LOGGED_IN_ONLY' }}
            />
        );

        expect(getWhatsApp).not.toHaveBeenCalled();
        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', SIGN_IN);
        expect(link).toHaveClass('btn-gradient', 'btn-gradient--outline-primary');
        expect(link).not.toHaveAttribute('data-interaction-kind');
    });

    it('AC-18 resolves the number for a signed-in visitor and tracks the tap', async () => {
        userState.user = { id: 'u-1' };
        getWhatsApp.mockResolvedValue({ ok: true, data: { number: NUMBER } });

        render(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'LOGGED_IN_ONLY' }}
            />
        );

        const link = await screen.findByRole('link', { name: /Escribir por WhatsApp/ });
        expect(getWhatsApp).toHaveBeenCalledWith({ id: 'v-1' });
        expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/549343'));
        expect(link).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
    });

    it('keeps inline channel geometry while looking up a signed-in visitor’s number', async () => {
        userState.user = { id: 'u-1' };
        getWhatsApp.mockResolvedValue({ ok: true, data: { number: NUMBER } });
        render(
            <VenueWhatsAppButton
                {...base}
                inlineChannel
                whatsapp={{ mode: 'LOGGED_IN_ONLY' }}
            />
        );

        const loading = screen.getByRole('status');
        expect(loading).toHaveClass(
            'btn-gradient--sm',
            'btn-gradient--outline-primary',
            'listing-contact__channel'
        );
        expect(loading).toHaveAttribute('aria-disabled', 'true');
        expect(loading.querySelector('svg')).toHaveAttribute('width', '16');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();

        const link = await screen.findByRole('link', { name: /Escribir por WhatsApp/ });
        expect(link).toHaveClass(
            'btn-gradient--sm',
            'btn-gradient--outline-primary',
            'listing-contact__channel'
        );
        expect(link.querySelector('svg')).toHaveAttribute('width', '16');
        expect(link).toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
    });

    it.each([
        ['an API failure', { ok: false }],
        ['an owner who stopped sharing', { ok: true, data: { number: null } }]
    ])('renders nothing for a signed-in visitor after %s', async (_name, response) => {
        userState.user = { id: 'u-1' };
        getWhatsApp.mockResolvedValue(response);

        const { container } = render(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'LOGGED_IN_ONLY' }}
            />
        );

        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('renders nothing for a PUBLIC number that is not dialable', () => {
        const { container } = render(
            <VenueWhatsAppButton
                {...base}
                whatsapp={{ mode: 'PUBLIC', number: 'ver web' }}
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});

describe('VenueWhatsAppButton ink (HOS-314)', () => {
    const css = readFileSync(
        resolve(__dirname, '../../../src/components/venue/VenueWhatsAppButton.module.css'),
        'utf8'
    );

    it('reads the stylesheet', () => {
        expect(css.length).toBeGreaterThan(300);
    });

    it('paints the brand green with the AA-safe dark ink token, never white', () => {
        expect(css).toContain('background-color: var(--channel-whatsapp);');
        expect(css).toContain('color: var(--channel-whatsapp-foreground);');
    });

    it('inks every text colour from an approved token', () => {
        expect(findBareInkDeclarations(css)).toEqual([]);
    });
});
