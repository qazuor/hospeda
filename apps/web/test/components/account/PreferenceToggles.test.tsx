/**
 * @file PreferenceToggles.test.tsx
 * @description RTL tests for the Preferences island (HOS-2479, D11): sections of
 * kit SwitchRows with an autosave chip, the newsletter and search-history
 * on/off wired to the endpoints their pages used, and the plan-locked row.
 */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferenceToggles } from '../../../src/components/account/PreferenceToggles.client';

const API = 'http://localhost:3001';

interface Scenario {
    settings?: Record<string, unknown>;
    newsletterStatus?: string | null;
    newsletterPrefs?: Record<string, boolean> | null;
    historyLocked?: boolean;
    failMutations?: boolean;
    failUserGet?: boolean;
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/** URL + method router standing in for the API. Returns the fetch mock. */
function installApi(scenario: Scenario = {}) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const mutating = method !== 'GET';
        if (mutating && scenario.failMutations) {
            return json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500);
        }
        if (url.includes('/protected/users/') && method === 'GET') {
            if (scenario.failUserGet) return json({ success: false }, 500);
            return json({
                success: true,
                data: {
                    id: 'user-1',
                    settings: scenario.settings ?? {
                        themeWeb: 'light',
                        languageWeb: 'es',
                        notifications: {
                            enabled: true,
                            allowEmails: true,
                            allowPush: false,
                            allowSms: false
                        }
                    }
                }
            });
        }
        if (url.endsWith('/newsletter/status')) {
            return json({
                success: true,
                data: {
                    subscribed: scenario.newsletterStatus === 'active',
                    status: scenario.newsletterStatus ?? null,
                    subscribedAt: null,
                    verifiedAt: null,
                    preferences: scenario.newsletterPrefs ?? null
                }
            });
        }
        if (url.endsWith('/protected/search-history') && method === 'GET') {
            return scenario.historyLocked
                ? json(
                      { success: false, error: { code: 'ENTITLEMENT_REQUIRED', message: 'no' } },
                      403
                  )
                : json({ success: true, data: { items: [] } });
        }
        return json({ success: true, data: {} });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function callsTo({
    fetchMock,
    method,
    path
}: {
    readonly fetchMock: ReturnType<typeof installApi>;
    readonly method: string;
    readonly path: string;
}) {
    return fetchMock.mock.calls.filter(
        ([url, init]) => String(url).includes(path) && (init?.method ?? 'GET') === method
    );
}

function renderPage({
    gatePlanNames = [] as readonly string[],
    digest = 'shown' as 'shown' | 'hidden' | 'absent'
} = {}) {
    const digestProp = digest === 'absent' ? {} : { showAiQuestionsDigest: digest === 'shown' };
    return render(
        <PreferenceToggles
            userId="user-1"
            locale="es"
            apiUrl={API}
            historyGatePlanNames={gatePlanNames}
            plansHref="/es/planes/turistas/precios/"
            {...digestProp}
        />
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('PreferenceToggles: async states', () => {
    it('shows a busy skeleton while the settings load', () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() => new Promise(() => undefined))
        );
        const { container } = renderPage();
        expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    });

    it('shows an error with a retry (never an empty page) when the settings fail', async () => {
        installApi({ failUserGet: true });
        renderPage();
        const retry = await screen.findByRole('button', { name: /reintentar/i });
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        installApi();
        fireEvent.click(retry);
        expect(
            await screen.findByRole('switch', { name: /Notificaciones por email/ })
        ).toBeVisible();
    });
});

describe('PreferenceToggles: sections', () => {
    it('renders flat sections, each with a help anchor, and no nested section', async () => {
        installApi({ newsletterStatus: 'active' });
        const { container } = renderPage();
        await screen.findByRole('switch', { name: /Notificaciones por email/ });
        const sections = Array.from(container.querySelectorAll('section[data-help]'));
        const anchors = sections.map((el) => el.getAttribute('data-help'));
        expect(anchors).toEqual(
            expect.arrayContaining([
                'section:preferences.appearance',
                'section:preferences.notifications',
                'section:preferences.newsletter',
                'section:preferences.history'
            ])
        );
        for (const section of sections) {
            expect(section.querySelector('section')).toBeNull();
        }
    });

    it('does not show admin-only settings', async () => {
        installApi();
        renderPage();
        await screen.findByRole('switch', { name: /Notificaciones por email/ });
        expect(screen.queryByText(/themeAdmin|languageAdmin/)).not.toBeInTheDocument();
    });

    it('reads the saved states into the switches', async () => {
        installApi({
            settings: {
                notifications: { allowEmails: true, allowPush: false, allowSms: false },
                aiQuestionsDigest: false
            }
        });
        renderPage();
        expect(
            await screen.findByRole('switch', { name: /Notificaciones por email/ })
        ).toBeChecked();
        expect(screen.getByRole('switch', { name: /Notificaciones push/ })).not.toBeChecked();
        expect(
            screen.getByRole('switch', { name: /Recibir el resumen semanal/ })
        ).not.toBeChecked();
    });

    it('treats an absent aiQuestionsDigest as on (opt-out)', async () => {
        installApi();
        renderPage();
        expect(
            await screen.findByRole('switch', { name: /Recibir el resumen semanal/ })
        ).toBeChecked();
    });
});

