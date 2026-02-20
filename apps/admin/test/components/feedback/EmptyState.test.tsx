/**
 * Tests for EmptyState component
 *
 * Verifies that EmptyState correctly:
 * 1. Renders a direct message string
 * 2. Renders using an i18n key
 * 3. Renders an icon when provided
 * 4. Renders an action element when provided
 * 5. Calls the action onClick handler
 * 6. Applies a custom className
 *
 * @module EmptyState.test
 */

import { EmptyState } from '@/components/feedback/EmptyState';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

describe('EmptyState', () => {
    describe('when message prop is provided directly', () => {
        it('renders the message text', () => {
            // Arrange & Act
            render(<EmptyState message="No items found" />);

            // Assert
            expect(screen.getByText('No items found')).toBeInTheDocument();
        });
    });

    describe('when messageKey prop is provided', () => {
        it('passes the key through t() and renders the result', () => {
            // Arrange & Act
            render(
                <EmptyState
                    messageKey={
                        'admin-common.emptyState.noData' as Parameters<
                            typeof EmptyState
                        >[0]['messageKey']
                    }
                />
            );

            // Assert - mock t() returns the key unchanged
            expect(screen.getByText('admin-common.emptyState.noData')).toBeInTheDocument();
        });
    });

    describe('when neither message nor messageKey is provided', () => {
        it('renders the default i18n key for no-data', () => {
            // Arrange & Act
            render(<EmptyState />);

            // Assert - the component calls t('admin-common.emptyState.noData') as default
            expect(screen.getByText('admin-common.emptyState.noData')).toBeInTheDocument();
        });
    });

    describe('icon prop', () => {
        it('renders the icon when provided', () => {
            // Arrange & Act
            render(
                <EmptyState
                    message="Empty"
                    icon={<span data-testid="empty-icon">no-data-icon</span>}
                />
            );

            // Assert
            expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
        });

        it('does not render the icon container when icon is not provided', () => {
            // Arrange & Act
            const { container } = render(<EmptyState message="No icon" />);

            // Assert
            const iconWrapper = container.querySelector('.mb-3.text-muted-foreground');
            expect(iconWrapper).not.toBeInTheDocument();
        });
    });

    describe('action prop', () => {
        it('renders the action element when provided', () => {
            // Arrange & Act
            render(
                <EmptyState
                    message="Empty list"
                    action={<button type="button">Create new</button>}
                />
            );

            // Assert
            expect(screen.getByRole('button', { name: 'Create new' })).toBeInTheDocument();
        });

        it('does not render the action container when action is not provided', () => {
            // Arrange & Act
            render(<EmptyState message="No action" />);

            // Assert - no button element present when action is not provided
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('calls the onClick handler when the action button is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            const handleClick = vi.fn();

            render(
                <EmptyState
                    message="Empty list"
                    action={
                        <button
                            type="button"
                            onClick={handleClick}
                        >
                            Add item
                        </button>
                    }
                />
            );

            // Act
            await user.click(screen.getByRole('button', { name: 'Add item' }));

            // Assert
            expect(handleClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('className prop', () => {
        it('applies the custom className to the container element', () => {
            // Arrange & Act
            const { container } = render(
                <EmptyState
                    message="Styled empty"
                    className="mt-8 border-red-500"
                />
            );

            // Assert
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('mt-8', 'border-red-500');
        });

        it('preserves base layout classes alongside the custom className', () => {
            // Arrange & Act
            const { container } = render(
                <EmptyState
                    message="Styled empty"
                    className="custom-class"
                />
            );

            // Assert
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
        });
    });

    describe('messageKey takes precedence over message', () => {
        it('renders the i18n key result when both messageKey and message are provided', () => {
            // Arrange & Act
            render(
                <EmptyState
                    messageKey={
                        'admin-common.emptyState.noData' as Parameters<
                            typeof EmptyState
                        >[0]['messageKey']
                    }
                    message="Direct message"
                />
            );

            // Assert - messageKey wins
            expect(screen.getByText('admin-common.emptyState.noData')).toBeInTheDocument();
            expect(screen.queryByText('Direct message')).not.toBeInTheDocument();
        });
    });
});
