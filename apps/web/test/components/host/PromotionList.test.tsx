/**
 * @file PromotionList.test.tsx
 * @description Tests for the PromotionList island — covers list render, empty state,
 * delete flow (inline confirm → api call → refresh), and error state.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock before any imports — vitest hoists vi.mock to top of file
const mockOwnerPromotionList = vi.fn();
const mockOwnerPromotionRemove = vi.fn();
const mockGetEffectiveSet = vi.fn();
const mockOwnerPromotionPause = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get ownerPromotionApi() {
        return {
            list: mockOwnerPromotionList,
            remove: mockOwnerPromotionRemove,
            pause: mockOwnerPromotionPause
        };
    }
}));
vi.mock('@/lib/entitlements-cache', () => ({ getEntitlementsCached: () => mockGetEffectiveSet() }));

// Import AFTER mock setup
import { PromotionList } from '../../../src/components/host/PromotionList.client';

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPromo1 = {
    id: 'promo-uuid-1',
    slug: 'verano-20',
    ownerId: 'owner-uuid',
    accommodationId: null,
    title: 'Descuento de verano',
    description: null,
    discountType: 'percentage' as const,
    discountValue: 20,
    minNights: null,
    validFrom: '2026-12-01',
    validUntil: '2027-02-28',
    maxRedemptions: null,
    currentRedemptions: 5,
    lifecycleState: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z'
};

const mockPromo2 = {
    id: 'promo-uuid-2',
    slug: 'noche-gratis',
    ownerId: 'owner-uuid',
    accommodationId: 'acc-uuid',
    title: 'Noche extra gratis',
    description: 'Por 3 o más noches',
    discountType: 'free_night' as const,
    discountValue: 1,
    minNights: 3,
    validFrom: '2026-06-01',
    validUntil: null,
    maxRedemptions: 10,
    currentRedemptions: 0,
    lifecycleState: 'DRAFT',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z'
};

/** Builds the paginated API response wrapping the given items */
function makeListResponse(items: (typeof mockPromo1)[]) {
    return {
        ok: true as const,
        data: {
            items,
            total: items.length,
            page: 1,
            pageSize: 20,
            totalPages: 1
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TEST:B13a:25 PromotionList effective-set gate', () => {
    // Braces matter: a function returned from beforeEach runs as its teardown.
    beforeEach(() => {
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: { create_promotions: 1 },
            limits: {},
            failed: false
        });
    });
    it('shows the CTA with the key', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));
        render(<PromotionList locale="es" />);
        expect(await screen.findByRole('link', { name: 'Agregar promoción' })).toBeInTheDocument();
    });
    it('a failed entitlement read does not lock: the empty state and «Agregar» stay (like PromotionForm)', async () => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: true });
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));
        render(<PromotionList locale="es" />);
        expect(await screen.findByRole('link', { name: 'Agregar promoción' })).toBeInTheDocument();
        expect(screen.getByText(/todavía no tenés ninguna promoción/i)).toBeInTheDocument();
        expect(screen.queryByText('Tu plan no incluye promociones.')).not.toBeInTheDocument();
        expect(document.querySelector('[data-reason="plan"]')).toBeNull();
    });
    it('while the entitlement read is pending, never flashes the LockedState', async () => {
        let settle: (value: unknown) => void = () => {};
        mockGetEffectiveSet.mockReturnValue(
            new Promise((resolve) => {
                settle = resolve;
            })
        );
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));
        render(<PromotionList locale="es" />);
        await waitFor(() => expect(mockOwnerPromotionList).toHaveBeenCalled());
        // Let the list response settle while the entitlement read stays pending.
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.queryByText('Tu plan no incluye promociones.')).not.toBeInTheDocument();
        expect(document.querySelector('[data-reason="plan"]')).toBeNull();
        expect(screen.queryByRole('link', { name: 'Agregar promoción' })).not.toBeInTheDocument();
        await act(async () => {
            settle({ entitlements: {}, limits: {}, failed: false });
        });
        expect(await screen.findByText('Tu plan no incluye promociones.')).toBeInTheDocument();
    });
    it('shows the upgrade banner and omits the empty-state CTA without the key', async () => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));
        render(<PromotionList locale="es" />);
        expect(await screen.findByText('Tu plan no incluye promociones.')).toBeInTheDocument();
        expect(screen.queryByText(/creá tu primera oferta/i)).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Agregar promoción' })).not.toBeInTheDocument();
    });
    it('renders loading skeleton on mount while data is pending', () => {
        mockOwnerPromotionList.mockReturnValue(new Promise(() => {})); // never resolves

        render(<PromotionList locale="es" />);

        const skeletonCards = document.querySelectorAll('[aria-hidden="true"]');
        expect(skeletonCards.length).toBeGreaterThan(0);
    });

    it('renders error state with retry button when list api fails', async () => {
        // Backend error carries an English/technical message — it must NOT leak
        // to the user (bug #3 regression): the localized loadFailed string is
        // shown instead.
        mockOwnerPromotionList.mockResolvedValue({
            ok: false,
            error: { message: 'Authentication required' }
        });

        render(<PromotionList locale="es" />);

        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.queryByText('Authentication required')).not.toBeInTheDocument();
        expect(
            screen.getByText('No se pudieron cargar las promociones. Intentá de nuevo.')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('renders empty state when the owner has no promotions', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));

        render(<PromotionList locale="es" />);

        const empty = await screen.findByText(/todavía no tenés ninguna promoción/i);
        expect(empty).toBeInTheDocument();
    });

    it('renders promotion cards with title, discount and lifecycle badge', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1, mockPromo2]));

        render(<PromotionList locale="es" />);

        expect(await screen.findByText('Descuento de verano')).toBeInTheDocument();
        expect(screen.getByText('Noche extra gratis')).toBeInTheDocument();
        // Percentage discount
        expect(screen.getByText('20%')).toBeInTheDocument();
        // Lifecycle badges (lowercase key mapping: ACTIVE → active → "Activa", DRAFT → draft → "Borrador")
        expect(screen.getByText(/activa/i)).toBeInTheDocument();
        expect(screen.getByText(/borrador/i)).toBeInTheDocument();
    });

    it('renders the "Agregar promoción" link', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));

        render(<PromotionList locale="es" />);

        // Wait for ready state
        await screen.findByText(/todavía no tenés ninguna promoción/i);

        const createLinks = screen
            .getAllByRole('link')
            .filter((el) => el.getAttribute('href')?.includes('promociones/nueva'));
        expect(createLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('shows inline confirm when delete button is clicked', async () => {
        const user = userEvent.setup();
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1]));

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');

        const deleteBtn = screen.getByRole('button', { name: /eliminar/i });
        await user.click(deleteBtn);

        // Confirm row should appear with confirm text
        expect(
            screen.getByText(/¿Eliminar esta promoción\? Esta acción no se puede deshacer\./i)
        ).toBeInTheDocument();
    });

    it('hides confirm row when cancel is clicked', async () => {
        const user = userEvent.setup();
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1]));

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');

        // Open confirm
        const deleteBtn = screen.getByRole('button', { name: /eliminar/i });
        await user.click(deleteBtn);

        // Cancel
        const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
        await user.click(cancelBtn);

        // Confirm text should be gone
        expect(
            screen.queryByText(/¿Eliminar esta promoción\? Esta acción no se puede deshacer\./i)
        ).not.toBeInTheDocument();
    });

    it('calls ownerPromotionApi.remove and refreshes list on confirmed delete', async () => {
        const user = userEvent.setup();

        // First call returns a list with the item; second call (after delete) returns empty
        mockOwnerPromotionList
            .mockResolvedValueOnce(makeListResponse([mockPromo1]))
            .mockResolvedValueOnce(makeListResponse([]));

        mockOwnerPromotionRemove.mockResolvedValue({ ok: true, data: { success: true } });

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');

        // Open confirm
        await user.click(screen.getByRole('button', { name: /eliminar/i }));

        // Confirm deletion — there are now 2 "Eliminar" buttons (main action + confirm)
        // The confirm "Eliminar" is inside the confirmRow group
        const confirmBtns = screen.getAllByRole('button', { name: /eliminar/i });
        await user.click(confirmBtns[confirmBtns.length - 1]);

        // remove should have been called with the correct id
        expect(mockOwnerPromotionRemove).toHaveBeenCalledWith({ id: 'promo-uuid-1' });

        // List should refresh → empty state rendered
        expect(await screen.findByText(/todavía no tenés ninguna promoción/i)).toBeInTheDocument();
    });

    it('shows delete error banner when remove api fails', async () => {
        const user = userEvent.setup();
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1]));
        mockOwnerPromotionRemove.mockResolvedValue({
            ok: false,
            error: { message: 'No se pudo eliminar' }
        });

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');

        await user.click(screen.getByRole('button', { name: /eliminar/i }));

        const confirmBtns = screen.getAllByRole('button', { name: /eliminar/i });
        await user.click(confirmBtns[confirmBtns.length - 1]);

        const errorBanner = await screen.findByRole('alert');
        expect(errorBanner).toBeInTheDocument();
    });

    // ---------------------------------------------------------------------------
    // Validity date rendering (BETA-88): validFrom/validUntil are date-only
    // UTC-midnight values and must render on the same calendar day regardless
    // of the runtime's local timezone.
    // ---------------------------------------------------------------------------

    it('renders the validity date on the correct calendar day under a non-UTC runtime timezone (BETA-88)', async () => {
        vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');
        try {
            mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1]));

            render(<PromotionList locale="es" />);

            await screen.findByText('Descuento de verano');

            // mockPromo1.validFrom = '2026-12-01' (UTC-midnight, date-only).
            // Without forcing UTC at the formatDate call site, Argentina's
            // UTC-3 offset would render this as "30 de noviembre" instead.
            expect(screen.getByText(/1 de diciembre de 2026/i)).toBeInTheDocument();
            expect(screen.queryByText(/30 de noviembre de 2026/i)).not.toBeInTheDocument();
        } finally {
            vi.unstubAllEnvs();
        }
    });

    it('renders edit link for each promotion pointing to the edit route', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1]));

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');

        const editLinks = screen
            .getAllByRole('link')
            .filter((el) =>
                el.getAttribute('href')?.includes(`promociones/${mockPromo1.id}/editar`)
            );
        expect(editLinks.length).toBe(1);
    });

    // ---------------------------------------------------------------------------
    // HOS-1637 (AC:B13a:22): the client-side `create_promotions` gate, read from
    // the old billing's entitlements, was removed. The create action is always
    // offered and the API decides on save.
    // ---------------------------------------------------------------------------

    it('offers the create action with no plan gate and no upgrade banner', async () => {
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));

        render(<PromotionList locale="es" />);

        await screen.findByText(/todavía no tenés ninguna promoción/i);

        const createLinks = screen
            .getAllByRole('link')
            .filter((el) => el.getAttribute('href')?.includes('promociones/nueva'));
        expect(createLinks.length).toBe(1);
        expect(screen.queryByText(/tu plan no incluye promociones/i)).not.toBeInTheDocument();
    });

    // ---------------------------------------------------------------------------
    // HOS-2440 / HOS-2505: the list used to ask for one default page and drop
    // the rest. It now asks for an explicit page and links every page.
    // ---------------------------------------------------------------------------

    it('HOS-2440: requests explicit pages and paginates when there are more than 50 promotions', async () => {
        const user = userEvent.setup();
        mockOwnerPromotionList.mockResolvedValue({
            ok: true,
            data: {
                items: [mockPromo1],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    total: 55,
                    totalPages: 3,
                    hasNextPage: true,
                    hasPreviousPage: false
                }
            }
        });

        render(<PromotionList locale="es" />);

        await screen.findByText('Descuento de verano');
        expect(mockOwnerPromotionList).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
        const pageThree = screen.getByRole('button', { name: 'Página 3' });
        await user.click(pageThree);
        await waitFor(() =>
            expect(mockOwnerPromotionList).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 })
        );
    });

    it('deleting the last item of the last page clamps to the new last page', async () => {
        const user = userEvent.setup();
        const paged = (items: (typeof mockPromo1)[], page: number, totalPages: number) => ({
            ok: true as const,
            data: {
                items,
                pagination: {
                    page,
                    pageSize: 20,
                    total: items.length,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        });
        mockOwnerPromotionList.mockImplementation(({ page }: { page: number }) =>
            Promise.resolve(page === 1 ? paged([mockPromo2], 1, 2) : paged([mockPromo1], 2, 2))
        );
        mockOwnerPromotionRemove.mockResolvedValue({ ok: true, data: { success: true } });

        render(<PromotionList locale="es" />);
        await screen.findByText('Noche extra gratis');
        await user.click(screen.getByRole('button', { name: 'Página 2' }));
        await screen.findByText('Descuento de verano');

        // After the delete, page 2 no longer exists.
        mockOwnerPromotionList.mockImplementation(({ page }: { page: number }) =>
            Promise.resolve(page === 1 ? paged([mockPromo2], 1, 1) : paged([], 2, 1))
        );
        await user.click(screen.getByRole('button', { name: /eliminar «descuento de verano»/i }));
        const confirmBtns = screen.getAllByRole('button', { name: /eliminar/i });
        await user.click(confirmBtns[confirmBtns.length - 1]);

        expect(await screen.findByText('Noche extra gratis')).toBeInTheDocument();
        expect(mockOwnerPromotionList).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
        expect(screen.queryByText(/todavía no tenés ninguna promoción/i)).not.toBeInTheDocument();
    });

    it('HOS-2505: without the plan and with no promotions, shows a LockedState naming the catalog plans', async () => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([]));

        render(
            <PromotionList
                locale="es"
                lockPlanNames={['Plan Catálogo']}
            />
        );

        expect(await screen.findByText('Plan Catálogo')).toBeInTheDocument();
        expect(document.querySelector('[data-reason="plan"]')).not.toBeNull();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toBeInTheDocument();
    });
});

