/**
 * @file ConversationReply.noReload.test.tsx
 * @description Regression for HOS-2439: sending a reply used to call
 * `window.location.reload()`. The new message must be appended to the thread in
 * place, and the textarea must be at least 16px so iOS does not zoom on focus.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationReply } from '../../../src/components/account/ConversationReply.client';

vi.mock('@/lib/env', () => ({
    getApiUrl: () => 'http://localhost:3001'
}));

const THREAD_AFTER = `<html><body><ol class="conv-thread__messages astro-x"><li>Primer mensaje</li><li>Respuesta nueva</li></ol></body></html>`;

describe('ConversationReply — no reload (HOS-2439)', () => {
    const reload = vi.fn();
    const originalLocation = window.location;

    beforeEach(() => {
        reload.mockClear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                href: 'http://localhost:4321/es/mi-cuenta/consultas/conv-1/?cursor=abc',
                reload
            }
        });
        document.body.innerHTML =
            '<ol class="conv-thread__messages astro-x"><li>Primer mensaje</li></ol>';
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: originalLocation
        });
        vi.restoreAllMocks();
    });

    it('appends the sent reply to the thread without reloading the page', async () => {
        const user = userEvent.setup();
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ id: 'm1' }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            .mockResolvedValueOnce(new Response(THREAD_AFTER, { status: 200 }));

        render(
            <ConversationReply
                mode="auth"
                conversationId="conv-1"
                locale="es"
            />,
            { container: document.body.appendChild(document.createElement('div')) }
        );
        await user.type(screen.getByPlaceholderText(/escribí tu respuesta/i), 'Respuesta nueva');
        await user.click(screen.getByRole('button', { name: /enviar/i }));

        await waitFor(() => {
            expect(document.querySelector('ol')?.textContent).toContain('Respuesta nueva');
        });
        // The refetch drops the cursor so the newest page is returned.
        expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
            'http://localhost:4321/es/mi-cuenta/consultas/conv-1/'
        );
        await new Promise((r) => setTimeout(r, 800));
        expect(reload).not.toHaveBeenCalled();
    });

    it('declares a textarea font size of at least 16px', () => {
        const css = readFileSync(
            resolve(__dirname, '../../../src/components/account/ConversationReply.module.css'),
            'utf8'
        );
        const block = css.match(/\.textarea\s*\{([^}]*)\}/)?.[1] ?? '';
        const size = block.match(/font-size:\s*([\d.]+)(rem|px)/);
        expect(size).not.toBeNull();
        const px = Number(size?.[1]) * (size?.[2] === 'rem' ? 16 : 1);
        expect(px).toBeGreaterThanOrEqual(16);
    });
});
