/**
 * @file NewsletterUnsubscribeConfirm.test.tsx
 * @description RTL tests for the confirm-unsubscribe island (HOS-2617).
 * The unsubscribe must happen only on click, never on render.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterUnsubscribeConfirm } from '../../../src/components/newsletter/NewsletterUnsubscribeConfirm.client';

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    return { createTranslations: (_locale: string) => ({ t: tFromCatalog }) };
});

vi.mock('../../../src/components/newsletter/NewsletterUnsubscribeConfirm.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_t, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

const assignMock = vi.fn();

beforeEach(() => {
    assignMock.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('location', { assign: assignMock });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('NewsletterUnsubscribeConfirm', () => {
    it('does not call the API on render', () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        render(
            <NewsletterUnsubscribeConfirm
                token="tok"
                locale="es"
            />
        );

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('POSTs the token on click and goes to desuscripto', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);
        render(
            <NewsletterUnsubscribeConfirm
                token="tok"
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /confirmar baja/i }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                'http://localhost:3001/api/v1/public/newsletter/unsubscribe',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ token: 'tok' })
                })
            );
            expect(assignMock).toHaveBeenCalledWith('/es/newsletter/desuscripto/');
        });
    });

    it('goes to the error page with token_expired when the API says so', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: { reason: 'NEWSLETTER_TOKEN_EXPIRED' } })
            })
        );
        render(
            <NewsletterUnsubscribeConfirm
                token="old"
                locale="en"
            />
        );

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(assignMock).toHaveBeenCalledWith('/en/newsletter/error/?reason=token_expired');
        });
    });

    it('goes to the error page with invalid_token for a bad token', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({ error: { reason: 'NEWSLETTER_TOKEN_INVALID' } })
            })
        );
        render(
            <NewsletterUnsubscribeConfirm
                token="bad"
                locale="pt"
            />
        );

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(assignMock).toHaveBeenCalledWith('/pt/newsletter/error/?reason=invalid_token');
        });
    });

    it('goes to invalid_token without calling the API when the link has no token', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        render(
            <NewsletterUnsubscribeConfirm
                token=""
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(assignMock).toHaveBeenCalledWith('/es/newsletter/error/?reason=invalid_token');
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows a retry message on a network failure and stays on the page', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        render(
            <NewsletterUnsubscribeConfirm
                token="tok"
                locale="es"
            />
        );

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => {
            expect(screen.getByText(/no pudimos procesar la baja/i)).toBeTruthy();
        });
        expect(assignMock).not.toHaveBeenCalled();
    });
});
