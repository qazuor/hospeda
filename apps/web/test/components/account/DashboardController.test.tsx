import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardController } from '@/components/account/DashboardController.client';

const mockUseTourState = vi.fn();
const mockUseWhatsNew = vi.fn();
const mockGetWelcomeTourForRole = vi.fn();

vi.mock('@/hooks/use-tour-state', () => ({
    useTourState: () => mockUseTourState()
}));

vi.mock('@/hooks/use-whats-new', () => ({
    useWhatsNew: () => mockUseWhatsNew()
}));

vi.mock('@/config/tours', () => ({
    getWelcomeTourForRole: (role: string) => mockGetWelcomeTourForRole(role)
}));

vi.mock('@/components/account/TourController.client', () => ({
    TourController: () => <div data-testid="tour-controller" />
}));

vi.mock('@/components/account/WhatsNewModal.client', () => ({
    WhatsNewModal: ({ open }: { open: boolean }) => (
        <div
            data-testid="whats-new-modal"
            data-open={open}
        />
    )
}));

describe('DashboardController D12 gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetWelcomeTourForRole.mockReturnValue({ id: 'web.host.welcome', version: '1.0' });
    });

    it('does not auto-open whats-new when welcome tour is pending', () => {
        mockUseTourState.mockReturnValue({ isLoading: false, hasSeen: () => false });
        mockUseWhatsNew.mockReturnValue({
            items: [
                { id: '1', title: 'Test', body: 'x', publishedAt: '', highlight: true, seen: false }
            ],
            isLoading: false
        });

        render(
            <DashboardController
                locale="es"
                userRole="HOST"
            />
        );

        const modal = screen.getByTestId('whats-new-modal');
        expect(modal).toHaveAttribute('data-open', 'false');
    });

    it('auto-opens whats-new when tour is complete and there are unseen highlights', () => {
        mockUseTourState.mockReturnValue({ isLoading: false, hasSeen: () => true });
        mockUseWhatsNew.mockReturnValue({
            items: [
                { id: '1', title: 'Test', body: 'x', publishedAt: '', highlight: true, seen: false }
            ],
            isLoading: false
        });

        render(
            <DashboardController
                locale="es"
                userRole="HOST"
            />
        );

        const modal = screen.getByTestId('whats-new-modal');
        expect(modal).toHaveAttribute('data-open', 'true');
    });

    it('does not auto-open when all highlights are already seen', () => {
        mockUseTourState.mockReturnValue({ isLoading: false, hasSeen: () => true });
        mockUseWhatsNew.mockReturnValue({
            items: [
                { id: '1', title: 'Test', body: 'x', publishedAt: '', highlight: true, seen: true }
            ],
            isLoading: false
        });

        render(
            <DashboardController
                locale="es"
                userRole="HOST"
            />
        );

        const modal = screen.getByTestId('whats-new-modal');
        expect(modal).toHaveAttribute('data-open', 'false');
    });

    it('does not auto-open while whats-new is still loading', () => {
        mockUseTourState.mockReturnValue({ isLoading: false, hasSeen: () => true });
        mockUseWhatsNew.mockReturnValue({
            items: [],
            isLoading: true
        });

        render(
            <DashboardController
                locale="es"
                userRole="HOST"
            />
        );

        const modal = screen.getByTestId('whats-new-modal');
        expect(modal).toHaveAttribute('data-open', 'false');
    });

    it('skips tour gate when no tour exists for role', () => {
        mockGetWelcomeTourForRole.mockReturnValue(null);
        mockUseTourState.mockReturnValue({ isLoading: false, hasSeen: () => true });
        mockUseWhatsNew.mockReturnValue({
            items: [
                { id: '1', title: 'Test', body: 'x', publishedAt: '', highlight: true, seen: false }
            ],
            isLoading: false
        });

        render(
            <DashboardController
                locale="es"
                userRole="TOURIST"
            />
        );

        const modal = screen.getByTestId('whats-new-modal');
        expect(modal).toHaveAttribute('data-open', 'true');
    });
});