describe('PreferenceToggles: AI digest only for listing owners (HOS-2602)', () => {
    it.each([
        ['false', 'hidden'],
        ['absent (fail-closed)', 'absent']
    ] as const)('hides the «asistente de tus fichas» row when showAiQuestionsDigest is %s', async (_label, digest) => {
        // Arrange
        installApi();
        // Act
        renderPage({ digest });
        await screen.findByRole('switch', { name: /Notificaciones por email/ });
        // Assert
        expect(
            screen.queryByRole('switch', { name: /Recibir el resumen semanal/ })
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/asistente de tus fichas/)).not.toBeInTheDocument();
    });

    it('shows the row to an account with a listing assistant', async () => {
        installApi();
        renderPage({ digest: 'shown' });
        expect(
            await screen.findByRole('switch', { name: /Recibir el resumen semanal/ })
        ).toBeInTheDocument();
    });
});

describe('PreferenceToggles: autosave chip', () => {
    it('saves a switch on its own and shows saving then saved', async () => {
        const fetchMock = installApi();
        renderPage();
        const toggle = await screen.findByRole('switch', { name: /Notificaciones push/ });
        fireEvent.click(toggle);
        await waitFor(() => {
            expect(document.querySelector('[data-status="saved"]')).not.toBeNull();
        });
        expect(document.querySelector('[data-status="saved"]')?.textContent).toMatch(/Guardado/);
        const [patch] = callsTo({ fetchMock, method: 'PATCH', path: '/protected/users/user-1' });
        const body = JSON.parse(String(patch?.[1]?.body)) as {
            settings: { notifications: { allowPush: boolean; allowEmails: boolean } };
        };
        expect(body.settings.notifications).toMatchObject({ allowPush: true, allowEmails: true });
    });

    it('PATCHes only aiQuestionsDigest=false when the digest is switched off', async () => {
        const fetchMock = installApi();
        renderPage();
        fireEvent.click(await screen.findByRole('switch', { name: /Recibir el resumen semanal/ }));
        await waitFor(() => {
            expect(
                callsTo({ fetchMock, method: 'PATCH', path: '/protected/users/user-1' })
            ).toHaveLength(1);
        });
        const [patch] = callsTo({ fetchMock, method: 'PATCH', path: '/protected/users/user-1' });
        expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
            settings: { aiQuestionsDigest: false }
        });
    });

    it('reverts the switch and shows the failed chip with retry when the save fails', async () => {
        installApi({ failMutations: true });
        renderPage();
        const toggle = await screen.findByRole('switch', { name: /Notificaciones push/ });
        fireEvent.click(toggle);
        await waitFor(() => {
            expect(document.querySelector('[data-status="error"]')).not.toBeNull();
        });
        expect(screen.getByRole('switch', { name: /Notificaciones push/ })).not.toBeChecked();
        const chip = document.querySelector('[data-status="error"]') as HTMLElement;
        expect(within(chip).getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });
});

