import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthRequiredPopover } from '../../../src/components/auth/AuthRequiredPopover.client';

describe('AuthRequiredPopover.client.tsx', () => {
    describe('Props', () => {
        it('should accept message prop', () => {
            const message = 'You must be logged in to continue';
            render(
                <AuthRequiredPopover
                    message={message}
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText(message)).toBeInTheDocument();
        });

        it('should accept onClose callback', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test message"
                    onClose={handleClose}
                />
            );
            expect(handleClose).not.toHaveBeenCalled();
        });

        it('should accept locale prop', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            expect(screen.getByText('Sign in')).toBeInTheDocument();
            expect(screen.getByText('Create account')).toBeInTheDocument();
        });

        it('should default locale to es', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Crear cuenta')).toBeInTheDocument();
        });

        it('should accept returnUrl prop', () => {
            const returnUrl = '/accommodations/123';
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    returnUrl={returnUrl}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            expect(loginLink).toHaveAttribute(
                'href',
                `/es/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`
            );
        });

        it('should accept className prop', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    className="custom-class"
                />
            );
            // className is applied to the outer div (which also has role="dialog")
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveClass('custom-class');
        });

        it('should accept pt locale prop', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="pt"
                />
            );
            expect(screen.getAllByText('Entrar').length).toBeGreaterThan(0);
            expect(screen.getByText('Criar conta')).toBeInTheDocument();
        });
    });

    describe('Rendering', () => {
        it('should render message text', () => {
            const message = 'Please log in to save your favorites';
            render(
                <AuthRequiredPopover
                    message={message}
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText(message)).toBeInTheDocument();
        });

        it('should render login link with Spanish text by default', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
        });

        it('should render register link with Spanish text by default', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText('Crear cuenta')).toBeInTheDocument();
        });

        it('should render login link with English text when locale is en', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            expect(screen.getByText('Sign in')).toBeInTheDocument();
        });

        it('should render register link with English text when locale is en', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            expect(screen.getByText('Create account')).toBeInTheDocument();
        });

        it('should render arrow/caret element', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const arrow = container.querySelector('[aria-hidden="true"]');
            expect(arrow).toBeInTheDocument();
            // Arrow uses Tailwind classes for styling including rotation
            expect(arrow).toHaveClass('rotate-45');
        });
    });

    describe('Links', () => {
        it('should have correct login href with Spanish locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            expect(loginLink).toHaveAttribute('href', '/es/auth/signin?returnUrl=');
        });

        it('should have correct register href with Spanish locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const registerLink = screen.getByText('Crear cuenta');
            expect(registerLink).toHaveAttribute('href', '/es/auth/signup');
        });

        it('should have correct login href with English locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            const loginLink = screen.getByText('Sign in');
            expect(loginLink).toHaveAttribute('href', '/en/auth/signin?returnUrl=');
        });

        it('should have correct register href with English locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            const registerLink = screen.getByText('Create account');
            expect(registerLink).toHaveAttribute('href', '/en/auth/signup');
        });

        it('should encode returnUrl in login href', () => {
            const returnUrl = '/path/with spaces/and?query=params';
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    returnUrl={returnUrl}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            expect(loginLink).toHaveAttribute(
                'href',
                `/es/auth/signin?returnUrl=${encodeURIComponent(returnUrl)}`
            );
        });

        it('should not include returnUrl in register href', () => {
            const returnUrl = '/accommodations/123';
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    returnUrl={returnUrl}
                />
            );
            const registerLink = screen.getByText('Crear cuenta');
            expect(registerLink).toHaveAttribute('href', '/es/auth/signup');
            expect(registerLink.getAttribute('href')).not.toContain('returnUrl');
        });

        it('should have correct login href with Portuguese locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="pt"
                />
            );
            const loginLink = screen.getAllByText('Entrar')[0];
            expect(loginLink).toHaveAttribute('href', '/pt/auth/signin?returnUrl=');
        });

        it('should have correct register href with Portuguese locale', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="pt"
                />
            );
            const registerLink = screen.getByText('Criar conta');
            expect(registerLink).toHaveAttribute('href', '/pt/auth/signup');
        });
    });

    describe('ARIA attributes', () => {
        it('should have role="dialog"', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toBeInTheDocument();
        });

        it('should have aria-label in Spanish by default', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            // aria-label comes from t('auth.authRequired') in the common namespace
            expect(popover?.getAttribute('aria-label')).toBeTruthy();
        });

        it('should have aria-label in English when locale is en', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="en"
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveAttribute('aria-label', 'Authentication required');
        });

        it('should have aria-label in Portuguese when locale is pt', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    locale="pt"
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            // aria-label comes from t('auth.authRequired') in the common namespace
            expect(popover?.getAttribute('aria-label')).toBeTruthy();
        });

        it('should have aria-hidden on arrow element', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const arrow = container.querySelector('[aria-hidden="true"]');
            expect(arrow).toBeInTheDocument();
        });
    });

    describe('Keyboard interaction', () => {
        it('should call onClose when Escape key is pressed', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={handleClose}
                />
            );

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when other keys are pressed', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={handleClose}
                />
            );

            fireEvent.keyDown(document, { key: 'Enter' });
            fireEvent.keyDown(document, { key: 'Space' });
            fireEvent.keyDown(document, { key: 'Tab' });

            expect(handleClose).not.toHaveBeenCalled();
        });
    });

    describe('Click outside interaction', () => {
        it('should call onClose when clicking outside the popover', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={handleClose}
                />
            );

            // Click outside the popover
            fireEvent.mouseDown(document.body);

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when clicking inside the popover', () => {
            const handleClose = vi.fn();
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={handleClose}
                />
            );

            const popover = container.querySelector('[role="dialog"]');
            if (popover) {
                fireEvent.mouseDown(popover);
            }

            expect(handleClose).not.toHaveBeenCalled();
        });

        it('should not call onClose when clicking on message text', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test message"
                    onClose={handleClose}
                />
            );

            const messageText = screen.getByText('Test message');
            fireEvent.mouseDown(messageText);

            expect(handleClose).not.toHaveBeenCalled();
        });

        it('should not call onClose when clicking on links', () => {
            const handleClose = vi.fn();
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={handleClose}
                />
            );

            const loginLink = screen.getByText('Iniciar sesión');
            const registerLink = screen.getByText('Crear cuenta');

            fireEvent.mouseDown(loginLink);
            fireEvent.mouseDown(registerLink);

            expect(handleClose).not.toHaveBeenCalled();
        });
    });

    describe('Styling', () => {
        it('should have card styling with shadow and rounded corners via Tailwind classes', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            // Component uses Tailwind classes for styling
            expect(popover).toHaveClass('rounded-xl');
            expect(popover).toHaveClass('border');
            expect(popover).toHaveClass('border-primary-100');
        });

        it('should have shadow class on popover container', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            // Shadow is applied via Tailwind class
            expect(popover).toHaveClass('shadow-lg');
        });

        it('should have Tailwind base classes on the outer div', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveClass('relative');
            expect(popover).toHaveClass('overflow-hidden');
            expect(popover).toHaveClass('bg-surface');
        });

        it('should have transition classes on login link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            // Component uses Tailwind classes for transitions
            expect(loginLink).toHaveClass('transition-all');
        });

        it('should have transition classes on register link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const registerLink = screen.getByText('Crear cuenta');
            // Component uses Tailwind classes for transitions
            expect(registerLink).toHaveClass('transition-all');
        });
    });

    describe('className forwarding', () => {
        it('should append custom className to base Tailwind classes on outer div', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    className="custom-test-class"
                />
            );
            // className is applied to the outer div which also has role="dialog"
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveClass('custom-test-class');
            expect(popover).toHaveClass('relative');
        });

        it('should handle empty className gracefully', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    className=""
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            // With empty className, .trim() prevents double spaces
            expect(popover?.className).not.toContain('  '); // No double spaces
        });
    });
});
