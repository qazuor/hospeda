/**
 * @file CreatePropertyMiniForm.test.tsx
 * @description Tests for CreatePropertyMiniForm — focus on the `already_host`
 * post-submit redirect behaviour.
 *
 * The form's validation requires all four fields (name, summary, type, city)
 * to be filled before the API is reached. SearchableSelect is mocked to a
 * simple `<button>` that fires `onChange` with a fixed item so tests can
 * bypass the async autocomplete UI without duplicating that component's own
 * test suite.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePropertyMiniForm } from '../../../src/components/host/CreatePropertyMiniForm.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Replace SearchableSelect with a plain button so the tests can drive the
 * type and city fields without the async combobox UI. Clicking the button
 * fires `onChange` with a fixed item, simulating a selection.
 */
vi.mock('../../../src/components/form/SearchableSelect.client', () => ({
    SearchableSelect: ({
        onChange,
        testId,
        label
    }: {
        onChange: (item: { id: string; label: string }) => void;
        testId?: string;
        label: string;
        [key: string]: unknown;
    }) => (
        <button
            type="button"
            data-testid={testId ? `${testId}-mock-select` : 'mock-select'}
            aria-label={`select-${label}`}
            onClick={() => onChange({ id: 'mock-id', label: 'Mock Option' })}
        >
            {label}
        </button>
    )
}));

/**
 * Mock i18n to return the fallback string directly without loading locale
 * files. All `t()` calls in the component pass a fallback string second arg.
 */
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