describe('owner decision 18: locked promotions are view + pause only', () => {
    beforeEach(() => {
        mockGetEffectiveSet.mockResolvedValue({ entitlements: {}, limits: {}, failed: false });
        mockOwnerPromotionList.mockResolvedValue(makeListResponse([mockPromo1, mockPromo2]));
    });

    it('shows «Editar» disabled, explains why, and offers no edit link', async () => {
        render(<PromotionList locale="es" />);

        const edit = await screen.findByRole('button', { name: /editar «descuento de verano»/i });
        expect(edit).toBeDisabled();
        expect(screen.queryByRole('link', { name: /editar/i })).not.toBeInTheDocument();
        expect(
            screen.getByText(/podés ver y pausar tus promociones, pero no crearlas ni editarlas/i)
        ).toBeInTheDocument();
    });

    it('offers «Pausar» only on an active promotion and pauses through the API', async () => {
        // Arrange
        mockOwnerPromotionPause.mockResolvedValue({ ok: true, data: {} });
        const user = userEvent.setup();
        render(<PromotionList locale="es" />);

        // Act
        const pause = await screen.findByRole('button', { name: /pausar «descuento de verano»/i });
        expect(screen.queryByRole('button', { name: /pausar «noche extra gratis»/i })).toBeNull();
        await user.click(pause);

        // Assert
        await waitFor(() =>
            expect(mockOwnerPromotionPause).toHaveBeenCalledWith({ id: 'promo-uuid-1' })
        );
        await waitFor(() => expect(mockOwnerPromotionList).toHaveBeenCalledTimes(2));
    });

    it('says so when the pause fails', async () => {
        mockOwnerPromotionPause.mockResolvedValue({ ok: false, error: { status: 500 } });
        const user = userEvent.setup();
        render(<PromotionList locale="es" />);

        await user.click(
            await screen.findByRole('button', { name: /pausar «descuento de verano»/i })
        );

        expect(
            await screen.findByText('No pudimos pausar la promoción. Probá de nuevo.')
        ).toBeInTheDocument();
    });

    it('with the key, keeps the edit link and offers no pause', async () => {
        mockGetEffectiveSet.mockResolvedValue({
            entitlements: { create_promotions: 1 },
            limits: {},
            failed: false
        });
        render(<PromotionList locale="es" />);

        expect(
            await screen.findByRole('link', { name: /editar «descuento de verano»/i })
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /pausar/i })).toBeNull();
    });
});
