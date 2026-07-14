// @vitest-environment jsdom
/**
 * PoiCategoryManager — component tests (HOS-144 T-019).
 *
 * Covers:
 *  - Happy path: renders the current assignment (chip-select reflects the
 *    assigned category ids) and a primary-radio list derived from exactly
 *    those ids.
 *  - Primary pre-selection on load (HOS-144): when the fetched assignment
 *    list carries `isPrimary: true` on one category, the corresponding radio
 *    is pre-checked and Save starts enabled — no interactive pick required.
 *  - AC-3 (primary-must-be-selected, structurally-safe): Save stays disabled
 *    until a primary is picked among the current selection, the radio list
 *    NEVER offers an unselected category, and deselecting the current
 *    primary via the chip field auto-clears it (Save re-disables) — this
 *    invariant holds whether the primary was pre-loaded or picked
 *    interactively.
 *  - Failure path: a rejected PUT surfaces an error toast and leaves the
 *    operator's selection exactly as they left it (no silent revert).
 *
 * All network calls are mocked via `vi.mock('@/lib/api/client')`.
 * `PoiCategorySelectField` is stubbed with a plain checkbox list — this test
 * only needs to verify the manager wires the selected ids through to the
 * PUT call and derives its primary-radio list from them, mirroring how
 * `PoiDestinationRelationManager.test.tsx` stubs `DestinationSelectField`.
 * `@/hooks/use-translations` and `@repo/icons` are already mocked globally
 * in `test/setup.tsx`.
 */

import type { PointOfInterestCategoryAssignment } from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { PoiCategoryManager } from '../PoiCategoryManager';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

// Stub the heavy chip combobox with a plain checkbox list — this test only
// needs to verify the manager wires the toggled ids through to the PUT call
// and derives the primary-radio list from the current selection.
vi.mock('@/components/entity-form/fields/entity-selects/PoiCategorySelectField', () => ({
    PoiCategorySelectField: ({
        value,
        onChange
    }: {
        readonly value?: string | string[];
        readonly onChange: (value: string | string[] | undefined) => void;
    }) => {
        const selected = Array.isArray(value) ? value : [];
        const allCategoryIds = ['cat-1', 'cat-2', 'cat-3'];
        return (
            <div data-testid="poi-category-select-field-stub">
                {allCategoryIds.map((id) => (
                    <label key={id}>
                        <input
                            type="checkbox"
                            data-testid={`poi-category-checkbox-${id}`}
                            checked={selected.includes(id)}
                            onChange={() => {
                                const next = selected.includes(id)
                                    ? selected.filter((v) => v !== id)
                                    : [...selected, id];
                                onChange(next);
                            }}
                        />
                        {id}
                    </label>
                ))}
            </div>
        );
    }
}));

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORY_1: PointOfInterestCategoryAssignment = {
    id: 'cat-1',
    slug: 'restaurant',
    nameI18n: { es: 'Restaurante', en: 'Restaurant', pt: 'Restaurante' },
    icon: null,
    isPrimary: false
};

const CATEGORY_2: PointOfInterestCategoryAssignment = {
    id: 'cat-2',
    slug: 'museum',
    nameI18n: { es: 'Museo', en: 'Museum', pt: 'Museu' },
    icon: null,
    isPrimary: false
};

const CATALOG_PAGE_RESPONSE = {
    data: {
        success: true,
        data: {
            items: [CATEGORY_1, CATEGORY_2],
            pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 }
        }
    },
    status: 200
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates an isolated QueryClient wrapper with retries disabled. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

/** Renders the manager for a fixed `pointOfInterestId` inside the wrapper. */
function renderManager() {
    return render(<PoiCategoryManager pointOfInterestId="poi-1" />, {
        wrapper: createWrapper()
    });
}

