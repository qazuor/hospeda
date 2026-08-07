/**
 * @file AllianceClaimBanner.test.tsx
 * @description RTL tests for the claim-redemption banner (HOS-278 AC-4).
 *
 * The security-relevant behaviours are the ones pinned hardest: the session
 * cookie travels, the token leaves the address bar, and a URL without a claim
 * does nothing at all.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllianceClaimBanner } from '../../../src/components/account/AllianceClaimBanner.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/account/AllianceClaimBanner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const LEAD_ID = '00000000-0000-4000-a000-000000000002';

function setUrl(search: string): void {
    window.history.replaceState({}, '', `/es/mi-cuenta/aliados${search}`);
}

function renderBanner() {
    return render(<AllianceClaimBanner locale="es" />);
}

beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    setUrl('');
    // `window.location.reload` is deliberately NOT stubbed: jsdom defines it
    // non-configurable, so `vi.spyOn` throws "Cannot redefine property". It
    // does not need stubbing either — the reload sits behind a 1200ms timeout
    // and these tests never advance timers, so it cannot fire inside one.
});

describe('AllianceClaimBanner', () => {
    describe('with no claim in the URL', () => {
        it('renders nothing', () => {
            const { container } = renderBanner();

            expect(container).toBeEmptyDOMElement();
        });

        it('makes no request', () => {
            renderBanner();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does nothing when only half the pair is present', () => {
            setUrl('?lead=abc');
            renderBanner();

            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('with a claim in the URL', () => {
        beforeEach(() => {
            setUrl(`?lead=${LEAD_ID}&claim=raw-token`);
        });

        it('posts the token to the claim endpoint for that lead', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

            renderBanner();

            await waitFor(() => expect(global.fetch).toHaveBeenCalled());
            const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
            expect(url).toContain(`/api/v1/protected/alliance/leads/${LEAD_ID}/claim`);
            expect(init.method).toBe('POST');
            expect(JSON.parse(String(init.body))).toEqual({ token: 'raw-token' });
        });

        it('sends the session cookie, without which every claim answers 404', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

            renderBanner();

            await waitFor(() =>
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({ credentials: 'include' })
                )
            );
        });

        it('strips the token from the address bar', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

            renderBanner();

            await waitFor(() => expect(global.fetch).toHaveBeenCalled());
            expect(window.location.search).not.toContain('claim');
            expect(window.location.search).not.toContain('lead');
        });

        it('strips the token even while the request is still in flight', async () => {
            // A refresh mid-flight must not fire a second redemption.
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => undefined) as never);

            renderBanner();

            await waitFor(() => expect(window.location.search).toBe(''));
        });

        it('confirms on success', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

            renderBanner();

            expect(await screen.findByText(/vinculamos la postulación/i)).toBeInTheDocument();
        });

        it('reports a rejected claim without pretending it worked', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as Response);

            renderBanner();

            expect(await screen.findByText(/no pudimos confirmar/i)).toBeInTheDocument();
        });

        it('reports a network failure the same way', async () => {
            vi.mocked(global.fetch).mockRejectedValue(new Error('offline'));

            renderBanner();

            expect(await screen.findByText(/no pudimos confirmar/i)).toBeInTheDocument();
        });

        it('announces itself politely to assistive tech', async () => {
            vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

            renderBanner();

            const status = await screen.findByRole('status');
            expect(status).toHaveAttribute('aria-live', 'polite');
        });
    });
});
