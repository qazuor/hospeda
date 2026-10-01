/**
 * NewPaidSignupsFreezeCard — the admin switch for `newPaidSignupsFrozen`.
 *
 * Pins the two things an operator relies on: the switch reports its new value
 * to the form, and the "signups are paused" warning is visible exactly while
 * the freeze is on.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewPaidSignupsFreezeCard } from '@/features/billing-settings/NewPaidSignupsFreezeCard';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key
    })
}));

describe('NewPaidSignupsFreezeCard', () => {
    it('renders the title, label and hint, and no warning while signups are open', () => {
        // Arrange / Act
        render(
            <NewPaidSignupsFreezeCard
                checked={false}
                onCheckedChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByText('admin-billing.settings.signupFreeze.title')).toBeInTheDocument();
        expect(screen.getByText('admin-billing.settings.signupFreeze.label')).toBeInTheDocument();
        expect(screen.getByText('admin-billing.settings.signupFreeze.hint')).toBeInTheDocument();
        expect(screen.queryByTestId('signup-freeze-active-warning')).not.toBeInTheDocument();
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('shows the active warning while the freeze is on', () => {
        // Arrange / Act
        render(
            <NewPaidSignupsFreezeCard
                checked
                onCheckedChange={vi.fn()}
            />
        );

        // Assert
        expect(screen.getByTestId('signup-freeze-active-warning')).toHaveTextContent(
            'admin-billing.settings.signupFreeze.activeWarning'
        );
        expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('reports the toggled value to the form', () => {
        // Arrange
        const onCheckedChange = vi.fn();
        render(
            <NewPaidSignupsFreezeCard
                checked={false}
                onCheckedChange={onCheckedChange}
            />
        );

        // Act
        fireEvent.click(screen.getByRole('switch'));

        // Assert
        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
});
