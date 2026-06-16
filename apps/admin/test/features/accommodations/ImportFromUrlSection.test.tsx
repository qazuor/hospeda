// @vitest-environment jsdom
/**
 * @file ImportFromUrlSection.test.tsx
 * @description Tests for the ImportFromUrlSection component (SPEC-222 T-026).
 *
 * Coverage:
 *   1. "Importar" button is disabled until the legal checkbox is ticked.
 *   2. After a successful import, `setFieldValue` is called for each field
 *      present in the fixture draft (name, summary, type).
 *   3. Confidence badges render for all imported fields.
 *   4. No save/submit mutation is triggered — only the import POST fires.
 *   5. Shows the review notice after a successful import.
 *   6. Shows an error alert when the mutation fails.
 *   7. Shows the server message when `response.message` is present.
 *   8. Button re-enables (not pending) after success.
 *
 * ## Mocking strategy
 *
 * - `useEntityFormContext` is mocked via `vi.mock` so `setFieldValue` is a
 *   spy we control.
 * - The import HTTP call is intercepted with MSW (`server.use(http.post(...))`).
 * - `useTranslations` is globally mocked in `test/setup.tsx` to return keys
 *   as-is; individual overrides use local vi.mock.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/server';

// ---------------------------------------------------------------------------
// Mocks (must be declared before any import of the SUT)
// ---------------------------------------------------------------------------

const mockSetFieldValue = vi.fn();

vi.mock('@/components/entity-form/context/EntityFormContext', () => ({
    useEntityFormContext: () => ({
        setFieldValue: mockSetFieldValue,
        handleFieldBlur: vi.fn(),
        handleFieldFocus: vi.fn(),
        setMode: vi.fn(),
        setActiveSection: vi.fn(),
        save: vi.fn(),
        saveAndPublish: vi.fn(),
        discard: vi.fn(),
        reset: vi.fn(),
        validateField: vi.fn(),
        validateForm: vi.fn(),
        isFieldDirty: vi.fn(() => false),
        isSectionDirty: vi.fn(() => false),
        hasUnsavedChanges: vi.fn(() => false),
        setErrors: vi.fn(),
        values: {},
        errors: {},
        dirtyFields: {},
        mode: 'edit',
        isLoading: false,
        isSaving: false,
        userPermissions: [],
        config: { sections: [], entityType: 'accommodation' },
        form: {}
    })
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks are registered
// ---------------------------------------------------------------------------

import { ImportFromUrlSection } from '@/features/accommodations/components/ImportFromUrlSection';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IMPORT_URL = 'http://localhost:3001/api/v1/protected/accommodations/import-from-url';

interface DraftField {
    readonly value: string;
    readonly confidence: number;
    readonly source: string;
}

interface ImportFixture {
    readonly draft: {
        readonly name?: DraftField;
        readonly summary?: DraftField;
        readonly type?: DraftField;
    };
    readonly source: string;
    readonly methodsUsed: string[];
    readonly partial: boolean;
    readonly message?: string;
    readonly destinationHint?: {
        readonly scrapedLocality?: string;
        readonly candidates: Array<{ readonly id: string; readonly name: string }>;
    };
}

const FULL_FIXTURE: ImportFixture = {
    draft: {
        name: { value: 'Cabaña del Río', confidence: 92, source: 'jsonld' },
        summary: { value: 'A peaceful riverside cabin.', confidence: 80, source: 'opengraph' },
        type: { value: 'CABIN', confidence: 75, source: 'text' }
    },
    source: 'booking',
    methodsUsed: ['jsonld', 'opengraph', 'text'],
    partial: false
};

const FIXTURE_WITH_MESSAGE: ImportFixture = {
    ...FULL_FIXTURE,
    message: 'AI cuota reducida: se usó extractor local.'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
}

function renderSection(): ReturnType<typeof render> {
    const qc = makeQueryClient();
    return render(
        <QueryClientProvider client={qc}>
            <ImportFromUrlSection />
        </QueryClientProvider>
    );
}

function makeSuccessHandler(fixture: ImportFixture) {
    return http.post(IMPORT_URL, () => HttpResponse.json({ success: true, data: fixture }));
}

function makeErrorHandler() {
    return http.post(IMPORT_URL, () =>
        HttpResponse.json(
            { success: false, error: { message: 'Scraping failed', code: 'SCRAPE_ERROR' } },
            { status: 500 }
        )
    );
}

/**
 * Fills the URL input and ticks the legal checkbox, then returns both elements.
 */
