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
            expect(screen.getByText('Sign up')).toBeInTheDocument();
        });

        it('should default locale to es', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
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
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveClass('custom-class');
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
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
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
            expect(screen.getByText('Sign up')).toBeInTheDocument();
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
            expect(arrow?.className).toContain('rotate-45');
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
            const registerLink = screen.getByText('Registrarse');
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
            const registerLink = screen.getByText('Sign up');
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
            const registerLink = screen.getByText('Registrarse');
            expect(registerLink).toHaveAttribute('href', '/es/auth/signup');
            expect(registerLink.getAttribute('href')).not.toContain('returnUrl');
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
            expect(popover).toHaveAttribute('aria-label', 'Autenticación requerida');
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
            const registerLink = screen.getByText('Registrarse');

            fireEvent.mouseDown(loginLink);
            fireEvent.mouseDown(registerLink);

            expect(handleClose).not.toHaveBeenCalled();
        });
    });

    describe('Styling', () => {
        it('should have card styling with shadow and rounded corners', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover?.className).toContain('rounded-lg');
            expect(popover?.className).toContain('shadow-lg');
            expect(popover?.className).toContain('border');
        });

        it('should have padding on popover container', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover?.className).toContain('p-4');
        });

        it('should have focus-visible styles on login link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            expect(loginLink.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on register link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const registerLink = screen.getByText('Registrarse');
            expect(registerLink.className).toContain('focus-visible:outline');
        });

        it('should have transition styles on login link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const loginLink = screen.getByText('Iniciar sesión');
            expect(loginLink.className).toContain('transition-colors');
        });

        it('should have transition styles on register link', () => {
            render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                />
            );
            const registerLink = screen.getByText('Registrarse');
            expect(registerLink.className).toContain('transition-colors');
        });
    });

    describe('className forwarding', () => {
        it('should append custom className to existing classes', () => {
            const { container } = render(
                <AuthRequiredPopover
                    message="Test"
                    onClose={vi.fn()}
                    className="custom-test-class"
                />
            );
            const popover = container.querySelector('[role="dialog"]');
            expect(popover).toHaveClass('custom-test-class');
            expect(popover).toHaveClass('rounded-lg');
            expect(popover).toHaveClass('shadow-lg');
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
            expect(popover?.className).not.toContain('  '); // No double spaces
        });
    });
});
