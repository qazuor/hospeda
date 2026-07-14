// @vitest-environment jsdom
/**
 * PoiDestinationRelationManager — component tests (HOS-144 T-022).
 *
 * Covers:
 *  - Happy path: renders one row per destination relation, badge/select
 *    reflecting the current PRIMARY/NEARBY value.
 *  - Relation change persists via PATCH, and a failed PATCH rolls the
 *    optimistic `<select>` value back to the previous relation + surfaces an
 *    error toast (HOS-144 R-4/AC-4).
 *  - Removing a relation shows the confirmation dialog BEFORE the DELETE
 *    request fires (HOS-144 AC-5).
 *  - Add-destination happy path: selecting a destination + clicking Add
 *    POSTs the expected body.
 *
 * All network calls are mocked via `vi.mock('@/lib/api/client')`.
 * `DestinationSelectField` is stubbed with a plain `<select>` to avoid
 * exercising its internal Popover/Command search machinery — this test only
 * needs to verify the manager wires the selected id through to the POST
 * call. `@tanstack/react-router` (Link), `@/hooks/use-translations`, and
 * `@repo/icons` are already mocked globally in `test/setup.tsx`.
 */

import {
    type PointOfInterestDestinationListItem,
    PointOfInterestDestinationRelationEnum
} from '@repo/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApi } from '@/lib/api/client';
import { PoiDestinationRelationManager } from '../PoiDestinationRelationManager';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));

const mockAddToast = vi.fn();
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: mockAddToast })
}));

// Stub the heavy combobox with a plain <select> — this test only needs to
// verify the manager wires the chosen destinationId through to the POST call.
vi.mock('@/components/entity-form/fields/entity-selects/DestinationSelectField', () => ({
    DestinationSelectField: ({
        value,
        onChange
    }: {
        readonly value?: string | string[];
        readonly onChange: (value: string | string[] | undefined) => void;
    }) => (
        <select
            data-testid="destination-select-field-stub"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
        >
            <option value="">-- select --</option>
            <option value="dest-3">Destination Three</option>
        </select>
    )
}));

const mockedFetchApi = vi.mocked(fetchApi);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRIMARY_ITEM: PointOfInterestDestinationListItem = {
    destinationId: 'dest-1',
    destinationName: 'Destination One',
    destinationSlug: 'destination-one',
    relation: PointOfInterestDestinationRelationEnum.PRIMARY
};