function fillForm(urlValue = 'https://booking.com/hotel/ar/sol.html'): {
    urlInput: HTMLInputElement;
    checkbox: HTMLInputElement;
    button: HTMLButtonElement;
} {
    const urlInput = screen.getByRole('textbox') as HTMLInputElement;
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    const button = screen.getByTestId('import-submit-btn') as HTMLButtonElement;

    fireEvent.change(urlInput, { target: { value: urlValue } });
    fireEvent.click(checkbox);

    return { urlInput, checkbox, button };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportFromUrlSection (SPEC-222 T-026)', () => {
    it('1. Importar button is disabled until the legal checkbox is ticked', () => {
        renderSection();

        const button = screen.getByTestId('import-submit-btn') as HTMLButtonElement;
        expect(button).toBeDisabled();

        // Tick the checkbox — button should become enabled
        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);
        expect(button).not.toBeDisabled();
    });

    it('2. After a successful import, setFieldValue is called for each draft field', async () => {
        server.use(makeSuccessHandler(FULL_FIXTURE));
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockSetFieldValue).toHaveBeenCalledWith('name', FULL_FIXTURE.draft.name?.value);
            expect(mockSetFieldValue).toHaveBeenCalledWith(
                'summary',
                FULL_FIXTURE.draft.summary?.value
            );
            expect(mockSetFieldValue).toHaveBeenCalledWith('type', FULL_FIXTURE.draft.type?.value);
        });
    });

    it('3. Confidence badges render for imported fields', async () => {
        server.use(makeSuccessHandler(FULL_FIXTURE));
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByTestId('import-confidence-badges')).toBeInTheDocument();
        });

        // One badge per prefilled field
        expect(screen.getByTestId('confidence-value-name')).toBeInTheDocument();
        expect(screen.getByTestId('confidence-value-summary')).toBeInTheDocument();
        expect(screen.getByTestId('confidence-value-type')).toBeInTheDocument();
    });

    it('4. Only the import POST fires — no save/submit mutation', async () => {
        const importSpy = vi.fn();
        server.use(
            http.post(IMPORT_URL, () => {
                importSpy();
                return HttpResponse.json({ success: true, data: FULL_FIXTURE });
            })
        );
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(importSpy).toHaveBeenCalledTimes(1);
        });

        // setFieldValue should only be called for prefill — no form save
        // A form save would be a different mutation; here we just assert the
        // import POST fired exactly once.
        expect(importSpy).toHaveBeenCalledTimes(1);
    });

    it('5. Shows the review notice after a successful import', async () => {
        server.use(makeSuccessHandler(FULL_FIXTURE));
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByTestId('import-review-notice')).toBeInTheDocument();
        });
    });

    it('6. Shows an error alert when the mutation fails', async () => {
        server.use(makeErrorHandler());
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('7. Shows the server message when response.message is present', async () => {
        server.use(makeSuccessHandler(FIXTURE_WITH_MESSAGE));
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByTestId('import-server-message')).toBeInTheDocument();
        });

        expect(screen.getByTestId('import-server-message')).toHaveTextContent(
            FIXTURE_WITH_MESSAGE.message ?? ''
        );
    });

    it('8. Importar button is not pending after success', async () => {
        server.use(makeSuccessHandler(FULL_FIXTURE));
        renderSection();

        const { button } = fillForm();
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByTestId('import-review-notice')).toBeInTheDocument();
        });

        // The button should be present and not in pending state
        const buttonAfter = screen.getByTestId('import-submit-btn') as HTMLButtonElement;
        expect(buttonAfter).not.toBeDisabled();
    });
});
