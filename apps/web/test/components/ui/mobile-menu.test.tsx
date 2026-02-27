import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NavItem } from '../../../src/components/ui/MobileMenu.client';
import { MobileMenu } from '../../../src/components/ui/MobileMenu.client';

// Mock HTMLDialogElement methods (not supported in jsdom)
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
});

const mockNavItems: ReadonlyArray<NavItem> = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' }
] as const;

describe('MobileMenu.client.tsx', () => {
    describe('Props', () => {
        it('should accept navItems prop', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Home')).toBeInTheDocument();
            expect(screen.getByText('About')).toBeInTheDocument();
            expect(screen.getByText('Contact')).toBeInTheDocument();
        });

        it('should accept locale prop (Spanish)', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="es"
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
        });

        it('should accept locale prop (English)', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Sign in')).toBeInTheDocument();
            expect(screen.getByText('Sign up')).toBeInTheDocument();
        });

        it('should default locale to Spanish', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
        });

        it('should accept user prop', () => {
            const user = { name: 'John Doe', email: 'john@example.com' };
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    user={user}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('john@example.com')).toBeInTheDocument();
        });

        it('should accept open prop', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
            expect(dialog).toBeInTheDocument();
        });

        it('should accept onClose callback', () => {
            const handleClose = vi.fn();
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={handleClose}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            fireEvent.click(closeButton);

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should accept className prop', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                    className="custom-menu"
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog).toHaveClass('custom-menu');
        });
    });

    describe('Rendering', () => {
        it('should render dialog element', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should render menu title', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const title = screen.getByText('Menu');
            expect(title).toBeInTheDocument();
            expect(title.tagName).toBe('H2');
        });

        it('should render close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton).toBeInTheDocument();
            expect(closeButton.tagName).toBe('BUTTON');
        });

        it('should render close icon SVG', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            const svg = closeButton.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('should render navigation links with correct hrefs', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const homeLink = screen.getByText('Home').closest('a');
            const aboutLink = screen.getByText('About').closest('a');
            const contactLink = screen.getByText('Contact').closest('a');

            expect(homeLink).toHaveAttribute('href', '/');
            expect(aboutLink).toHaveAttribute('href', '/about');
            expect(contactLink).toHaveAttribute('href', '/contact');
        });

        it('should render navigation as list', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const navList = container.querySelector('nav ul');
            expect(navList).toBeInTheDocument();
            expect(navList?.children).toHaveLength(3);
        });

        it('should render auth section when no user', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
        });

        it('should render user info when user provided', () => {
            const user = { name: 'Jane Smith', email: 'jane@example.com' };
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    user={user}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            expect(screen.getByText('jane@example.com')).toBeInTheDocument();
            expect(screen.queryByText('Iniciar sesión')).not.toBeInTheDocument();
            expect(screen.queryByText('Registrarse')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-modal="true"', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should have aria-labelledby pointing to title', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            const title = screen.getByText('Menu');

            expect(dialog).toHaveAttribute('aria-labelledby', 'mobile-menu-title');
            expect(title).toHaveAttribute('id', 'mobile-menu-title');
        });

        it('should have aria-label on close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton).toHaveAttribute('aria-label', 'Close menu');
        });

        it('should have aria-hidden on close icon SVG', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            const svg = closeButton.querySelector('svg');
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should have aria-label on navigation', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const nav = container.querySelector('nav');
            expect(nav).toHaveAttribute('aria-label', 'Mobile navigation');
        });

        it('should have focus-visible styles on close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on navigation links', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const homeLink = screen.getByText('Home').closest('a');
            expect(homeLink?.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on auth links', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const signInLink = screen.getByText('Iniciar sesión').closest('a');
            const signUpLink = screen.getByText('Registrarse').closest('a');

            expect(signInLink?.className).toContain('focus-visible:outline');
            expect(signUpLink?.className).toContain('focus-visible:outline');
        });
    });

    describe('Interaction', () => {
        it('should call onClose when close button is clicked', () => {
            const handleClose = vi.fn();
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={handleClose}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            fireEvent.click(closeButton);

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose on Escape key (cancel event)', () => {
            const handleClose = vi.fn();
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={handleClose}
                />
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
            }

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should call showModal when open prop is true', () => {
            vi.clearAllMocks();
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        });

        it('should call close when open prop changes to false', () => {
            vi.clearAllMocks();
            const { rerender, container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                // Simulate dialog being open
                Object.defineProperty(dialog, 'open', {
                    value: true,
                    writable: true,
                    configurable: true
                });
            }

            rerender(
                <MobileMenu
                    navItems={mockNavItems}
                    open={false}
                    onClose={() => {}}
                />
            );

            expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        });
    });

    describe('Styling', () => {
        it('should have slide-in animation classes', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('translate-x-full');
            expect(dialog?.className).toContain('open:translate-x-0');
            expect(dialog?.className).toContain('transition-transform');
        });

        it('should have fixed positioning on right side', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('fixed');
            expect(dialog?.className).toContain('right-0');
            expect(dialog?.className).toContain('top-0');
        });

        it('should have full height', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('h-screen');
        });

        it('should have width constraint', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('w-80');
            expect(dialog?.className).toContain('max-w-[85vw]');
        });

        it('should have border on left side', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('border-l');
        });

        it('should have shadow', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('shadow-2xl');
        });

        it('should have backdrop blur', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('backdrop:backdrop-blur-sm');
            expect(dialog?.className).toContain('backdrop:bg-black/50');
        });

        it('should have hover styles on navigation links', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const homeLink = screen.getByText('Home').closest('a');
            expect(homeLink?.className).toContain('hover:bg-bg-secondary');
        });

        it('should have transition on navigation links', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const homeLink = screen.getByText('Home').closest('a');
            expect(homeLink?.className).toContain('transition-colors');
        });

        it('should have hover styles on close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton.className).toContain('hover:bg-bg-secondary');
        });

        it('should have transition on close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton.className).toContain('transition-colors');
        });
    });

    describe('Button attributes', () => {
        it('should have type="button" on close button', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton).toHaveAttribute('type', 'button');
        });

        it('should not be disabled by default', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const closeButton = screen.getByLabelText('Close menu');
            expect(closeButton).not.toBeDisabled();
        });
    });

    describe('Layout', () => {
        it('should have flex column layout', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const mainContainer = container.querySelector('.flex.flex-col.h-full');
            expect(mainContainer).toBeInTheDocument();
        });

        it('should have border between header and content', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const header = container.querySelector('.border-b');
            expect(header).toBeInTheDocument();
        });

        it('should have border between navigation and auth section', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const authSection = container.querySelector('.border-t');
            expect(authSection).toBeInTheDocument();
        });

        it('should have scrollable navigation area', () => {
            const { container } = render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const nav = container.querySelector('nav');
            expect(nav?.className).toContain('overflow-y-auto');
            expect(nav?.className).toContain('flex-grow');
        });
    });

    describe('Locale switching', () => {
        it('should display Spanish auth links by default', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const signInLink = screen.getByText('Iniciar sesión').closest('a');
            const signUpLink = screen.getByText('Registrarse').closest('a');

            expect(signInLink).toHaveAttribute('href', '/es/auth/signin/');
            expect(signUpLink).toHaveAttribute('href', '/es/auth/signup/');
        });

        it('should display English auth links when locale is en', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    locale="en"
                    open={true}
                    onClose={() => {}}
                />
            );

            const signInLink = screen.getByText('Sign in').closest('a');
            const signUpLink = screen.getByText('Sign up').closest('a');

            expect(signInLink).toHaveAttribute('href', '/en/auth/signin/');
            expect(signUpLink).toHaveAttribute('href', '/en/auth/signup/');
        });
    });

    describe('Auth section', () => {
        it('should show login and register links when no user', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
            expect(screen.getByText('Registrarse')).toBeInTheDocument();
        });

        it('should show user name and email when user provided', () => {
            const user = { name: 'Alice Johnson', email: 'alice@example.com' };
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    user={user}
                    open={true}
                    onClose={() => {}}
                />
            );

            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('alice@example.com')).toBeInTheDocument();
            expect(screen.queryByText('Iniciar sesión')).not.toBeInTheDocument();
        });

        it('should have correct auth link hrefs', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const signInLink = screen.getByText('Iniciar sesión').closest('a');
            const signUpLink = screen.getByText('Registrarse').closest('a');

            expect(signInLink).toHaveAttribute('href', '/es/auth/signin/');
            expect(signUpLink).toHaveAttribute('href', '/es/auth/signup/');
        });

        it('should style sign up button differently (primary)', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const signUpLink = screen.getByText('Registrarse').closest('a');
            expect(signUpLink?.className).toContain('bg-primary');
            expect(signUpLink?.className).toContain('text-white');
        });

        it('should style sign in button with secondary background', () => {
            render(
                <MobileMenu
                    navItems={mockNavItems}
                    open={true}
                    onClose={() => {}}
                />
            );

            const signInLink = screen.getByText('Iniciar sesión').closest('a');
            expect(signInLink?.className).toContain('bg-bg-secondary');
        });
    });
});
