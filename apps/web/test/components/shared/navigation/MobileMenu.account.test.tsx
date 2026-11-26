import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileMenuAccountSection } from '../../../../src/components/shared/navigation/MobileMenuAccountSection.client';
import { createTranslations } from '../../../../src/lib/i18n';
import { signOutFromNavigation } from '../../../../src/lib/navigation/sign-out';

vi.mock('../../../../src/lib/navigation/sign-out', () => ({ signOutFromNavigation: vi.fn() }));

describe('mobile account shortcuts (D05)', () => {
    it('renders the desktop shortcuts and signs out after closing the drawer', () => {
        const { t } = createTranslations('es');
        const actions: (() => void)[] = [];
        render(
            <MobileMenuAccountSection
                locale="es"
                t={t}
                isOpen
                user={{ name: 'Turista VIP (auditoría)', email: 'test@example.test' }}
                permissions={[]}
                closeThen={({ afterClose }) => actions.push(afterClose)}
                onLinkClick={vi.fn()}
            />
        );

        const signOut = screen.getByRole('button', { name: 'Cerrar sesión' });
        fireEvent.click(signOut);

        expect(screen.getByRole('link', { name: /mi cuenta turista vip/i })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/'
        );
        expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/favoritos/'
        );
        expect(screen.getByRole('link', { name: 'Suscripción' })).toHaveAttribute(
            'href',
            '/es/mi-cuenta/suscripcion/'
        );
        expect(screen.getByText('TV')).toBeInTheDocument();
        expect(screen.queryByText(/auditoría/i)).toBeNull();
        expect(signOutFromNavigation).not.toHaveBeenCalled();
        actions[0]?.();
        expect(signOutFromNavigation).toHaveBeenCalledWith({ locale: 'es' });

        const css = readFileSync(
            resolve(
                __dirname,
                '../../../../src/components/shared/navigation/MobileMenu.module.css'
            ),
            'utf8'
        );
        expect(signOut.className).toMatch(/signOutButton/);
        const button = css.match(/\.signOutButton\s*\{([^}]*)}/)?.[1];
        expect(button).toContain('width: 100%;');
        expect(button).toContain('min-block-size: 2.75rem;');
        expect(button).toMatch(/background: (?:none|transparent);/);
        expect(button).toContain('border: none;');
        expect(button).toContain('cursor: pointer;');

        for (const name of ['Favoritos', 'Editar perfil', 'Suscripción']) {
            expect(screen.getByRole('link', { name }).className).toMatch(/accountLink/);
        }
        const quickLink = css.match(/\.accountLink\s*\{([^}]*)}/)?.[1];
        expect(quickLink).toContain('min-block-size: 2.75rem;');
    });
});
