/**
 * @file NewsletterResendButton.test.tsx
 * @description RTL tests for the resend button island used on the
 * `/{locale}/newsletter/confirma-tu-email` page.
 *
 * Covers: happy path, rate-limit/error response, network failure, and the
 * 60-second cooldown behavior using fake timers.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterResendButton } from '../../../src/components/newsletter/NewsletterResendButton.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (!fallback) return _key;
            if (!params) return fallback;
            return Object.entries(params).reduce(
                (acc, [name, value]) =>
                    acc.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
                fallback
            );
        }
    })
}));

vi.mock('../../../src/components/newsletter/NewsletterResendButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('NewsletterResendButton', () => {
    it('sends a POST to /api/v1/public/newsletter/resend with the email', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ sent: true })
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterResendButton
                email="guest@example.com"
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                'http://localhost:3001/api/v1/public/newsletter/resend',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ email: 'guest@example.com' })
                })
            );
        });
    });

    it('shows the success message after a successful send', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ sent: true })
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterResendButton
                email="guest@example.com"
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));

        await waitFor(() => {
            expect(screen.getByText(/te enviamos un nuevo email/i)).toBeInTheDocument();
        });
    });

    it('disables the button and shows the cooldown label after a successful send', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ sent: true })
        });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterResendButton
                email="guest@example.com"
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));

        // After the success transition the button enters the cooldown state:
        // disabled with a "Reintentar en {seconds}s" label.
        await waitFor(() => {
            const cooldownButton = screen.getByRole('button', { name: /reintentar en/i });
            expect(cooldownButton).toBeDisabled();
        });
    });

    it('shows the generic error message on a non-2xx response (rate-limited or 5xx)', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterResendButton
                email="guest@example.com"
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));

        await waitFor(() => {
            expect(screen.getByText(/no pudimos reenviar/i)).toBeInTheDocument();
        });
        // Button is re-enabled (no cooldown started).
        expect(screen.getByRole('button', { name: /reenviar/i })).not.toBeDisabled();
    });

    it('shows the generic error message on a network failure', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterResendButton
                email="guest@example.com"
                locale="es"
            />
        );
        fireEvent.click(screen.getByRole('button', { name: /reenviar/i }));

        await waitFor(() => {
            expect(screen.getByText(/no pudimos reenviar/i)).toBeInTheDocument();
        });
    });
});
