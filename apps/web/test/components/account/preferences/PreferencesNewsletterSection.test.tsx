/**
 * Tests for the newsletter section of Preferences (HOS-2479): unsubscribing
 * asks first, and a retry after a failed status re-read never repeats the
 * subscribe POST.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesNewsletterSection } from '../../../../src/components/account/preferences/PreferencesNewsletterSection';

const PREFS = { offers: true, events: true, guides: true, productNews: true };

const fetchMock = vi.fn();

const statusResponse = (status: string) => ({
    ok: true,
    status: 200,
    json: async () => ({ data: { status, preferences: PREFS } })
});

const calls = (method: string) =>
    fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PreferencesNewsletterSection', () => {
    it('asks for confirmation before unsubscribing and sends nothing on cancel', async () => {
        // Arrange
        fetchMock.mockResolvedValue(statusResponse('active'));
        const user = userEvent.setup();
        render(
            <PreferencesNewsletterSection
                locale="es"
                apiUrl="http://api.test"
            />
        );
        const toggle = await screen.findByRole('switch', { name: /newsletter/i });

        // Act
        await user.click(toggle);

        // Assert: asked, nothing sent yet
        expect(await screen.findByText(/querés desuscribirte/i)).toBeInTheDocument();
        expect(calls('DELETE')).toHaveLength(0);

        // Act: cancel
        await user.click(screen.getByRole('button', { name: /cancelar/i }));

        // Assert
        expect(calls('DELETE')).toHaveLength(0);
    });

    it('unsubscribes only after the confirmation', async () => {
        // Arrange
        fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) =>
            init?.method === 'DELETE' ? { ok: true, status: 200 } : statusResponse('active')
        );
        const user = userEvent.setup();
        render(
            <PreferencesNewsletterSection
                locale="es"
                apiUrl="http://api.test"
            />
        );

        // Act
        await user.click(await screen.findByRole('switch', { name: /newsletter/i }));
        await user.click(await screen.findByRole('button', { name: 'Desuscribirme' }));

        // Assert
        await waitFor(() => expect(calls('DELETE')).toHaveLength(1));
    });

    it('a retry after a failed status re-read does not subscribe twice', async () => {
        // Arrange: load = unsubscribed; POST ok; first re-read fails; second works
        let statusReads = 0;
        fetchMock.mockImplementation(async (_url: string, init?: { method?: string }) => {
            if (init?.method === 'POST') return { ok: true, status: 200 };
            statusReads += 1;
            if (statusReads === 2) return { ok: false, status: 500 };
            return statusResponse(statusReads === 1 ? 'unsubscribed' : 'pending_verification');
        });
        const user = userEvent.setup();
        render(
            <PreferencesNewsletterSection
                locale="es"
                apiUrl="http://api.test"
            />
        );
        await user.click(await screen.findByRole('switch', { name: /newsletter/i }));
        const retry = await screen.findByRole('button', { name: /reintentar/i });

        // Act
        await user.click(retry);

        // Assert
        await waitFor(() => expect(statusReads).toBe(3));
        expect(calls('POST')).toHaveLength(1);
    });
});
