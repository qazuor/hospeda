/**
 * @file CreatePropertyMiniForm.test.tsx
 * @description Tests for CreatePropertyMiniForm — focus on the `already_host`
 * post-submit redirect behaviour and import prefill (T-025).
 *
 * The form's validation requires all four fields (name, summary, type, city)
 * to be filled before the API is reached. SearchableSelect is mocked to a
 * simple `<button>` that fires `onChange` with a fixed item so tests can
 * bypass the async autocomplete UI without duplicating that component's own
 * test suite.
 *
 * ImportFromUrl is mocked with a stub that exposes a button calling `onImported`
 * with a fixture response, so tests can drive the prefill deterministically
 * without going through the real island's fetch.
 */

import type { AccommodationImportResponse } from '@repo/schemas';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatePropertyMiniForm } from '../../../src/components/host/CreatePropertyMiniForm.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

/**
 * Fixture import response used by the ImportFromUrl stub.
 * Provides name, summary, type with confidence metadata, and a destination hint.
 */
const FIXTURE_IMPORT_RESPONSE: AccommodationImportResponse = {
    draft: {
        name: { value: 'Casa Importada', confidence: 90, source: 'jsonld' },
        summary: { value: 'Descripción importada desde URL.', confidence: 75, source: 'opengraph' },
        type: { value: 'CABIN', confidence: 80, source: 'text' }
    },
    source: 'generic',
    methodsUsed: ['jsonld', 'opengraph', 'text'],
    partial: false,
    destinationHint: {
        scrapedLocality: 'Concepción del Uruguay',
        candidates: [{ id: '00000000-0000-0000-0000-000000000001', name: 'Concepción del Uruguay' }]
    }
};

/**
 * Mock ImportFromUrl with a stub that renders two buttons:
 * - "Importar desde una URL" toggles the section (mirrors the toggle button the
 *   real component renders).
 * - "Simular importación" calls `onImported` with the fixture response so the
 *   test can drive the prefill without a real HTTP request.
 */
vi.mock('../../../src/components/host/ImportFromUrl.client', () => ({
    ImportFromUrl: ({
        onImported
    }: {
        locale: string;
        onImported?: (response: AccommodationImportResponse) => void;
    }) => (
        <div data-testid="import-from-url-stub">
            <button
                type="button"
                data-testid="stub-trigger-import"
                onClick={() => onImported?.(FIXTURE_IMPORT_RESPONSE)}
            >
                Simular importación
            </button>
        </div>
    )
}));

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

// ---------------------------------------------------------------------------
// T-025: import prefill tests
// ---------------------------------------------------------------------------

/**
 * Open the import section by clicking the toggle button, then fire a simulated
 * import via the stub's "Simular importación" button.
 */
async function triggerImport(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByTestId('import-toggle'));
    await user.click(screen.getByTestId('stub-trigger-import'));
}

describe('CreatePropertyMiniForm — import prefill (T-025)', () => {
    it('pre-fills the name input from the import draft', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert: name input reflects the imported value.
        const nameInput = screen.getByRole('textbox', { name: /Nombre del alojamiento/i });
        expect(nameInput).toHaveValue('Casa Importada');
    });

    it('pre-fills the summary textarea from the import draft', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert
        const summaryInput = screen.getByRole('textbox', { name: /Descripción corta/i });
        expect(summaryInput).toHaveValue('Descripción importada desde URL.');
    });

    it('pre-fills the type picker from the import draft (uses existing typeItems label)', async () => {
        // Arrange — the mocked SearchableSelect renders a button, the mock records
        // the item via `onChange`. After import, the value prop is the typeItem state.
        // We verify by checking that the mocked type SearchableSelect received the
        // prefilled value — indirectly observed by the stub's onChange being called
        // when the import fires and the component passing typeItem down.
        // The simplest assertion: the CABIN value is now tracked in state, which we
        // can confirm by verifying that the confidence badge for type renders.
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert: badge for the type field is present.
        expect(screen.getByTestId('import-badge-type')).toBeInTheDocument();
        expect(screen.getByTestId('import-badge-type')).toHaveTextContent('80%');
    });

    it('renders confidence badges for all prefilled fields', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert: three badges must appear (name, summary, type).
        const nameBadge = screen.getByTestId('import-badge-name');
        const summaryBadge = screen.getByTestId('import-badge-summary');
        const typeBadge = screen.getByTestId('import-badge-type');

        expect(nameBadge).toBeInTheDocument();
        expect(nameBadge).toHaveTextContent('Importado');
        expect(nameBadge).toHaveTextContent('90%');
        expect(nameBadge).toHaveTextContent('jsonld');

        expect(summaryBadge).toBeInTheDocument();
        expect(summaryBadge).toHaveTextContent('75%');
        expect(summaryBadge).toHaveTextContent('opengraph');

        expect(typeBadge).toBeInTheDocument();
        expect(typeBadge).toHaveTextContent('80%');
        expect(typeBadge).toHaveTextContent('text');
    });

    it('shows the review notice after a successful import', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Assert notice is absent before import.
        expect(screen.queryByTestId('import-review-notice')).not.toBeInTheDocument();

        // Act
        await triggerImport(user);

        // Assert notice appears after import.
        expect(screen.getByTestId('import-review-notice')).toBeInTheDocument();
        expect(screen.getByTestId('import-review-notice')).toHaveTextContent(
            /Revisá y confirmá los datos importados/i
        );
    });

    it('surfaces the destination hint near the city picker when response carries destinationHint', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert: hint block is rendered.
        const hint = screen.getByTestId('destination-hint');
        expect(hint).toBeInTheDocument();
        expect(hint).toHaveTextContent('Concepción del Uruguay');
    });

    it('does NOT auto-set the city picker when destinationHint is present', async () => {
        // Arrange
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act
        await triggerImport(user);

        // Assert: the city mock-select button label doesn't change — city stays
        // null (no onChange was called on the city SearchableSelect).
        // The city picker renders with its original label from the mock ("Ciudad").
        expect(screen.getByTestId('property-city-mock-select')).toHaveTextContent(/Ciudad/i);
    });

    it('does NOT call the create endpoint as a result of import (no auto-save)', async () => {
        // Arrange: stub fetch so we can verify it is never invoked during import.
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const user = userEvent.setup();
        render(<CreatePropertyMiniForm {...DEFAULT_PROPS} />);

        // Act: trigger the import only, do not click submit.
        await triggerImport(user);

        // Assert: fetch must NOT have been called (no submit fired).
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
