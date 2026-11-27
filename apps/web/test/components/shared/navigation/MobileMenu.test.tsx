import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenu } from '../../../../src/components/shared/navigation/MobileMenu.client';

vi.mock('../../../../src/hooks/use-account-permissions', () => ({
    useAccountPermissions: () => ({ user: null, permissions: [] })
}));
vi.mock('../../../../src/components/shared/preferences/LanguageSwitcher.client', () => ({
    LanguageSwitcher: () => <span>Language</span>
}));
vi.mock('../../../../src/components/shared/preferences/ThemeControl.client', () => ({
    ThemeControl: () => <span>Theme</span>
}));
vi.mock('astro:transitions/client', () => ({ navigate: vi.fn() }));

function setup() {
    render(
        <MobileMenu
            locale="es"
            navItems={[{ label: 'Destinations', href: '/es/destinos/' }]}
            currentPath="/es/"
            logoSrc="/logo.webp"
            homeHref="/es/"
            initialUser={null}
            initialRoles={[]}
        />
    );
    act(() => window.dispatchEvent(new CustomEvent('mobile-menu:toggle')));
}

describe('MobileMenu site navigation', () => {
    it('focuses the shared kit close control and closes on click', () => {
        setup();
        const close = screen.getByRole('button', { name: 'Cerrar menú de navegación' });
        expect(close).toHaveClass('quiet', 'sm', 'iconOnly');
        expect(close.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
        expect(close).toHaveFocus();
        fireEvent.click(close);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('renders site links, guest sign-in and guest preferences', () => {
        setup();
        expect(screen.getByRole('link', { name: 'Destinations' })).toHaveAttribute(
            'href',
            '/es/destinos/'
        );
        expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
            'href',
            '/es/auth/signin/'
        );
        expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
            'href',
            '/es/auth/signup/'
        );
        expect(screen.getByText('Language')).toBeInTheDocument();
        expect(screen.getByText('Theme')).toBeInTheDocument();
    });
    it('closes on Escape and releases the scroll lock', () => {
        setup();
        expect(document.documentElement.style.overflow).toBe('hidden');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.documentElement).not.toHaveAttribute('data-mobile-menu-open');
    });
    it('stacks full-width primary and secondary auth actions with 44px targets', () => {
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/navigation/MobileMenu.module.css'
            ),
            'utf8'
        );
        setup();

        const signIn = screen.getByRole('link', { name: 'Iniciar sesión' });
        const signUp = screen.getByRole('link', { name: 'Crear cuenta' });
        expect(signIn).not.toHaveClass('btn-gradient--primary');
        expect(signIn.className).toMatch(/authSignIn/);
        expect(signUp).toHaveClass('btn-gradient--outline-primary');
        expect(signIn.parentElement).toBe(signUp.parentElement);
        expect(signIn.parentElement?.className).toMatch(/authActions/);
        const actions = css.match(/\.authActions\s*\{([^}]*)}/)?.[1];
        expect(actions).toContain('display: flex;');
        expect(actions).toContain('flex-direction: column;');
        expect(actions).toContain('gap: var(--space-2);');
        const links = css.match(/\.authActions\s*>\s*a\s*\{([^}]*)}/)?.[1];
        expect(links).toContain('width: 100%;');
        expect(links).toContain('min-block-size: 2.75rem;');
    });
    it('closes on page swap', () => {
        setup();
        act(() => document.dispatchEvent(new Event('astro:before-swap')));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('keeps publishing and account footer directly after the site list, with a scrollable overlay', () => {
        const css = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/navigation/MobileMenu.module.css'
            ),
            'utf8'
        );
        expect(css.match(/\.nav\s*\{[^}]*\}/)?.[0]).not.toMatch(/flex:\s*1/);
        expect(css.match(/\.overlay\s*\{[^}]*\}/)?.[0]).toContain('overflow-y: auto');
    });
    it('does not restore the removed global search CTA or duplicate account navigation', () => {
        const source = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/navigation/MobileMenu.client.tsx'
            ),
            'utf8'
        );
        expect(source).not.toMatch(
            /SearchIcon|goToSearch|styles\.searchLink|getCuratedAccountNav|buildAdminPanelItem/
        );
        expect(source).toContain('useNavigationDialog');
    });
});
