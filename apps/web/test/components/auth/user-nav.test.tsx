import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserNav } from '../../../src/components/auth/UserNav.client';
import type { UserNavProps } from '../../../src/components/auth/UserNav.client';

describe('UserNav.client.tsx', () => {
    const mockUser: UserNavProps['user'] = {
        name: 'John Doe',
        email: 'john@example.com',
        avatarUrl: 'https://example.com/avatar.jpg'
    };

    const mockUserNoAvatar: UserNavProps['user'] = {
        name: 'Jane Smith',
        email: 'jane@example.com'
    };

    describe('Props', () => {
        it('should accept user prop with avatarUrl', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const avatar = container.querySelector('img[src="https://example.com/avatar.jpg"]');
            expect(avatar).toBeInTheDocument();
            expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        });

        it('should accept user prop without avatarUrl', () => {
            render(<UserNav user={mockUserNoAvatar} />);
            const initialsElement = screen.getByText('JS');
            expect(initialsElement).toBeInTheDocument();
        });

        it('should accept locale prop', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="en"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);
            expect(screen.getByText('My Account')).toBeInTheDocument();
        });

        it('should default to es locale when locale is not provided', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);
            expect(screen.getByText('Mi Cuenta')).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            const { container } = render(
                <UserNav
                    user={mockUser}
                    className="custom-class"
                />
            );
            const wrapper = container.querySelector('.custom-class');
            expect(wrapper).toBeInTheDocument();
        });
    });

    describe('Rendering', () => {
        it('should render user name in trigger button', () => {
            render(<UserNav user={mockUser} />);
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });

        it('should render avatar image when avatarUrl is provided', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const avatar = container.querySelector('img[src="https://example.com/avatar.jpg"]');
            expect(avatar).toBeInTheDocument();
            expect(avatar).toHaveAttribute('alt', '');
            expect(avatar).toHaveClass('h-8', 'w-8', 'rounded-full', 'object-cover');
        });

        it('should render initials circle when avatarUrl is not provided', () => {
            render(<UserNav user={mockUserNoAvatar} />);
            const initialsElement = screen.getByText('JS');
            expect(initialsElement).toBeInTheDocument();
            expect(initialsElement).toHaveClass('bg-primary', 'text-white', 'rounded-full');
        });

        it('should render chevron icon in trigger button', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const chevron = container.querySelector('svg[viewBox="0 0 24 24"]');
            expect(chevron).toBeInTheDocument();
            expect(chevron).toHaveAttribute('aria-hidden', 'true');
        });

        it('should not render dropdown menu by default', () => {
            render(<UserNav user={mockUser} />);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    describe('Dropdown Menu', () => {
        it('should open dropdown menu on trigger button click', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);
            expect(screen.getByRole('menu', { name: 'User menu' })).toBeInTheDocument();
        });

        it('should close dropdown menu on second trigger button click', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });

            fireEvent.click(button);
            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.click(button);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('should display user name and email in menu header', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const allNameElements = screen.getAllByText('John Doe');
            expect(allNameElements.length).toBeGreaterThan(0);
            expect(screen.getByText('john@example.com')).toBeInTheDocument();
        });

        it('should render all menu items with correct text (es)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="es"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            expect(screen.getByRole('menuitem', { name: 'Mi Cuenta' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Favoritos' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Mis Reseñas' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Preferencias' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument();
        });

        it('should render all menu items with correct text (en)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="en"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Favorites' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'My Reviews' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Preferences' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Sign Out' })).toBeInTheDocument();
        });

        it('should render all menu items with correct text (pt)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="pt"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            expect(screen.getByRole('menuitem', { name: 'Minha Conta' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Favoritos' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Minhas Avaliações' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Preferências' })).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Sair' })).toBeInTheDocument();
        });

        it('should render separator between menu items and sign out', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menu = screen.getByRole('menu');
            const separator = menu.querySelector('hr');
            expect(separator).toBeInTheDocument();
        });
    });

    describe('Menu Links', () => {
        it('should have correct href for My Account link (es)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="es"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const link = screen.getByRole('menuitem', { name: 'Mi Cuenta' });
            expect(link).toHaveAttribute('href', '/es/mi-cuenta/');
        });

        it('should have correct href for Favorites link (en)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="en"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const link = screen.getByRole('menuitem', { name: 'Favorites' });
            expect(link).toHaveAttribute('href', '/en/mi-cuenta/favoritos/');
        });

        it('should have correct href for My Reviews link (pt)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="pt"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const link = screen.getByRole('menuitem', { name: 'Minhas Avaliações' });
            expect(link).toHaveAttribute('href', '/pt/mi-cuenta/resenas/');
        });

        it('should have correct href for Preferences link (es)', () => {
            render(
                <UserNav
                    user={mockUser}
                    locale="es"
                />
            );
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const link = screen.getByRole('menuitem', { name: 'Preferencias' });
            expect(link).toHaveAttribute('href', '/es/mi-cuenta/preferencias/');
        });
    });

    describe('Sign Out Button', () => {
        it('should render sign out button as button element', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const signOutButton = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
            expect(signOutButton.tagName).toBe('BUTTON');
            expect(signOutButton).toHaveAttribute('type', 'button');
        });

        it('should handle sign out click without errors', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const signOutButton = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
            expect(() => fireEvent.click(signOutButton)).not.toThrow();
        });

        it('should close menu after sign out is clicked', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const signOutButton = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
            fireEvent.click(signOutButton);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-expanded="false" when menu is closed', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            expect(button).toHaveAttribute('aria-expanded', 'false');
        });

        it('should have aria-expanded="true" when menu is open', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);
            expect(button).toHaveAttribute('aria-expanded', 'true');
        });

        it('should have aria-haspopup="menu" on trigger button', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            expect(button).toHaveAttribute('aria-haspopup', 'menu');
        });

        it('should have aria-label on trigger button', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: 'User menu for John Doe' });
            expect(button).toBeInTheDocument();
        });

        it('should have role="menu" on dropdown', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menu = screen.getByRole('menu');
            expect(menu).toBeInTheDocument();
            expect(menu).toHaveAttribute('aria-label', 'User menu');
        });

        it('should have role="menuitem" on all menu links', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menuItems = screen.getAllByRole('menuitem');
            expect(menuItems.length).toBe(5); // 4 links + 1 sign out button
        });

        it('should have aria-hidden="true" on avatar image', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const avatar = container.querySelector('img[src="https://example.com/avatar.jpg"]');
            expect(avatar).toHaveAttribute('aria-hidden', 'true');
        });

        it('should have aria-hidden="true" on initials circle', () => {
            const { container } = render(<UserNav user={mockUserNoAvatar} />);
            const initialsCircle = container.querySelector('.bg-primary.text-white.rounded-full');
            expect(initialsCircle).toHaveAttribute('aria-hidden', 'true');
        });

        it('should have aria-hidden="true" on chevron icon', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const chevron = container.querySelector('svg[viewBox="0 0 24 24"]');
            expect(chevron).toHaveAttribute('aria-hidden', 'true');
        });

        it('should have focus-visible styles on trigger button', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            expect(button.className).toContain('focus-visible:outline');
        });
    });

    describe('Keyboard Interaction', () => {
        it('should close menu on Escape key press', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('should return focus to trigger button after closing with Escape', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(document.activeElement).toBe(button);
        });

        it('should not close menu on other key presses', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            fireEvent.keyDown(document, { key: 'Enter' });
            expect(screen.getByRole('menu')).toBeInTheDocument();

            fireEvent.keyDown(document, { key: 'Tab' });
            expect(screen.getByRole('menu')).toBeInTheDocument();
        });
    });

    describe('Click Outside', () => {
        it('should close menu when clicking outside', () => {
            render(
                <div>
                    <UserNav user={mockUser} />
                    <div data-testid="outside">Outside element</div>
                </div>
            );

            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);
            expect(screen.getByRole('menu')).toBeInTheDocument();

            const outsideElement = screen.getByTestId('outside');
            fireEvent.mouseDown(outsideElement);

            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        it('should not close menu when clicking inside menu', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menu = screen.getByRole('menu');
            fireEvent.mouseDown(menu);

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });

        it('should not close menu when clicking trigger button again (toggle)', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            fireEvent.mouseDown(button);

            expect(screen.getByRole('menu')).toBeInTheDocument();
        });
    });

    describe('User Initials', () => {
        it('should display correct initials for single word name', () => {
            const singleNameUser = { name: 'Madonna', email: 'madonna@example.com' };
            render(<UserNav user={singleNameUser} />);
            expect(screen.getByText('M')).toBeInTheDocument();
        });

        it('should display correct initials for two word name', () => {
            const twoNameUser = { name: 'John Doe', email: 'john@example.com' };
            render(<UserNav user={twoNameUser} />);
            expect(screen.getByText('JD')).toBeInTheDocument();
        });

        it('should display correct initials for three word name', () => {
            const threeNameUser = { name: 'John Michael Doe', email: 'john@example.com' };
            render(<UserNav user={threeNameUser} />);
            expect(screen.getByText('JD')).toBeInTheDocument();
        });

        it('should display initials in uppercase', () => {
            const lowercaseUser = { name: 'john doe', email: 'john@example.com' };
            render(<UserNav user={lowercaseUser} />);
            expect(screen.getByText('JD')).toBeInTheDocument();
        });

        it('should handle empty name gracefully', () => {
            const emptyNameUser = { name: '', email: 'test@example.com' };
            const { container } = render(<UserNav user={emptyNameUser} />);
            const initialsCircle = container.querySelector('.bg-primary.text-white.rounded-full');
            expect(initialsCircle?.textContent).toBe('');
        });

        it('should handle name with extra whitespace', () => {
            const spacedUser = { name: '  John   Doe  ', email: 'john@example.com' };
            render(<UserNav user={spacedUser} />);
            expect(screen.getByText('JD')).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('should apply correct styles to trigger button', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            expect(button.className).toContain('rounded-lg');
            expect(button.className).toContain('hover:bg-gray-100');
            expect(button.className).toContain('transition-colors');
        });

        it('should apply correct styles to dropdown menu', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menu = screen.getByRole('menu');
            expect(menu.className).toContain('rounded-lg');
            expect(menu.className).toContain('border');
            expect(menu.className).toContain('shadow-lg');
            expect(menu.className).toContain('bg-white');
        });

        it('should rotate chevron icon when menu is open', () => {
            const { container } = render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });

            const chevronBefore = container.querySelector('svg[viewBox="0 0 24 24"]');
            const classNameBefore = chevronBefore?.getAttribute('class') || '';
            expect(classNameBefore).not.toContain('rotate-180');

            fireEvent.click(button);

            const chevronAfter = container.querySelector('svg[viewBox="0 0 24 24"]');
            const classNameAfter = chevronAfter?.getAttribute('class') || '';
            expect(classNameAfter).toContain('rotate-180');
        });

        it('should apply hover styles to menu items', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const menuItem = screen.getByRole('menuitem', { name: 'Mi Cuenta' });
            expect(menuItem.className).toContain('hover:bg-gray-100');
            expect(menuItem.className).toContain('transition-colors');
        });

        it('should apply distinct style to sign out button', () => {
            render(<UserNav user={mockUser} />);
            const button = screen.getByRole('button', { name: /user menu/i });
            fireEvent.click(button);

            const signOutButton = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
            expect(signOutButton.className).toContain('text-red-600');
            expect(signOutButton.className).toContain('hover:bg-red-50');
        });
    });

    describe('Responsive Design', () => {
        it('should hide user name on small screens', () => {
            render(<UserNav user={mockUser} />);
            const nameElement = screen.getByText('John Doe');
            expect(nameElement.className).toContain('hidden');
            expect(nameElement.className).toContain('sm:inline');
        });
    });
});
