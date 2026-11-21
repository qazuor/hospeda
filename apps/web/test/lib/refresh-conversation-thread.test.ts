/**
 * @file refresh-conversation-thread.test.ts
 * @description Unit coverage for `refreshConversationThread` (HOS-2439): the
 * whole `[data-conversation-thread]` block is swapped, and every failure leaves
 * the page untouched and reports `refreshed: false`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshConversationThread } from '../../src/lib/refresh-conversation-thread';

const PAGE_URL = 'http://localhost:4321/es/mi-cuenta/consultas/c1/?cursor=abc';

function mountBefore(): void {
    document.body.innerHTML = `
        <div data-conversation-thread>
            <div class="conv-thread__load-older"><a href="?cursor=old1">Anteriores</a></div>
            <ol class="conv-thread__messages"><li>uno</li></ol>
            <p class="conv-thread__read-receipt">Leído por el propietario</p>
        </div>`;
}

function html(inner: string): Response {
    return new Response(`<html><body>${inner}</body></html>`, { status: 200 });
}

describe('refreshConversationThread (HOS-2439)', () => {
    beforeEach(mountBefore);
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('replaces the whole container: stale read notice goes, load-older cursor updates', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            html(`<div data-conversation-thread>
                <div class="conv-thread__load-older"><a href="?cursor=new2">Anteriores</a></div>
                <ol class="conv-thread__messages"><li>uno</li><li>dos</li></ol>
            </div>`)
        );

        const result = await refreshConversationThread({ doc: document, pageUrl: PAGE_URL });

        expect(result.refreshed).toBe(true);
        expect(document.querySelectorAll('li')).toHaveLength(2);
        expect(document.querySelector('.conv-thread__read-receipt')).toBeNull();
        expect(document.querySelector('.conv-thread__load-older a')?.getAttribute('href')).toBe(
            '?cursor=new2'
        );
        expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
            'http://localhost:4321/es/mi-cuenta/consultas/c1/'
        );
    });

    it('works for the guest page markup too', async () => {
        document.body.innerHTML =
            '<div data-conversation-thread><ol class="guest-thread__messages"><li>a</li></ol></div>';
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            html(
                '<div data-conversation-thread><ol class="guest-thread__messages"><li>a</li><li>b</li></ol></div>'
            )
        );

        const result = await refreshConversationThread({
            doc: document,
            pageUrl: 'http://localhost:4321/es/guest/messages/tok/'
        });

        expect(result.refreshed).toBe(true);
        expect(document.querySelectorAll('li')).toHaveLength(2);
    });

    it('does nothing when the page has no thread container', async () => {
        document.body.innerHTML = '<p>otra cosa</p>';
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        const result = await refreshConversationThread({ doc: document, pageUrl: PAGE_URL });

        expect(result.refreshed).toBe(false);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('reports false and keeps the page when the response is not ok', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));

        const result = await refreshConversationThread({ doc: document, pageUrl: PAGE_URL });

        expect(result.refreshed).toBe(false);
        expect(document.querySelector('.conv-thread__read-receipt')).not.toBeNull();
    });

    it('reports false when the fetched HTML has no container (e.g. redirected to login)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(html('<form id="login"></form>'));

        const result = await refreshConversationThread({ doc: document, pageUrl: PAGE_URL });

        expect(result.refreshed).toBe(false);
        expect(document.querySelectorAll('li')).toHaveLength(1);
    });

    it('reports false when fetch throws', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

        const result = await refreshConversationThread({ doc: document, pageUrl: PAGE_URL });

        expect(result.refreshed).toBe(false);
        expect(document.querySelector('.conv-thread__read-receipt')).not.toBeNull();
    });
});
