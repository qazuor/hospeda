/**
 * @file NewsletterPreferences.test.tsx
 * @description RTL tests for the NewsletterPreferences React island
 * (SPEC-101 T-101-34).
 *
 * Covers each lifecycle status (active / pending_verification /
 * unsubscribed / null / bounced / complained) as a StatusPill, the resend
 * action, and (HOS-2479) that the page holds NO switch of its own and links
 * to Preferences instead.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterPreferences } from '../../../src/components/newsletter/NewsletterPreferences.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/components/newsletter/NewsletterPreferences.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
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

const complained: StatusFixture = {
    subscribed: false,
    status: 'complained',
    subscribedAt: '2026-02-01T10:00:00.000Z',
    verifiedAt: '2026-02-01T10:05:00.000Z'
};

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function renderIsland() {
    return render(
        <NewsletterPreferences
            locale="es"
            apiUrl={API_URL}
        />
    );
}

describe('NewsletterPreferences: initial render', () => {
    it('shows a Spinner and loading text before the status request resolves', () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => new Promise<Response>(() => undefined))
        );
        renderIsland();
        expect(screen.getByText('Cargando preferencias…')).toBeInTheDocument();
        expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('renders the error state when the status fetch returns 5xx', async () => {
        mockFetchSequence({ error: 500 });
        renderIsland();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});

describe('NewsletterPreferences: status pill', () => {
    it.each([
        ['active', subscribed, 'Activo'],
        ['pending_verification', pending, 'Pendiente de verificación'],
        ['unsubscribed', unsubscribed, 'No suscripto'],
        ['null', empty, 'No suscripto'],
        ['bounced', bounced, 'Email inválido'],
        ['complained', complained, 'Cancelado']
    ])('shows %s as a pill with its word', async (_name, fixture, word) => {
        mockFetchSequence(fixture);
        const { container } = renderIsland();
        await screen.findByText(word);
        expect(container.textContent).toContain(word);
    });

    it('shows the subscribed-since date for an active subscriber', async () => {
        mockFetchSequence(subscribed);
        renderIsland();
        await screen.findByText('Activo');
        expect(screen.getByText(/Suscripto desde/)).toBeInTheDocument();
    });

    it('lists the delivery channels for an active subscriber', async () => {
        mockFetchSequence(subscribed);
        renderIsland();
        await screen.findByText('Activo');
        expect(screen.getByText('WhatsApp')).toBeInTheDocument();
        expect(screen.getByText('Próximamente')).toBeInTheDocument();
    });
});

describe('NewsletterPreferences: no switch of its own (HOS-2479)', () => {
    it.each([
        ['active', subscribed],
        ['pending_verification', pending],
        ['unsubscribed', unsubscribed],
        ['null', empty],
        ['bounced', bounced]
    ])('has no switch, checkbox, subscribe or cancel control when %s', async (_name, fixture) => {
        mockFetchSequence(fixture);
        const { container } = renderIsland();
        await screen.findByText(/Estado/);
        expect(container.querySelector('[role="switch"]')).toBeNull();
        expect(container.querySelector('input[type="checkbox"]')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Suscribirme' })).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Cancelar suscripción' })
        ).not.toBeInTheDocument();
    });

    it('links to Preferences to change it', async () => {
        mockFetchSequence(subscribed);
        renderIsland();
        const link = await screen.findByRole('link', { name: 'Cambiar en Preferencias' });
        expect(link).toHaveAttribute('href', '/es/mi-cuenta/preferencias/');
    });
});

describe('NewsletterPreferences: pending_verification resend', () => {
    it('shows the pending banner and a resend button', async () => {
        mockFetchSequence(pending);
        renderIsland();
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
        renderIsland();
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

describe('NewsletterPreferences: accessibility', () => {
    it('has an aria-live polite region for status announcements', async () => {
        mockFetchSequence(empty);
        const { container } = renderIsland();
        await waitFor(() => {
            expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
        });
    });
});
