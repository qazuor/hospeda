/**
 * @file VenueMenuManager.locked-vaciar-http.test.tsx
 * @description The HTTP contract of "Vaciar" on a locked carta (HOS-1854,
 * TEST:5.2:1).
 *
 * These tests deliberately do NOT mock `apiClient`: the point is the calls that
 * leave the browser. A mocked client would pass even if the manager sent the
 * wrong body or the wrong path, which is exactly the bug this guards —
 * `menuUrl` lives on the listing and must clear through a PATCH whose body
 * carries ONLY `{ menuUrl: null }`, because HOS-2038 keeps a clearing-only
 * PATCH outside the section declaration (so it is authorized on `locked`).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const LISTING_PATH = `/api/v1/protected/venues/${LISTING_ID}`;

const ENTITLED: EntitlementsData = {
    entitlements: {
        manage_venue_menu: 1,
        manage_venue_daily_special: 1,
        manage_venue_events: 1
    },
    limits: {},
    hasLiveNonTrialTitle: false,
    failed: false
};

const mockEntitlements = vi.mocked(getEntitlementsCached);

/** Minimal response shape `apiClient.request` actually reads. */
function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements.mockResolvedValue(ENTITLED);
    mockFreshEntitlements.mockResolvedValue(ENTITLED);
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        const method = init?.method ?? 'GET';

        if (path === MENU_PATH && method === 'GET') {
            // Default: an empty carta. Tests that need data override below.
            return jsonResponse({ success: true, data: { sections: [], file: null } });
        }
        if (method === 'PUT') {
            return jsonResponse({ success: true, data: { sections: [], file: null } });
        }
        if (method === 'DELETE') {
            return jsonResponse({ success: true, data: { success: true } });
        }
        if (method === 'PATCH') {
            return jsonResponse({ success: true, data: {} });
        }
        return jsonResponse({ success: false }, 404);
    });
});

/** Every request the manager made, in order. */
function calls() {
    return fetchMock.mock.calls.map(([input, init]) => ({
        path: new URL(String(input)).pathname,
        method: (init as RequestInit | undefined)?.method ?? 'GET',
        body: (init as RequestInit | undefined)?.body
    }));
}

async function confirmVaciar(): Promise<void> {
    fireEvent.click(screen.getByTestId('venue-section-vaciar'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vaciar la sección' }));
}

describe('VenueMenuManager — "Vaciar" clears menuUrl over HTTP (TEST:5.2:1)', () => {
    it('sends the one-key PATCH when the carta has a link', async () => {
        // A stored file keeps the section non-empty independently of the link
        // logic, so this test is about the PATCH alone.
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = new URL(String(input)).pathname;
            const method = init?.method ?? 'GET';

            if (path === MENU_PATH && method === 'GET') {
                return jsonResponse({
                    success: true,
                    data: {
                        sections: [],
                        file: { url: 'https://res.cloudinary.com/demo/carta.pdf', kind: 'pdf' }
                    }
                });
            }
            if (method === 'PUT') {
                return jsonResponse({ success: true, data: {} });
            }
            if (method === 'DELETE') {
                return jsonResponse({ success: true, data: { success: true } });
            }
            if (method === 'PATCH') {
                return jsonResponse({ success: true, data: {} });
            }
            return jsonResponse({ success: false }, 404);
        });

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
                menuUrl="https://menu.example/carta"
            />
        );

        expect(await screen.findByText('Ver el PDF')).toBeInTheDocument();

        await confirmVaciar();

        await waitFor(() => {
            expect(calls().filter((call) => call.method === 'PATCH')).toHaveLength(1);
        });

        const patch = calls().find((call) => call.method === 'PATCH');
        expect(patch).toEqual({
            path: LISTING_PATH,
            method: 'PATCH',
            body: JSON.stringify({ menuUrl: null })
        });

        // Exactly one key, so HOS-2038 reads the body as clearing-only and the
        // request is authorized on a locked section.
        expect(Object.keys(JSON.parse(patch?.body as string))).toEqual(['menuUrl']);

        // The carta document still empties through its own endpoints.
        expect(calls().find((call) => call.method === 'PUT')).toEqual({
            path: MENU_PATH,
            method: 'PUT',
            body: JSON.stringify({ sections: [] })
        });
    });

    it('does not send the PATCH when the carta has no link', async () => {
        // A file makes the section non-empty, so "Vaciar" exists: the absence of
        // the PATCH is a decision about the link, not about the button.
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = new URL(String(input)).pathname;
            const method = init?.method ?? 'GET';

            if (path === MENU_PATH && method === 'GET') {
                return jsonResponse({
                    success: true,
                    data: {
                        sections: [],
                        file: {
                            url: 'https://res.cloudinary.com/demo/carta.pdf',
                            kind: 'pdf'
                        }
                    }
                });
            }
            if (method === 'PUT') {
                return jsonResponse({ success: true, data: {} });
            }
            if (method === 'DELETE') {
                return jsonResponse({ success: true, data: { success: true } });
            }
            return jsonResponse({ success: true, data: {} });
        });

        render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="locked"
            />
        );

        expect(await screen.findByText('Ver el PDF')).toBeInTheDocument();

        await confirmVaciar();

        await waitFor(() => {
            expect(calls().some((call) => call.method === 'DELETE')).toBe(true);
        });

        expect(calls().filter((call) => call.method === 'PATCH')).toHaveLength(0);
    });
});