describe('PreferenceToggles: newsletter (D11)', () => {
    it('shows the subscription switch on, plus the content types when active', async () => {
        installApi({
            newsletterStatus: 'active',
            newsletterPrefs: { offers: true, events: false, guides: true, productNews: true }
        });
        renderPage();
        expect(
            await screen.findByRole('switch', { name: /Recibir el newsletter por mail/ })
        ).toBeChecked();
        expect(screen.getByRole('switch', { name: /Ofertas/ })).toBeChecked();
        expect(screen.getByRole('switch', { name: /Eventos/ })).not.toBeChecked();
    });

    it('subscribes through POST /newsletter/subscribe (same call as the old page)', async () => {
        const fetchMock = installApi({ newsletterStatus: 'unsubscribed' });
        renderPage();
        const toggle = await screen.findByRole('switch', {
            name: /Recibir el newsletter por mail/
        });
        expect(toggle).not.toBeChecked();
        fireEvent.click(toggle);
        await waitFor(() => {
            expect(
                callsTo({ fetchMock, method: 'POST', path: '/protected/newsletter/subscribe' })
            ).toHaveLength(1);
        });
        const [post] = callsTo({ fetchMock, method: 'POST', path: '/newsletter/subscribe' });
        expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
            locale: 'es',
            source: 'account_preferences'
        });
    });

    it('unsubscribes through DELETE /newsletter/unsubscribe', async () => {
        const fetchMock = installApi({ newsletterStatus: 'active' });
        renderPage();
        fireEvent.click(
            await screen.findByRole('switch', { name: /Recibir el newsletter por mail/ })
        );
        // Unsubscribing asks first.
        fireEvent.click(await screen.findByRole('button', { name: 'Desuscribirme' }));
        await waitFor(() => {
            expect(
                callsTo({ fetchMock, method: 'DELETE', path: '/newsletter/unsubscribe' })
            ).toHaveLength(1);
        });
    });

    it('saves one content type through PATCH /newsletter/preferences with only that key', async () => {
        const fetchMock = installApi({ newsletterStatus: 'active' });
        renderPage();
        fireEvent.click(await screen.findByRole('switch', { name: /Ofertas/ }));
        await waitFor(() => {
            expect(
                callsTo({ fetchMock, method: 'PATCH', path: '/newsletter/preferences' })
            ).toHaveLength(1);
        });
        const [patch] = callsTo({ fetchMock, method: 'PATCH', path: '/newsletter/preferences' });
        expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ offers: false });
    });

    it('offers no content types and no switch to a bounced subscriber', async () => {
        installApi({ newsletterStatus: 'bounced' });
        renderPage();
        const toggle = await screen.findByRole('switch', {
            name: /Recibir el newsletter por mail/
        });
        expect(toggle).toBeDisabled();
        expect(screen.queryByRole('switch', { name: /Ofertas/ })).not.toBeInTheDocument();
    });
});

describe('PreferenceToggles: search history (D11)', () => {
    it('saves the opt-out through PATCH /search-history/preferences', async () => {
        const fetchMock = installApi({ settings: { searchHistoryEnabled: true } });
        renderPage();
        const toggle = await screen.findByRole('switch', { name: 'Historial de búsquedas' });
        expect(toggle).toBeChecked();
        fireEvent.click(toggle);
        await waitFor(() => {
            expect(
                callsTo({ fetchMock, method: 'PATCH', path: '/search-history/preferences' })
            ).toHaveLength(1);
        });
        const [patch] = callsTo({
            fetchMock,
            method: 'PATCH',
            path: '/search-history/preferences'
        });
        expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ enabled: false });
    });

    it('reads an explicit false as opted out', async () => {
        installApi({ settings: { searchHistoryEnabled: false } });
        renderPage();
        expect(
            await screen.findByRole('switch', { name: 'Historial de búsquedas' })
        ).not.toBeChecked();
    });

    it('renders one LockedState with catalog plan names and no duplicate switch', async () => {
        installApi({ historyLocked: true });
        const { container } = renderPage({ gatePlanNames: ['Plan Catalogo A', 'Plan Catalogo B'] });
        await screen.findByRole('link', { name: /ver planes/i });
        expect(
            screen.queryByRole('switch', { name: /Historial de búsquedas/ })
        ).not.toBeInTheDocument();
        expect(container.querySelectorAll('[data-reason="plan"]')).toHaveLength(1);
        const locked = container.querySelector('[data-reason="plan"]') as HTMLElement;
        expect(locked).not.toBeNull();
        expect(within(locked).getAllByText(/Plan Catalogo/).length).toBeGreaterThan(0);
        expect(within(locked).getByRole('link', { name: /ver planes/i })).toHaveAttribute(
            'href',
            '/es/planes/turistas/precios/'
        );
        // The old copy hardcoded plan names; none may come back.
        expect(container.textContent).not.toMatch(/\bPlus\b|\bVIP\b/);
    });

    it('shows an error with retry (not a switch) when the access check fails', async () => {
        const fetchMock = installApi();
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/protected/search-history')) return json({ success: false }, 500);
            if (url.endsWith('/newsletter/status')) {
                return json({ success: true, data: { status: null, preferences: null } });
            }
            return json({ success: true, data: { settings: {} } });
        });
        renderPage();
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /reintentar/i }).length).toBeGreaterThan(
                0
            );
        });
        expect(
            screen.queryByRole('switch', { name: 'Historial de búsquedas' })
        ).not.toBeInTheDocument();
    });
});
