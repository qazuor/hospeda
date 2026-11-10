/**
 * @file VenueMenuManager.locked-pretrial.test.tsx
 * @description The real read path of a `locked` carta in pre-trial
 * (HOS-1854, ronda 4 — the bug the E2E P0 job found).
 *
 * The page reads `/menu` server-side to build the "N cargados que no se
 * publican" notice, but the manager owns its own read. The manager used the
 * ANONYMOUS `apiClient.get`, so the browser dropped the session cookie on the
 * cross-origin request (web :18321, API :18001) and the API answered 401:
 * the notice said one dish was stored while the locked panel said "No hay
 * datos cargados". This test does NOT mock `apiClient`; it stubs `fetch` and
 * makes the stub behave like the API — a GET without credentials is a 401.
 *
 * The section state and the gate are the exact pair of the failing case: a
 * no-trial owner's DRAFT venue resolves `sectionState: 'locked'`, and the
 * effective set holds `activate_trial` with no live title, so the upsell is
 * the pre-trial wording.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '@/components/venue/VenueMenuManager.client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const MENU_PATH = `/api/v1/protected/venues/${LISTING_ID}/menu`;
const MENU_LINK = 'https://laparrilladelpuerto.example.com/carta';

/** The failing owner: no menu key, may activate the trial, holds no title. */
const PRE_TRIAL: EntitlementsData = {
    entitlements: { activate_trial: 1 },
    limits: {},
    hasLiveNonTrialTitle: false,
    failed: false
};

const mockEntitlements = vi.mocked(getEntitlementsCached);
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    } as unknown as Response;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements.mockResolvedValue(PRE_TRIAL);
    mockFreshEntitlements.mockResolvedValue(PRE_TRIAL);
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        const method = init?.method ?? 'GET';

        if (path === MENU_PATH && method === 'GET') {
            // The real API requires the session cookie. A browser GET without
            // `credentials: 'include'` omits it, and the route answers 401.
            if (init?.credentials !== 'include') {
                return jsonResponse(
                    { error: { code: 'UNAUTHORIZED', message: 'Session required' } },
                    401
                );
            }
            return jsonResponse({
                success: true,
                data: {
                    sections: [
                        {
                            name: 'Entradas',
                            description: null,
                            items: [
                                {
                                    name: 'Empanadas',
                                    description: 'De carne cortada a cuchillo',
                                    priceCents: 250_000,
                                    isAvailable: true,
                                    photoUrl: null,
                                    photoPublicId: null,
                                    photoAlt: null
                                }
                            ]
                        }
                    ],
                    file: { url: 'https://res.cloudinary.com/demo/carta.pdf', kind: 'pdf' },
                    externalUrl: MENU_LINK
                }
            });
        }

        return jsonResponse({ success: false }, 404);
    });
});

describe('VenueMenuManager — locked carta in pre-trial reads its data (HOS-1854)', () => {
    it('sends the session cookie and renders the stored dishes, file and link', async () => {
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
                menuUrl={MENU_LINK}
            />
        );

        // The dish the "N cargados" notice counted must be on screen.
        expect(await screen.findByText('Empanadas')).toBeInTheDocument();

        // The gate is pre-trial, so the upsell is the publish-to-unlock copy,
        // not the Profesional one.
        expect(screen.getByTestId('venue-section-locked-notice')).toHaveTextContent(
            'La carta se habilita cuando publiques tu ficha'
        );

        // Read-only: no editable control at all.
        expect(container.querySelectorAll('input')).toHaveLength(0);

        // The other two things the locked carta owns are read-only too.
        expect(screen.getByRole('link', { name: 'Ver el PDF' })).toHaveAttribute(
            'href',
            'https://res.cloudinary.com/demo/carta.pdf'
        );
        expect(screen.getByRole('link', { name: 'Enlace al menú' })).toHaveAttribute(
            'href',
            MENU_LINK
        );

        // "Vaciar" exists because the section holds data.
        expect(screen.getByTestId('venue-section-vaciar')).toBeInTheDocument();

        // The regression itself: the read carried the session cookie.
        const menuGet = fetchMock.mock.calls.find(([input, init]) => {
            const requestInit = init as RequestInit | undefined;
            return (
                new URL(String(input)).pathname === MENU_PATH &&
                (requestInit?.method ?? 'GET') === 'GET'
            );
        });
        expect((menuGet?.[1] as RequestInit | undefined)?.credentials).toBe('include');
    });
});
