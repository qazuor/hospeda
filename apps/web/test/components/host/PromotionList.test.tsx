/**
 * @file PromotionList.test.tsx
 * @description Tests for the PromotionList island — covers list render, empty state,
 * delete flow (inline confirm → api call → refresh), and error state.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock before any imports — vitest hoists vi.mock to top of file
const mockOwnerPromotionList = vi.fn();
const mockOwnerPromotionRemove = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get ownerPromotionApi() {
        return {
            list: mockOwnerPromotionList,
            remove: mockOwnerPromotionRemove
        };
    }
}));

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

describe('PromotionList', () => {
    it('renders loading skeleton on mount while data is pending', () => {
        mockOwnerPromotionList.mockReturnValue(new Promise(() => {})); // never resolves

        render(<PromotionList locale="es" />);

        const skeletonCards = document.querySelectorAll('[aria-hidden="true"]');
        expect(skeletonCards.length).toBeGreaterThan(0);
    });

    it('renders error state with retry button when list api fails', async () => {
        mockOwnerPromotionList.mockResolvedValue({
            ok: false,
            error: { message: 'Error al cargar' }
        });

        render(<PromotionList locale="es" />);

        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText('Error al cargar')).toBeInTheDocument();
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

    it('renders the "Nueva promoción" link', async () => {
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
});
