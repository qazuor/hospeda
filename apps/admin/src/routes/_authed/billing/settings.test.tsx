// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BillingSettingsPage } from './settings';

vi.mock('@/components/layout/SidebarPageLayout', () => ({
    SidebarPageLayout: ({ children }: { readonly children: ReactNode }) => <main>{children}</main>
}));
vi.mock('@/features/billing-signup-freeze/components/SignupFreezeCard', () => ({
    SignupFreezeCard: () => <div data-testid="signup-freeze-card" />
}));
vi.mock('@/features/billing-addon-freeze/components/AddonPurchasesFreezeCard', () => ({
    AddonPurchasesFreezeCard: () => <div data-testid="addon-purchases-freeze-card" />
}));

describe('billing settings freeze controls', () => {
    it('shows the independent signup and addon purchase freeze cards', () => {
        render(<BillingSettingsPage />);
        expect(screen.getByTestId('signup-freeze-card')).toBeInTheDocument();
        expect(screen.getByTestId('addon-purchases-freeze-card')).toBeInTheDocument();
    });
});
