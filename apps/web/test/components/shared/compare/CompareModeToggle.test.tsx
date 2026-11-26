import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompareModeToggle } from '@/components/shared/compare/CompareModeToggle.client';

const state = vi.hoisted(() => ({ active: false, canCompare: true, isLoading: false }));
const { toggle, load } = vi.hoisted(() => ({ toggle: vi.fn(), load: vi.fn() }));

vi.mock('@/store/compare-store', () => ({
    useCompareMode: () => state.active,
    toggleCompareMode: toggle,
    loadCompareModeFromStorage: load
}));
vi.mock('@/hooks/useCompareGuard', () => ({ useCompareGuard: () => state }));

describe('CompareModeToggle', () => {
    beforeEach(() => {
        state.active = false;
        state.canCompare = true;
        state.isLoading = false;
        vi.clearAllMocks();
    });

    it('shows the plan before a guest or free visitor opens the plans popover', () => {
        state.canCompare = false;
        render(
            <CompareModeToggle
                locale="es"
                planName="Plan del catálogo"
                planCapacity={7}
            />
        );

        const trigger = screen.getByRole('button', { name: /Comparar alojamientos/ });
        expect(trigger).toHaveTextContent('Plan del catálogo');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(trigger);

        expect(screen.getByRole('dialog')).toHaveStyle({ left: '16px' });
        expect(screen.getByText(/hasta 7 alojamientos.*Plan del catálogo/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            '/es/planes/turistas/precios/'
        );
        expect(screen.queryByText(/Iniciá sesión/)).not.toBeInTheDocument();
        expect(toggle).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows an explicit exit action and guidance for an entitled selection', () => {
        state.active = true;
        render(
            <CompareModeToggle
                locale="es"
                planName="Plan del catálogo"
            />
        );

        const exit = screen.getByRole('button', { name: /Salir de comparar/ });
        expect(exit).toHaveAttribute('aria-pressed', 'true');
        expect(exit).toHaveTextContent('Plan del catálogo');
        expect(screen.getByText('Elegí los alojamientos que querés comparar')).toBeVisible();
        expect(load).toHaveBeenCalledOnce();

        fireEvent.click(exit);

        expect(toggle).toHaveBeenCalledOnce();
    });

    it('does not enter compare mode or show the upsell while entitlements are unresolved', () => {
        state.canCompare = false;
        state.isLoading = true;
        render(<CompareModeToggle locale="es" />);

        const trigger = screen.getByRole('button', { name: /Comparar alojamientos/ });
        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-busy', 'true');
        expect(toggle).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