/** Mock logger to suppress output in tests. */
vi.mock('../../../src/lib/logger', () => ({
    webLogger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

/** Mock urls module — not under test here. */
vi.mock('../../../src/lib/urls', () => ({
    buildUrlWithParams: vi.fn(() => '/es/contacto')
}));

/** Mock toast store — not under test here. */
vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

/** Mock accommodation-type-icons — returns a consistent value. */
vi.mock('../../../src/lib/accommodation-type-icons', () => ({
    getAccommodationTypeIcon: vi.fn(() => '🏠')
}));

/** Mock api-errors — returns fallback string. */
vi.mock('../../../src/lib/api-errors', () => ({
    translateApiError: vi.fn(({ fallback }: { fallback?: string }) => fallback ?? 'Error')
}));

/** Mock billing-limit-error — not under test here. */
vi.mock('../../../src/lib/billing-limit-error', () => ({
    buildLimitReachedPayloadFromDetails: vi.fn(() => ({ message: 'Limit', action: undefined }))
}));

/** Mock destinations API — not under test here. */
vi.mock('../../../src/lib/api/endpoints', () => ({
    destinationsApi: {
        list: vi.fn().mockResolvedValue({ ok: false, error: { message: 'mocked' } })
    }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default props passed to every render call. */
const DEFAULT_PROPS = {
    locale: 'es' as const,
    apiUrl: 'http://localhost:3001',
    adminUrl: 'http://localhost:3000',
    accountPropertiesUrl: '/es/mi-cuenta/propiedades/',
    canAccessAdminPanel: false
} as const;

/** Build a mock Response-like object that `fetch` can resolve to. */
function buildFetchResponse(opts: {
    ok?: boolean;
    status?: number;
    body?: unknown;
}): Response {
    const { ok = true, status = 200, body = {} } = opts;
    return {
        ok,
        status,
        json: () => Promise.resolve(body)
    } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();

    // JSDOM does not allow direct assignment to window.location.href in strict
    // mode. Use Object.defineProperty to provide a writable stub — same
    // pattern as PlanPurchaseButton.test.tsx.
    Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
        configurable: true
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers to fill mandatory fields
// ---------------------------------------------------------------------------

/**
 * Fill the name and summary inputs and click the mocked type + city selects
 * so the form's `validate()` passes.
 */
async function fillAllFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    // The name label text is "Nombre del alojamiento *" — use a partial match.
    const nameInput = screen.getByRole('textbox', { name: /Nombre del alojamiento/i });
    // The summary is a <textarea>; getByRole('textbox') matches both <input type=text>
    // and <textarea>. Use label partial text to disambiguate.
    const summaryInput = screen.getByRole('textbox', { name: /Descripción corta/i });

    await user.type(nameInput, 'Mi Alojamiento Test');
    await user.type(summaryInput, 'Descripción de prueba para el alojamiento.');

    // Click the mocked SearchableSelect buttons to set type and city state.
    const typeSelect = screen.getByTestId('property-type-mock-select');
    const citySelect = screen.getByTestId('property-city-mock-select');
    await user.click(typeSelect);
    await user.click(citySelect);
}

/** Get the submit button — text is "Crear y continuar en el panel". */
function getSubmitButton(): HTMLElement {
    return screen.getByRole('button', { name: /Crear y continuar en el panel/i });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreatePropertyMiniForm — already_host redirect', () => {
    it('redirects to accountPropertiesUrl when API returns already_host (non-admin user)', async () => {
        // Arrange
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                buildFetchResponse({
                    ok: true,
                    body: {
                        data: {
                            status: 'already_host',
                            accommodationId: null,
                            accommodationSlug: null
                        }
                    }
                })
            )
        );
        const user = userEvent.setup();
        render(
            <CreatePropertyMiniForm
                {...DEFAULT_PROPS}
                canAccessAdminPanel={false}
            />
        );

        await fillAllFields(user);

        // Act
        await act(async () => {
            await user.click(getSubmitButton());
        });

        // Assert — must redirect to the own property list, NOT the global admin list.
        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/propiedades/');
        });
    });

    it('redirects to accountPropertiesUrl when API returns already_host (admin-capable user)', async () => {
        // Arrange — even when canAccessAdminPanel is true, already_host must NOT
        // redirect to the global admin accommodation list.
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                buildFetchResponse({
                    ok: true,
                    body: {
                        data: {
                            status: 'already_host',
                            accommodationId: null,
                            accommodationSlug: null
                        }
                    }
                })
            )
        );
        const user = userEvent.setup();
        render(
            <CreatePropertyMiniForm
                {...DEFAULT_PROPS}
                canAccessAdminPanel={true}
            />
        );

        await fillAllFields(user);

        // Act
        await act(async () => {
            await user.click(getSubmitButton());
        });

        // Assert — must be the web property list, never the global admin list.
        await waitFor(() => {
            expect(window.location.href).toBe('/es/mi-cuenta/propiedades/');
            expect(window.location.href).not.toContain('http://localhost:3000/accommodations');
        });
    });

    it('does NOT redirect to the global admin list when API returns already_host', async () => {
        // Arrange — regression guard: the old code sent admin-capable users to
        // `${adminBase}/accommodations` (the global list). Verify it is gone.
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                buildFetchResponse({
                    ok: true,
                    body: {
                        data: {
                            status: 'already_host',
                            accommodationId: null,
                            accommodationSlug: null
                        }
                    }
                })
            )
        );
        const user = userEvent.setup();
        render(
            <CreatePropertyMiniForm
                {...DEFAULT_PROPS}
                canAccessAdminPanel={true}
                adminUrl="http://localhost:3000"
            />
        );

        await fillAllFields(user);

        await act(async () => {
            await user.click(getSubmitButton());
        });

        await waitFor(() => {
            // Must NOT be the raw admin global list URL.
            expect(window.location.href).not.toBe('http://localhost:3000/accommodations');
        });
    });

    it('redirects to admin edit page (not accountPropertiesUrl) on created status', async () => {
        // Regression guard: the `created` branch must still redirect to the admin
        // edit page — this tests that we only changed the already_host branch.
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                // First call: session refresh (refreshSessionFromDatabase)
                .mockResolvedValueOnce(buildFetchResponse({ ok: true, body: {} }))
                // Second call: the actual onboarding start
                .mockResolvedValueOnce(
                    buildFetchResponse({
                        ok: true,
                        body: {
                            data: {
                                status: 'created',
                                accommodationId: 'abc-123',
                                accommodationSlug: 'mi-alojamiento'
                            }
                        }
                    })
                )
        );

        // The component calls refreshSessionFromDatabase before the onboarding
        // endpoint, so we need fetch to respond twice. However, the form itself
        // calls the onboarding endpoint first, THEN refreshSessionFromDatabase.
        // Re-wire: onboarding is the FIRST fetch, refresh is the SECOND.
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValueOnce(
                    buildFetchResponse({
                        ok: true,
                        body: {
                            data: {
                                status: 'created',
                                accommodationId: 'abc-123',
                                accommodationSlug: 'mi-alojamiento'
                            }
                        }
                    })
                )
                .mockResolvedValueOnce(buildFetchResponse({ ok: true, body: {} }))
        );

        const user = userEvent.setup();
        render(
            <CreatePropertyMiniForm
                {...DEFAULT_PROPS}
                canAccessAdminPanel={true}
                adminUrl="http://localhost:3000"
            />
        );

        await fillAllFields(user);

        await act(async () => {
            await user.click(getSubmitButton());
        });

        await waitFor(() => {
            expect(window.location.href).toBe('http://localhost:3000/accommodations/abc-123/edit');
        });
    });
});