/** Routes a mocked `fetchApi` call by path/method for the assigned-categories + catalog + save requests. */
function mockFetchApiFor(options: {
    assigned: PointOfInterestCategoryAssignment[];
    putResult?: 'success' | 'error';
}) {
    mockedFetchApi.mockImplementation(async ({ path, method }) => {
        if (path.includes('/poi-categories')) {
            return CATALOG_PAGE_RESPONSE;
        }
        if (path.includes('/poi-1/categories')) {
            if (!method || method === 'GET') {
                return { data: { success: true, data: options.assigned }, status: 200 };
            }
            if (method === 'PUT') {
                if (options.putResult === 'error') {
                    throw new Error('Network error');
                }
                return {
                    data: {
                        success: true,
                        data: { categories: options.assigned }
                    },
                    status: 200
                };
            }
        }
        throw new Error(`Unexpected fetchApi call in test: ${method ?? 'GET'} ${path}`);
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: happy path render
// ---------------------------------------------------------------------------

describe('PoiCategoryManager — renders current assignment', () => {
    it('reflects the assigned categories in the chip select and derives the primary-radio list from them', async () => {
        mockFetchApiFor({ assigned: [CATEGORY_1, CATEGORY_2] });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-checkbox-cat-1')).toBeChecked();
            expect(screen.getByTestId('poi-category-checkbox-cat-2')).toBeChecked();
        });
        expect(screen.getByTestId('poi-category-checkbox-cat-3')).not.toBeChecked();

        // Primary radios exist only for the two assigned categories.
        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
            expect(screen.getByTestId('poi-category-primary-radio-cat-2')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('poi-category-primary-radio-cat-3')).not.toBeInTheDocument();

        // Neither fixture is flagged `isPrimary: true` here, so no radio is
        // pre-checked and Save stays disabled — covered separately by the
        // "pre-selects the primary radio" test below for the isPrimary=true case.
        expect(screen.getByTestId('poi-category-save-button')).toBeDisabled();
    });

    it('pre-selects the primary radio and enables Save when the fetched assignment has isPrimary: true (HOS-144)', async () => {
        mockFetchApiFor({
            assigned: [
                { ...CATEGORY_1, isPrimary: true },
                { ...CATEGORY_2, isPrimary: false }
            ]
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
        });

        // Pre-selected from the GET response's isPrimary flag — no click needed.
        expect(
            (screen.getByTestId('poi-category-primary-radio-cat-1') as HTMLInputElement).checked
        ).toBe(true);
        expect(
            (screen.getByTestId('poi-category-primary-radio-cat-2') as HTMLInputElement).checked
        ).toBe(false);
        expect(screen.getByTestId('poi-category-save-button')).not.toBeDisabled();
    });

    it('renders the empty-state hint when no categories are assigned', async () => {
        mockFetchApiFor({ assigned: [] });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-empty-hint')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('poi-category-primary-fieldset')).not.toBeInTheDocument();
        expect(screen.getByTestId('poi-category-save-button')).toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// Tests: AC-3 — primary-must-be-selected, structurally safe
// ---------------------------------------------------------------------------

describe('PoiCategoryManager — primary selection (AC-3)', () => {
    it('enables Save only once a primary is picked, and clears it when its category is deselected', async () => {
        mockFetchApiFor({ assigned: [CATEGORY_1, CATEGORY_2] });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
        });

        const saveButton = screen.getByTestId('poi-category-save-button');
        expect(saveButton).toBeDisabled();

        fireEvent.click(screen.getByTestId('poi-category-primary-radio-cat-1'));
        expect(saveButton).not.toBeDisabled();

        // Deselecting cat-1 from the chip field removes its radio option AND
        // clears the primary — Save re-disables (invalid state unrepresentable).
        fireEvent.click(screen.getByTestId('poi-category-checkbox-cat-1'));

        await waitFor(() => {
            expect(
                screen.queryByTestId('poi-category-primary-radio-cat-1')
            ).not.toBeInTheDocument();
        });
        expect(saveButton).toBeDisabled();
    });

    it('never offers a radio for a category that is not currently selected', async () => {
        mockFetchApiFor({ assigned: [CATEGORY_1] });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
        });

        // cat-2 and cat-3 were never selected — no radio for either.
        expect(screen.queryByTestId('poi-category-primary-radio-cat-2')).not.toBeInTheDocument();
        expect(screen.queryByTestId('poi-category-primary-radio-cat-3')).not.toBeInTheDocument();

        // Selecting cat-3 via the chip field makes its radio appear.
        fireEvent.click(screen.getByTestId('poi-category-checkbox-cat-3'));

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-3')).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: failure path — save rejected
// ---------------------------------------------------------------------------

describe('PoiCategoryManager — save failure', () => {
    it('shows an error toast and preserves the selection when the PUT is rejected', async () => {
        mockFetchApiFor({ assigned: [CATEGORY_1, CATEGORY_2], putResult: 'error' });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('poi-category-primary-radio-cat-1'));
        fireEvent.click(screen.getByTestId('poi-category-save-button'));

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'error' })
            );
        });

        // Selection survives the failed save — no silent revert (HOS-144 §8).
        expect(screen.getByTestId('poi-category-checkbox-cat-1')).toBeChecked();
        expect(screen.getByTestId('poi-category-checkbox-cat-2')).toBeChecked();
        expect(
            (screen.getByTestId('poi-category-primary-radio-cat-1') as HTMLInputElement).checked
        ).toBe(true);
    });

    it('persists the selection via PUT and shows a success toast on success', async () => {
        mockFetchApiFor({ assigned: [CATEGORY_1], putResult: 'success' });

        renderManager();

        await waitFor(() => {
            expect(screen.getByTestId('poi-category-primary-radio-cat-1')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('poi-category-primary-radio-cat-1'));
        fireEvent.click(screen.getByTestId('poi-category-save-button'));

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PUT',
                    path: expect.stringContaining('/poi-1/categories'),
                    body: { categoryIds: ['cat-1'], primaryCategoryId: 'cat-1' }
                })
            );
        });

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'success' })
            );
        });
    });
});
