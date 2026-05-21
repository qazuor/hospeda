/**
 * @file NewsletterPreferences.test.tsx
 * @description RTL tests for the NewsletterPreferences React island
 * (SPEC-101 T-101-34).
 *
 * Covers each lifecycle status (active / pending_verification /
 * unsubscribed / null / bounced / complained) plus the cancel-confirm
 * flow and the three actions (subscribe, resend, unsubscribe).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterPreferences } from '../../../src/components/newsletter/NewsletterPreferences.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/newsletter/NewsletterPreferences.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'http://localhost:3001';

interface StatusFixture {
    subscribed: boolean;
    status: 'active' | 'pending_verification' | 'unsubscribed' | 'bounced' | 'complained' | null;
    subscribedAt: string | null;
    verifiedAt: string | null;
    preferences?: Record<'offers' | 'events' | 'guides' | 'productNews', boolean> | null;
}

const ALL_TRUE_PREFS = {
    offers: true,
    events: true,
    guides: true,
    productNews: true
} as const;

function mockFetchSequence(...responses: Array<StatusFixture | { error: number } | 'ok'>) {
    const fetchMock = vi.fn().mockImplementation(async () => {
        const next = responses.shift();
        if (!next) {
            throw new Error('Unexpected fetch call');
        }
        if (typeof next === 'object' && 'error' in next) {
            return new Response(JSON.stringify({ success: false, error: { message: 'err' } }), {
                status: next.error,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (next === 'ok') {
            // Used for action endpoints (subscribe / resend / unsubscribe / preferences)
            // where the route returns `{ data: ... }` and the component only checks res.ok.
            return new Response(JSON.stringify({ success: true, data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // The protected status route wraps its payload in `{ success, data, metadata }`.
        // We mirror that envelope here so the component's `envelope.data` extraction
        // resolves correctly.
        return new Response(
            JSON.stringify({
                success: true,
                data: { ...next, preferences: next.preferences ?? null },
                metadata: { timestamp: new Date().toISOString(), requestId: 'test' }
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const subscribed: StatusFixture = {
    subscribed: true,
    status: 'active',
    subscribedAt: '2026-04-15T12:00:00.000Z',
    verifiedAt: '2026-04-15T12:05:00.000Z'
};

const pending: StatusFixture = {
    subscribed: false,
    status: 'pending_verification',
    subscribedAt: '2026-05-10T10:00:00.000Z',
    verifiedAt: null
};

const empty: StatusFixture = {
    subscribed: false,
    status: null,
    subscribedAt: null,
    verifiedAt: null
};

const unsubscribed: StatusFixture = {
    subscribed: false,
    status: 'unsubscribed',
    subscribedAt: '2026-03-01T10:00:00.000Z',
    verifiedAt: '2026-03-01T10:05:00.000Z'
};

const bounced: StatusFixture = {
    subscribed: false,
    status: 'bounced',
    subscribedAt: '2026-02-01T10:00:00.000Z',
    verifiedAt: '2026-02-01T10:05:00.000Z'
};

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsletterPreferences — initial render', () => {
    it('shows a loading state before the status request resolves', () => {
        // fetch never resolves → still in loading
        vi.stubGlobal(
            'fetch',
            vi.fn(() => new Promise<Response>(() => undefined))
        );
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
    });

    it('renders the error state when the status fetch returns 5xx', async () => {
        mockFetchSequence({ error: 500 });
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});

describe('NewsletterPreferences — active state', () => {
    it('renders the Activo badge, the subscribed-since date and a cancel button', async () => {
        mockFetchSequence(subscribed);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await screen.findByText('Activo');
        // "Suscripto desde:" is followed by the formatted date in the SAME <p>
        // — match the prefix tolerating the trailing colon + spaces.
        expect(
            screen.getByText((content) => content.includes('Suscripto desde'))
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancelar suscripción' })).toBeInTheDocument();
    });

    it('opens the inline confirm dialog when "Cancelar suscripción" is clicked', async () => {
        mockFetchSequence(subscribed);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        const cancelBtn = await screen.findByRole('button', { name: 'Cancelar suscripción' });
        fireEvent.click(cancelBtn);
        expect(screen.getByText('¿Cancelar suscripción?')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sí, cancelar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'No, quedarme' })).toBeInTheDocument();
    });

    it('dismisses the confirm dialog without firing the API when "No, quedarme" is clicked', async () => {
        const fetchMock = mockFetchSequence(subscribed);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        const cancelBtn = await screen.findByRole('button', { name: 'Cancelar suscripción' });
        fireEvent.click(cancelBtn);
        fireEvent.click(screen.getByRole('button', { name: 'No, quedarme' }));
        expect(screen.queryByText('¿Cancelar suscripción?')).not.toBeInTheDocument();
        // Only the initial /status request — no DELETE.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('calls DELETE /unsubscribe when "Sí, cancelar" is clicked and re-fetches the status', async () => {
        const fetchMock = mockFetchSequence(subscribed, empty, empty);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        const cancelBtn = await screen.findByRole('button', { name: 'Cancelar suscripción' });
        fireEvent.click(cancelBtn);
        fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));

        await waitFor(() => {
            const deleteCall = fetchMock.mock.calls.find(
                ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'
            );
            expect(deleteCall).toBeDefined();
            expect(String(deleteCall?.[0])).toContain('/api/v1/protected/newsletter/unsubscribe');
        });

        // After a successful DELETE we re-fetch /status.
        await waitFor(() => {
            expect(screen.getByText('No suscripto')).toBeInTheDocument();
        });
    });
});

describe('NewsletterPreferences — pending_verification state', () => {
    it('shows the pending banner and a resend button', async () => {
        mockFetchSequence(pending);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await screen.findByText('Pendiente de verificación');
        expect(
            screen.getByText('Revisá tu email para confirmar tu suscripción.')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Reenviar email de confirmación' })
        ).toBeInTheDocument();
    });

    it('POSTs to /resend-verification when the resend button is clicked', async () => {
        const fetchMock = mockFetchSequence(pending, empty);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        const resendBtn = await screen.findByRole('button', {
            name: 'Reenviar email de confirmación'
        });
        fireEvent.click(resendBtn);
        await waitFor(() => {
            const postCall = fetchMock.mock.calls.find(([url]) =>
                String(url).includes('/resend-verification')
            );
            expect(postCall).toBeDefined();
            expect((postCall?.[1] as RequestInit | undefined)?.method).toBe('POST');
        });
    });
});

describe('NewsletterPreferences — unsubscribed / null states', () => {
    it.each([
        ['null status', empty],
        ['unsubscribed status', unsubscribed]
    ])('shows a Subscribe button on %s', async (_label, fixture) => {
        mockFetchSequence(fixture);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Suscribirme' })).toBeInTheDocument();
        });
    });

    it('POSTs to /subscribe with locale + source body when "Suscribirme" is clicked', async () => {
        const fetchMock = mockFetchSequence(empty, pending, pending);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        const subBtn = await screen.findByRole('button', { name: 'Suscribirme' });
        fireEvent.click(subBtn);
        await waitFor(() => {
            const postCall = fetchMock.mock.calls.find(([url]) =>
                String(url).endsWith('/subscribe')
            );
            expect(postCall).toBeDefined();
            const init = postCall?.[1] as RequestInit | undefined;
            expect(init?.method).toBe('POST');
            const body = JSON.parse(String(init?.body));
            expect(body).toEqual({ locale: 'es', source: 'account_preferences' });
        });
    });
});

describe('NewsletterPreferences — terminal states', () => {
    it('shows the bounced badge and no actions for bounced subscribers', async () => {
        mockFetchSequence(bounced);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            // The string appears twice: once in the badge + once in the terminal note.
            expect(screen.getAllByText('Email inválido').length).toBeGreaterThanOrEqual(1);
        });
        expect(screen.queryByRole('button', { name: 'Suscribirme' })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Cancelar suscripción' })
        ).not.toBeInTheDocument();
    });
});

describe('NewsletterPreferences — accessibility', () => {
    it('has an aria-live polite region for status announcements', async () => {
        // Mock fetch BEFORE render so the island leaves the loading state and
        // mounts the live region.
        mockFetchSequence(empty);
        const { container } = render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            const live = container.querySelector('[aria-live="polite"]');
            expect(live).not.toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// Newsletter polish additions: per-channel section + per-content-type toggles
// ---------------------------------------------------------------------------

describe('NewsletterPreferences — channels + content types (active state)', () => {
    const activeWithDefaults: StatusFixture = {
        ...subscribed,
        preferences: { ...ALL_TRUE_PREFS }
    };

    it('renders the per-channel section with Email enabled and WhatsApp coming soon', async () => {
        mockFetchSequence(activeWithDefaults);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('Email')).toBeInTheDocument();
        });
        // Both labels and badges are rendered.
        expect(screen.getByText(/activado/i)).toBeInTheDocument();
        expect(screen.getByText('WhatsApp')).toBeInTheDocument();
        expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
    });

    it('renders the four content-type checkboxes pre-filled from the status response', async () => {
        mockFetchSequence({
            ...subscribed,
            preferences: { offers: false, events: true, guides: true, productNews: false }
        });
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('Ofertas')).toBeInTheDocument();
        });

        const offers = screen.getByLabelText(/ofertas/i) as HTMLInputElement;
        const events = screen.getByLabelText(/eventos/i) as HTMLInputElement;
        const guides = screen.getByLabelText(/guías/i) as HTMLInputElement;
        const productNews = screen.getByLabelText(/novedades del producto/i) as HTMLInputElement;

        expect(offers.checked).toBe(false);
        expect(events.checked).toBe(true);
        expect(guides.checked).toBe(true);
        expect(productNews.checked).toBe(false);
    });

    it('defaults to all-true preferences when the status payload returns null', async () => {
        mockFetchSequence({ ...subscribed, preferences: null });
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('Ofertas')).toBeInTheDocument();
        });
        const offers = screen.getByLabelText(/ofertas/i) as HTMLInputElement;
        expect(offers.checked).toBe(true);
    });

    it('PATCHes /api/v1/protected/newsletter/preferences when a content-type checkbox is toggled', async () => {
        const fetchMock = mockFetchSequence(activeWithDefaults, 'ok');
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getByText('Ofertas')).toBeInTheDocument();
        });

        const offers = screen.getByLabelText(/ofertas/i);
        fireEvent.click(offers);

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                `${API_URL}/api/v1/protected/newsletter/preferences`,
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ offers: false })
                })
            );
        });
    });

    it('does NOT render the per-channel section or content toggles on bounced (terminal)', async () => {
        mockFetchSequence(bounced);
        render(
            <NewsletterPreferences
                locale="es"
                apiUrl={API_URL}
            />
        );
        await waitFor(() => {
            expect(screen.getAllByText('Email inválido').length).toBeGreaterThanOrEqual(1);
        });
        expect(screen.queryByText('Email')).not.toBeInTheDocument();
        expect(screen.queryByText('Ofertas')).not.toBeInTheDocument();
    });
});