const NEARBY_ITEM: PointOfInterestDestinationListItem = {
    destinationId: 'dest-2',
    destinationName: 'Destination Two',
    destinationSlug: 'destination-two',
    relation: PointOfInterestDestinationRelationEnum.NEARBY
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
    return render(<PoiDestinationRelationManager pointOfInterestId="poi-1" />, {
        wrapper: createWrapper()
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests: happy path render
// ---------------------------------------------------------------------------

describe('PoiDestinationRelationManager — renders relations', () => {
    it('renders one row per destination relation with the correct select value', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [PRIMARY_ITEM, NEARBY_ITEM] },
            status: 200
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
            expect(screen.getByText('Destination Two')).toBeInTheDocument();
        });

        const selectOne = screen.getByTestId(
            'poi-destination-relation-select-dest-1'
        ) as HTMLSelectElement;
        const selectTwo = screen.getByTestId(
            'poi-destination-relation-select-dest-2'
        ) as HTMLSelectElement;

        expect(selectOne.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);
        expect(selectTwo.value).toBe(PointOfInterestDestinationRelationEnum.NEARBY);
    });

    it('renders the empty-state hint when there are no relations', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [] },
            status: 200
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.poiDestinations.empty')).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: relation change + rollback on failure
// ---------------------------------------------------------------------------

describe('PoiDestinationRelationManager — relation change', () => {
    it('rolls back the select value and shows an error toast when PATCH fails', async () => {
        mockedFetchApi.mockImplementation(async ({ method }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: [PRIMARY_ITEM] }, status: 200 };
            }
            if (method === 'PATCH') {
                throw new Error('Network error');
            }
            throw new Error(`Unexpected method in test: ${method}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
        });

        const select = screen.getByTestId(
            'poi-destination-relation-select-dest-1'
        ) as HTMLSelectElement;
        expect(select.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);

        fireEvent.change(select, {
            target: { value: PointOfInterestDestinationRelationEnum.NEARBY }
        });

        // A PATCH request was issued for the right destination.
        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PATCH',
                    path: expect.stringContaining('/poi-1/destinations/dest-1')
                })
            );
        });

        // Rollback: the select value reverts to PRIMARY after the failed PATCH.
        await waitFor(() => {
            const current = screen.getByTestId(
                'poi-destination-relation-select-dest-1'
            ) as HTMLSelectElement;
            expect(current.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);
        });

        // An error toast was surfaced.
        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'error' })
            );
        });
    });

    it('keeps busy state per-row and does not let a failed PATCH on one row revert another row', async () => {
        // Stateful in-memory store so the invalidate-triggered refetch (onSettled)
        // reflects each row's real applied/rolled-back state, not stale static
        // fixtures — this is what would mask the cross-clobber bug otherwise
        // (HOS-144 judgment-day FIX 2 regression test).
        const store: PointOfInterestDestinationListItem[] = [
            { ...PRIMARY_ITEM },
            { ...NEARBY_ITEM }
        ];
        const releaseRowAPatchRef: { current: (() => void) | null } = { current: null };
        let rowAShouldFail = false;

        mockedFetchApi.mockImplementation(async ({ method, path, body }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: store.map((i) => ({ ...i })) }, status: 200 };
            }
            if (method === 'PATCH' && path.includes('/dest-1')) {
                await new Promise<void>((resolve, reject) => {
                    releaseRowAPatchRef.current = () => {
                        if (rowAShouldFail) {
                            reject(new Error('Network error'));
                        } else {
                            resolve();
                        }
                    };
                });
                const relation = (body as { relation: PointOfInterestDestinationRelationEnum })
                    .relation;
                const item = store.find((i) => i.destinationId === 'dest-1');
                if (item) item.relation = relation;
                return { data: { success: true, data: { relation } }, status: 200 };
            }
            if (method === 'PATCH' && path.includes('/dest-2')) {
                const relation = (body as { relation: PointOfInterestDestinationRelationEnum })
                    .relation;
                const item = store.find((i) => i.destinationId === 'dest-2');
                if (item) item.relation = relation;
                return { data: { success: true, data: { relation } }, status: 200 };
            }
            throw new Error(`Unexpected call in test: ${method} ${path}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
            expect(screen.getByText('Destination Two')).toBeInTheDocument();
        });

        const selectA = screen.getByTestId(
            'poi-destination-relation-select-dest-1'
        ) as HTMLSelectElement;
        const selectB = screen.getByTestId(
            'poi-destination-relation-select-dest-2'
        ) as HTMLSelectElement;

        // Change row A — its PATCH stays in-flight (pending) until released.
        fireEvent.change(selectA, {
            target: { value: PointOfInterestDestinationRelationEnum.NEARBY }
        });

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PATCH',
                    path: expect.stringContaining('/dest-1')
                })
            );
        });

        // Row A is busy; row B is independent and still enabled.
        await waitFor(() => expect(selectA).toBeDisabled());
        expect(selectB).not.toBeDisabled();

        // Change row B to PRIMARY while row A is still pending.
        fireEvent.change(selectB, {
            target: { value: PointOfInterestDestinationRelationEnum.PRIMARY }
        });

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PATCH',
                    path: expect.stringContaining('/dest-2')
                })
            );
        });

        // Row B's change applied successfully.
        await waitFor(() => {
            const currentB = screen.getByTestId(
                'poi-destination-relation-select-dest-2'
            ) as HTMLSelectElement;
            expect(currentB.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);
        });

        // Now fail row A's still-pending PATCH.
        rowAShouldFail = true;
        releaseRowAPatchRef.current?.();

        // Row A rolls back to its own previous value (PRIMARY) …
        await waitFor(() => {
            const currentA = screen.getByTestId(
                'poi-destination-relation-select-dest-1'
            ) as HTMLSelectElement;
            expect(currentA.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);
        });

        // … and row A is no longer busy …
        await waitFor(() => expect(selectA).not.toBeDisabled());

        // … while row B's applied change was NOT reverted by row A's failure.
        const currentB = screen.getByTestId(
            'poi-destination-relation-select-dest-2'
        ) as HTMLSelectElement;
        expect(currentB.value).toBe(PointOfInterestDestinationRelationEnum.PRIMARY);
    });

    it('persists the new relation via PATCH and shows a success toast', async () => {
        mockedFetchApi.mockImplementation(async ({ method }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: [PRIMARY_ITEM] }, status: 200 };
            }
            if (method === 'PATCH') {
                return {
                    data: {
                        success: true,
                        data: { relation: PointOfInterestDestinationRelationEnum.NEARBY }
                    },
                    status: 200
                };
            }
            throw new Error(`Unexpected method in test: ${method}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
        });

        const select = screen.getByTestId(
            'poi-destination-relation-select-dest-1'
        ) as HTMLSelectElement;

        fireEvent.change(select, {
            target: { value: PointOfInterestDestinationRelationEnum.NEARBY }
        });

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'PATCH',
                    path: expect.stringContaining('/poi-1/destinations/dest-1'),
                    body: { relation: PointOfInterestDestinationRelationEnum.NEARBY }
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

// ---------------------------------------------------------------------------
// Tests: remove requires confirmation
// ---------------------------------------------------------------------------

describe('PoiDestinationRelationManager — remove', () => {
    it('shows a confirmation dialog before the DELETE request fires', async () => {
        mockedFetchApi.mockImplementation(async ({ method }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: [PRIMARY_ITEM] }, status: 200 };
            }
            if (method === 'DELETE') {
                return { data: { success: true, data: { deleted: true } }, status: 200 };
            }
            throw new Error(`Unexpected method in test: ${method}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('poi-destination-remove-dest-1'));

        // Dialog is open; DELETE has NOT been called yet.
        expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
        expect(mockedFetchApi).not.toHaveBeenCalledWith(
            expect.objectContaining({ method: 'DELETE' })
        );

        fireEvent.click(screen.getByTestId('delete-confirm-confirm'));

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'DELETE',
                    path: expect.stringContaining('/poi-1/destinations/dest-1')
                })
            );
        });
    });

    it('does not call DELETE when the confirmation dialog is cancelled', async () => {
        mockedFetchApi.mockImplementation(async ({ method }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: [PRIMARY_ITEM] }, status: 200 };
            }
            throw new Error(`Unexpected method in test: ${method}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('Destination One')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('poi-destination-remove-dest-1'));
        fireEvent.click(screen.getByTestId('delete-confirm-cancel'));

        await waitFor(() => {
            expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
        });

        expect(mockedFetchApi).not.toHaveBeenCalledWith(
            expect.objectContaining({ method: 'DELETE' })
        );
    });
});

// ---------------------------------------------------------------------------
// Tests: add destination happy path
// ---------------------------------------------------------------------------

describe('PoiDestinationRelationManager — add destination', () => {
    it('POSTs the selected destination and default PRIMARY relation', async () => {
        mockedFetchApi.mockImplementation(async ({ method }) => {
            if (!method || method === 'GET') {
                return { data: { success: true, data: [] }, status: 200 };
            }
            if (method === 'POST') {
                return {
                    data: {
                        success: true,
                        data: { relation: PointOfInterestDestinationRelationEnum.PRIMARY }
                    },
                    status: 201
                };
            }
            throw new Error(`Unexpected method in test: ${method}`);
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.poiDestinations.empty')).toBeInTheDocument();
        });

        fireEvent.change(screen.getByTestId('destination-select-field-stub'), {
            target: { value: 'dest-3' }
        });
        fireEvent.click(screen.getByTestId('poi-destination-add-button'));

        await waitFor(() => {
            expect(mockedFetchApi).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    path: expect.stringContaining('/poi-1/destinations'),
                    body: {
                        destinationId: 'dest-3',
                        relation: PointOfInterestDestinationRelationEnum.PRIMARY
                    }
                })
            );
        });

        await waitFor(() => {
            expect(mockAddToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'success' })
            );
        });
    });

    it('disables the Add button until a destination is selected', async () => {
        mockedFetchApi.mockResolvedValue({
            data: { success: true, data: [] },
            status: 200
        });

        renderManager();

        await waitFor(() => {
            expect(screen.getByText('admin-pages.poiDestinations.empty')).toBeInTheDocument();
        });

        expect(screen.getByTestId('poi-destination-add-button')).toBeDisabled();
    });
});
