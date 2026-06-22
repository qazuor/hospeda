/**
 * @file PreferenceToggles.test.tsx
 * @description Unit tests for the PreferenceToggles React island (T-040).
 *
 * Covers:
 * - Loading state on mount
 * - Renders toggles from fetched settings
 * - Theme select and language select are rendered
 * - Newsletter toggle starts unchecked when newsletter=false
 * - Email notification toggle is checked when allowEmails=true
 * - Toggling newsletter sends a PATCH request
 * - On PATCH failure: value reverts + toast shown
 * - Admin-only fields (themeAdmin, languageAdmin) are NOT shown
 * - Error state on fetch failure
 * - SPEC-183 T-006: PATCH error with known code surfaces localized text
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferenceToggles } from '../../../src/components/account/PreferenceToggles.client';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/PreferenceToggles.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// `translateApiError` spy — lets us verify T-006 calls without needing to
// actually translate codes (that's tested in @repo/i18n unit tests).
// Returns a sentinel so tests can confirm the helper's return value flows
// through to the toast, regardless of the fallback string.
const TRANSLATE_SENTINEL = '__TRANSLATED_BY_HELPER__';
const mockTranslateApiError = vi.fn(
    (_params: { error?: unknown; t?: unknown; fallback?: string }) => TRANSLATE_SENTINEL
);

vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: (params: Parameters<typeof mockTranslateApiError>[0]) =>
        mockTranslateApiError(params)
}));

vi.mock('../../../src/lib/i18n', () => {
    // Stable t function — avoids useCallback dep instability when t is recreated each render
    const t = (key: string, fallback?: string): string => fallback ?? key;
    const translations = { t } as const;
    return {
        createTranslations: () => translations
    };
});

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_SETTINGS = {
    themeWeb: 'light',
    languageWeb: 'es',
    notifications: {
        enabled: true,
        allowEmails: true,
        allowPush: false,
        allowSms: false
    },
    newsletter: false
};

function makeUserResponse(settings = BASE_SETTINGS) {
    return JSON.stringify({
        success: true,
        data: { id: 'user-1', settings }
    });
}

function makePatchBody(success: boolean, errorMsg?: string) {
    return JSON.stringify(
        success ? { success: true } : { success: false, error: { message: errorMsg ?? 'Error' } }
    );
}

/** Build a GET mock that returns a fresh Response on every call */
function buildGetMock(settings = BASE_SETTINGS) {
    return vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
        const method = opts?.method ?? 'GET';
        if (method === 'GET' || method === undefined) {
            return Promise.resolve(
                new Response(makeUserResponse(settings), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        }
        return Promise.resolve(
            new Response(makePatchBody(true), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        );
    });
}

function renderToggles() {
    return render(
        <PreferenceToggles
            userId="user-1"
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PreferenceToggles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTranslateApiError.mockReturnValue(TRANSLATE_SENTINEL);
    });

    it('shows loading state on mount', () => {
        globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
        renderToggles();
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
    });

    it('shows error state when fetch fails', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));
        renderToggles();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('renders theme select after fetch', async () => {
        globalThis.fetch = buildGetMock();
        renderToggles();
        await waitFor(() => {
            expect(screen.getByLabelText('Tema')).toBeInTheDocument();
        });
    });

    it('renders language select after fetch', async () => {
        globalThis.fetch = buildGetMock();
        renderToggles();
        await waitFor(() => {
            expect(screen.getByLabelText('Idioma')).toBeInTheDocument();
        });
    });

    it('newsletter toggle is unchecked when newsletter=false', async () => {
        globalThis.fetch = buildGetMock();
        renderToggles();
        await waitFor(() => {
            const checkbox = screen.getByRole('checkbox', { name: /recibir el bolet.n/i });
            expect(checkbox).not.toBeChecked();
        });
    });

    it('email notification toggle is checked when allowEmails=true', async () => {
        globalThis.fetch = buildGetMock();
        renderToggles();
        await waitFor(() => {
            const emailCheckbox = screen.getByRole('checkbox', {
                name: /correo electrónico/i
            });
            expect(emailCheckbox).toBeChecked();
        });
    });

    it('toggling newsletter sends a PATCH request', async () => {
        const patchCalls: RequestInit[] = [];
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'PATCH') {
                patchCalls.push(opts!);
                return Promise.resolve(
                    new Response(makePatchBody(true), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }
            return Promise.resolve(
                new Response(makeUserResponse(), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        renderToggles();
        await waitFor(() => screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));

        const checkbox = screen.getByRole('checkbox', { name: /recibir el bolet.n/i });
        fireEvent.click(checkbox);

        await waitFor(() => {
            expect(patchCalls.length).toBeGreaterThan(0);
        });

        expect(patchCalls[0]).toMatchObject({ method: 'PATCH' });
    });

    it('reverts newsletter toggle and shows toast on PATCH failure', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'PATCH') {
                return Promise.resolve(
                    new Response(makePatchBody(false, 'No se pudo guardar'), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }
            return Promise.resolve(
                new Response(makeUserResponse(), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        renderToggles();
        await waitFor(() => screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));

        const checkbox = screen.getByRole('checkbox', { name: /recibir el bolet.n/i });
        fireEvent.click(checkbox);

        await waitFor(() => {
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' })
            );
        });

        // After revert, checkbox should be unchecked (original state was newsletter: false)
        await waitFor(() => {
            expect(checkbox).not.toBeChecked();
        });
    });

    it('does NOT render themeAdmin or languageAdmin inputs', async () => {
        globalThis.fetch = buildGetMock();
        renderToggles();
        await waitFor(() => screen.getByLabelText('Tema'));

        const allSelects = screen.queryAllByRole('combobox');
        for (const select of allSelects) {
            const label = select.getAttribute('aria-label') ?? '';
            expect(label.toLowerCase()).not.toContain('admin');
        }
    });

    // ── SPEC-183 T-006: translateApiError integration ─────────────────────────

    it('T-006: PATCH failure passes the full error object (with code) to translateApiError', async () => {
        const apiError = {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed (English raw)'
        };

        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'PATCH') {
                return Promise.resolve(
                    new Response(JSON.stringify({ success: false, error: apiError }), {
                        status: 422,
                        headers: { 'Content-Type': 'application/json' }
                    })
                );
            }
            return Promise.resolve(
                new Response(makeUserResponse(), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        renderToggles();
        await waitFor(() => screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));
        fireEvent.click(screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));

        // translateApiError must be called with the full error object (not just message).
        await waitFor(() => {
            expect(mockTranslateApiError).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({ code: 'VALIDATION_ERROR' })
                })
            );
        });

        // The toast message is the sentinel returned by our translateApiError mock,
        // confirming that the component uses the helper's result, not a raw string.
        await waitFor(() => {
            expect(vi.mocked(addToast)).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error', message: TRANSLATE_SENTINEL })
            );
        });
    });

    it('T-006: PATCH failure passes a localized fallback to translateApiError', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'PATCH') {
                return Promise.resolve(
                    new Response(
                        JSON.stringify({ success: false, error: { message: 'Server overloaded' } }),
                        { status: 503, headers: { 'Content-Type': 'application/json' } }
                    )
                );
            }
            return Promise.resolve(
                new Response(makeUserResponse(), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });

        renderToggles();
        await waitFor(() => screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));
        fireEvent.click(screen.getByRole('checkbox', { name: /recibir el bolet.n/i }));

        await waitFor(() => {
            expect(mockTranslateApiError).toHaveBeenCalledWith(
                expect.objectContaining({
                    // The component passes a pre-localized string as fallback.
                    fallback: expect.any(String)
                })
            );
        });
    });
});
