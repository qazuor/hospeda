/**
 * Tests for ComingSoon component
 *
 * Verifies that ComingSoon correctly:
 * 1. Renders with direct title and description strings
 * 2. Uses i18n keys when titleKey/descriptionKey are provided
 * 3. Falls back to default translation keys when neither prop is provided
 * 4. Renders a custom icon when provided
 * 5. Applies a custom className
 *
 * @module ComingSoon.test
 */

import { ComingSoon } from '@/components/feedback/ComingSoon';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es'
    })
}));

describe('ComingSoon', () => {
    describe('when title and description props are provided directly', () => {
        it('renders the provided title and description strings', () => {
            // Arrange & Act
            render(
                <ComingSoon
                    title="Upcoming Feature"
                    description="This feature will be available soon"
                />
            );

            // Assert
            expect(screen.getByText('Upcoming Feature')).toBeInTheDocument();
            expect(screen.getByText('This feature will be available soon')).toBeInTheDocument();
        });
    });

    describe('when titleKey and descriptionKey are provided', () => {
        it('passes keys through the t() function and renders the result', () => {
            // Arrange & Act
            // The mock t() returns the key itself, so we assert on key strings
            render(
                <ComingSoon
                    titleKey={
                        'admin-common.comingSoon.title' as Parameters<
                            typeof ComingSoon
                        >[0]['titleKey']
                    }
                    descriptionKey={
                        'admin-common.comingSoon.description' as Parameters<
                            typeof ComingSoon
                        >[0]['descriptionKey']
                    }
                />
            );

            // Assert - mock returns the key unchanged
            expect(screen.getByText('admin-common.comingSoon.title')).toBeInTheDocument();
            expect(screen.getByText('admin-common.comingSoon.description')).toBeInTheDocument();
        });
    });

    describe('when neither title nor titleKey is provided', () => {
        it('uses the default i18n key for title and description', () => {
            // Arrange & Act
            render(<ComingSoon />);

            // Assert - the component calls t('admin-common.comingSoon.title') as default
            expect(screen.getByText('admin-common.comingSoon.title')).toBeInTheDocument();
            expect(screen.getByText('admin-common.comingSoon.description')).toBeInTheDocument();
        });
    });

    describe('when a custom icon is provided', () => {
        it('renders the icon above the title', () => {
            // Arrange & Act
            render(
                <ComingSoon
                    title="With Icon"
                    icon={<span data-testid="custom-icon">icon</span>}
                />
            );

            // Assert
            expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
            expect(screen.getByText('With Icon')).toBeInTheDocument();
        });
    });

    describe('when no icon is provided', () => {
        it('does not render the icon container', () => {
            // Arrange & Act
            const { container } = render(<ComingSoon title="No Icon" />);

            // Assert - icon wrapper div should not exist
            const iconContainer = container.querySelector('.mb-3.text-muted-foreground');
            expect(iconContainer).not.toBeInTheDocument();
        });
    });

    describe('className prop', () => {
        it('applies the provided className to the container', () => {
            // Arrange & Act
            const { container } = render(
                <ComingSoon
                    title="Styled"
                    className="my-custom-class"
                />
            );

            // Assert
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('my-custom-class');
        });

        it('still renders the base classes when className is provided', () => {
            // Arrange & Act
            const { container } = render(
                <ComingSoon
                    title="Styled"
                    className="extra-class"
                />
            );

            // Assert
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
        });
    });

    describe('titleKey takes precedence over title', () => {
        it('renders the i18n key result when both titleKey and title are provided', () => {
            // Arrange & Act
            render(
                <ComingSoon
                    titleKey={
                        'admin-common.comingSoon.title' as Parameters<
                            typeof ComingSoon
                        >[0]['titleKey']
                    }
                    title="Direct Title"
                />
            );

            // Assert - titleKey wins
            expect(screen.getByText('admin-common.comingSoon.title')).toBeInTheDocument();
            expect(screen.queryByText('Direct Title')).not.toBeInTheDocument();
        });
    });
});
